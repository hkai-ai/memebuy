import { access, mkdir } from "node:fs/promises";
import path from "node:path";

async function exists(filePath: string) {
  try { await access(filePath); return true; } catch { return false; }
}

export async function findProjectRoot(start = process.cwd()): Promise<string> {
  if (process.env.MEME_ADMIN_ROOT) return path.resolve(process.env.MEME_ADMIN_ROOT);
  let current = path.resolve(start);
  while (true) {
    if (await exists(path.join(current, "skills", "meme-template-analyzer", "SKILL.md"))) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error("找不到 memebuy 项目根目录");
    current = parent;
  }
}

export function isInside(parent: string, target: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function safeSlug(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug || slug.length > 80) throw new Error("名称必须包含有效字符且不超过 80 字符");
  return slug;
}

export async function ensureDir(dir: string) { await mkdir(dir, { recursive: true }); }
