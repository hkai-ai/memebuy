import path from "node:path";
import { describe, expect, it } from "vitest";
import { isInside, safeSlug } from "./paths.js";

describe("path safety", () => {
  it("normalizes business group names", () => {
    expect(safeSlug("  七月 猫猫 / Reaction  ")).toBe("七月-猫猫-reaction");
  });

  it("rejects empty and overlong slugs", () => {
    expect(() => safeSlug("!!!")).toThrow();
    expect(() => safeSlug("a".repeat(81))).toThrow();
  });

  it("does not confuse sibling paths with children", () => {
    const root = path.resolve("C:/work/artifacts");
    expect(isInside(root, path.join(root, "batch", "result.json"))).toBe(true);
    expect(isInside(root, path.resolve("C:/work/artifacts-elsewhere/file.json"))).toBe(false);
  });
});
