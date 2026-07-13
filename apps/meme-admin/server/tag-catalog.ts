import type { TagCatalog, TagDefinition } from "../shared/types.js";

const ID_RE = /^[a-z][a-z0-9._-]{1,79}$/;
const LEGACY_SEED_IDS = new Set([
  "scene.pet", "scene.couple", "scene.family", "scene.workplace", "scene.campus",
  "theme.reaction", "theme.healing", "theme.contrast", "style.cute", "style.retro",
  "emotion.happy", "emotion.awkward", "use-case.reply", "use-case.social-post",
  "mechanism.text-reaction", "mechanism.identity-replacement", "mechanism.visual-contrast",
]);

const seed = (id: string, label: string, group: string): TagDefinition => ({ id, label, group, aliases: [], enabled: true });

const DEFAULT_TAGS: TagDefinition[] = [
  seed("layout.creative-collage", "创意拼贴", "版式·形态"),
  seed("layout.meme-with-text", "梗图带字", "版式·形态"),
  seed("layout.retro-pictorial", "复古画报", "版式·形态"),
  seed("layout.slogan-poster", "文字标语海报", "版式·形态"),
  seed("layout.retro-film", "复古胶片", "版式·形态"),
  seed("layout.y2k-window", "Y2K窗口", "版式·形态"),
  seed("layout.idol-poster", "偶像海报", "版式·形态"),
  seed("layout.newspaper-collage", "报纸剪贴", "版式·形态"),
  seed("layout.photo-booth", "大头贴", "版式·形态"),
  seed("art.flat-illustration", "扁平插画", "画风·笔触"),
  seed("art.watercolor", "水彩", "画风·笔触"),
  seed("art.crayon-colored-pencil", "蜡笔彩铅", "画风·笔触"),
  seed("art.painterly-illustration", "厚涂插画", "画风·笔触"),
  seed("art.chibi-cartoon", "Q版卡通", "画风·笔触"),
  seed("art.anime", "日漫风", "画风·笔触"),
  seed("art.black-ink-line-art", "黑笔线稿", "画风·笔触"),
  seed("art.simple-sketch", "简单素描", "画风·笔触"),
  seed("art.american-pop-art", "美式波普", "画风·笔触"),
  seed("art.pixel-art", "像素画", "画风·笔触"),
  seed("art.child-doodle", "儿童涂鸦", "画风·笔触"),
  seed("art.guochao-illustration", "国潮插画", "画风·笔触"),
  seed("craft.black-white-printmaking", "黑白版画", "工艺·材质"),
  seed("craft.screen-printing", "丝网印刷", "工艺·材质"),
  seed("craft.felt-clay", "羊毛毡黏土", "工艺·材质"),
  seed("craft.cross-stitch-embroidery", "十字绣刺绣", "工艺·材质"),
  seed("photo.pet-costume", "萌宠变装实拍", "实拍"),
  seed("photo.pet-photography", "宠物摄影", "实拍"),
  seed("photo.handmade", "手作实拍", "实拍"),
  seed("watch.miniature-photography", "微缩摄影", "观察池"),
  seed("watch.still-life-photography", "静物摄影", "观察池"),
  seed("watch.ukiyo-e", "浮世绘", "观察池"),
  seed("watch.photo-doodle", "照片涂鸦", "观察池"),
  seed("watch.live-action-illustration", "实景插画", "观察池"),
  seed("watch.fabric-collage", "布艺拼贴", "观察池"),
  seed("watch.ancient-painting", "古画风", "观察池"),
  seed("watch.plush-illustration", "毛绒质感插画", "观察池"),
  seed("watch.masterpiece-parody", "名画戏仿", "观察池"),
];

export function defaultTagCatalog(): TagCatalog {
  return {
    schemaVersion: "1.1",
    updatedAt: new Date().toISOString(),
    tags: DEFAULT_TAGS.map((tag) => ({ ...tag, aliases: [...tag.aliases] })),
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
  const tags = input.tags.filter((raw) => !LEGACY_SEED_IDS.has(String((raw as Partial<TagDefinition> | undefined)?.id ?? ""))).map((raw, index): TagDefinition => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`第 ${index + 1} 个标签必须是对象`);
    const tag = raw as TagDefinition;
    const id = String(tag.id ?? "").trim();
    const label = String(tag.label ?? "").trim();
    const group = String(tag.group ?? "自定义").trim();
    if (!ID_RE.test(id)) throw new Error(`标签 ID 不合法：${id || `第 ${index + 1} 个标签`}`);
    if (!label || label.length > 40) throw new Error(`标签名称必须为 1-40 个字符：${id}`);
    if (!group || group.length > 40) throw new Error(`标签分组必须为 1-40 个字符：${id}`);
    if (ids.has(id)) throw new Error(`标签 ID 重复：${id}`);
    const labelKey = label.toLowerCase();
    if (labels.has(labelKey)) throw new Error(`标签名称重复：${label}`);
    ids.add(id); labels.add(labelKey);
    return {
      id,
      label,
      group,
      aliases: normalizeStrings(tag.aliases ?? []),
      enabled: tag.enabled !== false,
      ...(typeof tag.description === "string" && tag.description.trim() ? { description: tag.description.trim().slice(0, 160) } : {}),
    };
  });
  const updatedAt = typeof input.updatedAt === "string" && !Number.isNaN(Date.parse(input.updatedAt)) ? input.updatedAt : new Date().toISOString();
  return { schemaVersion: "1.1", updatedAt, tags };
}

export function withDefaultTags(value: unknown): TagCatalog {
  const catalog = normalizeTagCatalog(value);
  const existingById = new Map(catalog.tags.map((tag) => [tag.id, tag]));
  const defaultIds = new Set(DEFAULT_TAGS.map((tag) => tag.id));
  return {
    ...catalog,
    tags: [
      ...DEFAULT_TAGS.map((tag) => existingById.get(tag.id) ?? { ...tag, aliases: [...tag.aliases] }),
      ...catalog.tags.filter((tag) => !defaultIds.has(tag.id)),
    ],
  };
}

export function selectedTags(catalog: TagCatalog, ids: string[]): TagDefinition[] {
  const wanted = new Set(ids);
  return catalog.tags.filter((tag) => wanted.has(tag.id));
}
