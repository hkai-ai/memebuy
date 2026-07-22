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
    cultural_reference = read("references/cultural-reference-discovery.md")
    reference_authority = read("references/reference-authority.md")
    prompt_validation = read("references/prompt-and-validation.md")
    prompt_enhancement = read("references/prompt-enhancement-v2.md")
    generation_testing = read("references/generation-testing.md")
    batch_review = read("references/batch-and-review.md")
    tagging_taxonomy = read("references/tagging-and-taxonomy.md")
    oss_handoff = read("references/oss-handoff.md")
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
        "formula_reflection_review",
        "validate_semantic_analysis.py",
        "编译与验证",
        "用户原图默认直通生成",
        "validate_gallery_template.py",
        "一个模板一个",
        "authoring-handoff",
        "oss-handoff.md",
        "tagging-and-taxonomy.md",
    ]:
        require(skill, needle, "SKILL.md")

    for needle in [
        "templateText",
        "editablePrompt",
        "allowFullRewrite",
        "slots[]",
        "完整画面描述",
        "禁止显示单选项候选控件",
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

    for needle in ["operator", "ai", "external", "tagAssignments", "tag-catalog.snapshot.json", "metadata.tags", "普通 tags", "8 组风格标签", "4 组情绪标签", "group"]:
        require(tagging_taxonomy, needle, "references/tagging-and-taxonomy.md")
    for reference in [
        "slot-and-visual-design.md",
        "cultural-reference-discovery.md",
        "reference-authority.md",
        "prompt-and-validation.md",
        "prompt-enhancement-v2.md",
        "generation-testing.md",
        "batch-and-review.md",
    ]:
        require(skill, reference, "SKILL.md")

    for needle in [
        "distinctive_feature_bundle",
        "interpretation_hypotheses",
        "external_reference",
        "intrinsic_visual_joke",
        "standalone_image",
        "confirmed",
        "probable",
        "suspected",
        "unknown",
        "none",
        "formula_reflection_review",
        "generic_description_risk",
        "content_function",
    ]:
        require(cultural_reference, needle, "cultural-reference-discovery.md")

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
        "promptEnhancement",
        "resolvedPrompt",
        "inputSchema",
        "preprocessSteps",
        "完整、连贯、可独立理解",
        "至少 3 个去重",
        "LiquidJS",
        "allowCustom: true",
        "{value,label}",
        "gallery.template_image",
        "validate_gallery_template.py",
    ]:
        require(prompt_validation, needle, "prompt-and-validation.md")

    for needle in [
        "开放内容由用户决定",
        "呈现维度",
        "不要用文字复述",
        "lockedConstraints",
        "preserve",
        "openSlotLabels",
        "gallery.template_rewrite",
        "parsed.prompt",
        "全文编辑",
    ]:
        require(prompt_enhancement, needle, "prompt-enhancement-v2.md")

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
        "semanticReviewStatus",
        "needs_research",
        "最终 JSON",
        "不能当作后端批量导入载荷",
        "handoff/<batch-id>/<template-key>.json",
    ]:
        require(batch_review, needle, "batch-and-review.md")

    for needle in [
        "pnpm gallery:finalize",
        "ALIYUN_OSS_ASSETS_DOMAIN",
        "metadata.needsReview",
        "SHA-256",
        "handoff",
        "--write-back",
        "--progress-file",
        "HEAD",
        "不得读取、打印、复制或写入 AK/SK",
        "最终交付清单",
        "不能只给 `batch-manifest.json`",
    ]:
        require(oss_handoff, needle, "oss-handoff.md")

    for needle in [
        "additionalProperties: false",
        "{{ subject | \"白猫\" }}",
        "promptEnhancement",
        "resolvedPrompt",
        "image_over_text",
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
        "promptEnhancement",
        "resolvedPrompt",
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
    assert schema["required"] == ["key", "title", "promptTemplate", "promptEnhancement", "inputSchema"]
    assert schema["properties"]["description"]["maxLength"] == 20
    assert "tagAssignments" in schema["properties"]["metadata"]["properties"]
    assert "tagAssignment" in schema["$defs"]
    assert sample["metadata"]["tagAssignments"][0]["source"] == "operator"
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
        "promptEnhancement",
        "inputSchema",
        "preprocessSteps",
        "metadata",
    }
    assert sample["preprocessSteps"] == []
    assert any(item["type"] == "image" for item in sample["inputSchema"])
    assert not any(item["type"] == "select" for item in sample["inputSchema"])
    assert any(item["type"] == "prompt" for item in sample["inputSchema"])
    assert any(item["type"] == "subject" for item in sample["inputSchema"])
    assert len(sample["description"]) <= 20
    assert sample["promptEnhancement"]["output"] == {"format": "json", "promptField": "finalPrompt"}

    for needle in [
        "任务完成后会交付什么",
        "handoff/<batch-id>/",
        "应交给后端吗",
    ]:
        require(readme, needle, "README.md")

    assert manifest["version"] == "0.36.0"
    assert "references/tagging-and-taxonomy.md" in manifest["tracked_files"]
    assert "scripts/validate_slot_intelligence.py" in manifest["tracked_files"]
    assert "scripts/test_slot_intelligence.py" in manifest["tracked_files"]
    assert "scripts/validate_frontend_experience.py" in manifest["tracked_files"]
    assert "scripts/test_frontend_experience.py" in manifest["tracked_files"]
    assert "references/prompt-enhancement-v2.md" in manifest["tracked_files"]
    assert manifest["updated_at"] == "2026-07-22"
    for tracked in manifest["tracked_files"]:
        if not (ROOT / tracked).exists():
            raise AssertionError(f"skill-manifest.json tracks missing file: {tracked}")


if __name__ == "__main__":
    main()
