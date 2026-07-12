import type { ImageAsset, ImageAssetOrigin, ImageAssetSort } from "./types.js";

export function classifyImageAsset(relativePath: string, fileName: string): ImageAssetOrigin {
  const normalizedPath = relativePath.replaceAll("\\", "/").toLowerCase();
  const normalizedName = fileName.toLowerCase();
  if (/^source(?:[._-]|$)/.test(normalizedName)) return "source";
  if (normalizedPath.split("/").some((segment) => segment === "output" || segment === "result")) return "generated";
  return "other";
}

export function imageAssetOrigin(image: ImageAsset): ImageAssetOrigin {
  return image.origin ?? classifyImageAsset(image.relativePath, image.fileName);
}

export function imageAssetDedupKey(image: ImageAsset): string {
  return image.contentSha256 ? `sha256:${image.contentSha256}` : `path:${image.sourcePath.toLowerCase()}`;
}

export function deduplicateImageAssets(images: ImageAsset[]): ImageAsset[] {
  const originRank: Record<ImageAssetOrigin, number> = { source: 0, generated: 1, other: 2 };
  const preferred = [...images].sort((a, b) => originRank[imageAssetOrigin(a)] - originRank[imageAssetOrigin(b)] || a.relativePath.localeCompare(b.relativePath, "zh-CN"));
  const seen = new Set<string>();
  return preferred.filter((image) => { const key = imageAssetDedupKey(image); if (seen.has(key)) return false; seen.add(key); return true; });
}

export function imageAssetFolder(relativePath: string): string {
  const segments = relativePath.replaceAll("\\", "/").split("/");
  segments.pop();
  if (["output", "result"].includes(segments.at(-1)?.toLowerCase() ?? "")) segments.pop();
  return segments.join("/");
}

export function compareImageAssets(a: ImageAsset, b: ImageAsset, sort: ImageAssetSort): number {
  const rank: Record<ImageAssetOrigin, number> = { source: 0, generated: 1, other: 2 };
  const originOrder = rank[imageAssetOrigin(a)] - rank[imageAssetOrigin(b)];
  if (originOrder) return originOrder;
  if (sort === "name_asc") return a.fileName.localeCompare(b.fileName, "zh-CN");
  const timeOrder = Date.parse(a.modifiedAt ?? "") - Date.parse(b.modifiedAt ?? "");
  if (Number.isFinite(timeOrder) && timeOrder) return sort === "time_desc" ? -timeOrder : timeOrder;
  return a.relativePath.localeCompare(b.relativePath, "zh-CN");
}

export function sourceImageIdsForFolders(images: ImageAsset[], folders: ReadonlySet<string>): string[] {
  return deduplicateImageAssets(images.filter((image) => folders.has(imageAssetFolder(image.relativePath)) && imageAssetOrigin(image) === "source")).map((image) => image.id);
}
