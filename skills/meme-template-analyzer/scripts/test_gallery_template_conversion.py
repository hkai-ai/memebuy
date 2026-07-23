from __future__ import annotations

import json
import sys
import tempfile
from copy import deepcopy
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from convert_image_edit_to_meme_template import build_gallery_template  # noqa: E402
from clean_image_edit_template import clean_template  # noqa: E402
from validate_gallery_template import validate, validate_artifact_paths  # noqa: E402
from validate_semantic_analysis import validate_analysis  # noqa: E402


ROOT = SCRIPT_DIR.parent


def fixture() -> dict:
    return {
        "schemaVersion": "2.0.0",
        "templateId": "laser_cat_test",
        "title": "激光猫",
        "summary": "内部分析摘要，不应进入 description",
        "description": "激光宠物海报",
        "templateText": "一只【主体：白猫】发射【激光颜色：粉色】激光。",
        "slots": [
            {
                "id": "subject",
                "label": "主体",
                "inputKind": "subject",
                "slotRole": "semantic_replacement",
                "required": True,
                "defaultValue": "白猫",
                "suggestions": ["白猫", "黑狗", "熊猫", "垂耳兔"],
                "allowCustom": True,
                "imagePromptValue": "用户上传图中的主体",
                "extract": "保留主体身份、轮廓与颜色，不继承构图。",
                "maxCount": 1,
                "private": True,
                "sourceOptions": ["upload", "asset_library"],
            },
            {
                "id": "laser_color",
                "label": "激光颜色",
                "inputKind": "select",
                "slotRole": "visual_variable",
                "required": True,
                "defaultValue": "粉色",
                "suggestions": ["粉色", "蓝色"],
                "allowCustom": False,
            },
            {
                "id": "subject_reference",
                "label": "主体参考图",
                "inputKind": "image_upload",
                "slotRole": "identity_reference",
                "required": False,
                "maxCount": 1,
                "private": True,
                "extract": "保留主体身份。",
                "sourceOptions": ["upload"],
                "allowCustom": False,
            },
        ],
        "templateSource": {
            "path": "source.png",
            "role": "template_reference",
            "preserve": ["subject_on_right"],
            "locked_composition_constraints": [
                {"id": "laser_direction", "value": "保持主体位于右侧并向左下方发射激光的纵向构图与画幅裁切。"},
                {"id": "paper_style", "value": "保持粗糙纸张颗粒、复古印刷网点和手绘线稿结合的媒介质感。"},
                {"id": "spatial_relation", "value": "保持主体、眼睛与激光之间的前后层级、遮挡关系和方向联系。"}
            ],
        },
        "taxonomy": {
            "category": "反差",
            "styles": ["复古"],
            "needs_review": ["taxonomy"],
        },
        "tagAssignments": [
            {"tagId": "scene.pet", "label": "宠物", "dimension": "scene", "level": "category", "source": "operator", "status": "accepted"},
            {"tagId": "mechanism.visual-contrast", "label": "视觉反差", "dimension": "mechanism", "level": "tag", "source": "template", "status": "accepted"},
            {"label": "白猫", "dimension": "subject", "level": "tag", "source": "ai", "status": "accepted", "confidence": 0.94},
            {"label": "疑似惊讶", "dimension": "emotion", "level": "tag", "source": "ai", "status": "suggested", "confidence": 0.52},
            {"label": "funny cat", "dimension": "source_tag", "level": "tag", "source": "external", "status": "accepted", "provider": "pinterest"},
        ],
        "semanticReview": semantic_fixture(),
    }


def semantic_fixture() -> dict:
    return {
        "visual_observations": ["动物主体", "单颗珍珠耳环", "头巾", "越肩回眸"],
        "distinctive_feature_bundle": ["头巾", "单颗珍珠耳环", "越肩回眸"],
        "content_function": "meme_template",
        "reference_discovery": {
            "reference_status": "probable",
            "reference_type": "artwork",
            "primary_reference": "《戴珍珠耳环的少女》",
            "evidence": ["三个识别锚点同时出现"],
            "counter_evidence": [],
            "none_evidence": [],
            "human_review_required": False,
            "review_reasons": [],
        },
        "interpretation_hypotheses": [
            {"kind": "external_reference", "claim": "名画戏仿", "explains": ["头巾"], "unexplained": [], "assumptions": [], "confidence": 0.95},
            {"kind": "intrinsic_visual_joke", "claim": "动物拟人化", "explains": ["动物配饰"], "unexplained": ["组合来源"], "assumptions": [], "confidence": 0.6},
            {"kind": "standalone_image", "claim": "普通萌宠照", "explains": ["动物"], "unexplained": ["名画锚点"], "assumptions": [], "confidence": 0.1},
        ],
        "formula_reflection_review": {
            "distinctive_bundle_explained": True,
            "alternative_hypotheses_compared": True,
            "generic_description_risk": "low",
            "reference_anchors_identified": ["头巾", "单颗珍珠耳环", "越肩回眸"],
            "unknown_as_none_risk": "low",
            "passed": True,
            "review_reasons": [],
        },
        "confidence": {
            "visual_observation": 0.98,
            "reference_identification": 0.95,
            "context_understanding": 0.8,
            "meme_formula": 0.94,
            "slot_design": 0.9,
        },
    }


def main() -> None:
    sample = json.loads(
        (ROOT / "references" / "gallery-template-import.sample.json").read_text(encoding="utf-8")
    )
    assert not validate(sample), validate(sample)

    record = build_gallery_template(fixture())
    assert not validate(record), validate(record)
    assert set(record) == {
        "key",
        "title",
        "description",
        "cover",
        "referenceImage",
        "imageSize",
        "imageN",
        "inputSchema",
        "preprocessSteps",
        "promptTemplate",
        "promptEnhancement",
        "metadata",
    }
    assert record["preprocessSteps"] == []
    assert "stageKey" not in record
    assert record["cover"] == "source.png"
    assert record["referenceImage"] == "source.png"
    assert record["imageSize"] == "1024x1024"
    assert record["description"] == "激光宠物海报"
    assert record["metadata"]["version"] == "2.0.0"
    assert "{{ subject | \"白猫\" }}" in record["promptTemplate"]
    assert "激光向左下方发射" not in record["promptTemplate"]
    assert record["promptEnhancement"]["lockedConstraints"] == [
        "沿用参考图的画幅、裁切、留白、镜头景别与元素位置比例",
        "沿用参考图的媒介质感与材质表现",
        "沿用参考图的前景背景层级、遮挡关系与阅读顺序",
    ]
    assert record["promptEnhancement"]["preserve"] == []
    assert record["promptEnhancement"]["referenceField"] == "referenceImage"
    assert record["promptEnhancement"]["output"] == {"format": "json", "promptField": "finalPrompt"}
    assert "只输出最终成图" in record["promptEnhancement"]["instruction"]
    assert record["inputSchema"][0]["type"] == "subject"
    assert record["inputSchema"][0]["resolutionStrategy"] == "image_over_text"
    assert record["inputSchema"][0]["image"]["promptValue"] == "用户上传图中的主体"
    assert record["inputSchema"][1]["type"] == "select"
    assert record["inputSchema"][1]["options"][0] == {"value": "粉色", "label": "粉色"}
    assert record["inputSchema"][2]["type"] == "image"
    assert record["metadata"]["needsReview"] == "taxonomy"
    assert record["metadata"]["tags"] == ["反差", "复古", "宠物", "视觉反差", "白猫", "funny cat"]
    assert len(record["metadata"]["tagAssignments"]) == 5
    assert "疑似惊讶" not in record["metadata"]["tags"]
    assert record["metadata"]["referenceContext"]["status"] == "probable"
    assert record["metadata"]["referenceContext"]["primaryReference"] == "《戴珍珠耳环的少女》"
    assert record["inputSchema"][0]["label"] == "主体"
    assert record["inputSchema"][0]["image"]["promptValue"] == "用户上传图中的主体"
    assert record["metadata"]["inputSemantics"]["subject"]["semanticType"] == "subject_identity"
    assert record["metadata"]["inputSemantics"]["subject"]["uploadLabel"] == "上传主体图"
    assert "上传图决定对应主体的身份、物种与人物类型" in record["promptEnhancement"]["instruction"]
    assert "在开放槽位对应维度上不具权限" in record["promptEnhancement"]["instruction"]
    assert "finalPrompt 必须" not in record["promptEnhancement"]["instruction"]
    assert "path" not in record["metadata"]["templateSource"]
    assert record["metadata"]["templateSource"]["referenceField"] == "referenceImage"

    leaking_fixture = fixture()
    leaking_fixture["promptEnhancement"] = {
        "stageKey": "gallery.prompt_rewrite",
        "instruction": "按 reaction_portrait 组件图执行编辑。每个输入只修改其绑定组件。",
        "preserve": ["reaction_portrait_1", "reaction_portrait_2"],
    }
    leaking_fixture["templateSource"]["preserve"] = [
        "reaction_portrait_1", "reaction_portrait_2"
    ]
    leaking_fixture["templateSource"]["locked_composition_constraints"][0]["description"] = (
        "保持激光方向，具体可编辑内容由组件槽位控制。"
    )
    sanitized = build_gallery_template(leaking_fixture)
    assert "组件图" not in sanitized["promptEnhancement"]["instruction"]
    assert "只输出最终成图" in sanitized["promptEnhancement"]["instruction"]
    assert sanitized["promptEnhancement"]["preserve"] == []
    assert sanitized["metadata"]["templateSource"]["preserve"] == []
    assert "组件槽位" not in sanitized["metadata"]["templateSource"]["locked_composition_constraints"][0]["description"]

    visibility_fixture = fixture()
    visibility_fixture["promptEnhancement"] = {
        "stageKey": "gallery.prompt_rewrite",
        "instruction": "后端内部策略",
    }
    frontend = clean_template(
        visibility_fixture,
        "frontend",
        None,
        keep_suggestion_reasons=False,
        keep_slot_ui=False,
        keep_mock_user_input=False,
    )
    assert frontend["description"] == "激光宠物海报"
    assert "summary" not in frontend
    assert "promptEnhancement" not in frontend
    runtime = clean_template(
        visibility_fixture,
        "runtime",
        None,
        keep_suggestion_reasons=False,
        keep_slot_ui=False,
        keep_mock_user_input=False,
    )
    assert runtime["promptEnhancement"]["instruction"] == "后端内部策略"

    without_taxonomy = fixture()
    without_taxonomy.pop("taxonomy")
    draft_record = build_gallery_template(without_taxonomy)
    assert draft_record["metadata"]["needsReview"] == "taxonomy 未提供或未确认"

    suspected = fixture()
    suspected["taxonomy"]["needs_review"] = []
    suspected["semanticReview"]["reference_discovery"].update(
        {
            "reference_status": "suspected",
            "reference_type": "game",
            "primary_reference": "未确认的游戏角色梗",
            "human_review_required": True,
            "review_reasons": ["疑似小众游戏梗，出处未确认"],
        }
    )
    suspected_record = build_gallery_template(suspected)
    assert suspected_record["metadata"]["needsReview"] == "疑似小众游戏梗，出处未确认"

    assert not validate_analysis(semantic_fixture())
    incomplete_semantics = semantic_fixture()
    incomplete_semantics["interpretation_hypotheses"] = incomplete_semantics["interpretation_hypotheses"][:1]
    assert any("missing kinds" in error for error in validate_analysis(incomplete_semantics))

    broken_semantics = json.loads(json.dumps(record, ensure_ascii=False))
    broken_semantics["metadata"]["inputSemantics"]["missing_slot"] = {
        "slotRole": "visual_variable",
        "defaultValue": "红色",
    }
    errors = validate(broken_semantics)
    assert any(
        "metadata.inputSemantics references undefined input ids: missing_slot" in error
        for error in errors
    ), errors

    portrait = fixture()
    portrait["sourceAccess"] = {"inputs": [{"width": 593, "height": 727}]}
    assert build_gallery_template(portrait)["imageSize"] == "832x1024"

    invalid_boolean = deepcopy(record)
    invalid_boolean["inputSchema"][0]["required"] = "false"
    assert any("required must be a boolean" in error for error in validate(invalid_boolean))

    invalid_dimension = deepcopy(record)
    invalid_dimension["inputSchema"][2]["minWidth"] = 32
    assert any("minWidth must be an integer from 64 to 8192" in error for error in validate(invalid_dimension))

    invalid_subject = deepcopy(record)
    invalid_subject["inputSchema"][0]["image"]["promptValue"] = "白猫"
    assert any("must not repeat the default text subject" in error for error in validate(invalid_subject))

    invalid_prompt = deepcopy(record)
    invalid_prompt["promptTemplate"] = '{{ subject | "白猫" '
    assert any("unclosed or unmatched placeholder" in error for error in validate(invalid_prompt))

    invalid_payload = deepcopy(record)
    invalid_payload["promptTemplate"] = "{{ laser_color.missing | \"粉色\" }}"
    assert any("undefined select payload field" in error for error in validate(invalid_payload))

    leaked_constraint = deepcopy(record)
    leaked_constraint["promptTemplate"] += " 必须遵守：保持构图。"
    assert any("backend-only constraint text" in error for error in validate(leaked_constraint))

    invalid_external_tag = deepcopy(record)
    invalid_external_tag["metadata"]["tagAssignments"][-1].pop("provider")
    assert any("provider is required for external source" in error for error in validate(invalid_external_tag))

    missing_flat_tag = deepcopy(record)
    missing_flat_tag["metadata"]["tags"].remove("白猫")
    assert any("missing accepted assignment labels" in error for error in validate(missing_flat_tag))

    with tempfile.TemporaryDirectory() as temp:
        base_dir = Path(temp)
        (base_dir / "source.png").write_bytes(b"image")
        local_record = deepcopy(record)
        local_record["cover"] = "source.png"
        local_record["referenceImage"] = "source.png"
        assert not validate_artifact_paths(local_record, base_dir, asset_mode="local")
        assert any(
            "must be a remote URL" in error
            for error in validate_artifact_paths(local_record, base_dir, asset_mode="remote")
        )

        remote_record = deepcopy(record)
        remote_record["cover"] = "https://assets.memebuy.cn/dev/gallery/templates/123e4567-e89b-42d3-a456-426614174000.webp"
        remote_record["referenceImage"] = remote_record["cover"]
        assert not validate_artifact_paths(
            remote_record,
            base_dir,
            asset_mode="remote",
            assets_domain="assets.memebuy.cn",
            key_prefix="dev/",
        )
        remote_record["cover"] = "file:///tmp/source.png"
        assert any(
            "scheme is not supported" in error
            for error in validate_artifact_paths(
                remote_record,
                base_dir,
                asset_mode="remote",
                assets_domain="assets.memebuy.cn",
                key_prefix="dev/",
            )
        )

    bad_source = fixture()
    bad_source["slots"][0]["required"] = "false"
    try:
        build_gallery_template(bad_source)
    except ValueError as error:
        assert "required must be a boolean" in str(error)
    else:
        raise AssertionError("converter accepted a string boolean")

    unused_slot = fixture()
    unused_slot["slots"].append(
        {
            "id": "unused_prop",
            "label": "随身物",
            "inputKind": "prompt",
            "slotRole": "semantic_replacement",
            "required": False,
            "defaultValue": "雨伞",
            "suggestions": ["雨伞", "手提包", "书本"],
        }
    )
    try:
        build_gallery_template(unused_slot)
    except ValueError as error:
        assert "every textual slot must appear naturally" in str(error)
    else:
        raise AssertionError("converter silently appended an unused textual slot")


if __name__ == "__main__":
    main()
