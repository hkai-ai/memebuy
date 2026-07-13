import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { JobRecord } from "../shared/types.js";
import { Storage } from "./storage.js";

const tempRoots: string[] = [];
afterEach(async () => { await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("local JSON storage", () => {
  it("marks running tasks interrupted after service restart", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "meme-admin-storage-")); tempRoots.push(root);
    const storage = new Storage(root); await storage.init();
    const job: JobRecord = { id: "job-1", batchId: "batch", groupId: "group", groupName: "group", status: "running", phase: "analyzing", createdAt: new Date().toISOString(), resultDirectory: path.join(root, "result"), lastEvent: "running", validatorResults: [] };
    await storage.saveJob(job);
    const restarted = new Storage(root); await restarted.init();
    const restored = await restarted.getJob(job.id);
    expect(restored?.status).toBe("interrupted"); expect(restored?.lastEvent).toContain("服务重启");
  });

  it("persists concurrency settings", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "meme-admin-settings-")); tempRoots.push(root);
    const storage = new Storage(root); await storage.init(); expect((await storage.getSettings()).concurrency).toBe(1);
    await storage.saveSettings({ concurrency: 3 }); expect((await storage.getSettings()).concurrency).toBe(3);
  });

  it("creates, persists, and snapshots the operator tag catalog", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "meme-admin-tag-catalog-")); tempRoots.push(root);
    const storage = new Storage(root); await storage.init();
    const catalog = await storage.getTagCatalog(); expect(catalog.tags).toHaveLength(37);
    catalog.tags.push({ id: "tag.campaign-a", label: "campaign-a", group: "自定义", aliases: [], enabled: true });
    catalog.updatedAt = "2026-07-13T00:00:00.000Z"; await storage.saveTagCatalog(catalog);
    const snapshot = await storage.snapshotTagCatalog(path.join(root, "artifacts", "batch"));
    expect((await storage.getTagCatalog()).tags.some((tag) => tag.id === "tag.campaign-a")).toBe(true);
    expect(JSON.parse(await readFile(snapshot, "utf8")).updatedAt).toBe("2026-07-13T00:00:00.000Z");
  });
});
