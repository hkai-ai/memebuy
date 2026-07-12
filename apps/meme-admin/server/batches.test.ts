import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBatch, defaultGroup, exportCompatibilityFiles, organizeGroup, readCompatibilityFile, scanImages } from "./batches.js";

const tempRoots: string[] = [];
async function tempRoot() { const root = await mkdtemp(path.join(os.tmpdir(), "meme-admin-")); tempRoots.push(root); return root; }
afterEach(async () => { await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("batch files", () => {
  it("scans supported images recursively and ignores other files", async () => {
    const root = await tempRoot(); await mkdir(path.join(root, "nested"));
    await Promise.all([
      writeFile(path.join(root, "cat.JPG"), "one"),
      writeFile(path.join(root, "nested", "dog.webp"), "two"),
      writeFile(path.join(root, "notes.txt"), "skip"),
    ]);
    const images = await scanImages(root);
    expect(images.map((item) => item.relativePath)).toEqual(["cat.JPG", "nested/dog.webp"]);
    expect(new Set(images.map((item) => item.id)).size).toBe(2);
  });

  it("copies grouped images without deleting the source and writes compatible JSON", async () => {
    const projectRoot = await tempRoot(); const source = path.join(projectRoot, "source"); await mkdir(source);
    const sourceFile = path.join(source, "meme.png"); await writeFile(sourceFile, "image-data");
    const batch = createBatch(projectRoot, "运营批次", source, await scanImages(source));
    const group = defaultGroup("cat-reaction", batch.defaults); group.imageIds = [batch.images[0].id]; batch.images[0].groupId = group.id; batch.groups.push(group);
    const copied = await organizeGroup(batch, group); await exportCompatibilityFiles(batch);
    expect(copied).toHaveLength(1); expect(await readFile(copied[0], "utf8")).toBe("image-data");
    expect((await stat(sourceFile)).isFile()).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(batch.outputFolder, "batch-manifest.json"), "utf8"));
    expect(manifest.artifactType).toBe("batch_organized_manifest"); expect(manifest.groups[0].config.category).toBe("");
  });

  it("imports a legacy organized manifest", async () => {
    const projectRoot = await tempRoot(); const source = path.join(projectRoot, "legacy"); await mkdir(source);
    const image = path.join(source, "old.png"); await writeFile(image, "legacy-image");
    const manifestPath = path.join(source, "batch-manifest.json");
    await writeFile(manifestPath, JSON.stringify({ batchId: "legacy-batch", groups: [{ groupName: "legacy-group", config: { groupName: "legacy-group", status: "needs_review", tags: ["旧数据"] }, images: [{ imageId: "img-old", sourcePath: image, fileName: "old.png" }] }] }));
    const batch = await readCompatibilityFile(manifestPath, projectRoot);
    expect(batch.groups[0].groupName).toBe("legacy-group"); expect(batch.groups[0].imageIds).toEqual(["img-old"]); expect(batch.images[0].groupId).toBe(batch.groups[0].id);
  });

  it("imports a standalone group-config and discovers sibling images", async () => {
    const projectRoot = await tempRoot(); const groupDir = path.join(projectRoot, "group-folder"); await mkdir(groupDir);
    await writeFile(path.join(groupDir, "source.png"), "image");
    const configPath = path.join(groupDir, "group-config.json");
    await writeFile(configPath, JSON.stringify({ groupName: "single-group", status: "ready_for_template", category: "reaction", tags: ["单组"] }));
    const batch = await readCompatibilityFile(configPath, projectRoot);
    expect(batch.images).toHaveLength(1); expect(batch.groups).toHaveLength(1); expect(batch.groups[0].imageIds).toEqual([batch.images[0].id]);
  });
});
