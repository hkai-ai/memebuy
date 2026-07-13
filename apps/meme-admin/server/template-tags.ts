import { randomUUID } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

function normalizedTags(values: unknown): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error("标签必须是字符串数组");
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function writeTemplate(file: string, template: Record<string, unknown>, validate?: (candidate: string) => Promise<void>) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  try { if (validate) await validate(temporary); await rename(temporary, file); }
  catch (error) { await import("node:fs/promises").then(({ rm }) => rm(temporary, { force: true })); throw error; }
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
  const assignments = Array.isArray(metadata.tagAssignments) ? metadata.tagAssignments.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown>[] : [];
  for (const label of tags) {
    if (!assignments.some((item) => item.label === label && item.source === "operator")) assignments.push({ label, dimension: "manual", level: "tag", source: "operator", status: "accepted" });
  }
  metadata.tagAssignments = assignments;
  template.metadata = metadata;
  await writeTemplate(file, template);
  return metadata.tags as string[];
}

export async function setManualTagsOnMemeTemplate(file: string, values: unknown, validate?: (candidate: string) => Promise<void>): Promise<string[]> {
  const manualTags = normalizedTags(values);
  const data: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`模板 JSON 顶层必须是对象：${file}`);
  const template = data as Record<string, unknown>;
  if (template.metadata !== undefined && (!template.metadata || typeof template.metadata !== "object" || Array.isArray(template.metadata))) throw new Error(`metadata 必须是对象：${file}`);
  const metadata = (template.metadata ?? {}) as Record<string, unknown>;
  const assignments = Array.isArray(metadata.tagAssignments) ? metadata.tagAssignments.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown>[] : [];
  const previousManual = new Set(assignments.filter((item) => item.source === "operator" && item.dimension === "manual").map((item) => String(item.label ?? "")));
  const retained = assignments.filter((item) => !(item.source === "operator" && item.dimension === "manual"));
  const retainedLabels = new Set(retained.filter((item) => item.status === "accepted").map((item) => String(item.label ?? "")).filter(Boolean));
  for (const label of manualTags) if (!retainedLabels.has(label)) retained.push({ label, dimension: "manual", level: "tag", source: "operator", status: "accepted" });
  const existing = normalizedTags(metadata.tags ?? []).filter((label) => !previousManual.has(label));
  metadata.tags = [...new Set([...existing, ...retainedLabels, ...manualTags])];
  metadata.tagAssignments = retained; template.metadata = metadata;
  await writeTemplate(file, template, validate);
  return manualTags;
}
