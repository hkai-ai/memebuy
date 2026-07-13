import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addTagsToMemeTemplate, findMemeTemplateFiles, setManualTagsOnMemeTemplate } from "./template-tags.js";

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
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ key: "demo", metadata: { tags: ["反应图", "猫"], version: "1.0.0", tagAssignments: [
      { label: "反应图", dimension: "manual", level: "tag", source: "operator", status: "accepted" },
      { label: "猫", dimension: "manual", level: "tag", source: "operator", status: "accepted" },
    ] } });
  });

  it("creates metadata.tags when metadata is absent", async () => {
    const root = await tempRoot(); const file = path.join(root, "meme-template.json");
    await writeFile(file, JSON.stringify({ key: "demo" }));
    await addTagsToMemeTemplate(file, ["新标签"]);
    expect(JSON.parse(await readFile(file, "utf8")).metadata.tags).toEqual(["新标签"]);
    expect(JSON.parse(await readFile(file, "utf8")).metadata.tagAssignments[0].source).toBe("operator");
  });

  it("replaces manual labels while preserving locked assignments", async () => {
    const root = await tempRoot(); const file = path.join(root, "meme-template.json");
    await writeFile(file, JSON.stringify({ key: "demo", metadata: { tags: ["反应图", "旧人工标签"], tagAssignments: [
      { label: "反应图", dimension: "theme", level: "category", source: "template", status: "accepted" },
      { label: "旧人工标签", dimension: "manual", level: "tag", source: "operator", status: "accepted" },
    ] } }));
    expect(await setManualTagsOnMemeTemplate(file, ["新人工标签"])).toEqual(["新人工标签"]);
    const result = JSON.parse(await readFile(file, "utf8"));
    expect(result.metadata.tags).toEqual(["反应图", "新人工标签"]);
    expect(result.metadata.tagAssignments.map((item: any) => item.label)).toEqual(["反应图", "新人工标签"]);
  });

  it("does not replace the source file when post-edit validation fails", async () => {
    const root = await tempRoot(); const file = path.join(root, "meme-template.json");
    await writeFile(file, JSON.stringify({ key: "demo", metadata: { tags: ["原标签"] } }));
    const before = await readFile(file, "utf8");
    await expect(setManualTagsOnMemeTemplate(file, ["新标签"], async () => { throw new Error("invalid"); })).rejects.toThrow("invalid");
    expect(await readFile(file, "utf8")).toBe(before);
  });
});
