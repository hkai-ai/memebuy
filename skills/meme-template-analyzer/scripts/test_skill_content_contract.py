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

    require(json_contract, "co_variation_constraints", "json-contract.md")
    require(json_contract, "dependent_slot", "json-contract.md")
    require(json_contract, "failure_if_unsynced", "json-contract.md")

    require(stability_contract, "co_variation_adherence", "stability-testset-contract.md")
    require(stability_contract, "expected_co_variation_constraints", "stability-testset-contract.md")


if __name__ == "__main__":
    main()
