import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import validate_stability_testset as validator


def valid_case(case_id, scope, reference_mode):
    uses_user = reference_mode in {
        "user_subject_reference_only",
        "user_subject_plus_source_meme_reference",
    }
    uses_source = reference_mode == "user_subject_plus_source_meme_reference"
    source_usage = "image_reference" if uses_source else (
        "textual_locked_anchors_only" if uses_user else "none"
    )
    return {
        "case_id": case_id,
        "variant_scope": scope,
        "reference_mode": reference_mode,
        "reference_usage": {
            "uses_user_subject_reference": uses_user,
            "user_subject_reference_source": "mock_user_upload" if uses_user else "none",
            "user_subject_reference_quality": "medium" if uses_user else "not_applicable",
            "uses_source_meme_reference": uses_source,
            "source_meme_reference_source": "uploaded_source_meme" if uses_source else "none",
            "source_meme_usage": source_usage,
            "reference_priority": "user_subject_first" if uses_user else "none",
            "expected_benefit": "追踪参考图影响",
            "risk_to_watch": [],
            "test_purpose": "比较参考图使用方式",
        },
        "raw_user_input": "插入一只企鹅",
        "expected_locked_features": ["复古 meme 照片风格"],
        "expected_editable_slots": ["subject_primary"],
        "expected_reading_model": ["前景主体冷静，背景灾难形成反差"],
        "expected_salience_model": ["主体为主导注意力，灾难背景为次要注意力"],
        "expected_style_profile": ["低分辨率照片"],
        "expected_subject_replacement_policy": {},
        "expected_creative_freedom_controls": {},
        "allowed_changes": ["主体替换"],
        "forbidden_drift": ["缺少参考图使用记录"],
        "expected_prompt_json_paths": ["$.rendered_prompts.faithful.prompt"],
        "pass_criteria": ["参考图使用方式明确"],
    }


def valid_testset():
    return {
        "schema_version": "1.1",
        "artifact_type": "meme_stability_testset",
        "source_template_id": "calm_pet_disaster",
        "test_goal": "验证参考图使用可追踪性",
        "reference_test_matrix": [
            {
                "reference_mode": "text_only_baseline",
                "uses_user_subject_reference": False,
                "uses_source_meme_reference": False,
                "source_meme_usage": "none",
                "reference_priority": "none",
                "test_purpose": "检查基线漂移",
            },
            {
                "reference_mode": "user_subject_reference_only",
                "uses_user_subject_reference": True,
                "uses_source_meme_reference": False,
                "source_meme_usage": "textual_locked_anchors_only",
                "reference_priority": "user_subject_first",
                "test_purpose": "检查身份参考图效果",
            },
            {
                "reference_mode": "user_subject_plus_source_meme_reference",
                "uses_user_subject_reference": True,
                "uses_source_meme_reference": True,
                "source_meme_usage": "image_reference",
                "reference_priority": "user_subject_first",
                "test_purpose": "检查源 meme 参考图风险",
            },
        ],
        "faithful_cases": [
            valid_case("faithful_01_text", "faithful", "text_only_baseline"),
            valid_case("faithful_01_user", "faithful", "user_subject_reference_only"),
            valid_case(
                "faithful_01_both",
                "faithful",
                "user_subject_plus_source_meme_reference",
            ),
        ],
        "creative_cases": [],
        "negative_controls": [],
        "evaluation_rubric": [],
        "repeatability_protocol": {
            "generations_per_case": 3,
            "reference_modes_per_case": [
                "text_only_baseline",
                "user_subject_reference_only",
                "user_subject_plus_source_meme_reference",
            ],
            "compare_dimensions": ["身份", "构图", "源主体泄漏"],
            "stable_if": ["参考图使用方式保持可追踪"],
            "unstable_if": ["reference mode 被遗漏"],
        },
    }


class StabilityTestsetValidatorTests(unittest.TestCase):
    def test_valid_reference_matrix_passes(self):
        errors = validator.validate(valid_testset())
        self.assertEqual(errors, [])

    def test_missing_case_reference_usage_fails(self):
        data = valid_testset()
        del data["faithful_cases"][0]["reference_usage"]
        errors = validator.validate(data)
        self.assertTrue(any("reference_usage" in error for error in errors))

    def test_missing_required_reference_mode_fails(self):
        data = valid_testset()
        data["reference_test_matrix"] = data["reference_test_matrix"][:2]
        errors = validator.validate(data)
        self.assertTrue(any("user_subject_plus_source_meme_reference" in error for error in errors))

    def test_cli_returns_nonzero_for_invalid_file(self):
        data = valid_testset()
        data["faithful_cases"][1]["reference_usage"]["uses_user_subject_reference"] = False
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "stability-testset.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                exit_code = validator.main([str(path)])
        self.assertEqual(exit_code, 1)


if __name__ == "__main__":
    unittest.main()
