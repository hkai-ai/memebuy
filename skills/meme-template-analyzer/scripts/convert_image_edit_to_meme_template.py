#!/usr/bin/env python3
"""Convert an image-edit-template artifact into a backend meme-template record."""

from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from pathlib import Path
from typing import Any

from clean_image_edit_template import clean_template, simplify_suggestions


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def write_json(path: Path, data: Any, indent: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write("\n")


def slugify(value: str, fallback: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or fallback


def first_source_path(data: dict[str, Any]) -> str:
    template_source = data.get("templateSource")
    if isinstance(template_source, dict) and template_source.get("path"):
        return str(template_source["path"])
    source_access = data.get("sourceAccess")
    if isinstance(source_access, dict):
        inputs = source_access.get("inputs")
        if isinstance(inputs, list) and inputs:
            first = inputs[0]
            if isinstance(first, dict) and first.get("path"):
                return str(first["path"])
    return ""


def first_source_hash(data: dict[str, Any]) -> str:
    source_access = data.get("sourceAccess")
    if isinstance(source_access, dict):
        inputs = source_access.get("inputs")
        if isinstance(inputs, list) and inputs:
            first = inputs[0]
            if isinstance(first, dict) and first.get("sha256"):
                return str(first["sha256"])
    return ""


def slot_to_prompt_slot(slot: dict[str, Any]) -> OrderedDict[str, Any]:
    default = slot.get("defaultValue", slot.get("currentValue", ""))
    prompt_slot = OrderedDict(
        [
            ("id", slot.get("id", "")),
            ("label", slot.get("label", slot.get("id", ""))),
            ("policy", "required" if slot.get("required") else "extensible"),
            ("from", default),
        ]
    )
    if slot.get("slotRole"):
        prompt_slot["role"] = slot["slotRole"]
    return prompt_slot


def slot_to_input(slot: dict[str, Any]) -> OrderedDict[str, Any] | None:
    input_kind = slot.get("inputKind")
    if input_kind not in {"image_upload", "image_select", "select", "prompt"}:
        return None
    if input_kind in {"image_upload", "image_select"}:
        return OrderedDict(
            [
                ("type", "image"),
                ("id", slot.get("id", "")),
                ("label", slot.get("label", slot.get("id", ""))),
                ("required", bool(slot.get("required"))),
                ("hint", slot.get("placeholder", "")),
                ("private", bool(slot.get("private", True))),
                ("maxCount", slot.get("maxCount", 1)),
                ("extract", slot.get("extract", "")),
            ]
        )
    item = OrderedDict(
        [
            ("type", "select" if input_kind == "select" else "prompt"),
            ("id", slot.get("id", "")),
            ("label", slot.get("label", slot.get("id", ""))),
            ("required", bool(slot.get("required"))),
        ]
    )
    if slot.get("suggestions"):
        item["options" if input_kind == "select" else "suggestions"] = simplify_suggestions(
            slot["suggestions"],
            keep_reasons=False,
        )
    return item


def slim_slot(slot: dict[str, Any]) -> OrderedDict[str, Any]:
    keys = [
        "id",
        "label",
        "inputKind",
        "slotRole",
        "required",
        "defaultValue",
        "placeholder",
        "suggestions",
        "allowCustom",
        "extract",
        "maxCount",
        "private",
        "sourceOptions",
    ]
    slim = OrderedDict()
    for key in keys:
        if key not in slot:
            continue
        value = slot[key]
        if key == "suggestions":
            value = simplify_suggestions(value, keep_reasons=False)
        if value in ("", [], {}, None) and key not in {"defaultValue", "suggestions"}:
            continue
        slim[key] = value
    return slim


def slim_template_source(source: Any) -> Any:
    if not isinstance(source, dict):
        return source
    slim = OrderedDict()
    for key in ["id", "role", "path", "authority", "preserve", "doNotUseFor"]:
        if key in source:
            slim[key] = source[key]
    constraints = source.get("locked_composition_constraints")
    if isinstance(constraints, list) and constraints:
        slim["lockedConstraints"] = [
            OrderedDict(
                (k, item[k])
                for k in ["id", "label", "value"]
                if isinstance(item, dict) and k in item
            )
            for item in constraints
            if isinstance(item, dict)
        ]
    return slim


def slim_backend_hint(hint: Any) -> Any:
    if not isinstance(hint, dict):
        return hint
    slim = OrderedDict()
    if hint.get("strategy"):
        slim["strategy"] = hint["strategy"]
    modes = hint.get("generationModes")
    if isinstance(modes, dict):
        slim["generationModes"] = modes
    return slim


def slim_edit_config(data: dict[str, Any], *, include_backend_hint: bool) -> OrderedDict[str, Any]:
    edit_config = clean_template(
        data,
        "runtime",
        data.get("analysisRef") if isinstance(data.get("analysisRef"), str) else None,
        keep_suggestion_reasons=False,
        keep_slot_ui=False,
        keep_mock_user_input=False,
    )
    slim = OrderedDict()
    for key in ["templateText", "editablePrompt", "allowFullRewrite"]:
        if key in edit_config:
            slim[key] = edit_config[key]
    if "slots" in edit_config and isinstance(edit_config["slots"], list):
        slim["slots"] = [slim_slot(slot) for slot in edit_config["slots"] if isinstance(slot, dict)]
    if "templateSource" in edit_config:
        slim["templateSource"] = slim_template_source(edit_config["templateSource"])
    if include_backend_hint and "backendHint" in edit_config:
        slim["backendHint"] = slim_backend_hint(edit_config["backendHint"])
    return slim


def build_meme_template(
    data: dict[str, Any],
    source_file: str,
    *,
    include_legacy: bool,
    include_backend_hint: bool,
) -> OrderedDict[str, Any]:
    template_id = str(data.get("templateId") or "")
    key = slugify(template_id, "meme-template")
    title = str(data.get("title") or template_id or "未命名模板")
    source_path = first_source_path(data)
    source_hash = first_source_hash(data)
    slots = data.get("slots") if isinstance(data.get("slots"), list) else []
    prompt_slots = [slot_to_prompt_slot(slot) for slot in slots if isinstance(slot, dict)]
    inputs = [item for slot in slots if isinstance(slot, dict) for item in [slot_to_input(slot)] if item]
    edit_config = slim_edit_config(data, include_backend_hint=include_backend_hint)

    record = OrderedDict(
        [
            ("version", 1),
            ("key", key),
            ("title", title),
            ("description", data.get("summary", "")),
            (
                "taxonomy",
                OrderedDict(
                    [
                        ("category", ""),
                        ("templateMechanism", ""),
                        ("scenes", []),
                        ("topics", []),
                        ("styles", []),
                        ("emotions", []),
                        ("useCases", []),
                        ("series", []),
                        ("parentTemplateKey", ""),
                        ("variantName", ""),
                        ("needs_review", ["taxonomy"]),
                    ]
                ),
            ),
            (
                "assets",
                OrderedDict(
                    [
                        ("templateImage", source_path),
                        ("cover", source_path),
                        ("exampleWorks", []),
                    ]
                ),
            ),
            ("editConfig", edit_config),
            (
                "ingestion",
                OrderedDict(
                    [
                        ("sourceId", template_id),
                        ("sourcePath", source_path),
                        ("sourceSha256", source_hash),
                        ("sourceArtifact", source_file),
                        ("status", "needs_human_review"),
                        ("notes", ["Converted from image-edit-template.json; review taxonomy before import."]),
                    ]
                ),
            ),
        ]
    )
    if include_legacy:
        record["inputs"] = inputs
        record["prompt"] = OrderedDict([("master", data.get("templateText", "")), ("slots", prompt_slots)])
        record["modes"] = OrderedDict(
            [
                (
                    "hifi",
                    OrderedDict(
                        [
                            ("enabled", True),
                            ("useTemplateImage", bool(source_path)),
                            ("note", "legacy compatibility field; editConfig is the default editor payload."),
                        ]
                    ),
                ),
                (
                    "free",
                    OrderedDict(
                        [
                            ("enabled", False),
                            ("mustKeep", []),
                            ("canChange", ""),
                            ("baseDescription", ""),
                            ("examples", []),
                        ]
                    ),
                ),
            ]
        )
        record["generationFit"] = OrderedDict(
            [
                ("hifi", "usable"),
                ("free", "usable"),
                ("reason", "Converted from image-edit-template; review taxonomy and generation fit before import."),
            ]
        )
        record["output"] = OrderedDict([("size", "1024x1024"), ("n", 1)])
    return record


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert image-edit-template.json into backend meme-template.json."
    )
    parser.add_argument("input", type=Path, help="Path to image-edit-template.json")
    parser.add_argument(
        "--output",
        type=Path,
        help="Output path. Defaults to meme-template.json in the same directory.",
    )
    parser.add_argument(
        "--include-legacy",
        action="store_true",
        help="Include legacy inputs/prompt/modes/generationFit/output blocks.",
    )
    parser.add_argument(
        "--include-backend-hint",
        action="store_true",
        help="Include backendHint generation policy in editConfig.",
    )
    parser.add_argument("--indent", type=int, default=2, help="JSON indentation")
    args = parser.parse_args()

    input_path = args.input.resolve()
    output_path = (args.output or input_path.with_name("meme-template.json")).resolve()
    data = load_json(input_path)
    meme_template = build_meme_template(
        data,
        input_path.name,
        include_legacy=args.include_legacy,
        include_backend_hint=args.include_backend_hint,
    )
    write_json(output_path, meme_template, args.indent)
    print(f"input: {input_path}")
    print(f"output: {output_path}")
    print("status: needs_human_review")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
