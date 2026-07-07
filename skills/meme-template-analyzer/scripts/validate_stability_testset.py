#!/usr/bin/env python3
"""校验 meme stability-testset 的参考图可追踪性。"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REQUIRED_REFERENCE_MODES = {
    "text_only_baseline": {
        "uses_user_subject_reference": False,
        "uses_source_meme_reference": False,
        "source_meme_usage": "none",
    },
    "user_subject_reference_only": {
        "uses_user_subject_reference": True,
        "uses_source_meme_reference": False,
        "source_meme_usage": "textual_locked_anchors_only",
    },
    "user_subject_plus_source_meme_reference": {
        "uses_user_subject_reference": True,
        "uses_source_meme_reference": True,
        "source_meme_usage": "image_reference",
    },
}

CASE_GROUPS = ("faithful_cases", "creative_cases", "negative_controls")


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _mode_errors(prefix: str, mode: str, usage: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    expected = REQUIRED_REFERENCE_MODES.get(mode)
    if expected is None:
        errors.append(f"{prefix}: 未知 reference_mode '{mode}'")
        return errors

    for key, expected_value in expected.items():
        actual_value = usage.get(key)
        if actual_value != expected_value:
            errors.append(
                f"{prefix}: reference_usage.{key} 对于 {mode} 必须是 "
                f"{expected_value!r}，实际为 {actual_value!r}"
            )
    return errors


def _validate_reference_matrix(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    matrix = data.get("reference_test_matrix")
    if not isinstance(matrix, list) or not matrix:
        return ["reference_test_matrix 为必填项，且必须是非空 list"]

    seen_modes = set()
    for index, entry in enumerate(matrix):
        prefix = f"reference_test_matrix[{index}]"
        if not isinstance(entry, dict):
            errors.append(f"{prefix}: 必须是 object")
            continue
        mode = entry.get("reference_mode")
        if not isinstance(mode, str):
            errors.append(f"{prefix}.reference_mode 为必填项")
            continue
        seen_modes.add(mode)
        errors.extend(_mode_errors(prefix, mode, entry))
        if not entry.get("test_purpose"):
            errors.append(f"{prefix}.test_purpose 为必填项")

    missing = sorted(set(REQUIRED_REFERENCE_MODES) - seen_modes)
    for mode in missing:
        errors.append(f"reference_test_matrix 缺少必需 mode: {mode}")
    return errors


def _iter_cases(data: dict[str, Any]):
    for group in CASE_GROUPS:
        for index, case in enumerate(_as_list(data.get(group))):
            yield group, index, case


def _validate_cases(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    case_count = 0
    for group, index, case in _iter_cases(data):
        case_count += 1
        prefix = f"{group}[{index}]"
        if not isinstance(case, dict):
            errors.append(f"{prefix}: 必须是 object")
            continue

        case_id = case.get("case_id")
        if not case_id:
            errors.append(f"{prefix}.case_id 为必填项")

        mode = case.get("reference_mode")
        if not isinstance(mode, str):
            errors.append(f"{prefix}.reference_mode 为必填项")
            continue

        usage = case.get("reference_usage")
        if not isinstance(usage, dict):
            errors.append(f"{prefix}.reference_usage 为必填项")
            continue

        errors.extend(_mode_errors(prefix, mode, usage))
        required_usage_fields = (
            "user_subject_reference_source",
            "user_subject_reference_quality",
            "source_meme_reference_source",
            "reference_priority",
            "expected_benefit",
            "risk_to_watch",
            "test_purpose",
        )
        for field in required_usage_fields:
            if field not in usage:
                errors.append(f"{prefix}.reference_usage.{field} 为必填项")

    if case_count == 0:
        errors.append("至少需要一个 stability test case")
    return errors


def _validate_repeatability_protocol(data: dict[str, Any]) -> list[str]:
    protocol = data.get("repeatability_protocol")
    if not isinstance(protocol, dict):
        return ["repeatability_protocol 为必填项"]

    errors: list[str] = []
    modes = set(_as_list(protocol.get("reference_modes_per_case")))
    missing = sorted(set(REQUIRED_REFERENCE_MODES) - modes)
    for mode in missing:
        errors.append(f"repeatability_protocol.reference_modes_per_case 缺少 mode: {mode}")
    return errors


def validate(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return ["root 必须是 JSON object"]

    errors: list[str] = []
    if data.get("artifact_type") != "meme_stability_testset":
        errors.append("artifact_type 必须是 'meme_stability_testset'")

    errors.extend(_validate_reference_matrix(data))
    errors.extend(_validate_cases(data))
    errors.extend(_validate_repeatability_protocol(data))
    return errors


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="校验 stability-testset.json 的参考图可追踪性。"
    )
    parser.add_argument("path", help="stability-testset.json 路径")
    args = parser.parse_args(argv)

    path = Path(args.path)
    try:
        data = load_json(path)
    except Exception as exc:  # pragma: no cover - CLI guard
        print(f"读取 JSON 失败: {exc}", file=sys.stderr)
        return 1

    errors = validate(data)
    if errors:
        print("stability-testset 校验失败:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("stability-testset 校验通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
