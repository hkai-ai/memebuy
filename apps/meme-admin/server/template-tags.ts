import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function normalizedTags(values: unknown): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error("标签必须是字符串数组");
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export async function findMemeTemplateFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolutePath);
      else if (entry.isFile() && entry.name === "meme-template.json") files.push(absolutePath);
    }
  }
  try { await walk(root); } catch (reason: any) {
    if (reason?.code !== "ENOENT") throw reason;
  }
  return files.sort();
}

export async function addTagsToMemeTemplate(file: string, values: unknown): Promise<string[]> {
  const tags = normalizedTags(values);
  if (!tags.length) throw new Error("请至少填写一个标签");
  const data: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`模板 JSON 顶层必须是对象：${file}`);
  const template = data as Record<string, unknown>;
  if (template.metadata !== undefined && (!template.metadata || typeof template.metadata !== "object" || Array.isArray(template.metadata))) {
    throw new Error(`metadata 必须是对象：${file}`);
  }
  const metadata = (template.metadata ?? {}) as Record<string, unknown>;
  const existing = normalizedTags(metadata.tags ?? []);
  metadata.tags = [...new Set([...existing, ...tags])];
  template.metadata = metadata;
  await writeFile(file, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  return metadata.tags as string[];
}
