from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def require(text: str, needle: str, source: str) -> None:
    if needle not in text:
        raise AssertionError(f"{source} missing required content: {needle}")


def main() -> None:
    skill = read("SKILL.md")
    json_contract = read("references/json-contract.md")
    stability_contract = read("references/stability-testset-contract.md")

    require(skill, "co_variation_constraints", "SKILL.md")
    require(skill, "跨槽关系", "SKILL.md")
    require(skill, "颜色、明度、材质", "SKILL.md")
    require(skill, "生成图 QA", "SKILL.md")
    require(skill, "remix_suitability", "SKILL.md")
    require(skill, "高保真主体替换", "SKILL.md")
    require(skill, "creative remap", "SKILL.md")
    require(skill, "fusion_model", "SKILL.md")
    require(skill, "fused_slots", "SKILL.md")
    require(skill, "replacement_sensitivity", "SKILL.md")
    require(skill, "meme_formula", "SKILL.md")
    require(skill, "slot_minimization_review", "SKILL.md")
    require(skill, "业务槽位不是画面元素清单", "SKILL.md")
    require(skill, "hifi_free_boundary_reflection", "SKILL.md")
    require(skill, "hifi_must_keep", "SKILL.md")
    require(skill, "free_must_keep", "SKILL.md")
    require(skill, "free_can_change", "SKILL.md")
    require(skill, "composition_pattern", "SKILL.md")
    require(skill, "template-review-page", "SKILL.md")
    require(skill, "review.html", "SKILL.md")
    require(skill, "人审预览页", "SKILL.md")
    require(skill, "复制核对卡", "SKILL.md")
    require(skill, "生成审核页", "SKILL.md")
    require(skill, "给运营看", "SKILL.md")
    require(skill, "做个预览页", "SKILL.md")
    require(skill, "batch-manifest.json", "SKILL.md")
    require(skill, "generationFit", "SKILL.md")
    require(skill, "taxonomy", "SKILL.md")
    require(skill, "folderAsSeries", "SKILL.md")
    require(skill, "批量审核页", "SKILL.md")

    require(json_contract, "co_variation_constraints", "json-contract.md")
    require(json_contract, "dependent_slot", "json-contract.md")
    require(json_contract, "failure_if_unsynced", "json-contract.md")
    require(json_contract, "remix_suitability", "json-contract.md")
    require(json_contract, "high_fidelity_subject_replaceability", "json-contract.md")
    require(json_contract, "creative_remap_recommended", "json-contract.md")
    require(json_contract, "fusion_model", "json-contract.md")
    require(json_contract, "has_fused_subject", "json-contract.md")
    require(json_contract, "requires_remap_if_subject_changes", "json-contract.md")
    require(json_contract, "meme_formula", "json-contract.md")
    require(json_contract, "slot_minimization_review", "json-contract.md")
    require(json_contract, "business_exposure", "json-contract.md")

    gallery_contract = read("references/gallery-authoring-contract.md")
    require(gallery_contract, "meme_formula", "gallery-authoring-contract.md")
    require(gallery_contract, "不是画面元素清单", "gallery-authoring-contract.md")
    require(gallery_contract, "默认控制在 2-4 个业务槽位", "gallery-authoring-contract.md")
    require(gallery_contract, "hifi_free_boundary_reflection", "gallery-authoring-contract.md")
    require(gallery_contract, "hifi_must_keep", "gallery-authoring-contract.md")
    require(gallery_contract, "free_must_keep", "gallery-authoring-contract.md")
    require(gallery_contract, "free_can_change", "gallery-authoring-contract.md")
    require(gallery_contract, "composition_pattern", "gallery-authoring-contract.md")
    require(gallery_contract, "batch-manifest.json", "gallery-authoring-contract.md")
    require(gallery_contract, "generationFit", "gallery-authoring-contract.md")
    require(gallery_contract, "taxonomy", "gallery-authoring-contract.md")
    require(gallery_contract, "ready_for_import", "gallery-authoring-contract.md")
    require(gallery_contract, "sourceSha256", "gallery-authoring-contract.md")
    require(gallery_contract, "<series-or-topic-slug>-<formula-slug>-<short-hash>", "gallery-authoring-contract.md")

    require(stability_contract, "co_variation_adherence", "stability-testset-contract.md")
    require(stability_contract, "expected_co_variation_constraints", "stability-testset-contract.md")

    readme = read("README.md")
    require(readme, "template-review-page", "README.md")
    require(readme, "review.html", "README.md")
    require(readme, "业务人员", "README.md")
    require(readme, "file:///", "README.md")
    require(readme, "生成审核页", "README.md")
    require(readme, "给运营看", "README.md")
    require(readme, "batch-manifest.json", "README.md")
    require(readme, "generationFit", "README.md")
    require(readme, "taxonomy", "README.md")


if __name__ == "__main__":
    main()
