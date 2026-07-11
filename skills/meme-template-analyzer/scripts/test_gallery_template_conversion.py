from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from convert_image_edit_to_meme_template import build_gallery_template  # noqa: E402
from validate_gallery_template import validate  # noqa: E402


ROOT = SCRIPT_DIR.parent


def fixture() -> dict:
    return {
        "schemaVersion": "1.0",
        "templateId": "laser_cat_test",
        "title": "激光猫",
        "summary": "测试模板",
        "templateText": "一只【主体：白猫】发射【激光颜色：粉色】激光。",
        "slots": [
            {
                "id": "subject",
                "label": "主体",
                "inputKind": "text",
                "slotRole": "semantic_replacement",
                "required": True,
                "defaultValue": "白猫",
                "suggestions": ["黑狗", "熊猫"],
                "allowCustom": True,
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
                {"id": "laser_direction", "value": "激光向左下方发射。"}
            ],
        },
        "taxonomy": {
            "category": "反差",
            "styles": ["复古"],
            "needs_review": ["taxonomy"],
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
        "metadata",
    }
    assert record["preprocessSteps"] == []
    assert "stageKey" not in record
    assert record["cover"] == "source.png"
    assert record["referenceImage"] == "source.png"
    assert record["imageSize"] == "1024x1024"
    assert "{{ subject | \"白猫\" }}" in record["promptTemplate"]
    assert "激光向左下方发射" in record["promptTemplate"]
    assert record["inputSchema"][0]["type"] == "prompt"
    assert record["inputSchema"][1]["type"] == "select"
    assert record["inputSchema"][1]["options"][0] == {"value": "粉色", "label": "粉色"}
    assert record["inputSchema"][2]["type"] == "image"
    assert record["metadata"]["needsReview"] == "taxonomy"
    assert "path" not in record["metadata"]["templateSource"]
    assert record["metadata"]["templateSource"]["referenceField"] == "referenceImage"

    without_taxonomy = fixture()
    without_taxonomy.pop("taxonomy")
    draft_record = build_gallery_template(without_taxonomy)
    assert draft_record["metadata"]["needsReview"] == "taxonomy 未提供或未确认"

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

    invalid_prompt = deepcopy(record)
    invalid_prompt["promptTemplate"] = '{{ subject | "白猫" '
    assert any("unclosed or unmatched placeholder" in error for error in validate(invalid_prompt))

    invalid_payload = deepcopy(record)
    invalid_payload["promptTemplate"] = "{{ laser_color.missing | \"粉色\" }}"
    assert any("undefined select payload field" in error for error in validate(invalid_payload))

    bad_source = fixture()
    bad_source["slots"][0]["required"] = "false"
    try:
        build_gallery_template(bad_source)
    except ValueError as error:
        assert "required must be a boolean" in str(error)
    else:
        raise AssertionError("converter accepted a string boolean")


if __name__ == "__main__":
    main()
