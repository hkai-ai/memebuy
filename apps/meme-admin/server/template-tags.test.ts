import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addTagsToMemeTemplate, findMemeTemplateFiles } from "./template-tags.js";

const tempRoots: string[] = [];
async function tempRoot() { const root = await mkdtemp(path.join(os.tmpdir(), "meme-tags-")); tempRoots.push(root); return root; }
afterEach(async () => { await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("template tags", () => {
  it("finds only meme-template.json recursively", async () => {
    const root = await tempRoot(); const nested = path.join(root, "nested"); await mkdir(nested);
    await Promise.all([writeFile(path.join(root, "other.json"), "{}"), writeFile(path.join(nested, "meme-template.json"), "{}")]);
    expect(await findMemeTemplateFiles(root)).toEqual([path.join(nested, "meme-template.json")]);
  });

  it("merges, trims, and persists metadata.tags", async () => {
    const root = await tempRoot(); const file = path.join(root, "meme-template.json");
    await writeFile(file, JSON.stringify({ key: "demo", metadata: { tags: ["反应图"], version: "1.0.0" } }));
    expect(await addTagsToMemeTemplate(file, [" 反应图 ", "猫", "猫"])).toEqual(["反应图", "猫"]);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ key: "demo", metadata: { tags: ["反应图", "猫"], version: "1.0.0" } });
  });

  it("creates metadata.tags when metadata is absent", async () => {
    const root = await tempRoot(); const file = path.join(root, "meme-template.json");
    await writeFile(file, JSON.stringify({ key: "demo" }));
    await addTagsToMemeTemplate(file, ["新标签"]);
    expect(JSON.parse(await readFile(file, "utf8")).metadata.tags).toEqual(["新标签"]);
  });
});
