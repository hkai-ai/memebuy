import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { classifyImageAsset } from "../shared/assets.js";
import type { BatchConfig, GroupConfig, ImageAsset } from "../shared/types.js";
import { forEachConcurrent, sha256File } from "./file-utils.js";
import { ensureDir, safeSlug } from "./paths.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export async function scanImages(root: string, previousImages: ImageAsset[] = []): Promise<ImageAsset[]> {
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error("素材路径不是文件夹");
  const images: ImageAsset[] = [];
  const files: string[] = [];
  const previousByPath = new Map(previousImages.map((image) => [image.sourcePath.toLowerCase(), image]));
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
    }
  }
  await walk(root);
  await forEachConcurrent(files, 4, async (absolute) => {
    const relativePath = path.relative(root, absolute).replaceAll("\\", "/");
    const fileName = path.basename(absolute);
    const shortHash = createHash("sha256").update(absolute.toLowerCase()).digest("hex").slice(0, 10);
    const fileStat = await stat(absolute);
    const modifiedAt = fileStat.mtime.toISOString();
    const previous = previousByPath.get(absolute.toLowerCase());
    const contentSha256 = previous?.contentSha256 && previous.modifiedAt === modifiedAt && previous.fileSize === fileStat.size ? previous.contentSha256 : await sha256File(absolute);
    images.push({ id: `img-${shortHash}`, sourcePath: absolute, relativePath, fileName, shortHash, origin: classifyImageAsset(relativePath, fileName), modifiedAt, fileSize: fileStat.size, contentSha256 });
  });
  return images.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-CN"));
}

export function defaultGroup(name: string, defaults: BatchConfig["defaults"]): GroupConfig {
  return {
    id: randomUUID(), groupName: safeSlug(name), status: "needs_review",
    referenceConfig: { template_reference: true, style_reference: false, composition_reference: true, identity_reference: false, other: "" },
    referenceDependencyLevel: "medium", testModeRecommendation: "reference_aware_preferred",
    generationMode: defaults.generationMode, category: defaults.category, templateMechanism: "",
    tags: [...defaults.tags], notes: "", imageIds: [],
  };
}

export function createBatch(projectRoot: string, name: string, sourceFolder: string, images: ImageAsset[]): BatchConfig {
  const now = new Date().toISOString();
  const id = `${safeSlug(name)}-${now.slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6)}`;
  return {
    id, name: name.trim(), sourceFolder: path.resolve(sourceFolder),
    outputFolder: path.join(projectRoot, "artifacts", "meme-template-analyzer", "batches", id),
    defaults: { generationMode: "template", category: "", tags: [] }, images, groups: [], createdAt: now, updatedAt: now,
  };
}

export async function organizeGroup(batch: BatchConfig, group: GroupConfig): Promise<string[]> {
  const inputDir = path.join(batch.outputFolder, "groups", safeSlug(group.groupName), "input");
  await ensureDir(inputDir);
  const copied: string[] = [];
  const seenContent = new Set<string>();
  for (const imageId of group.imageIds) {
    const image = batch.images.find((item) => item.id === imageId);
    if (!image) continue;
    if (image.contentSha256 && seenContent.has(image.contentSha256)) continue;
    if (image.contentSha256) seenContent.add(image.contentSha256);
    const target = path.join(inputDir, `${image.shortHash}-${path.basename(image.fileName)}`);
    try { await copyFile(image.sourcePath, target, 1); } catch (error: any) { if (error?.code !== "EEXIST") throw error; }
    copied.push(target);
  }
  return copied;
}

export async function exportCompatibilityFiles(batch: BatchConfig) {
  await ensureDir(batch.outputFolder);
  const workspace = {
    schemaVersion: "1.0", artifactType: "batch_review_workspace", createdAt: batch.createdAt, batchId: batch.id,
    sourceFolder: batch.sourceFolder,
    images: batch.images.map((image) => ({ ...image, status: image.groupId ? "assigned" : "unassigned", suggestedGroup: image.groupId ?? "" })),
  };
  const groups = [];
  for (const group of batch.groups) {
    const groupDir = path.join(batch.outputFolder, "groups", safeSlug(group.groupName));
    await mkdir(groupDir, { recursive: true });
    const config = { ...group, imageCount: group.imageIds.length };
    await writeFile(path.join(groupDir, "group-config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    groups.push({ groupName: group.groupName, config, images: group.imageIds.map((id) => batch.images.find((image) => image.id === id)).filter(Boolean) });
  }
  const manifest = { schemaVersion: "1.0", artifactType: "batch_organized_manifest", createdAt: new Date().toISOString(), batchId: batch.id, mode: "copy", groups };
  await Promise.all([
    writeFile(path.join(batch.outputFolder, "batch-workspace.json"), `${JSON.stringify(workspace, null, 2)}\n`, "utf8"),
    writeFile(path.join(batch.outputFolder, "batch-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  ]);
}

export async function readCompatibilityFile(filePath: string, projectRoot: string): Promise<BatchConfig> {
  const data = JSON.parse(await readFile(filePath, "utf8"));
  const sourceFolder = path.resolve(data.sourceFolder ?? path.dirname(filePath));
  const isSingleGroupConfig = Boolean(data.groupName && !data.groups && !data.artifactType);
  const scannedSingleGroupImages = isSingleGroupConfig ? await scanImages(path.dirname(filePath)) : [];
  const rawImages = data.images ?? (data.groups ?? []).flatMap((group: any) => group.images ?? []);
  const effectiveImages = rawImages.length ? rawImages : scannedSingleGroupImages;
  const images: ImageAsset[] = effectiveImages.map((image: any, index: number) => {
    const sourcePath = path.resolve(image.sourcePath ?? image.organizedPath ?? "");
    const relativePath = image.relativePath ?? path.basename(sourcePath);
    const shortHash = image.shortHash ?? image.sourceSha256?.slice(0, 10) ?? createHash("sha256").update(sourcePath).digest("hex").slice(0, 10);
    const fileName = image.fileName ?? path.basename(sourcePath);
    return { id: image.id ?? image.imageId ?? `img-${shortHash}-${index}`, sourcePath, relativePath, fileName, shortHash, origin: image.origin ?? classifyImageAsset(relativePath, fileName), modifiedAt: image.modifiedAt, fileSize: image.fileSize, contentSha256: image.contentSha256 ?? image.sourceSha256 };
  });
  const batch = createBatch(projectRoot, data.batchId ?? path.basename(filePath, ".json"), sourceFolder, images);
  const rawGroups = isSingleGroupConfig ? [{ groupName: data.groupName, config: data, images: images.map((image) => ({ imageId: image.id })) }] : (data.groups ?? []);
  batch.groups = rawGroups.map((raw: any) => {
    const config = raw.config ?? raw;
    const group = defaultGroup(config.groupName ?? raw.groupName ?? "imported-group", batch.defaults);
    Object.assign(group, config, { id: config.id ?? randomUUID(), imageIds: (raw.images ?? []).map((item: any) => item.imageId ?? item.id).filter(Boolean) });
    return group;
  });
  for (const group of batch.groups) for (const imageId of group.imageIds) { const image = batch.images.find((item) => item.id === imageId); if (image) image.groupId = group.id; }
  return batch;
}
