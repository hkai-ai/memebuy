#!/usr/bin/env python3
"""Reject Gallery templates that compile but create a broken or mechanical editor UX."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


INTERNAL_MARKERS = (
    "·组件槽位版", "组件槽位版", "槽位版", "批次版",
    "按可见组件开放编辑能力", "开放编辑能力",
)
GENERIC_SUGGESTIONS = {
    "HELLO", "TODAY", "保持可爱", "复古版本", "明亮活泼版本", "克制极简版本",
}
FALLBACK_RE = re.compile(r"\{\{\s*([a-zA-Z][a-zA-Z0-9_-]*)[^}]*\|\s*\"([^\"]*)\"\s*\}\}")
SIZE_RE = re.compile(r"^(\d{2,4})x(\d{2,4})$")


def ratio_for_size(image_size: str) -> str | None:
    match = SIZE_RE.fullmatch(image_size)
    if not match:
        return None
    width, height = int(match.group(1)), int(match.group(2))
    candidates = [(16, 9), (1, 1), (9, 16), (3, 4), (4, 3)]
    best = min(candidates, key=lambda ratio: abs(width / height - ratio[0] / ratio[1]))
    return f"{best[0]}:{best[1]}"


def validate(data: Any, runtime_profile: str = "gallery-v2-subject") -> list[str]:
    if not isinstance(data, dict):
        return ["root must be an object"]
    errors: list[str] = []
    title = str(data.get("title") or "")
    description = str(data.get("description") or "")
    prompt = str(data.get("promptTemplate") or "")
    for field, value in (("title", title), ("description", description), ("promptTemplate", prompt)):
        for marker in INTERNAL_MARKERS:
            if marker in value:
                errors.append(f"{field} exposes internal authoring language: {marker}")
    if re.search(r"制作[“\"]?.{0,80}模板", prompt):
        errors.append("promptTemplate describes authoring a template instead of the user's image intent")

    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    semantics = metadata.get("inputSemantics") if isinstance(metadata.get("inputSemantics"), dict) else {}
    fallbacks = {match.group(1): match.group(2) for match in FALLBACK_RE.finditer(prompt)}
    subjects = []
    for index, item in enumerate(data.get("inputSchema") or []):
        if not isinstance(item, dict):
            continue
        input_id = str(item.get("id") or "")
        required = item.get("required") is True
        has_fallback = bool(fallbacks.get(input_id))
        if item.get("type") == "subject":
            subjects.append(item)
            text = item.get("text") if isinstance(item.get("text"), dict) else {}
            has_fallback = has_fallback or bool(str(text.get("defaultValue") or "").strip())
            slot_semantics = semantics.get(input_id) if isinstance(semantics.get(input_id), dict) else {}
            for key in ("semanticType", "defaultStateLabel", "textInputLabel", "uploadLabel"):
                if not str(slot_semantics.get(key) or "").strip():
                    errors.append(f"inputSchema[{index}] subject is missing metadata.inputSemantics.{input_id}.{key}")
            semantic_type = str(slot_semantics.get("semanticType") or "")
            label = str(item.get("label") or "")
            if any(word in label for word in ("人物", "人像", "肖像", "女孩", "男孩")) and semantic_type != "person_identity":
                errors.append(f"inputSchema[{index}] {input_id!r} must use semanticType=person_identity")
            if any(word in label for word in ("宠物", "猫", "狗")) and semantic_type != "pet_identity":
                errors.append(f"inputSchema[{index}] {input_id!r} must use semanticType=pet_identity")
        if required and has_fallback:
            errors.append(f"inputSchema[{index}] {input_id!r} is required even though the template has a usable fallback")
        values: list[str] = []
        if item.get("type") == "prompt":
            values = [str(value) for value in item.get("suggestions") or []]
        elif item.get("type") == "subject" and isinstance(item.get("text"), dict):
            values = [str(value) for value in item["text"].get("suggestions") or []]
        bad = sorted(set(values) & GENERIC_SUGGESTIONS)
        if bad:
            errors.append(f"inputSchema[{index}] {input_id!r} contains mechanical suggestions: {', '.join(bad)}")

    requirements = metadata.get("runtimeRequirements") if isinstance(metadata.get("runtimeRequirements"), dict) else {}
    if subjects and requirements.get("subjectInputVersion") != 2:
        errors.append("metadata.runtimeRequirements.subjectInputVersion must be 2 for subject inputs")
    if len(subjects) > 1 and requirements.get("supportsMultipleSubjectImages") is not True:
        errors.append("multiple subject inputs require supportsMultipleSubjectImages=true")
    if subjects and requirements.get("imageSlotAddressing") != "input_id":
        errors.append("subject images must be addressed by stable input id")
    if runtime_profile == "legacy-single-image" and subjects:
        errors.append("legacy-single-image runtime cannot accept Gallery v2 subject image values")

    presentation = metadata.get("presentation") if isinstance(metadata.get("presentation"), dict) else {}
    expected_ratio = ratio_for_size(str(data.get("imageSize") or ""))
    if expected_ratio and presentation.get("recommendedOutputRatio") != expected_ratio:
        errors.append(f"metadata.presentation.recommendedOutputRatio must be {expected_ratio}")
    if data.get("referenceImage") and presentation.get("referenceImageRemovable") is not False:
        errors.append("template reference image must be fixed for generation")
    return errors


def discover(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    direct = sorted(path.glob("template-*/meme-template.json"))
    return direct or sorted(path.rglob("meme-template.json")) or sorted(path.glob("*.json"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Gallery template frontend experience.")
    parser.add_argument("path", type=Path)
    parser.add_argument("--runtime-profile", choices=["gallery-v2-subject", "legacy-single-image"], default="gallery-v2-subject")
    args = parser.parse_args()
    files = discover(args.path.resolve())
    if not files:
        print("FAIL: no Gallery template JSON found")
        return 1
    failed = 0
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"FAIL {path}: {exc}")
            failed += 1
            continue
        errors = validate(data, args.runtime_profile)
        if errors:
            failed += 1
            print(f"FAIL {path}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"PASS {path}")
    print(f"SUMMARY: {len(files) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
