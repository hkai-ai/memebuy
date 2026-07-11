import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parents[1]


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def require(text: str, needle: str, source: str) -> None:
    if needle not in text:
        raise AssertionError(f"{source} missing required content: {needle}")


def main() -> None:
    skill = read("SKILL.md")
    json_contract = read("references/json-contract.md")
    gallery_contract = read("references/gallery-authoring-contract.md")
    slot_design = read("references/slot-and-visual-design.md")
    reference_authority = read("references/reference-authority.md")
    prompt_validation = read("references/prompt-and-validation.md")
    generation_testing = read("references/generation-testing.md")
    batch_review = read("references/batch-and-review.md")
    readme = read("README.md")
    business_doc = (REPO_ROOT / "docs" / "梗图模板业务使用说明.md").read_text(encoding="utf-8")
    taxonomy_doc = (REPO_ROOT / "docs" / "梗图模板库分类逻辑说明.md").read_text(encoding="utf-8")
    batch_workbench = read("assets/batch-workbench.html")
    schema = json.loads(read("references/gallery-template-import.schema.json"))
    sample = json.loads(read("references/gallery-template-import.sample.json"))
    manifest = json.loads(read("skill-manifest.json"))

    for needle in [
        "GalleryTemplateImport",
        "meme-template.json",
        "image-edit-template.json",
        "强制门禁",
        "请求路由",
        "Reference 导航",
        "默认单图流程",
        "编译与验证",
        "用户原图默认直通生成",
        "validate_gallery_template.py",
        "一个模板一个",
    ]:
        require(skill, needle, "SKILL.md")

    for needle in [
        "templateText",
        "editablePrompt",
        "allowFullRewrite",
        "slots[]",
        "slot_reflection_review",
        "templateSource",
        "userSubjectInput",
        "image-edit-analysis.json",
    ]:
        require(skill, needle, "SKILL.md")

    for needle in [
        "分析生成测试",
        "3 张明显不同",
        "generation-results.json",
        "完整 `prompt`",
        "template-review-page",
        "batch-review-workbench",
        "batch-manifest.json",
    ]:
        require(skill, needle, "SKILL.md")

    assert len(skill.splitlines()) <= 250, "SKILL.md should stay concise; move details to references"
    for reference in [
        "slot-and-visual-design.md",
        "reference-authority.md",
        "prompt-and-validation.md",
        "generation-testing.md",
        "batch-and-review.md",
    ]:
        require(skill, reference, "SKILL.md")

    for needle in [
        "semantic_merge_review",
        "canvas_background",
        "frame_border",
        "subject_outline",
        "content_panel",
        "identity_reference",
        "co_variation_constraints",
        "fusion_model",
    ]:
        require(slot_design, needle, "slot-and-visual-design.md")

    for needle in [
        "templateSource",
        "userSubjectInput",
        "imageRefs[]",
        "composition_authority",
        "identity_authority",
        "arrangement_pattern",
        "用户上传图默认原图直通生成",
    ]:
        require(reference_authority, needle, "reference-authority.md")

    for needle in [
        "promptTemplate",
        "inputSchema",
        "preprocessSteps",
        "LiquidJS",
        "allowCustom: true",
        "{value,label}",
        "gallery.template_image",
        "validate_gallery_template.py",
    ]:
        require(prompt_validation, needle, "prompt-and-validation.md")

    for needle in [
        "3 张真实",
        "generation-results.json",
        "完整 `prompt`",
        "mustDifferFromSource",
        "arrangement_pattern",
    ]:
        require(generation_testing, needle, "generation-testing.md")

    for needle in [
        "batch-workspace.json",
        "batch-manifest.json",
        "group-config.json",
        "metadata.needsReview",
        "DRAFT",
        "PUBLISHED",
        "review.html",
    ]:
        require(batch_review, needle, "batch-and-review.md")

    for needle in [
        "additionalProperties: false",
        "{{ subject | \"白猫\" }}",
        "select.options",
        "原图直通",
        "preprocessSteps",
        "metadata.templateSource",
        "import-report.json",
        "DRAFT",
        "PUBLISHED",
    ]:
        require(gallery_contract, needle, "gallery-authoring-contract.md")

    for needle in [
        "GalleryTemplateImport",
        "promptTemplate",
        "inputSchema",
        "preprocessSteps",
        "metadata",
        "validate_gallery_template.py",
    ]:
        require(json_contract, needle, "json-contract.md")
        require(readme, needle, "README.md")

    for needle in [
        "GalleryTemplate",
        "上传本地图到 OSS",
        "promptTemplate",
        "用户上传图片默认原图直通生成",
    ]:
        require(business_doc, needle, "docs/梗图模板业务使用说明.md")

    require(taxonomy_doc, "历史生成模式", "docs/梗图模板库分类逻辑说明.md")

    for needle in [
        "showDirectoryPicker",
        "batch-workspace.json",
        "group-config.json",
        "referenceDependencyLevel",
    ]:
        require(batch_workbench, needle, "assets/batch-workbench.html")

    assert schema["additionalProperties"] is False
    assert schema["required"] == ["key", "title", "promptTemplate", "inputSchema"]
    assert set(schema["properties"]) == {
        "key",
        "title",
        "description",
        "cover",
        "referenceImage",
        "imageSize",
        "imageN",
        "stageKey",
        "promptTemplate",
        "inputSchema",
        "preprocessSteps",
        "metadata",
    }
    assert sample["preprocessSteps"] == []
    assert any(item["type"] == "image" for item in sample["inputSchema"])
    assert any(item["type"] == "select" for item in sample["inputSchema"])
    assert any(item["type"] == "prompt" for item in sample["inputSchema"])

    assert manifest["version"] == "0.20.0"
    assert manifest["updated_at"] == "2026-07-11"
    for tracked in manifest["tracked_files"]:
        if not (ROOT / tracked).exists():
            raise AssertionError(f"skill-manifest.json tracks missing file: {tracked}")


if __name__ == "__main__":
    main()
