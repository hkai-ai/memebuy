import { describe, expect, it } from "vitest";
import { defaultTagCatalog, normalizeTagCatalog, selectedTags } from "./tag-catalog.js";

describe("tag catalog", () => {
  it("ships the visual creation tags without category or mechanism labels", () => {
    const catalog = defaultTagCatalog();
    expect(catalog.schemaVersion).toBe("1.1");
    expect(catalog.tags).toHaveLength(37);
    expect([...new Set(catalog.tags.map((tag) => tag.group))]).toEqual(["版式·形态", "画风·笔触", "工艺·材质", "实拍", "观察池"]);
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

  it("drops the old built-in category and mechanism seeds", () => {
    const catalog = normalizeTagCatalog({ tags: [
      { id: "scene.pet", label: "宠物", dimension: "scene", level: "category", aliases: [], enabled: true, aiAssignable: true },
      { id: "tag.keep", label: "保留", group: "自定义", aliases: [], enabled: true },
    ] });
    expect(catalog.tags.map((tag) => tag.id)).toEqual(["tag.keep"]);
  });
});
