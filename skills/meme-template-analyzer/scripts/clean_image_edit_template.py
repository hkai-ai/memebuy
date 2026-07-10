#!/usr/bin/env python3
"""Clean image-edit-template artifacts for runtime or frontend use.

The default profile keeps fields needed by both frontend rendering and backend
prompt compilation, but moves the bulky analysis block into a sidecar file.
The source file is never overwritten unless --in-place is passed.
"""

from __future__ import annotations

import argparse
import json
from collections import OrderedDict
from pathlib import Path
from typing import Any


RUNTIME_KEYS = [
    "schemaVersion",
    "artifactType",
    "createdAt",
    "sourceAccess",
    "templateId",
    "title",
    "summary",
    "templateSource",
    "userSubjectInput",
    "templateText",
    "editablePrompt",
    "allowFullRewrite",
    "slots",
    "imageRefs",
    "backendHint",
    "analysisRef",
]

FRONTEND_KEYS = [
    "schemaVersion",
    "artifactType",
    "createdAt",
    "templateId",
    "title",
    "summary",
    "templateText",
    "editablePrompt",
    "allowFullRewrite",
    "slots",
]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def ordered_subset(data: dict[str, Any], keys: list[str]) -> OrderedDict[str, Any]:
    cleaned: OrderedDict[str, Any] = OrderedDict()
    for key in keys:
        if key in data:
            cleaned[key] = data[key]
    for key, value in data.items():
        if key not in cleaned and key != "analysis":
            cleaned[key] = value
    return cleaned


def simplify_suggestions(suggestions: Any, keep_reasons: bool) -> Any:
    if not isinstance(suggestions, list):
        return suggestions

    simplified = []
    for item in suggestions:
        if isinstance(item, str):
            simplified.append(item)
            continue
        if not isinstance(item, dict):
            simplified.append(item)
            continue
        value = item.get("value", item.get("label"))
        label = item.get("label")
        reason = item.get("reason")
        if value is None:
            simplified.append(item)
        elif keep_reasons and (label not in (None, value) or reason):
            compact_item = OrderedDict([("value", value)])
            if label not in (None, value):
                compact_item["label"] = label
            if reason:
                compact_item["reason"] = reason
            simplified.append(compact_item)
        else:
            simplified.append(value)
    return simplified


def simplify_slots(
    slots: Any,
    *,
    keep_suggestion_reasons: bool,
    keep_slot_ui: bool,
) -> Any:
    if not isinstance(slots, list):
        return slots

    simplified_slots = []
    for slot in slots:
        if not isinstance(slot, dict):
            simplified_slots.append(slot)
            continue

        cleaned_slot = OrderedDict()
        for key, value in slot.items():
            if key == "suggestions":
                cleaned_slot[key] = simplify_suggestions(value, keep_suggestion_reasons)
            elif key == "ui" and not keep_slot_ui:
                continue
            else:
                cleaned_slot[key] = value
        simplified_slots.append(cleaned_slot)
    return simplified_slots


def default_output_path(input_path: Path, profile: str) -> Path:
    if profile == "frontend":
        return input_path.with_name("image-edit-template.frontend.json")
    return input_path.with_name("image-edit-template.clean.json")


def default_analysis_path(input_path: Path) -> Path:
    return input_path.with_name("image-edit-analysis.json")


def write_json(path: Path, data: Any, indent: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write("\n")


def clean_template(
    data: dict[str, Any],
    profile: str,
    analysis_ref: str | None,
    *,
    keep_suggestion_reasons: bool,
    keep_slot_ui: bool,
    keep_mock_user_input: bool,
) -> OrderedDict[str, Any]:
    working = dict(data)
    analysis = working.pop("analysis", None)
    if not keep_mock_user_input:
        working.pop("mockUserInput", None)
    if "slots" in working:
        working["slots"] = simplify_slots(
            working["slots"],
            keep_suggestion_reasons=keep_suggestion_reasons,
            keep_slot_ui=keep_slot_ui,
        )

    if profile == "runtime":
        if analysis is not None and analysis_ref:
            working["analysisRef"] = analysis_ref
        return ordered_subset(working, RUNTIME_KEYS)

    if profile == "frontend":
        return ordered_subset({key: working[key] for key in FRONTEND_KEYS if key in working}, FRONTEND_KEYS)

    raise ValueError(f"Unsupported profile: {profile}")


def byte_len(path: Path) -> int:
    return path.stat().st_size if path.exists() else 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Clean image-edit-template.json into smaller runtime/frontend artifacts."
    )
    parser.add_argument("input", type=Path, help="Path to image-edit-template.json")
    parser.add_argument(
        "--profile",
        choices=["runtime", "frontend"],
        default="runtime",
        help="runtime keeps backend/API fields; frontend keeps only UI-facing API response fields.",
    )
    parser.add_argument("--output", type=Path, help="Output JSON path")
    parser.add_argument(
        "--analysis-output",
        type=Path,
        help="Sidecar path for the removed analysis block.",
    )
    parser.add_argument(
        "--no-analysis-sidecar",
        action="store_true",
        help="Drop analysis without writing image-edit-analysis.json.",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite the input file with the cleaned result.",
    )
    parser.add_argument(
        "--keep-suggestion-reasons",
        action="store_true",
        help="Keep suggestion reason/label objects instead of simplifying to string arrays.",
    )
    parser.add_argument(
        "--keep-slot-ui",
        action="store_true",
        help="Keep slot ui metadata such as group/order/helperText.",
    )
    parser.add_argument(
        "--keep-mock-user-input",
        action="store_true",
        help="Keep mockUserInput for demos or product validation previews.",
    )
    parser.add_argument("--indent", type=int, default=2, help="JSON indentation")
    args = parser.parse_args()

    input_path = args.input.resolve()
    data = load_json(input_path)
    original_bytes = byte_len(input_path)

    analysis = data.get("analysis")
    analysis_output = args.analysis_output or default_analysis_path(input_path)
    write_analysis = (
        args.profile == "runtime"
        and analysis is not None
        and not args.no_analysis_sidecar
    )
    analysis_ref = analysis_output.name if write_analysis else None

    cleaned = clean_template(
        data,
        args.profile,
        analysis_ref,
        keep_suggestion_reasons=args.keep_suggestion_reasons,
        keep_slot_ui=args.keep_slot_ui,
        keep_mock_user_input=args.keep_mock_user_input,
    )
    output_path = input_path if args.in_place else (args.output or default_output_path(input_path, args.profile))
    output_path = output_path.resolve()

    if write_analysis:
        analysis_doc = OrderedDict(
            [
                ("schemaVersion", data.get("schemaVersion", "1.0")),
                ("artifactType", "image_edit_analysis"),
                ("createdAt", data.get("createdAt")),
                ("sourceTemplate", input_path.name if output_path == input_path else output_path.name),
                ("templateId", data.get("templateId")),
                ("title", data.get("title")),
                ("analysis", analysis),
            ]
        )
        write_json(analysis_output.resolve(), analysis_doc, args.indent)

    write_json(output_path, cleaned, args.indent)

    cleaned_bytes = byte_len(output_path)
    ratio = 0 if original_bytes == 0 else round((1 - cleaned_bytes / original_bytes) * 100, 1)
    print(f"input: {input_path}")
    print(f"output: {output_path}")
    print(f"profile: {args.profile}")
    print(f"original_bytes: {original_bytes}")
    print(f"cleaned_bytes: {cleaned_bytes}")
    print(f"reduction_percent: {ratio}")
    if write_analysis:
        print(f"analysis_output: {analysis_output.resolve()}")
    elif analysis is not None:
        print("analysis_output: skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
