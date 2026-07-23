#!/usr/bin/env python3
"""Compile image-edit-template.json into GalleryTemplate import JSON v1."""

from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from copy import deepcopy
from pathlib import Path
from typing import Any

from clean_image_edit_template import simplify_suggestions
from validate_gallery_template import validate as validate_gallery_record


TOKEN_RE = re.compile(r"【\s*([^【】：:]+?)\s*[：:]\s*([^】]*)】")
KEY_RE = re.compile(r"^[a-z][a-z0-9-]{1,59}$")
ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,39}$")
TAG_ID_RE = re.compile(r"^[a-z][a-z0-9._-]{1,79}$")
TEXTUAL_KINDS = {"text", "prompt", "select", "subject"}
INTERNAL_PRESERVE_ID_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+_\d+$", re.IGNORECASE)
INTERNAL_GENERATION_MARKERS = (
    "组件图", "组件槽位", "槽位框", "槽位说明", "组件标签", "组件 ID",
    "可编辑组件区域", "按可见组件开放编辑能力",
)
REFERENCE_RESTATEMENT_RE = re.compile(r"图像依据[:：]|具体为|具体是|^保持模板参考图|^沿用参考图")
DEFAULT_REWRITE_INSTRUCTION = (
    "把基础提示词改写成一条完整、可直接执行的图像生成提示词。"
)
CLEAN_OUTPUT_INSTRUCTION = (
    "只输出最终成图；不得显示模板标题、槽位框、组件标签、组件 ID、虚线连线、图例、"
    "操作说明、界面元素或任何编辑标注。"
)
SUBJECT_OVERRIDE_INSTRUCTION = (
    "用户在开放槽位中填写或上传的内容拥有对应维度的最高权限，必须完整体现；"
    "上传图决定对应主体的身份、物种与人物类型，并覆盖默认主体身份。"
)
REFERENCE_AUTHORITY_INSTRUCTION = (
    "参考图与最终提示词会一同送入图像模型；参考图在构图、画幅、裁切、镜头景别、机位、"
    "姿态、留白、画风、媒介、材质、光影及其他未开放呈现维度上具有最高权限，"
    "在开放槽位对应维度上不具权限；背景或色调未开放时由参考图控制，开放时由用户输入控制。"
    "只需指名沿用参考图的视觉维度，"
    "不要用文字复述参考图中的具体画面内容。"
)
DEFAULT_REFERENCE_CONSTRAINTS = (
    "沿用参考图的画幅、裁切、留白、镜头景别与元素位置比例",
    "沿用参考图的媒介质感与材质表现",
    "沿用参考图的前景背景层级、遮挡关系与阅读顺序",
)
IDENTITY_SEMANTIC_TYPES = {
    "subject_identity", "person_identity", "pet_identity", "animal_identity",
    "character_identity", "object_identity",
}
IDENTITY_LABEL_RE = re.compile(
    r"猫咪|小猫|猫|小狗|狗狗|狗|宠物|人物|人像|肖像|女孩|男孩|女人|男人|"
    r"女性|男性|动物|角色|商品|物体"
)


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


def slugify(value: str, fallback: str = "meme-template") -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    value = re.sub(r"-+", "-", value).strip("-")
    if not value or not value[0].isalpha():
        value = f"meme-{value}" if value else fallback
    return value[:60].rstrip("-")


def source_path(data: dict[str, Any]) -> str | None:
    template_source = data.get("templateSource")
    if isinstance(template_source, dict) and template_source.get("path"):
        return str(template_source["path"])
    source_access = data.get("sourceAccess")
    if isinstance(source_access, dict):
        inputs = source_access.get("inputs")
        if isinstance(inputs, list):
            for item in inputs:
                if isinstance(item, dict) and item.get("path"):
                    return str(item["path"])
    return None


def json_literal(value: Any) -> str:
    return json.dumps("" if value is None else str(value), ensure_ascii=False)


def contains_internal_generation_language(value: Any) -> bool:
    text = str(value or "")
    return any(marker.casefold() in text.casefold() for marker in INTERNAL_GENERATION_MARKERS) or bool(
        re.search(r"\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+_\d+\b", text, re.IGNORECASE)
    )


def safe_preserve_values(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = str(item).strip()[:120]
        if (
            not text
            or INTERNAL_PRESERVE_ID_RE.fullmatch(text)
            or re.fullmatch(r"[a-z][a-z0-9_]+", text, re.IGNORECASE)
            or contains_internal_generation_language(text)
            or REFERENCE_RESTATEMENT_RE.search(text)
        ):
            continue
        if text not in result:
            result.append(text)
    return result


def safe_rewrite_instruction(value: Any, has_reference: bool = False) -> str:
    # Keep this layer deterministic and content-neutral.  Template-specific visual
    # facts belong to the reference image; semantic invariants belong to preserve.
    parts = [DEFAULT_REWRITE_INSTRUCTION, SUBJECT_OVERRIDE_INSTRUCTION]
    if has_reference:
        parts.append(REFERENCE_AUTHORITY_INSTRUCTION)
    parts.append(CLEAN_OUTPUT_INSTRUCTION)
    return "".join(part.rstrip("。") + "。" for part in parts)


def is_identity_subject_slot(slot: dict[str, Any]) -> bool:
    if slot.get("inputKind") != "subject":
        return False
    semantic_type = str(slot.get("semanticType") or "").strip()
    if semantic_type in IDENTITY_SEMANTIC_TYPES or semantic_type.endswith("_identity"):
        return True
    label = str(slot.get("label") or "")
    return slot.get("slotRole") == "identity_reference" or (
        slot.get("slotRole") == "semantic_replacement"
        and ("主体" in label or bool(IDENTITY_LABEL_RE.search(label)))
    )


def generic_identity_label(label: Any) -> str:
    original = str(label or "").strip()
    if not original:
        return "主体"
    if not IDENTITY_LABEL_RE.search(original):
        return original
    cleaned = IDENTITY_LABEL_RE.sub("", original)
    cleaned = re.sub(r"主体+", "主体", cleaned).strip(" ·_-：:")
    if not cleaned or cleaned in {"主体", "主体图", "主体照片", "主体头像"}:
        return "主体"
    if "组合" in cleaned or "一组" in cleaned or "多名" in cleaned or "多个" in cleaned:
        return "主体组合"
    position = next(
        (word for word in ("左侧", "右侧", "中央", "前景", "背景", "顶部", "底部", "上层", "下层", "盒内", "框内") if word in cleaned),
        "",
    )
    return f"{position}主体" if position else "主体"


def normalize_identity_subject_slot(slot: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(slot)
    if not is_identity_subject_slot(result):
        return result
    result["label"] = generic_identity_label(result.get("label"))
    result["semanticType"] = "subject_identity"
    image_prompt = str(result.get("imagePromptValue") or "").strip()
    if not image_prompt or IDENTITY_LABEL_RE.search(image_prompt):
        result["imagePromptValue"] = "用户上传图中的主体"
    for key, fallback in (
        ("defaultStateLabel", "保留原主体"),
        ("textInputLabel", "或用文字描述主体"),
        ("uploadLabel", "上传主体图"),
    ):
        value = str(result.get(key) or "").strip()
        if not value or IDENTITY_LABEL_RE.search(value):
            result[key] = fallback
    return result


def strict_bool(value: Any, field: str, default: bool) -> bool:
    if value is None:
        return default
    if not isinstance(value, bool):
        raise ValueError(f"{field} must be a boolean")
    return value


def strict_int(value: Any, field: str, default: int, minimum: int, maximum: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{field} must be an integer")
    if not minimum <= value <= maximum:
        raise ValueError(f"{field} must be from {minimum} to {maximum}")
    return value


def output_image_size(data: dict[str, Any]) -> str:
    explicit = data.get("imageSize")
    if explicit is not None:
        if not isinstance(explicit, str) or not re.fullmatch(r"\d{2,4}x\d{2,4}", explicit):
            raise ValueError("imageSize must look like 832x1024")
        return explicit
    source_access = data.get("sourceAccess")
    if isinstance(source_access, dict):
        for item in source_access.get("inputs", []):
            if not isinstance(item, dict):
                continue
            width, height = item.get("width"), item.get("height")
            if (
                isinstance(width, int) and not isinstance(width, bool) and width > 0
                and isinstance(height, int) and not isinstance(height, bool) and height > 0
            ):
                if height > width:
                    scaled_width = max(64, min(1024, round((1024 * width / height) / 64) * 64))
                    return f"{scaled_width}x1024"
                if width > height:
                    scaled_height = max(64, min(1024, round((1024 * height / width) / 64) * 64))
                    return f"1024x{scaled_height}"
    return "1024x1024"


def recommended_output_ratio(image_size: str) -> str:
    width, height = (int(value) for value in image_size.split("x", 1))
    candidates = [(16, 9), (1, 1), (9, 16), (3, 4), (4, 3)]
    target = width / height
    best = min(candidates, key=lambda ratio: abs(target - ratio[0] / ratio[1]))
    return f"{best[0]}:{best[1]}"


def suggestion_strings(value: Any) -> list[str]:
    simplified = simplify_suggestions(value, keep_reasons=False)
    if not isinstance(simplified, list):
        return []
    return [str(item)[:120] for item in simplified if str(item)]


def option_objects(value: Any) -> list[OrderedDict[str, Any]]:
    if not isinstance(value, list):
        return []
    options: list[OrderedDict[str, Any]] = []
    for item in value:
        if isinstance(item, str):
            options.append(OrderedDict([("value", item[:120]), ("label", item[:40])]))
            continue
        if not isinstance(item, dict):
            continue
        raw_value = item.get("value", item.get("label"))
        raw_label = item.get("label", raw_value)
        if not raw_value or not raw_label:
            continue
        option = OrderedDict([("value", str(raw_value)[:120]), ("label", str(raw_label)[:40])])
        if item.get("thumbnail"):
            option["thumbnail"] = str(item["thumbnail"])[:500]
        payload = item.get("payload")
        if isinstance(payload, dict):
            option["payload"] = {
                str(key): str(payload_value)[:4000]
                for key, payload_value in payload.items()
            }
        options.append(option)
    return options[:30]


def is_text_only_image_select(slot: dict[str, Any]) -> bool:
    return slot.get("slotRole") in {
        "semantic_replacement",
        "prompt_fragment",
        "visual_variable",
    }


def is_textual_slot(slot: dict[str, Any]) -> bool:
    return slot.get("inputKind") in TEXTUAL_KINDS or (
        slot.get("inputKind") == "image_select" and is_text_only_image_select(slot)
    )


def slot_to_input(slot: dict[str, Any]) -> OrderedDict[str, Any]:
    slot_id = str(slot.get("id", ""))
    label = str(slot.get("label") or slot_id)[:40]
    input_kind = slot.get("inputKind")
    required = strict_bool(slot.get("required"), f"slot {slot_id!r}.required", False)
    allow_custom = strict_bool(slot.get("allowCustom"), f"slot {slot_id!r}.allowCustom", True)

    if not ID_RE.fullmatch(slot_id):
        raise ValueError(f"invalid slot id for GalleryTemplate inputSchema: {slot_id!r}")

    if input_kind in {"text", "prompt"} or (input_kind == "select" and allow_custom):
        item = OrderedDict([("type", "prompt"), ("id", slot_id), ("label", label)])
        placeholder = slot.get("placeholder")
        if placeholder:
            item["placeholder"] = str(placeholder)[:120]
        item["required"] = required
        validation = slot.get("validation")
        if isinstance(validation, dict):
            if validation.get("minLength") is not None:
                item["minLength"] = strict_int(
                    validation["minLength"], f"slot {slot_id!r}.validation.minLength", 0, 0, 4000
                )
            if validation.get("maxLength") is not None:
                item["maxLength"] = strict_int(
                    validation["maxLength"], f"slot {slot_id!r}.validation.maxLength", 120, 1, 4000
                )
        suggestions = suggestion_strings(slot.get("suggestions"))[:10]
        if suggestions and len(suggestions) < 3:
            raise ValueError(
                f"prompt slot {slot_id!r} suggestions require at least 3 distinct values; "
                "omit suggestions for free-text-only input"
            )
        if suggestions:
            item["suggestions"] = suggestions
        return item

    if input_kind == "select" or (
        input_kind == "image_select" and is_text_only_image_select(slot)
    ):
        options = option_objects(slot.get("suggestions"))
        if len(options) < 2:
            raise ValueError(f"select slot {slot_id!r} requires at least two distinct options")
        return OrderedDict(
            [
                ("type", "select"),
                ("id", slot_id),
                ("label", label),
                ("required", required),
                ("options", options),
            ]
        )

    if input_kind == "subject":
        default_value = str(slot.get("defaultValue") or "").strip()
        if not default_value:
            raise ValueError(f"subject slot {slot_id!r} requires defaultValue")
        suggestions = suggestion_strings(slot.get("suggestions"))[:10]
        if len(suggestions) < 3:
            raise ValueError(f"subject slot {slot_id!r} requires at least three distinct suggestions")
        source_options = slot.get("sourceOptions")
        if not isinstance(source_options, list) or not source_options:
            raise ValueError(f"subject slot {slot_id!r} requires sourceOptions")
        allowed_sources = {"upload", "recent_upload", "asset_library"}
        if any(not isinstance(source, str) or source not in allowed_sources for source in source_options):
            raise ValueError(f"subject slot {slot_id!r}.sourceOptions contains an invalid source")
        image = OrderedDict(
            [
                ("enabled", True),
                ("promptValue", str(slot.get("imagePromptValue") or "用户上传图中的主体")[:120]),
            ]
        )
        hint = slot.get("imageHint") or slot.get("placeholder")
        if hint:
            image["hint"] = str(hint)[:120]
        extract = str(slot.get("extract") or "").strip()
        if not extract:
            raise ValueError(f"subject slot {slot_id!r} requires extract")
        image["extract"] = extract[:1000]
        image["maxCount"] = strict_int(slot.get("maxCount"), f"slot {slot_id!r}.maxCount", 1, 1, 6)
        validation = slot.get("validation")
        if isinstance(validation, dict):
            if validation.get("minWidth") is not None:
                image["minWidth"] = strict_int(
                    validation["minWidth"], f"slot {slot_id!r}.validation.minWidth", 64, 64, 8192
                )
            if validation.get("minHeight") is not None:
                image["minHeight"] = strict_int(
                    validation["minHeight"], f"slot {slot_id!r}.validation.minHeight", 64, 64, 8192
                )
        image["private"] = strict_bool(slot.get("private"), f"slot {slot_id!r}.private", False)
        image["sourceOptions"] = list(dict.fromkeys(source_options))
        text = OrderedDict(
            [
                ("defaultValue", default_value[:120]),
                ("allowCustom", allow_custom),
                ("suggestions", suggestions),
            ]
        )
        placeholder = slot.get("placeholder")
        if placeholder:
            text["placeholder"] = str(placeholder)[:120]
        return OrderedDict(
            [
                ("type", "subject"),
                ("id", slot_id),
                ("label", label),
                ("required", required),
                ("text", text),
                ("image", image),
                ("resolutionStrategy", "image_over_text"),
            ]
        )

    if input_kind in {"image_upload"}:
        item = OrderedDict([("type", "image"), ("id", slot_id), ("label", label)])
        hint = slot.get("placeholder") or slot.get("hint")
        if hint:
            item["hint"] = str(hint)[:120]
        item["required"] = required
        item["maxCount"] = strict_int(slot.get("maxCount"), f"slot {slot_id!r}.maxCount", 1, 1, 6)
        validation = slot.get("validation")
        if isinstance(validation, dict):
            if validation.get("minWidth"):
                item["minWidth"] = strict_int(validation["minWidth"], f"slot {slot_id!r}.validation.minWidth", 64, 64, 8192)
            if validation.get("minHeight"):
                item["minHeight"] = strict_int(validation["minHeight"], f"slot {slot_id!r}.validation.minHeight", 64, 64, 8192)
        item["private"] = strict_bool(slot.get("private"), f"slot {slot_id!r}.private", False)
        return item

    if input_kind == "image_select":
        raise ValueError(
            f"image_select slot {slot_id!r} passes an image as a runtime reference, "
            "which GalleryTemplate import v1 does not support"
        )
    raise ValueError(f"unsupported inputKind for slot {slot_id!r}: {input_kind!r}")


def find_slot(label: str, default: str, slots: list[dict[str, Any]]) -> dict[str, Any]:
    exact = [slot for slot in slots if str(slot.get("label", "")).strip() == label]
    if len(exact) == 1:
        return exact[0]
    fuzzy = [
        slot
        for slot in slots
        if label in str(slot.get("label", "")) or str(slot.get("label", "")) in label
    ]
    if len(fuzzy) == 1:
        return fuzzy[0]
    by_default = [slot for slot in slots if str(slot.get("defaultValue", "")) == default]
    if len(by_default) == 1:
        return by_default[0]
    raise ValueError(f"cannot map template token 【{label}：{default}】 to one slot id")


def template_constraints(template_source: Any) -> list[str]:
    if not isinstance(template_source, dict):
        return []
    constraints: list[str] = []
    locked = template_source.get("lockedConstraints")
    if not isinstance(locked, list):
        locked = template_source.get("locked_composition_constraints")
    if isinstance(locked, list):
        for item in locked:
            if isinstance(item, dict):
                text = item.get("value") or item.get("description")
                if text:
                    constraints.append(str(text).rstrip("。"))
            elif isinstance(item, str) and item.strip():
                constraints.append(item.strip().rstrip("。"))
    preserve = safe_preserve_values(template_source.get("preserve"))
    if isinstance(preserve, list) and preserve:
        readable = "、".join(str(item).replace("_", " ") for item in preserve)
        constraints.append(f"保留模板参考图的这些结构和风格特征：{readable}")
    return constraints


def reference_dimension_constraints(has_reference: bool) -> list[str]:
    """Return dimension pointers; downstream image models can inspect the reference image."""
    return list(DEFAULT_REFERENCE_CONSTRAINTS) if has_reference else []


def dedupe_preserve(values: list[str], locked_constraints: list[str]) -> list[str]:
    locked = {re.sub(r"[\s，。；、]", "", value) for value in locked_constraints}
    return [
        value
        for value in values
        if re.sub(r"[\s，。；、]", "", value) not in locked
    ]


def compile_prompt_template(data: dict[str, Any], slots: list[dict[str, Any]]) -> str:
    template_text = str(data.get("templateText") or data.get("editablePrompt") or "").strip()
    if not template_text:
        raise ValueError("templateText or editablePrompt is required to compile promptTemplate")
    used_ids: set[str] = set()

    def replace_token(match: re.Match[str]) -> str:
        label = match.group(1).strip()
        default = match.group(2).strip()
        slot = find_slot(label, default, slots)
        slot_id = str(slot["id"])
        if not is_textual_slot(slot):
            raise ValueError(f"template token {label!r} maps to non-text slot {slot_id!r}")
        used_ids.add(slot_id)
        fallback = default or slot.get("defaultValue", "")
        return f"{{{{ {slot_id} | {json_literal(fallback)} }}}}"

    prompt = TOKEN_RE.sub(replace_token, template_text)

    unused = [
        str(slot.get("id", ""))
        for slot in slots
        if is_textual_slot(slot) and str(slot.get("id", "")) not in used_ids
    ]
    if unused:
        raise ValueError(
            "every textual slot must appear naturally in templateText; unused slot ids: "
            + ", ".join(unused)
        )
    if len(prompt) > 4000:
        raise ValueError(f"compiled promptTemplate exceeds 4000 characters: {len(prompt)}")
    return re.sub(r"\s+", " ", prompt).strip()


def compile_prompt_enhancement(data: dict[str, Any]) -> OrderedDict[str, Any]:
    explicit = data.get("promptEnhancement")
    template_source = data.get("templateSource")
    source = template_source if isinstance(template_source, dict) else {}
    has_reference = bool(source_path(data))
    locked_constraints = reference_dimension_constraints(has_reference)
    preserve = safe_preserve_values(source.get("preserve"))

    if explicit is not None and not isinstance(explicit, dict):
        raise ValueError("promptEnhancement must be an object")
    config = explicit or {}
    stage_key = str(config.get("stageKey") or "gallery.prompt_rewrite").strip()
    instruction = safe_rewrite_instruction(config.get("instruction"), has_reference=has_reference)
    result = OrderedDict(
        [
            ("stageKey", stage_key[:60]),
            ("instruction", instruction[:8000]),
        ]
    )
    if has_reference:
        result["referenceField"] = "referenceImage"
    explicit_locked = config.get("lockedConstraints")
    if isinstance(explicit_locked, list) and not has_reference:
        locked_constraints = template_constraints({"lockedConstraints": explicit_locked})
    explicit_preserve = config.get("preserve")
    if isinstance(explicit_preserve, list):
        preserve = safe_preserve_values(explicit_preserve)
    result["lockedConstraints"] = locked_constraints[:30]
    result["preserve"] = dedupe_preserve(preserve, locked_constraints)[:30]
    result["output"] = OrderedDict([("format", "json"), ("promptField", "finalPrompt")])
    return result


def normalized_tag_assignments(value: Any) -> list[OrderedDict[str, Any]]:
    if value in (None, []):
        return []
    if not isinstance(value, list):
        raise ValueError("tagAssignments must be an array")
    assignments: list[OrderedDict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for index, raw in enumerate(value):
        if not isinstance(raw, dict):
            raise ValueError(f"tagAssignments[{index}] must be an object")
        label = str(raw.get("label") or "").strip()
        dimension = str(raw.get("dimension") or "").strip()
        level = str(raw.get("level") or "").strip()
        source = str(raw.get("source") or "").strip()
        status = str(raw.get("status") or "").strip()
        if not label or len(label) > 80:
            raise ValueError(f"tagAssignments[{index}].label must contain 1-80 characters")
        if not re.fullmatch(r"[a-z][a-z0-9_-]{1,39}", dimension):
            raise ValueError(f"tagAssignments[{index}].dimension is invalid")
        if level not in {"category", "tag"}:
            raise ValueError(f"tagAssignments[{index}].level is invalid")
        if source not in {"operator", "template", "ai", "external"}:
            raise ValueError(f"tagAssignments[{index}].source is invalid")
        if status not in {"accepted", "suggested", "rejected"}:
            raise ValueError(f"tagAssignments[{index}].status is invalid")
        if source in {"operator", "template"} and status != "accepted":
            raise ValueError(f"tagAssignments[{index}] locked source must be accepted")
        tag_id = str(raw.get("tagId") or "").strip()
        if tag_id and not TAG_ID_RE.fullmatch(tag_id):
            raise ValueError(f"tagAssignments[{index}].tagId is invalid")
        confidence = raw.get("confidence")
        if confidence is not None and (source != "ai" or isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1):
            raise ValueError(f"tagAssignments[{index}].confidence is only valid for ai from 0 to 1")
        provider = str(raw.get("provider") or "").strip()
        if source == "external" and not provider:
            raise ValueError(f"tagAssignments[{index}].provider is required for external source")
        key = (source, tag_id or label.casefold())
        if key in seen:
            continue
        seen.add(key)
        assignment = OrderedDict()
        if tag_id:
            assignment["tagId"] = tag_id
        assignment.update([("label", label), ("dimension", dimension), ("level", level), ("source", source), ("status", status)])
        if confidence is not None:
            assignment["confidence"] = confidence
        if provider:
            assignment["provider"] = provider[:80]
        evidence = str(raw.get("evidence") or "").strip()
        if evidence:
            assignment["evidence"] = evidence[:300]
        assignments.append(assignment)
    return assignments


def metadata_tags(taxonomy: Any, assignments: list[OrderedDict[str, Any]] | None = None) -> list[str]:
    if not isinstance(taxonomy, dict):
        return []
    tags: list[str] = []
    for key, value in taxonomy.items():
        if key in {"needs_review", "parentTemplateKey", "variantName"}:
            continue
        values = value if isinstance(value, list) else [value]
        for item in values:
            text = str(item).strip()
            if text and text not in tags:
                tags.append(text)
    for assignment in assignments or []:
        text = str(assignment.get("label") or "").strip()
        if assignment.get("status") == "accepted" and text and text not in tags:
            tags.append(text)
    return tags


def metadata_template_source(source: Any) -> Any:
    if not isinstance(source, dict):
        return source
    result = OrderedDict((key, value) for key, value in source.items() if key != "path")
    if not result.get("role"):
        result["role"] = "template_reference"
    if result.get("role") == "template_reference" and not isinstance(result.get("authority"), dict):
        result["authority"] = OrderedDict(
            [
                ("composition_authority", "high"),
                ("style_authority", "high"),
                ("identity_authority", "none"),
            ]
        )
    if "preserve" in result:
        result["preserve"] = safe_preserve_values(result["preserve"])
    locked = result.get("locked_composition_constraints")
    if isinstance(locked, list):
        cleaned_locked = []
        for item in locked:
            if not isinstance(item, dict):
                cleaned_locked.append(item)
                continue
            cleaned = OrderedDict(item)
            value = str(cleaned.get("value") or "").strip()
            description = str(cleaned.get("description") or "").strip()
            if contains_internal_generation_language(description) and value:
                cleaned["description"] = f"保持{value}。"
            cleaned_locked.append(cleaned)
        result["locked_composition_constraints"] = cleaned_locked
    result["referenceField"] = "referenceImage"
    return result


def slot_semantics(slots: list[dict[str, Any]]) -> dict[str, Any]:
    result: OrderedDict[str, Any] = OrderedDict()
    for slot in slots:
        details = OrderedDict()
        for key in [
            "slotRole", "semanticType", "defaultValue", "allowCustom", "extract",
            "sourceOptions", "resolutionStrategy", "defaultStateLabel", "textInputLabel",
            "uploadLabel",
        ]:
            if key in slot and slot[key] not in (None, "", []):
                details[key] = slot[key]
        if details:
            result[str(slot.get("id", ""))] = details
    return result


def semantic_analysis(data: dict[str, Any]) -> dict[str, Any]:
    candidate = data.get("_semanticAnalysis") or data.get("semanticReview")
    if isinstance(candidate, dict) and isinstance(candidate.get("analysis"), dict):
        return candidate["analysis"]
    return candidate if isinstance(candidate, dict) else {}


def semantic_review_metadata(data: dict[str, Any]) -> tuple[dict[str, Any] | None, list[str]]:
    analysis = semantic_analysis(data)
    discovery = analysis.get("reference_discovery") if isinstance(analysis.get("reference_discovery"), dict) else {}
    reflection = analysis.get("formula_reflection_review") if isinstance(analysis.get("formula_reflection_review"), dict) else {}
    status = str(discovery.get("reference_status") or "").strip()
    if not status:
        return None, []
    context = OrderedDict([("status", status)])
    for source_key, target_key in [("reference_type", "type"), ("primary_reference", "primaryReference")]:
        value = discovery.get(source_key)
        if value not in (None, "", []):
            context[target_key] = value
    anchors = reflection.get("reference_anchors_identified")
    if isinstance(anchors, list) and anchors:
        context["anchors"] = anchors
    reasons: list[str] = []
    for reason in discovery.get("review_reasons", []):
        text = str(reason).strip()
        if text and text not in reasons:
            reasons.append(text)
    if status in {"unknown", "suspected"} and not reasons:
        reasons.append(f"文化参照状态为 {status}，需要人工确认")
    if reflection.get("passed") is False:
        reasons.append("meme 公式前提审计未通过")
    if reflection.get("generic_description_risk") == "high":
        reasons.append("当前解释存在高泛化复述风险")
    return context, reasons


def build_gallery_template(data: dict[str, Any]) -> OrderedDict[str, Any]:
    template_id = str(data.get("templateId") or "")
    key = slugify(template_id)
    title = str(data.get("title") or template_id or "未命名模板")[:80]
    description = str(data.get("description") or "").strip()[:20] or None
    source = source_path(data)
    slots = [normalize_identity_subject_slot(slot) for slot in data.get("slots", []) if isinstance(slot, dict)]
    if len(slots) > 20:
        raise ValueError("GalleryTemplate inputSchema supports at most 20 inputs")
    ids = [str(slot.get("id", "")) for slot in slots]
    if len(ids) != len(set(ids)):
        raise ValueError("slot ids must be unique")

    input_schema = [slot_to_input(slot) for slot in slots]
    image_size = output_image_size(data)
    prompt_template = compile_prompt_template(data, slots)
    prompt_enhancement = compile_prompt_enhancement(data)
    taxonomy = data.get("taxonomy") if isinstance(data.get("taxonomy"), dict) else {}
    tag_assignments = normalized_tag_assignments(data.get("tagAssignments"))
    needs_review = taxonomy.get("needs_review") if taxonomy else ["taxonomy 未提供或未确认"]
    if not isinstance(needs_review, list):
        needs_review = [str(needs_review)] if needs_review else []
    reference_context, semantic_reasons = semantic_review_metadata(data)
    for reason in semantic_reasons:
        if reason not in needs_review:
            needs_review.append(reason)
    metadata = OrderedDict(
        [
            ("tags", metadata_tags(taxonomy, tag_assignments)),
            ("version", "2.0.0"),
        ]
    )
    if taxonomy:
        if taxonomy.get("category"):
            metadata["category"] = taxonomy["category"]
        if taxonomy.get("templateMechanism"):
            metadata["templateMechanism"] = taxonomy["templateMechanism"]
        metadata["taxonomy"] = taxonomy
    if tag_assignments:
        metadata["tagAssignments"] = tag_assignments
    if data.get("templateSource"):
        metadata["templateSource"] = metadata_template_source(data["templateSource"])
    if reference_context:
        metadata["referenceContext"] = reference_context
    semantics = slot_semantics(slots)
    if semantics:
        metadata["inputSemantics"] = semantics
    subject_count = sum(1 for item in input_schema if item.get("type") == "subject")
    metadata["presentation"] = OrderedDict(
        [
            ("recommendedOutputRatio", recommended_output_ratio(image_size)),
            ("referenceImageRemovable", not bool(source)),
        ]
    )
    metadata["runtimeRequirements"] = OrderedDict(
        [
            ("subjectInputVersion", 2 if subject_count else 0),
            ("supportsMultipleSubjectImages", subject_count > 1),
            ("imageSlotAddressing", "input_id"),
        ]
    )
    if isinstance(needs_review, list) and needs_review:
        metadata["needsReview"] = "；".join(str(item) for item in needs_review)

    record = OrderedDict(
        [
            ("key", key),
            ("title", title),
            ("description", description),
            ("cover", source),
            ("referenceImage", source),
            ("imageSize", image_size),
            ("imageN", 1),
            ("inputSchema", input_schema),
            ("preprocessSteps", []),
            ("promptTemplate", prompt_template),
            ("promptEnhancement", prompt_enhancement),
            ("metadata", metadata),
        ]
    )
    validate_record(record)
    errors = validate_gallery_record(record)
    if errors:
        raise ValueError("GalleryTemplate validation failed: " + "; ".join(errors))
    return record


def validate_record(record: dict[str, Any]) -> None:
    if not KEY_RE.fullmatch(str(record.get("key", ""))):
        raise ValueError(f"invalid key: {record.get('key')!r}")
    if not record.get("title") or len(str(record["title"])) > 80:
        raise ValueError("title must contain 1-80 characters")
    if not record.get("promptTemplate") or len(str(record["promptTemplate"])) > 4000:
        raise ValueError("promptTemplate must contain 1-4000 characters")
    if not isinstance(record.get("promptEnhancement"), dict):
        raise ValueError("promptEnhancement must be an object")
    inputs = record.get("inputSchema")
    if not isinstance(inputs, list) or len(inputs) > 20:
        raise ValueError("inputSchema must be an array with at most 20 items")
    ids = [item.get("id") for item in inputs if isinstance(item, dict)]
    if len(ids) != len(set(ids)):
        raise ValueError("inputSchema ids must be unique")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compile image-edit-template.json into GalleryTemplate import JSON v1."
    )
    parser.add_argument("input", type=Path, help="Path to image-edit-template.json")
    parser.add_argument(
        "--output",
        type=Path,
        help="Output path. Defaults to meme-template.json in the same directory.",
    )
    parser.add_argument("--indent", type=int, default=2, help="JSON indentation")
    args = parser.parse_args()

    input_path = args.input.resolve()
    output_path = (args.output or input_path.with_name("meme-template.json")).resolve()
    data = load_json(input_path)
    analysis_ref = data.get("analysisRef")
    if isinstance(analysis_ref, str) and analysis_ref.strip():
        analysis_path = (input_path.parent / analysis_ref).resolve()
        if not analysis_path.is_file():
            raise ValueError(f"analysisRef does not exist: {analysis_ref}")
        data["_semanticAnalysis"] = load_json(analysis_path)
    record = build_gallery_template(data)
    write_json(output_path, record, args.indent)
    print(f"input: {input_path}")
    print(f"output: {output_path}")
    print("contract: GalleryTemplateImport v1")
    print(f"needs_review: {bool(record.get('metadata', {}).get('needsReview'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
