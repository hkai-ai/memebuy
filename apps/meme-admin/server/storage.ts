import { randomUUID } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AdminSettings, BatchConfig, JobRecord } from "../shared/types.js";
import { ensureDir } from "./paths.js";

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
}
