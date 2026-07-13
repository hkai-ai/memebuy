import { describe, expect, it } from "vitest";
import { defaultTagCatalog, normalizeTagCatalog, selectedTags } from "./tag-catalog.js";

describe("tag catalog", () => {
  it("ships distinct category and fixed-template tag levels", () => {
    const catalog = defaultTagCatalog();
    expect(catalog.tags.some((tag) => tag.level === "category" && tag.aiAssignable)).toBe(true);
    expect(catalog.tags.some((tag) => tag.level === "tag" && !tag.aiAssignable)).toBe(true);
  });

  it("normalizes aliases and rejects duplicate labels in one dimension", () => {
    const catalog = normalizeTagCatalog({ schemaVersion: "1.0", updatedAt: "2026-07-13T00:00:00.000Z", tags: [
      { id: "scene.pet", label: "宠物", dimension: "scene", level: "category", aliases: [" 猫狗 ", "猫狗"], enabled: true, aiAssignable: true },
    ] });
    expect(catalog.tags[0].aliases).toEqual(["猫狗"]);
    expect(() => normalizeTagCatalog({ tags: [catalog.tags[0], { ...catalog.tags[0], id: "scene.pet-2" }] })).toThrow("同一维度标签名称重复");
  });

  it("keeps disabled historical selections resolvable", () => {
    const catalog = defaultTagCatalog(); const first = catalog.tags[0]; catalog.tags[1].enabled = false;
    expect(selectedTags(catalog, [first.id, catalog.tags[1].id]).map((tag) => tag.id)).toEqual([first.id, catalog.tags[1].id]);
  });
});
