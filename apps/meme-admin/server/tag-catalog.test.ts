import { describe, expect, it } from "vitest";
import { defaultTagCatalog, normalizeTagCatalog, selectedTags, withDefaultTags } from "./tag-catalog.js";

describe("tag catalog", () => {
  it("ships the visual creation tags without category or mechanism labels", () => {
    const catalog = defaultTagCatalog();
    expect(catalog.schemaVersion).toBe("1.1");
    expect(catalog.tags).toHaveLength(119);
    expect(Object.fromEntries([...new Set(catalog.tags.map((tag) => tag.group))].map((group) => [group, catalog.tags.filter((tag) => tag.group === group).length]))).toEqual({
      "画风·笔触": 18, "动漫·卡通": 10, "国风·东方": 8, "工艺·材质": 16,
      "版式·形态": 21, "复古·年代": 14, "实拍·摄影": 8, "3D·数字": 8,
      "萌趣": 4, "暖感": 4, "态度": 4, "氛围": 4,
    });
    expect(catalog.tags.map((tag) => tag.label)).toContain("Y2K窗口");
    expect(catalog.tags.map((tag) => tag.label)).not.toContain("聊天回复");
  });

  it("normalizes aliases and rejects duplicate labels", () => {
    const catalog = normalizeTagCatalog({ schemaVersion: "1.0", updatedAt: "2026-07-13T00:00:00.000Z", tags: [
      { id: "tag.lolcat", label: "lolcat", group: "自定义", aliases: [" 猫猫头 ", "猫猫头"], enabled: true },
    ] });
    expect(catalog.tags[0].aliases).toEqual(["猫猫头"]);
    expect(() => normalizeTagCatalog({ tags: [catalog.tags[0], { ...catalog.tags[0], id: "tag.lolcat-2" }] })).toThrow("标签名称重复");
  });

  it("keeps disabled historical selections resolvable", () => {
    const catalog = normalizeTagCatalog({ tags: [
      { id: "tag.one", label: "one", group: "自定义", aliases: [], enabled: true },
      { id: "tag.two", label: "two", group: "自定义", aliases: [], enabled: false },
    ] });
    expect(selectedTags(catalog, ["tag.one", "tag.two"]).map((tag) => tag.id)).toEqual(["tag.one", "tag.two"]);
  });

  it("moves retained defaults into the new group while preserving their state", () => {
    const catalog = withDefaultTags({ tags: [
      { id: "art.anime", label: "日漫风", group: "画风·笔触", aliases: ["anime"], enabled: false },
    ] });
    expect(catalog.tags.find((tag) => tag.id === "art.anime")).toMatchObject({ group: "动漫·卡通", aliases: ["anime"], enabled: false });
  });

  it("drops the old built-in category and mechanism seeds", () => {
    const catalog = normalizeTagCatalog({ tags: [
      { id: "scene.pet", label: "宠物", dimension: "scene", level: "category", aliases: [], enabled: true, aiAssignable: true },
      { id: "craft.felt-clay", label: "羊毛毡黏土", group: "工艺·材质", aliases: [], enabled: true },
      { id: "tag.keep", label: "保留", group: "自定义", aliases: [], enabled: true },
    ] });
    expect(catalog.tags.map((tag) => tag.id)).toEqual(["tag.keep"]);
  });
});
