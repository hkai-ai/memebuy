import { randomUUID } from "node:crypto";
import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { classifyImageAsset } from "../shared/assets.js";
import type { AdminSettings, BatchConfig, JobRecord, TagCatalog } from "../shared/types.js";
import { forEachConcurrent, sha256File } from "./file-utils.js";
import { ensureDir } from "./paths.js";
import { defaultTagCatalog, withDefaultTags } from "./tag-catalog.js";

export class Storage {
  readonly root: string;
  private readonly batchesDir: string;
  private readonly jobsDir: string;

  constructor(projectRoot: string) {
    this.root = path.join(projectRoot, ".meme-admin");
    this.batchesDir = path.join(this.root, "batches");
    this.jobsDir = path.join(this.root, "jobs");
  }

  async init() {
    await Promise.all([ensureDir(this.batchesDir), ensureDir(this.jobsDir), ensureDir(path.join(this.root, "logs"))]);
    const storedCatalog = await this.readJson<TagCatalog>(path.join(this.root, "tag-catalog.json"));
    await this.saveTagCatalog(storedCatalog ?? defaultTagCatalog());
    const validTagIds = new Set((await this.getTagCatalog()).tags.map((tag) => tag.id));
    for (const batch of await this.listBatches()) {
      let changed = false;
      for (const group of batch.groups) {
        const migratedTagIds = [...new Set([...(group.tagIds ?? []), ...(group.operatorTagIds ?? []), ...(group.templateTagIds ?? [])])].filter((id) => validTagIds.has(id));
        if (JSON.stringify(group.tagIds ?? []) !== JSON.stringify(migratedTagIds)) { group.tagIds = migratedTagIds; changed = true; }
        if (group.operatorTagIds !== undefined) { delete group.operatorTagIds; changed = true; }
        if (group.templateTagIds !== undefined) { delete group.templateTagIds; changed = true; }
        if (typeof group.uploadSourceImages !== "boolean") { group.uploadSourceImages = false; changed = true; }
      }
      await forEachConcurrent(batch.images, 4, async (image) => {
        if (!image.origin) { image.origin = classifyImageAsset(image.relativePath, image.fileName); changed = true; }
        if (!image.modifiedAt || image.fileSize === undefined) {
          try { const fileStat = await stat(image.sourcePath); image.modifiedAt = fileStat.mtime.toISOString(); image.fileSize = fileStat.size; changed = true; } catch { /* Keep missing legacy files readable. */ }
        }
        if (!image.contentSha256) {
          try { image.contentSha256 = await sha256File(image.sourcePath); changed = true; } catch { /* Keep missing legacy files readable. */ }
        }
      });
      if (changed) await this.saveBatch(batch);
    }
    for (const job of await this.listJobs()) {
      if (job.status === "running") {
        job.status = "interrupted";
        job.finishedAt = new Date().toISOString();
        job.lastEvent = "服务重启，原任务已中断";
        await this.saveJob(job);
      }
    }
  }

  private async atomicJson(filePath: string, value: unknown) {
    await ensureDir(path.dirname(filePath));
    const temp = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, filePath);
  }

  private async readJson<T>(filePath: string): Promise<T | undefined> {
    try { return JSON.parse(await readFile(filePath, "utf8")) as T; }
    catch (error: any) { if (error?.code === "ENOENT") return undefined; throw error; }
  }

  async listBatches(): Promise<BatchConfig[]> {
    const names = await readdir(this.batchesDir);
    const values = await Promise.all(names.filter((name) => name.endsWith(".json")).map((name) => this.readJson<BatchConfig>(path.join(this.batchesDir, name))));
    return values.filter(Boolean).sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt)) as BatchConfig[];
  }
  getBatch(id: string) { return this.readJson<BatchConfig>(path.join(this.batchesDir, `${id}.json`)); }
  saveBatch(batch: BatchConfig) { return this.atomicJson(path.join(this.batchesDir, `${batch.id}.json`), batch); }

  async listJobs(): Promise<JobRecord[]> {
    const names = await readdir(this.jobsDir);
    const values = await Promise.all(names.filter((name) => name.endsWith(".json")).map((name) => this.readJson<JobRecord>(path.join(this.jobsDir, name))));
    return values.filter(Boolean).sort((a, b) => b!.createdAt.localeCompare(a!.createdAt)) as JobRecord[];
  }
  getJob(id: string) { return this.readJson<JobRecord>(path.join(this.jobsDir, `${id}.json`)); }
  saveJob(job: JobRecord) { return this.atomicJson(path.join(this.jobsDir, `${job.id}.json`), job); }
  logPath(id: string) { return path.join(this.root, "logs", `${id}.jsonl`); }

  async getSettings(): Promise<AdminSettings> {
    return (await this.readJson<AdminSettings>(path.join(this.root, "settings.json"))) ?? { concurrency: 1 };
  }
  saveSettings(settings: AdminSettings) { return this.atomicJson(path.join(this.root, "settings.json"), settings); }

  async getTagCatalog(): Promise<TagCatalog> {
    return withDefaultTags((await this.readJson<TagCatalog>(path.join(this.root, "tag-catalog.json"))) ?? defaultTagCatalog());
  }
  saveTagCatalog(catalog: unknown) { return this.atomicJson(path.join(this.root, "tag-catalog.json"), withDefaultTags(catalog)); }
  async snapshotTagCatalog(outputFolder: string): Promise<string> {
    const file = path.join(outputFolder, "tag-catalog.snapshot.json");
    await this.atomicJson(file, await this.getTagCatalog());
    return file;
  }
}
