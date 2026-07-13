import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectTemplateAssets, retryTemplateAssets, type OssAssetDependencies, type OssConfig } from "./oss-assets.js";

const roots: string[] = [];
const config: OssConfig = { accessKeyId: "ak", accessKeySecret: "sk", bucket: "assets", endpoint: "oss.example.com", domain: "assets.example.com", prefix: "dev/" };
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "meme-oss-assets-")); roots.push(root);
  const file = path.join(root, "meme-template.json");
  await writeFile(path.join(root, "source.png"), "same-image");
  await writeFile(file, `${JSON.stringify({ key: "demo-template", cover: "./source.png", referenceImage: "./source.png", metadata: { tags: ["猫"] } }, null, 2)}\n`);
  return { root, file };
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("OSS source image assistance", () => {
  it("distinguishes local images, uploaded objects, and missing remote objects", async () => {
    const { file } = await fixture();
    const local = await inspectTemplateAssets(file, config, { headObject: async () => false });
    expect(local.state).toBe("not_uploaded");

    const data = JSON.parse(await readFile(file, "utf8"));
    data.cover = data.referenceImage = "https://assets.example.com/dev/gallery/templates/00000000-0000-4000-8000-000000000000.png";
    await writeFile(file, JSON.stringify(data));
    expect((await inspectTemplateAssets(file, config, { headObject: async () => true })).state).toBe("uploaded");
    expect((await inspectTemplateAssets(file, config, { headObject: async () => false })).state).toBe("object_missing");
  });

  it("uploads one source image, verifies it, and atomically updates both JSON fields", async () => {
    const { file } = await fixture(); const objects = new Set<string>(); let puts = 0;
    const dependencies: OssAssetDependencies = {
      headObject: async (key) => objects.has(key),
      putObject: async ({ key }) => { puts += 1; objects.add(key); },
      validateLocal: async () => undefined,
      validateRemote: async (candidate) => {
        const data = JSON.parse(await readFile(candidate, "utf8"));
        expect(data.cover).toMatch(/^https:\/\/assets\.example\.com\/dev\/gallery\/templates\//);
        expect(data.referenceImage).toBe(data.cover);
      },
    };
    const result = await retryTemplateAssets(file, config, dependencies);
    const finalData = JSON.parse(await readFile(file, "utf8"));
    expect(result).toEqual({ uploaded: 1, reused: 1, writtenBack: 1 });
    expect(puts).toBe(1); expect(finalData.cover).toBe(finalData.referenceImage); expect(finalData.metadata.tags).toEqual(["猫"]);
  });

  it("can repair a broken remote URL from the retained source image", async () => {
    const { file } = await fixture(); const data = JSON.parse(await readFile(file, "utf8"));
    data.cover = data.referenceImage = "https://assets.example.com/dev/gallery/templates/missing.png"; await writeFile(file, JSON.stringify(data));
    const objects = new Set<string>();
    await retryTemplateAssets(file, config, {
      headObject: async (key) => objects.has(key), putObject: async ({ key }) => { objects.add(key); }, validateLocal: async () => undefined, validateRemote: async () => undefined,
    });
    const repaired = JSON.parse(await readFile(file, "utf8"));
    expect(repaired.cover).not.toContain("missing.png"); expect(repaired.referenceImage).toBe(repaired.cover);
  });
});
