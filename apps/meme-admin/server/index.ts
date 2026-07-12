import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { AdminSettings, BatchConfig, GroupConfig, JobRecord, ResultFile } from "../shared/types.js";
import { createBatch, defaultGroup, exportCompatibilityFiles, organizeGroup, readCompatibilityFile, scanImages } from "./batches.js";
import { findProjectRoot, isInside, safeSlug } from "./paths.js";
import { JobRunner } from "./runner.js";
import { Storage } from "./storage.js";

const execFileAsync = promisify(execFile);
const projectRoot = await findProjectRoot();
const storage = new Storage(projectRoot);
await storage.init();
const runner = new JobRunner(storage, projectRoot);
await runner.init();
const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });

function fail(message: string, statusCode = 400): never { const error: any = new Error(message); error.statusCode = statusCode; throw error; }
async function requireBatch(id: string) { const batch = await storage.getBatch(id); if (!batch) fail("批次不存在", 404); return batch!; }
function requireGroup(batch: BatchConfig, id: string) { const group = batch.groups.find((item) => item.id === id); if (!group) fail("分组不存在", 404); return group; }
function touch(batch: BatchConfig) { batch.updatedAt = new Date().toISOString(); }

async function allowedPath(target: string): Promise<boolean> {
  for (const batch of await storage.listBatches()) if (isInside(batch.sourceFolder, target) || isInside(batch.outputFolder, target)) return true;
  return isInside(path.join(projectRoot, "artifacts", "meme-template-analyzer"), target);
}

app.get("/api/health", async () => ({ ok: true, projectRoot }));
app.get("/api/settings", () => storage.getSettings());
app.put<{ Body: AdminSettings }>("/api/settings", async (request) => {
  const concurrency = Number(request.body?.concurrency);
  if (![1, 2, 3].includes(concurrency)) fail("并发数只能为 1、2 或 3");
  const settings = { concurrency: concurrency as 1 | 2 | 3 };
  await storage.saveSettings(settings); runner.setConcurrency(settings.concurrency); return settings;
});

app.post("/api/system/pick-directory", async () => {
  if (process.platform !== "win32") fail("当前只支持在 Windows 上打开目录选择器");
  const script = "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; if($d.ShowDialog() -eq 'OK'){[Console]::Write($d.SelectedPath)}";
  const { stdout } = await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-STA", "-Command", script], { windowsHide: false });
  return { path: stdout.trim() };
});

app.post<{ Body: { path: string } }>("/api/system/open-folder", async (request) => {
  const target = path.resolve(request.body?.path ?? "");
  if (!await allowedPath(target)) fail("不允许打开配置范围之外的路径", 403);
  await access(target); await execFileAsync("explorer.exe", [target]); return { ok: true };
});

app.get("/api/batches", () => storage.listBatches());
app.post<{ Body: { name: string; sourceFolder: string } }>("/api/batches", async (request) => {
  const sourceFolder = path.resolve(request.body?.sourceFolder ?? "");
  const images = await scanImages(sourceFolder);
  const batch = createBatch(projectRoot, request.body?.name || path.basename(sourceFolder), sourceFolder, images);
  await storage.saveBatch(batch); await exportCompatibilityFiles(batch); return batch;
});
app.post<{ Body: { path: string } }>("/api/batches/import", async (request) => {
  const batch = await readCompatibilityFile(path.resolve(request.body?.path ?? ""), projectRoot);
  await storage.saveBatch(batch); await exportCompatibilityFiles(batch); return batch;
});
app.post<{ Params: { id: string } }>("/api/batches/:id/rescan", async (request) => {
  const batch = await requireBatch(request.params.id); const previous = new Map(batch.images.map((item) => [item.sourcePath, item]));
  batch.images = (await scanImages(batch.sourceFolder)).map((image) => ({ ...image, groupId: previous.get(image.sourcePath)?.groupId }));
  for (const group of batch.groups) group.imageIds = group.imageIds.filter((id) => batch.images.some((image) => image.id === id));
  touch(batch); await storage.saveBatch(batch); await exportCompatibilityFiles(batch); return batch;
});
app.put<{ Params: { id: string }; Body: BatchConfig }>("/api/batches/:id", async (request) => {
  if (request.body.id !== request.params.id) fail("批次 ID 不匹配");
  request.body.outputFolder = path.resolve(request.body.outputFolder);
  if (!isInside(path.join(projectRoot, "artifacts", "meme-template-analyzer"), request.body.outputFolder)) fail("输出目录必须位于 artifacts/meme-template-analyzer 内");
  touch(request.body); await storage.saveBatch(request.body); await exportCompatibilityFiles(request.body); return request.body;
});
app.post<{ Params: { id: string }; Body: { name: string } }>("/api/batches/:id/groups", async (request) => {
  const batch = await requireBatch(request.params.id); const group = defaultGroup(request.body?.name || `group-${batch.groups.length + 1}`, batch.defaults);
  if (batch.groups.some((item) => item.groupName === group.groupName)) fail("分组目录名已存在");
  batch.groups.push(group); touch(batch); await storage.saveBatch(batch); await exportCompatibilityFiles(batch); return batch;
});
app.put<{ Params: { id: string; groupId: string }; Body: GroupConfig }>("/api/batches/:id/groups/:groupId", async (request) => {
  const batch = await requireBatch(request.params.id); const index = batch.groups.findIndex((item) => item.id === request.params.groupId);
  if (index < 0) fail("分组不存在", 404); safeSlug(request.body.groupName);
  if (batch.groups.some((item, i) => i !== index && item.groupName === request.body.groupName)) fail("分组目录名已存在");
  request.body.id = request.params.groupId; request.body.imageIds = batch.groups[index].imageIds; batch.groups[index] = request.body;
  touch(batch); await storage.saveBatch(batch); await exportCompatibilityFiles(batch); return batch;
});
app.delete<{ Params: { id: string; groupId: string } }>("/api/batches/:id/groups/:groupId", async (request) => {
  const batch = await requireBatch(request.params.id); requireGroup(batch, request.params.groupId);
  batch.groups = batch.groups.filter((item) => item.id !== request.params.groupId);
  batch.images.forEach((image) => { if (image.groupId === request.params.groupId) image.groupId = undefined; });
  touch(batch); await storage.saveBatch(batch); await exportCompatibilityFiles(batch); return batch;
});
app.post<{ Params: { id: string }; Body: { groupId?: string; imageIds: string[] } }>("/api/batches/:id/assign", async (request) => {
  const batch = await requireBatch(request.params.id); const group = request.body.groupId ? requireGroup(batch, request.body.groupId) : undefined;
  const selected = new Set(request.body.imageIds ?? []);
  for (const image of batch.images) if (selected.has(image.id)) image.groupId = group?.id;
  for (const item of batch.groups) item.imageIds = batch.images.filter((image) => image.groupId === item.id).map((image) => image.id);
  touch(batch); await storage.saveBatch(batch); await exportCompatibilityFiles(batch); return batch;
});
app.post<{ Params: { id: string; groupId: string } }>("/api/batches/:id/groups/:groupId/organize", async (request) => {
  const batch = await requireBatch(request.params.id); const group = requireGroup(batch, request.params.groupId);
  const files = await organizeGroup(batch, group); await exportCompatibilityFiles(batch); return { files };
});

app.get("/api/jobs", () => storage.listJobs());
app.post<{ Body: { batchId: string; groupId: string } }>("/api/jobs", async (request) => {
  const batch = await requireBatch(request.body.batchId); const group = requireGroup(batch, request.body.groupId);
  if (group.status === "skipped") fail("已跳过的分组不能创建任务");
  if (!group.imageIds.length) fail("分组没有图片");
  const duplicate = (await storage.listJobs()).some((job) => job.batchId === batch.id && job.groupId === group.id && (job.status === "queued" || job.status === "running"));
  if (duplicate) fail("该分组已有排队或运行中的任务");
  const id = randomUUID(); const resultDirectory = path.join(batch.outputFolder, "groups", safeSlug(group.groupName), "result");
  const job: JobRecord = { id, batchId: batch.id, groupId: group.id, groupName: group.groupName, status: "queued", phase: "preparing", createdAt: new Date().toISOString(), resultDirectory, lastEvent: "等待执行", validatorResults: [] };
  await storage.saveJob(job); runner.enqueue(id); return job;
});
app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", (request) => runner.cancel(request.params.id));
app.post<{ Params: { id: string } }>("/api/jobs/:id/retry", async (request) => {
  const source = await storage.getJob(request.params.id); if (!source) fail("任务不存在", 404);
  if (!["failed", "cancelled", "interrupted"].includes(source.status)) fail("只有失败、取消或中断任务可以重试");
  const job: JobRecord = { ...source, id: randomUUID(), status: "queued", phase: "preparing", pid: undefined, createdAt: new Date().toISOString(), startedAt: undefined, finishedAt: undefined, lastEvent: "等待重试", error: undefined, retryOf: source.id, validatorResults: [] };
  await storage.saveJob(job); runner.enqueue(job.id); return job;
});
app.get<{ Params: { id: string } }>("/api/jobs/:id/events", async (request, reply) => {
  const job = await storage.getJob(request.params.id); if (!job) fail("任务不存在", 404);
  reply.hijack(); reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  reply.raw.write(`data: ${JSON.stringify({ event: null, job })}\n\n`);
  const listener = (id: string, event: unknown, current: JobRecord) => { if (id === request.params.id) reply.raw.write(`data: ${JSON.stringify({ event, job: current })}\n\n`); };
  runner.on("job-event", listener); const heartbeat = setInterval(() => reply.raw.write(": heartbeat\n\n"), 15000);
  request.raw.on("close", () => { clearInterval(heartbeat); runner.off("job-event", listener); });
});

async function resultFiles(root: string): Promise<ResultFile[]> {
  const files: ResultFile[] = [];
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name); if (entry.isDirectory()) await walk(absolutePath); else {
        const ext = path.extname(entry.name).toLowerCase(); const kind = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? "image" : ext === ".json" ? "json" : ext === ".md" ? "markdown" : "other";
        files.push({ name: entry.name, relativePath: path.relative(root, absolutePath).replaceAll("\\", "/"), absolutePath, kind, url: kind === "image" ? `/api/files?path=${encodeURIComponent(absolutePath)}` : undefined });
      }
    }
  }
  try { if ((await stat(root)).isDirectory()) await walk(root); } catch { return []; }
  return files;
}
app.get<{ Params: { id: string } }>("/api/jobs/:id/files", async (request) => { const job = await storage.getJob(request.params.id); if (!job) fail("任务不存在", 404); return resultFiles(job.resultDirectory); });
app.get<{ Querystring: { path: string } }>("/api/files", async (request, reply) => {
  const target = path.resolve(request.query.path ?? ""); if (!await allowedPath(target)) fail("不允许读取配置范围之外的文件", 403);
  const ext = path.extname(target).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return reply.type(ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg").send(await import("node:fs").then(({ createReadStream }) => createReadStream(target)));
  if (![".json", ".md", ".txt"].includes(ext)) fail("不支持读取该文件类型", 415);
  return reply.type(ext === ".json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8").send(await import("node:fs/promises").then(({ readFile }) => readFile(target, "utf8")));
});

const clientRoot = path.join(projectRoot, "apps", "meme-admin", "dist", "client");
try {
  await access(clientRoot); await app.register(fastifyStatic, { root: clientRoot, wildcard: false });
  app.setNotFoundHandler((request, reply) => request.url.startsWith("/api/") ? reply.code(404).send({ message: "API 不存在" }) : reply.sendFile("index.html"));
} catch { /* Vite dev server serves the client */ }

app.setErrorHandler((error: any, _request, reply) => reply.code(error.statusCode ?? 500).send({ message: error.message ?? "服务器错误" }));
await app.listen({ host: "127.0.0.1", port: Number(process.env.MEME_ADMIN_PORT ?? 14174) });
