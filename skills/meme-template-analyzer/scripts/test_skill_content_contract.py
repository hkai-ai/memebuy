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

    require(stability_contract, "co_variation_adherence", "stability-testset-contract.md")
    require(stability_contract, "expected_co_variation_constraints", "stability-testset-contract.md")


if __name__ == "__main__":
    main()
