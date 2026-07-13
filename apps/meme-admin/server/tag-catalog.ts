import type { TagCatalog, TagDefinition } from "../shared/types.js";

const ID_RE = /^[a-z][a-z0-9._-]{1,79}$/;
const DIMENSION_RE = /^[a-z][a-z0-9_-]{1,39}$/;

const seed = (
  id: string,
  label: string,
  dimension: string,
  level: TagDefinition["level"],
  aiAssignable = true,
): TagDefinition => ({ id, label, dimension, level, aliases: [], enabled: true, aiAssignable });

export function defaultTagCatalog(): TagCatalog {
  return {
    schemaVersion: "1.0",
    updatedAt: new Date().toISOString(),
    tags: [
      seed("scene.pet", "宠物", "scene", "category"),
      seed("scene.couple", "情侣", "scene", "category"),
      seed("scene.family", "亲子", "scene", "category"),
      seed("scene.workplace", "职场", "scene", "category"),
      seed("scene.campus", "校园", "scene", "category"),
      seed("theme.reaction", "反应图", "theme", "category"),
      seed("theme.healing", "治愈", "theme", "category"),
      seed("theme.contrast", "反差", "theme", "category"),
      seed("style.cute", "可爱", "style", "category"),
      seed("style.retro", "复古", "style", "category"),
      seed("emotion.happy", "开心", "emotion", "category"),
      seed("emotion.awkward", "尴尬", "emotion", "category"),
      seed("use-case.reply", "聊天回复", "use_case", "category"),
      seed("use-case.social-post", "社交发布", "use_case", "category"),
      seed("mechanism.text-reaction", "文字反应梗", "mechanism", "tag", false),
      seed("mechanism.identity-replacement", "身份替换", "mechanism", "tag", false),
      seed("mechanism.visual-contrast", "视觉反差", "mechanism", "tag", false),
    ],
  };
}

function normalizeStrings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error("标签别名必须是字符串数组");
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

export function normalizeTagCatalog(value: unknown): TagCatalog {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("标签词库必须是对象");
  const input = value as Partial<TagCatalog>;
  if (!Array.isArray(input.tags)) throw new Error("标签词库 tags 必须是数组");
  const ids = new Set<string>();
  const labels = new Set<string>();
  const tags = input.tags.map((raw, index): TagDefinition => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`第 ${index + 1} 个标签必须是对象`);
    const tag = raw as TagDefinition;
    const id = String(tag.id ?? "").trim();
    const label = String(tag.label ?? "").trim();
    const dimension = String(tag.dimension ?? "").trim();
    if (!ID_RE.test(id)) throw new Error(`标签 ID 不合法：${id || `第 ${index + 1} 个标签`}`);
    if (!label || label.length > 40) throw new Error(`标签名称必须为 1-40 个字符：${id}`);
    if (!DIMENSION_RE.test(dimension)) throw new Error(`标签维度不合法：${id}`);
    if (!(["category", "tag"] as const).includes(tag.level)) throw new Error(`标签层级不合法：${id}`);
    if (ids.has(id)) throw new Error(`标签 ID 重复：${id}`);
    const labelKey = `${dimension}:${label}`.toLowerCase();
    if (labels.has(labelKey)) throw new Error(`同一维度标签名称重复：${label}`);
    ids.add(id); labels.add(labelKey);
    return {
      id,
      label,
      dimension,
      level: tag.level,
      aliases: normalizeStrings(tag.aliases ?? []),
      enabled: tag.enabled !== false,
      aiAssignable: Boolean(tag.aiAssignable),
      ...(typeof tag.description === "string" && tag.description.trim() ? { description: tag.description.trim().slice(0, 160) } : {}),
    };
  });
  const updatedAt = typeof input.updatedAt === "string" && !Number.isNaN(Date.parse(input.updatedAt)) ? input.updatedAt : new Date().toISOString();
  return { schemaVersion: "1.0", updatedAt, tags };
}

export function selectedTags(catalog: TagCatalog, ids: string[]): TagDefinition[] {
  const wanted = new Set(ids);
  return catalog.tags.filter((tag) => wanted.has(tag.id));
}
