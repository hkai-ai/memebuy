import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { OssAssetFieldStatus, OssAssetState, OssJobAssetStatus, OssTemplateAssetStatus } from "../shared/types.js";
import { findMemeTemplateFiles } from "./template-tags.js";

const IMAGE_FIELDS = ["cover", "referenceImage"] as const;
const MIME = new Map([
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".webp", "image/webp"], [".gif", "image/gif"], [".avif", "image/avif"],
]);
const SOURCE_NAMES = new Set(["source.png", "source.jpg", "source.jpeg", "source.webp", "source.gif", "source.avif"]);
const OSS_OBJECT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpe?g|webp|gif|avif)$/i;

export interface OssConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint: string;
  domain: string;
  prefix: string;
}

export interface OssAssetDependencies {
  headObject(key: string): Promise<boolean>;
  putObject(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  validateLocal(file: string, config: OssConfig): Promise<void>;
  validateRemote(file: string, config: OssConfig): Promise<void>;
}

function normalizeHost(value: string | undefined, label: string): string {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!raw || raw.includes("://") || /[/?#@]/.test(raw)) throw new Error(`${label} 必须是纯 hostname`);
  return raw;
}

function normalizePrefix(value: string | undefined): string {
  const cleaned = String(value ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!cleaned) return "";
  if (cleaned.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("ALIYUN_OSS_KEY_PREFIX 包含非法路径片段");
  return `${cleaned}/`;
}

export function loadOssConfig(env: NodeJS.ProcessEnv = process.env): OssConfig {
  const required = ["ALIYUN_OSS_ACCESS_KEY_ID", "ALIYUN_OSS_ACCESS_KEY_SECRET", "ALIYUN_OSS_ASSETS_BUCKET", "ALIYUN_OSS_ASSETS_ENDPOINT", "ALIYUN_OSS_ASSETS_DOMAIN"];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`缺少 OSS 环境变量：${missing.join(", ")}`);
  return {
    accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID!.trim(),
    accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET!.trim(),
    bucket: env.ALIYUN_OSS_ASSETS_BUCKET!.trim(),
    endpoint: normalizeHost(env.ALIYUN_OSS_ASSETS_ENDPOINT, "ALIYUN_OSS_ASSETS_ENDPOINT"),
    domain: normalizeHost(env.ALIYUN_OSS_ASSETS_DOMAIN, "ALIYUN_OSS_ASSETS_DOMAIN"),
    prefix: normalizePrefix(env.ALIYUN_OSS_KEY_PREFIX),
  };
}

export function loadProjectEnv(projectRoot: string) {
  const required = ["ALIYUN_OSS_ACCESS_KEY_ID", "ALIYUN_OSS_ACCESS_KEY_SECRET", "ALIYUN_OSS_ASSETS_BUCKET", "ALIYUN_OSS_ASSETS_ENDPOINT", "ALIYUN_OSS_ASSETS_DOMAIN"];
  if (required.every((name) => process.env[name]?.trim())) return;
  try { process.loadEnvFile(path.join(projectRoot, ".env")); }
  catch (error: any) { if (error?.code !== "ENOENT") throw error; }
}

function managedKey(value: string, config: OssConfig): string | undefined {
  try {
    const url = new URL(value);
    const expected = `/${config.prefix}gallery/templates/`;
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== config.domain || url.port || url.search || url.hash || !url.pathname.startsWith(expected) || !OSS_OBJECT_RE.test(url.pathname.slice(expected.length))) return undefined;
    return url.pathname.slice(1);
  } catch { return undefined; }
}

async function exists(file: string) { try { await access(file); return true; } catch { return false; } }

function aggregate(states: OssAssetState[]): OssAssetState {
  if (!states.length || states.includes("invalid")) return "invalid";
  if (states.includes("config_missing")) return "config_missing";
  if (states.includes("object_missing")) return "object_missing";
  if (states.includes("local_missing")) return "local_missing";
  if (states.includes("partial") || (states.includes("uploaded") && states.includes("not_uploaded"))) return "partial";
  if (states.every((state) => state === "uploaded")) return "uploaded";
  return "not_uploaded";
}

export async function inspectTemplateAssets(templateFile: string, config: OssConfig, dependencies: Pick<OssAssetDependencies, "headObject">): Promise<OssTemplateAssetStatus> {
  try {
    const data = JSON.parse(await readFile(templateFile, "utf8")) as Record<string, unknown>;
    const fields: OssAssetFieldStatus[] = [];
    for (const field of IMAGE_FIELDS) {
      const value = data[field];
      if (value === undefined || value === null || value === "") continue;
      if (typeof value !== "string") { fields.push({ field, state: "invalid", message: `${field} 必须是字符串` }); continue; }
      const key = managedKey(value, config);
      if (key) {
        const present = await dependencies.headObject(key);
        fields.push({ field, value, state: present ? "uploaded" : "object_missing", ...(!present ? { message: "JSON 已有 URL，但 OSS 对象不存在" } : {}) });
      } else if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        fields.push({ field, value, state: "invalid", message: "不是当前 assets 域名下的受控 URL" });
      } else {
        const local = path.resolve(path.dirname(templateFile), value);
        const present = await exists(local);
        fields.push({ field, value, state: present ? "not_uploaded" : "local_missing", ...(!present ? { message: "本地原图不存在" } : {}) });
      }
    }
    const state = aggregate(fields.map((item) => item.state));
    return { templateFile, templateKey: typeof data.key === "string" ? data.key : undefined, state, fields, ...(!fields.length ? { message: "模板没有可检查的原图字段" } : {}) };
  } catch (error: any) {
    return { templateFile, state: "invalid", fields: [], message: error?.message ?? String(error) };
  }
}

export async function inspectJobAssets(jobId: string, resultDirectory: string, config: OssConfig, dependencies: Pick<OssAssetDependencies, "headObject">): Promise<OssJobAssetStatus> {
  const files = await findMemeTemplateFiles(resultDirectory);
  const templates = await Promise.all(files.map((file) => inspectTemplateAssets(file, config, dependencies)));
  return {
    jobId,
    state: aggregate(templates.map((item) => item.state)),
    templates,
    checkedAt: new Date().toISOString(),
    ...(!files.length ? { message: "结果目录中没有 meme-template.json" } : {}),
  };
}

async function fallbackSource(templateFile: string): Promise<string | undefined> {
  const entries = await readdir(path.dirname(templateFile), { withFileTypes: true });
  const matches = entries.filter((entry) => entry.isFile() && SOURCE_NAMES.has(entry.name.toLowerCase())).map((entry) => path.join(path.dirname(templateFile), entry.name));
  return matches.length === 1 ? matches[0] : undefined;
}

async function atomicValidatedJson(file: string, value: unknown, config: OssConfig, validateRemote: OssAssetDependencies["validateRemote"]) {
  const pending = `${file}.${randomUUID()}.pending.json`;
  const writeTemp = `${pending}.${randomUUID()}.tmp`;
  await writeFile(writeTemp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(writeTemp, pending);
  try { await validateRemote(pending, config); await rename(pending, file); }
  catch (error) { await rm(pending, { force: true }); throw error; }
}

export async function retryTemplateAssets(templateFile: string, config: OssConfig, dependencies: OssAssetDependencies): Promise<{ uploaded: number; reused: number; writtenBack: number }> {
  await dependencies.validateLocal(templateFile, config);
  const initial = JSON.parse(await readFile(templateFile, "utf8")) as Record<string, unknown>;
  const finalData = structuredClone(initial);
  const uploadedByDigest = new Map<string, string>();
  let uploaded = 0; let reused = 0;
  for (const field of IMAGE_FIELDS) {
    const value = initial[field];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") throw new Error(`${field} 必须是字符串：${templateFile}`);
    const currentKey = managedKey(value, config);
    if (currentKey && await dependencies.headObject(currentKey)) { reused += 1; continue; }
    let source: string | undefined;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      const local = path.resolve(path.dirname(templateFile), value);
      if (await exists(local)) source = local;
    }
    source ??= await fallbackSource(templateFile);
    if (!source) throw new Error(`${field} 找不到可重新上传的本地 source image：${templateFile}`);
    const ext = path.extname(source).toLowerCase(); const contentType = MIME.get(ext);
    if (!contentType) throw new Error(`${field} 使用了不支持的图片类型：${source}`);
    const body = await readFile(source); const digest = createHash("sha256").update(body).digest("hex");
    const cached = uploadedByDigest.get(digest);
    if (cached) { finalData[field] = cached; reused += 1; continue; }
    const key = `${config.prefix}gallery/templates/${randomUUID()}${ext}`;
    await dependencies.putObject({ key, body, contentType });
    if (!await dependencies.headObject(key)) throw new Error(`OSS 上传后对象检查失败：${key}`);
    const url = `https://${config.domain}/${key}`;
    uploadedByDigest.set(digest, url); finalData[field] = url; uploaded += 1;
  }
  const latest = JSON.parse(await readFile(templateFile, "utf8")) as Record<string, unknown>;
  for (const field of IMAGE_FIELDS) {
    if (latest[field] !== initial[field] && latest[field] !== finalData[field]) throw new Error(`${field} 在上传期间已被修改，未覆盖源模板：${templateFile}`);
    if (finalData[field] !== undefined) latest[field] = finalData[field];
  }
  await atomicValidatedJson(templateFile, latest, config, dependencies.validateRemote);
  return { uploaded, reused, writtenBack: 1 };
}

function collectProcess(command: string, args: string[], cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); }); child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => resolve({ code: 1, output: error.message })); child.on("close", (code) => resolve({ code: code ?? 1, output: output.trim() }));
  });
}

export async function validateGalleryTemplate(projectRoot: string, file: string, mode: "either" | "remote", config?: Pick<OssConfig, "domain" | "prefix">) {
  const validator = path.join(projectRoot, "skills", "meme-template-analyzer", "scripts", "validate_gallery_template.py");
  const args = [validator, "--asset-mode", mode];
  if (config) args.push("--assets-domain", config.domain, "--key-prefix", config.prefix);
  args.push(file);
  const result = await collectProcess("python", args, projectRoot);
  if (result.code !== 0 || !result.output.includes("PASS")) throw new Error(`模板 ${mode} validator 失败：${result.output}`);
}

export async function createOssDependencies(projectRoot: string, config: OssConfig): Promise<OssAssetDependencies> {
  const { default: OSS } = await import("ali-oss");
  const client = new OSS({ accessKeyId: config.accessKeyId, accessKeySecret: config.accessKeySecret, bucket: config.bucket, endpoint: `https://${config.endpoint}`, secure: true });
  return {
    async headObject(key) {
      try { const result = await client.head(key); return result?.res?.status === 200; }
      catch (error: any) { if (error?.status === 404 || error?.code === "NoSuchKey") return false; throw error; }
    },
    async putObject({ key, body, contentType }) {
      const result = await client.put(key, body, { headers: { "Content-Type": contentType } });
      if (result?.res?.status !== 200) throw new Error(`OSS 上传未返回成功状态：${key}`);
    },
    async validateLocal(file, current) {
      await validateGalleryTemplate(projectRoot, file, "either", current);
    },
    async validateRemote(file, current) {
      await validateGalleryTemplate(projectRoot, file, "remote", current);
    },
  };
}

export async function ensureOssContext(projectRoot: string) {
  loadProjectEnv(projectRoot);
  const config = loadOssConfig();
  return { config, dependencies: await createOssDependencies(projectRoot, config) };
}
