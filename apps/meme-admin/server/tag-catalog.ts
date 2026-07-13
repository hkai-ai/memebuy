import type { TagCatalog, TagDefinition } from "../shared/types.js";

const ID_RE = /^[a-z][a-z0-9._-]{1,79}$/;
const LEGACY_SEED_IDS = new Set([
  "scene.pet", "scene.couple", "scene.family", "scene.workplace", "scene.campus",
  "theme.reaction", "theme.healing", "theme.contrast", "style.cute", "style.retro",
  "emotion.happy", "emotion.awkward", "use-case.reply", "use-case.social-post",
  "mechanism.text-reaction", "mechanism.identity-replacement", "mechanism.visual-contrast",
  "craft.felt-clay", "watch.photo-doodle", "watch.live-action-illustration",
  "watch.ancient-painting", "watch.plush-illustration",
]);

const seed = (id: string, label: string, group: string): TagDefinition => ({ id, label, group, aliases: [], enabled: true });

const DEFAULT_TAGS: TagDefinition[] = [
  seed("art.black-ink-line-art", "黑笔线稿", "画风·笔触"),
  seed("art.simple-sketch", "简单素描", "画风·笔触"),
  seed("art.ballpoint-pen", "圆珠笔画", "画风·笔触"),
  seed("art.marker", "马克笔", "画风·笔触"),
  seed("art.watercolor", "水彩", "画风·笔触"),
  seed("art.gouache", "水粉", "画风·笔触"),
  seed("art.oil-painting", "油画", "画风·笔触"),
  seed("art.oil-pastel", "油画棒", "画风·笔触"),
  seed("art.crayon-colored-pencil", "蜡笔彩铅", "画风·笔触"),
  seed("art.soft-pastel", "色粉画", "画风·笔触"),
  seed("art.chalk", "粉笔画", "画风·笔触"),
  seed("art.flat-illustration", "扁平插画", "画风·笔触"),
  seed("art.painterly-illustration", "厚涂插画", "画风·笔触"),
  seed("art.gradient-diffusion", "渐变弥散", "画风·笔触"),
  seed("art.minimal-line", "极简线条", "画风·笔触"),
  seed("art.spray-graffiti", "喷漆涂鸦", "画风·笔触"),
  seed("art.child-doodle", "儿童涂鸦", "画风·笔触"),
  seed("art.journal-doodle", "手账涂鸦", "画风·笔触"),
  seed("art.anime", "日漫风", "动漫·卡通"),
  seed("anime.showa-retro", "昭和复古动漫", "动漫·卡通"),
  seed("art.chibi-cartoon", "Q版卡通", "动漫·卡通"),
  seed("anime.american-cartoon", "美式卡通", "动漫·卡通"),
  seed("anime.american-comic", "美式漫画", "动漫·卡通"),
  seed("art.american-pop-art", "美式波普", "动漫·卡通"),
  seed("anime.four-panel-comic", "四格漫画", "动漫·卡通"),
  seed("anime.picture-book", "绘本插画", "动漫·卡通"),
  seed("anime.korean-illustration", "韩系插画", "动漫·卡通"),
  seed("art.pixel-art", "像素画", "动漫·卡通"),
  seed("art.guochao-illustration", "国潮插画", "国风·东方"),
  seed("east.ink-wash", "水墨画", "国风·东方"),
  seed("east.gongbi-heavy-color", "工笔重彩", "国风·东方"),
  seed("watch.ukiyo-e", "浮世绘", "国风·东方"),
  seed("east.retro-new-year-print", "复古年画", "国风·东方"),
  seed("east.paper-cut", "剪纸", "国风·东方"),
  seed("east.blue-white-porcelain", "青花瓷", "国风·东方"),
  seed("east.dunhuang-mural", "敦煌壁画", "国风·东方"),
  seed("craft.cross-stitch-embroidery", "十字绣刺绣", "工艺·材质"),
  seed("craft.knitting-yarn", "针织毛线", "工艺·材质"),
  seed("craft.felt", "羊毛毡", "工艺·材质"),
  seed("craft.clay-handmade", "黏土手作", "工艺·材质"),
  seed("watch.fabric-collage", "布艺拼贴", "工艺·材质"),
  seed("craft.paper-sculpture", "纸艺立体", "工艺·材质"),
  seed("craft.origami", "折纸", "工艺·材质"),
  seed("craft.woodcut", "木刻版画", "工艺·材质"),
  seed("craft.black-white-printmaking", "黑白版画", "工艺·材质"),
  seed("craft.screen-printing", "丝网印刷", "工艺·材质"),
  seed("craft.rubber-stamp", "橡皮章", "工艺·材质"),
  seed("craft.mosaic", "马赛克", "工艺·材质"),
  seed("craft.stained-glass", "彩绘玻璃", "工艺·材质"),
  seed("craft.enamel-pin", "珐琅徽章", "工艺·材质"),
  seed("craft.plush-texture", "毛绒质感", "工艺·材质"),
  seed("craft.building-block", "积木颗粒", "工艺·材质"),
  seed("layout.creative-collage", "创意拼贴", "版式·形态"),
  seed("layout.newspaper-collage", "报纸剪贴", "版式·形态"),
  seed("layout.retro-pictorial", "复古画报", "版式·形态"),
  seed("layout.idol-poster", "偶像海报", "版式·形态"),
  seed("layout.slogan-poster", "文字标语海报", "版式·形态"),
  seed("layout.art-lettering", "艺术字", "版式·形态"),
  seed("layout.meme-with-text", "梗图带字", "版式·形态"),
  seed("layout.reaction-sticker", "表情包", "版式·形态"),
  seed("layout.photo-booth", "大头贴", "版式·形态"),
  seed("layout.stamp-border", "邮票边框", "版式·形态"),
  seed("layout.ticket-stub", "票根", "版式·形态"),
  seed("layout.id-photo", "证件照", "版式·形态"),
  seed("layout.magazine-cover", "杂志封面", "版式·形态"),
  seed("layout.album-cover", "专辑封面", "版式·形态"),
  seed("layout.menu", "菜单", "版式·形态"),
  seed("layout.wanted-poster", "通缉令", "版式·形态"),
  seed("layout.postcard", "明信片", "版式·形态"),
  seed("layout.calendar", "日历", "版式·形态"),
  seed("layout.tarot-card", "塔罗牌", "版式·形态"),
  seed("layout.game-card", "游戏卡牌", "版式·形态"),
  seed("watch.masterpiece-parody", "名画戏仿", "版式·形态"),
  seed("layout.retro-film", "复古胶片", "复古·年代"),
  seed("retro.black-white-photo", "黑白老照片", "复古·年代"),
  seed("retro.polaroid", "宝丽来", "复古·年代"),
  seed("retro.ccd-snapshot", "CCD随手拍", "复古·年代"),
  seed("retro.american-ad", "美式复古广告", "复古·年代"),
  seed("retro.hong-kong", "港风", "复古·年代"),
  seed("retro.millennium-glitter", "千禧闪粉", "复古·年代"),
  seed("layout.y2k-window", "Y2K窗口", "复古·年代"),
  seed("retro.vaporwave", "蒸汽波", "复古·年代"),
  seed("retro.glitch", "故障风", "复古·年代"),
  seed("retro.cyberpunk", "赛博朋克", "复古·年代"),
  seed("retro.neon-sign", "霓虹灯牌", "复古·年代"),
  seed("retro.8bit-game", "8bit游戏", "复古·年代"),
  seed("retro.ps1-lofi", "PS1低保真", "复古·年代"),
  seed("photo.pet-costume", "萌宠变装实拍", "实拍·摄影"),
  seed("photo.pet-photography", "宠物摄影", "实拍·摄影"),
  seed("photo.handmade", "手作实拍", "实拍·摄影"),
  seed("watch.still-life-photography", "静物摄影", "实拍·摄影"),
  seed("photo.food-photography", "美食摄影", "实拍·摄影"),
  seed("watch.miniature-photography", "微缩摄影", "实拍·摄影"),
  seed("photo.macro-closeup", "微距特写", "实拍·摄影"),
  seed("photo.fisheye", "鱼眼镜头", "实拍·摄影"),
  seed("digital.3d-render", "3D渲染", "3D·数字"),
  seed("digital.clay-3d", "黏土3D", "3D·数字"),
  seed("digital.low-poly", "低多边形", "3D·数字"),
  seed("digital.isometric", "等距视角", "3D·数字"),
  seed("digital.inflated", "膨胀质感", "3D·数字"),
  seed("digital.chrome-metal", "金属铬感", "3D·数字"),
  seed("digital.glass", "玻璃质感", "3D·数字"),
  seed("digital.ai-hyperreal", "AI超写实", "3D·数字"),
  seed("mood.cute", "可爱", "萌趣"),
  seed("mood.cheeky-cute", "贱萌", "萌趣"),
  seed("mood.funny", "搞笑", "萌趣"),
  seed("mood.crazy", "发疯", "萌趣"),
  seed("mood.healing", "治愈", "暖感"),
  seed("mood.warm", "温馨", "暖感"),
  seed("mood.romantic", "浪漫", "暖感"),
  seed("mood.dreamy", "梦幻", "暖感"),
  seed("mood.cool", "酷", "态度"),
  seed("mood.fiery", "燃", "态度"),
  seed("mood.melancholy", "丧", "态度"),
  seed("mood.rebellious", "叛逆", "态度"),
  seed("mood.artsy", "文艺", "氛围"),
  seed("mood.nostalgic", "怀旧", "氛围"),
  seed("mood.dark", "暗黑", "氛围"),
  seed("mood.eerie", "诡异", "氛围"),
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
      ...DEFAULT_TAGS.map((tag) => {
        const existing = existingById.get(tag.id);
        return existing ? { ...tag, aliases: [...existing.aliases], enabled: existing.enabled, ...(existing.description ? { description: existing.description } : {}) } : { ...tag, aliases: [...tag.aliases] };
      }),
      ...catalog.tags.filter((tag) => !defaultIds.has(tag.id)),
    ],
  };
}

export function selectedTags(catalog: TagCatalog, ids: string[]): TagDefinition[] {
  const wanted = new Set(ids);
  return catalog.tags.filter((tag) => wanted.has(tag.id));
}
