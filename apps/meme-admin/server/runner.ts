import { EventEmitter } from "node:events";
import { appendFile, readFile, readdir, rm, stat } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { BatchConfig, GroupConfig, JobEvent, JobRecord, JobStatus, TagCatalog, ValidatorResult } from "../shared/types.js";
import { organizeGroup, exportCompatibilityFiles } from "./batches.js";
import { ensureDir, safeSlug } from "./paths.js";
import { Storage } from "./storage.js";
import { selectedTags } from "./tag-catalog.js";

function now() { return new Date().toISOString(); }

async function collectOutput(command: string, args: string[], cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout?.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => resolve({ code: 1, output: error.message }));
    child.on("close", (code) => resolve({ code: code ?? 1, output: output.trim() }));
  });
}

async function findFiles(root: string, name: string): Promise<string[]> {
  const found: string[] = [];
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) found.push(...await findFiles(absolute, name));
      else if (entry.isFile() && entry.name === name) found.push(absolute);
    }
  } catch { return found; }
  return found;
}

export class JobRunner extends EventEmitter {
  private queue: string[] = [];
  private running = new Map<string, ChildProcess>();
  private updateTails = new Map<string, Promise<void>>();
  private concurrency = 1;

  constructor(private storage: Storage, private projectRoot: string) { super(); }

  async init() {
    this.concurrency = (await this.storage.getSettings()).concurrency;
    const queued = (await this.storage.listJobs()).filter((job) => job.status === "queued").map((job) => job.id);
    this.queue.push(...queued);
    this.pump();
  }

  setConcurrency(value: 1 | 2 | 3) { this.concurrency = value; this.pump(); }
  enqueue(id: string) { if (!this.queue.includes(id)) this.queue.push(id); this.pump(); }

  private async update(job: JobRecord, summary: string, type: JobEvent["type"] = "status", detail?: unknown) {
    const previous = this.updateTails.get(job.id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      job.lastEvent = summary;
      await this.storage.saveJob(job);
      const event: JobEvent = { at: now(), type, phase: job.phase, summary, detail };
      await appendFile(this.storage.logPath(job.id), `${JSON.stringify(event)}\n`, "utf8");
      this.emit("job-event", job.id, event, job);
    });
    this.updateTails.set(job.id, next);
    await next;
  }

  private async flush(id: string) { await this.updateTails.get(id)?.catch(() => undefined); }

  private pump() {
    while (this.running.size < this.concurrency && this.queue.length) {
      const id = this.queue.shift()!;
      void this.run(id);
    }
  }

  async cancel(id: string): Promise<JobRecord> {
    const job = await this.storage.getJob(id);
    if (!job) throw new Error("任务不存在");
    if (job.status === "queued") {
      this.queue = this.queue.filter((item) => item !== id);
      job.status = "cancelled"; job.finishedAt = now();
      await this.update(job, "任务已从队列取消");
      return job;
    }
    const child = this.running.get(id);
    if (child?.pid) {
      if (process.platform === "win32") await collectOutput("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], this.projectRoot);
      else child.kill("SIGTERM");
    }
    job.status = "cancelled"; job.finishedAt = now();
    await this.update(job, "任务已取消");
    return job;
  }

  private commandAndArgs(args: string[]): { command: string; args: string[] } {
    if (process.env.CODEX_BIN) return { command: process.env.CODEX_BIN, args };
    if (process.platform === "win32") {
      const script = path.join(process.env.APPDATA ?? "", "npm", "codex.ps1");
      return { command: "powershell.exe", args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, ...args] };
    }
    return { command: "codex", args };
  }

  private buildPrompt(batch: BatchConfig, group: GroupConfig, resultDir: string, catalog: TagCatalog, catalogSnapshot: string): string {
    const mode = group.generationMode === "generation_test" ? "批量分析并执行真实生成测试" : "批量分析并生成可入库模板，不生成真实图片";
    const ossInstruction = group.uploadSourceImages
      ? `用户已明确授权上传 source image。所有本地 validator 通过后，必须读取 oss-handoff.md，并执行 pnpm gallery:finalize "${resultDir}" --output "${path.join(resultDir, ".oss-handoff")}" --progress-file "${path.join(resultDir, ".oss-progress.json")}" --write-back；PUT、HEAD 或 remote validator 任一步失败都不得伪造成功。`
      : "本任务未授权 OSS 写入；只生成本地路径版 meme-template.json，不得上传或回写远程 URL。";
    const lockedTags = selectedTags(catalog, group.tagIds ?? []).map((tag) => ({ tagId: tag.id, label: tag.label, dimension: "manual", level: "tag", source: "operator", status: "accepted" }));
    return [
      `使用仓库内 ${path.join(this.projectRoot, "skills", "meme-template-analyzer", "SKILL.md")} 执行任务。`,
      "必须读取仓库内 skill 及其所需 references，禁止使用同名全局 skill。",
      `任务模式：${mode}。`,
      `输入目录：${path.join(batch.outputFolder, "groups", safeSlug(group.groupName), "input")}。`,
      `唯一结果目录：${resultDir}。只在此目录写本任务产物，不修改仓库代码。`,
      `标签词库快照：${catalogSnapshot}。必须读取，并按仓库内 tagging-and-taxonomy.md 执行。`,
      `锁定人工标签：${JSON.stringify(lockedTags)}。这些普通 tags 必须原样保留，AI 不得删除、改名或覆盖。`,
      `分组配置：分类=${group.category || "待分析"}；标签=${group.tags.join("、") || "待分析"}；模板机制=${group.templateMechanism || "待分析"}。`,
      `参考配置：${JSON.stringify(group.referenceConfig)}；依赖级别=${group.referenceDependencyLevel}；建议模式=${group.testModeRecommendation}。`,
      `业务备注：${group.notes || "无"}。`,
      "必须生成 image-edit-template.json、image-edit-analysis.json、meme-template.json、index.md，并运行语义与 Gallery validator。",
      ossInstruction,
      "如语义需要人工审核，保留 DRAFT/needsReview，不要伪造已确认状态。",
    ].join("\n");
  }

  private async validate(resultDir: string): Promise<ValidatorResult[]> {
    const results: ValidatorResult[] = [];
    const semanticValidator = path.join(this.projectRoot, "skills", "meme-template-analyzer", "scripts", "validate_semantic_analysis.py");
    const galleryValidator = path.join(this.projectRoot, "skills", "meme-template-analyzer", "scripts", "validate_gallery_template.py");
    for (const file of await findFiles(resultDir, "image-edit-analysis.json")) {
      const run = await collectOutput("python", [semanticValidator, file], this.projectRoot);
      results.push({ file, validator: "semantic", passed: run.code === 0 && run.output.includes("PASS"), output: run.output });
    }
    for (const file of await findFiles(resultDir, "meme-template.json")) {
      const run = await collectOutput("python", [galleryValidator, file], this.projectRoot);
      results.push({ file, validator: "gallery", passed: run.code === 0 && run.output.includes("PASS"), output: run.output });
    }
    return results;
  }

  private async hasNeedsReview(resultDir: string): Promise<boolean> {
    for (const file of await findFiles(resultDir, "meme-template.json")) {
      try {
        const parsed = JSON.parse(await readFile(file, "utf8"));
        if (parsed?.metadata?.needsReview || parsed?.metadata?.taxonomy?.needs_review?.length) return true;
      } catch { /* validator reports malformed JSON */ }
    }
    return false;
  }

  private async run(id: string) {
    let job = await this.storage.getJob(id);
    if (!job || job.status !== "queued") { this.pump(); return; }
    try {
      const batch = await this.storage.getBatch(job.batchId);
      const group = batch?.groups.find((item) => item.id === job!.groupId);
      if (!batch || !group) throw new Error("任务对应的批次或分组不存在");
      job.status = "running"; job.phase = "preparing"; job.startedAt = now();
      await this.update(job, "正在整理输入文件");
      const inputs = await organizeGroup(batch, group);
      if (!inputs.length) throw new Error("分组中没有可执行的图片");
      await exportCompatibilityFiles(batch);
      await ensureDir(job.resultDirectory);
      const tagCatalog = await this.storage.getTagCatalog();
      const tagCatalogSnapshot = await this.storage.snapshotTagCatalog(batch.outputFolder);

      job.phase = "analyzing";
      await this.update(job, "Codex 正在分析分组素材");
      const codexArgs = ["-a", "never", "exec", "--json", "-C", this.projectRoot, "-s", "workspace-write"];
      for (const input of inputs) codexArgs.push("-i", input);
      const invocation = this.commandAndArgs(codexArgs);
      const ossProgressFile = path.join(job.resultDirectory, ".oss-progress.json");
      if (group.uploadSourceImages) await rm(ossProgressFile, { force: true });
      const child = spawn(invocation.command, invocation.args, { cwd: this.projectRoot, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      child.stdin?.end(this.buildPrompt(batch, group, job.resultDirectory, tagCatalog, tagCatalogSnapshot));
      this.running.set(id, child); job.pid = child.pid; await this.storage.saveJob(job);

      let stdoutBuffer = "";
      child.stdout?.on("data", (chunk) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split(/\r?\n/); stdoutBuffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          let detail: unknown = line; let summary = line.slice(0, 240);
          try {
            detail = JSON.parse(line);
            const event: any = detail;
            summary = event.item?.text ?? event.item?.command ?? event.message ?? event.type ?? "Codex 事件";
          } catch { /* retain text */ }
          void this.update(job!, String(summary).slice(0, 500), "agent", detail);
        }
      });
      child.stderr?.on("data", (chunk) => { void appendFile(this.storage.logPath(id), `${JSON.stringify({ at: now(), type: "agent", phase: "analyzing", summary: chunk.toString().trim() })}\n`, "utf8"); });

      let lastOssProgress = "";
      const ossProgressTimer = group.uploadSourceImages ? setInterval(() => {
        void readFile(ossProgressFile, "utf8").then((raw) => {
          if (raw === lastOssProgress) return; lastOssProgress = raw;
          const progress = JSON.parse(raw); job!.phase = "uploading";
          const summary = progress.status === "failed" ? `OSS 原图上传失败：${progress.error ?? "未知错误"}` : `OSS 原图上传 ${progress.completedTemplates ?? 0}/${progress.totalTemplates ?? 0} · 新上传 ${progress.uploaded ?? 0} · 复用 ${progress.reused ?? 0}`;
          return this.update(job!, summary, progress.status === "failed" ? "error" : "status", progress);
        }).catch(() => undefined);
      }, 500) : undefined;

      let exitCode: number;
      try { exitCode = await new Promise<number>((resolve, reject) => { child.on("error", reject); child.on("close", (code) => resolve(code ?? 1)); }); }
      finally { if (ossProgressTimer) clearInterval(ossProgressTimer); }
      this.running.delete(id);
      await this.flush(id);
      job = (await this.storage.getJob(id)) ?? job;
      if (job.status === "cancelled") return;
      if (exitCode !== 0) throw new Error(`Codex 退出码 ${exitCode}`);

      job.phase = "validating";
      await this.update(job, "正在运行产物校验");
      job.validatorResults = await this.validate(job.resultDirectory);
      for (const result of job.validatorResults) await this.update(job, `${result.validator} validator: ${result.passed ? "PASS" : "FAIL"}`, "validator", result);
      const galleryCount = job.validatorResults.filter((item) => item.validator === "gallery").length;
      if (!galleryCount || job.validatorResults.some((item) => !item.passed)) throw new Error("产物 validator 未全部通过");

      job.phase = "finalizing";
      const needsReview = await this.hasNeedsReview(job.resultDirectory);
      job.status = needsReview ? "needs_review" : "succeeded";
      job.finishedAt = now(); job.pid = undefined;
      await this.update(job, needsReview ? "生成完成，等待业务审核" : "生成和校验均已完成");
    } catch (error: any) {
      this.running.delete(id);
      job = (await this.storage.getJob(id)) ?? job;
      if (job.status !== "cancelled") {
        job.status = "failed"; job.finishedAt = now(); job.pid = undefined; job.error = error?.message ?? String(error);
        await this.update(job, job.error ?? "任务执行失败", "error");
      }
    } finally { this.pump(); }
  }
}
