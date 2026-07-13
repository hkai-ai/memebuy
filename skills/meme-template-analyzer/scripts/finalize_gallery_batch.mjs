#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const VALIDATOR = path.join(SCRIPT_DIR, "validate_gallery_template.py");
const IMAGE_FIELDS = ["cover", "referenceImage"];
const MIME = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".avif", "image/avif"],
]);
const KEY_RE = /^[a-z][a-z0-9-]{1,59}$/;
const OSS_OBJECT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpe?g|webp|gif|avif)$/i;

function fail(message) {
  throw new Error(message);
}

export function normalizeHost(value, label) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!raw || raw.includes("://") || /[/?#@]/.test(raw)) fail(`${label} 必须是纯 hostname`);
  const parsed = new URL(`https://${raw}`);
  if (parsed.hostname !== raw || parsed.port) fail(`${label} 必须是纯 hostname`);
  return raw;
}

export function normalizePrefix(value) {
  const cleaned = String(value ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!cleaned) return "";
  if (cleaned.split("/").some((part) => !part || part === "." || part === "..")) {
    fail("ALIYUN_OSS_KEY_PREFIX 包含非法路径片段");
  }
  return `${cleaned}/`;
}

export function loadOssConfig(env = process.env) {
  const required = [
    "ALIYUN_OSS_ACCESS_KEY_ID",
    "ALIYUN_OSS_ACCESS_KEY_SECRET",
    "ALIYUN_OSS_ASSETS_BUCKET",
    "ALIYUN_OSS_ASSETS_ENDPOINT",
    "ALIYUN_OSS_ASSETS_DOMAIN",
  ];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) fail(`缺少 OSS 环境变量：${missing.join(", ")}`);
  return {
    accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID.trim(),
    accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET.trim(),
    bucket: String(env.ALIYUN_OSS_ASSETS_BUCKET).trim(),
    endpoint: normalizeHost(env.ALIYUN_OSS_ASSETS_ENDPOINT, "ALIYUN_OSS_ASSETS_ENDPOINT"),
    domain: normalizeHost(env.ALIYUN_OSS_ASSETS_DOMAIN, "ALIYUN_OSS_ASSETS_DOMAIN"),
    prefix: normalizePrefix(env.ALIYUN_OSS_KEY_PREFIX),
  };
}

export function isManagedRemoteUrl(value, config) {
  try {
    const url = new URL(value);
    const expectedPrefix = `/${config.prefix}gallery/templates/`;
    return url.protocol === "https:"
      && url.hostname.toLowerCase() === config.domain
      && !url.port
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && url.pathname.startsWith(expectedPrefix)
      && OSS_OBJECT_RE.test(url.pathname.slice(expectedPrefix.length));
  } catch {
    return false;
  }
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, file);
}

async function collectTemplateFiles(target) {
  const resolved = path.resolve(target);
  const found = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name === "meme-template.json") found.push(absolute);
    }
  }
  const stats = await import("node:fs/promises").then(({ stat }) => stat(resolved));
  if (stats.isFile()) {
    if (path.basename(resolved) !== "meme-template.json") fail(`输入文件必须名为 meme-template.json：${resolved}`);
    return [resolved];
  }
  if (!stats.isDirectory()) fail(`输入路径不是文件或目录：${resolved}`);
  await walk(resolved);
  return found.sort((a, b) => a.localeCompare(b));
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, output: output.trim() }));
  });
}

async function defaultValidate(file, mode, config) {
  const result = await runProcess("python", [
    VALIDATOR,
    "--asset-mode", mode,
    "--assets-domain", config.domain,
    "--key-prefix", config.prefix,
    file,
  ], process.cwd());
  if (result.code !== 0 || !result.output.includes("PASS")) {
    fail(`模板校验失败：${file}\n${result.output}`);
  }
}

async function createDefaultUploader(config) {
  const { default: OSS } = await import("ali-oss");
  const client = new OSS({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    endpoint: `https://${config.endpoint}`,
    secure: true,
  });
  return async ({ key, body, contentType }) => {
    const result = await client.put(key, body, { headers: { "Content-Type": contentType } });
    if (result?.res?.status !== 200) fail(`OSS 上传未返回成功状态：${key}`);
    const head = await client.head(key);
    if (head?.res?.status !== 200) fail(`OSS 上传后对象检查失败：${key}`);
  };
}

function stateFileFor(outputDir) {
  return path.join(path.dirname(outputDir), `.${path.basename(outputDir)}.upload-state.json`);
}

async function readState(file, config) {
  if (!await exists(file)) return { version: 1, domain: config.domain, prefix: config.prefix, uploads: {}, templates: {} };
  const state = JSON.parse(await readFile(file, "utf8"));
  if (state.version !== 1 || state.domain !== config.domain || state.prefix !== config.prefix) {
    fail(`上传恢复记录与当前 OSS 配置不一致：${file}`);
  }
  state.uploads ??= {};
  state.templates ??= {};
  return state;
}

async function validateExistingOutput(outputDir, keys) {
  if (!await exists(outputDir)) return;
  const entries = await readdir(outputDir, { withFileTypes: true });
  const unexpected = entries.filter((entry) => {
    if (!entry.isFile() || path.extname(entry.name) !== ".json") return true;
    return !keys.has(path.basename(entry.name, ".json"));
  });
  if (unexpected.length) {
    fail(`交付目录包含本批次之外的文件，请更换空目录：${unexpected.map((entry) => entry.name).join(", ")}`);
  }
}

async function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function writeBackTemplate(template, finalData, validateFile, config) {
  const latest = JSON.parse(await readFile(template.file, "utf8"));
  for (const field of IMAGE_FIELDS) {
    if (latest[field] !== template.data[field] && latest[field] !== finalData[field]) {
      fail(`${field} 在上传期间已被修改，未覆盖源模板：${template.file}`);
    }
    if (finalData[field] !== undefined) latest[field] = finalData[field];
  }
  const pending = `${template.file}.${randomUUID()}.pending.json`;
  await atomicJson(pending, latest);
  try {
    await validateFile(pending, "remote", config);
    await rename(pending, template.file);
  } catch (error) {
    await import("node:fs/promises").then(({ rm }) => rm(pending, { force: true }));
    throw error;
  }
}

function resolveLocalAsset(templateFile, field, value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return undefined;
  const resolved = path.resolve(path.dirname(templateFile), value);
  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME.get(ext);
  if (!contentType) fail(`${field} 使用了不支持的图片类型：${value}`);
  return { resolved, ext, contentType };
}

export async function finalizeGalleryBatch(options) {
  const input = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const progressFile = options.progressFile ? path.resolve(options.progressFile) : undefined;
  const config = options.config ?? loadOssConfig();
  const validateFile = options.validateFile ?? defaultValidate;
  const files = await collectTemplateFiles(input);
  if (!files.length) fail(`未找到 meme-template.json：${input}`);
  const progress = async (value) => {
    const snapshot = { status: "running", totalTemplates: files.length, updatedAt: new Date().toISOString(), ...value };
    if (progressFile) await atomicJson(progressFile, snapshot);
    if (options.onProgress) await options.onProgress(snapshot);
  };
  await progress({ phase: "preflight", completedTemplates: 0, uploaded: 0, reused: 0 });

  const templates = [];
  const keys = new Set();
  for (const file of files) {
    await validateFile(file, "either", config);
    const data = JSON.parse(await readFile(file, "utf8"));
    if (!KEY_RE.test(data.key ?? "")) fail(`模板 key 非法：${file}`);
    if (keys.has(data.key)) fail(`批次内模板 key 重复：${data.key}`);
    keys.add(data.key);
    for (const field of IMAGE_FIELDS) {
      const value = data[field];
      if (typeof value !== "string" || !value) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !isManagedRemoteUrl(value, config)) {
        fail(`${field} 不是当前 assets 域名下的合法 HTTPS URL：${file}`);
      }
      const local = resolveLocalAsset(file, field, value);
      if (local && !await exists(local.resolved)) fail(`${field} 本地文件不存在：${local.resolved}`);
    }
    templates.push({ file, data });
  }

  const stateFile = options.stateFile ? path.resolve(options.stateFile) : stateFileFor(outputDir);
  const state = await readState(stateFile, config);
  await validateExistingOutput(outputDir, keys);
  const uploadObject = options.uploadObject ?? await createDefaultUploader(config);
  await mkdir(outputDir, { recursive: true });
  let uploaded = 0;
  let reused = 0;
  let writtenBack = 0;
  let completedTemplates = 0;
  await progress({ phase: "uploading", completedTemplates, uploaded, reused });

  for (const template of templates) {
    const finalData = structuredClone(template.data);
    for (const field of IMAGE_FIELDS) {
      const value = finalData[field];
      if (typeof value !== "string" || !value) continue;
      if (isManagedRemoteUrl(value, config)) { reused += 1; continue; }
      const local = resolveLocalAsset(template.file, field, value);
      if (!local) fail(`${field} 不是可上传的本地路径：${template.file}`);
      const body = await readFile(local.resolved);
      const digest = await sha256(body);
      const cached = state.uploads[digest];
      if (cached?.url && isManagedRemoteUrl(cached.url, config)) {
        finalData[field] = cached.url;
        reused += 1;
        continue;
      }
      const key = `${config.prefix}gallery/templates/${randomUUID()}${local.ext}`;
      await uploadObject({ key, body, contentType: local.contentType, sourcePath: local.resolved });
      const url = `https://${config.domain}/${key}`;
      state.uploads[digest] = { key, url, size: body.length, contentType: local.contentType, uploadedAt: new Date().toISOString() };
      await atomicJson(stateFile, state);
      finalData[field] = url;
      uploaded += 1;
      await progress({ phase: "uploading", completedTemplates, currentTemplate: finalData.key, currentField: field, uploaded, reused });
    }

    const outputFile = path.join(outputDir, `${finalData.key}.json`);
    const temporary = `${outputFile}.${randomUUID()}.pending.json`;
    await atomicJson(temporary, finalData);
    try {
      await validateFile(temporary, "remote", config);
      await rename(temporary, outputFile);
    } catch (error) {
      await import("node:fs/promises").then(({ rm }) => rm(temporary, { force: true }));
      throw error;
    }
    state.templates[finalData.key] = { source: template.file, output: outputFile, finalizedAt: new Date().toISOString() };
    await atomicJson(stateFile, state);
    if (options.writeBack) {
      await progress({ phase: "writing_back", completedTemplates, currentTemplate: finalData.key, uploaded, reused });
      await writeBackTemplate(template, finalData, validateFile, config);
      writtenBack += 1;
    }
    completedTemplates += 1;
    await progress({ phase: "uploading", completedTemplates, currentTemplate: finalData.key, uploaded, reused });
  }

  if (progressFile) await atomicJson(progressFile, { status: "completed", phase: "completed", totalTemplates: files.length, completedTemplates, uploaded, reused, writtenBack, updatedAt: new Date().toISOString() });
  return { input, output: outputDir, stateFile, progressFile, templates: templates.length, uploaded, reused, writtenBack };
}

function parseArgs(argv) {
  let input = "";
  let output = "";
  let stateFile;
  let progressFile;
  let writeBack = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--output") output = argv[++index] ?? "";
    else if (value === "--state-file") stateFile = argv[++index];
    else if (value === "--progress-file") progressFile = argv[++index];
    else if (value === "--write-back") writeBack = true;
    else if (value.startsWith("--")) fail(`未知参数：${value}`);
    else if (!input) input = value;
    else fail(`多余参数：${value}`);
  }
  if (!input || !output) fail("用法：gallery:finalize <input> --output <output-dir> [--state-file <file>] [--progress-file <file>] [--write-back]");
  return { input, output, stateFile, progressFile, writeBack };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  finalizeGalleryBatch(options)
    .then((summary) => console.log(JSON.stringify({ ok: true, ...summary }, null, 2)))
    .catch(async (error) => {
      if (options.progressFile) await atomicJson(path.resolve(options.progressFile), { status: "failed", phase: "failed", error: error?.message ?? String(error), updatedAt: new Date().toISOString() }).catch(() => undefined);
      console.error(error?.message ?? String(error));
      process.exitCode = 1;
    });
}
