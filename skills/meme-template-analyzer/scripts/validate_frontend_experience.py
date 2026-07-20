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
PROMPT_AUTHORING_MARKERS = (
    "沿用原画面", "沿用原图", "以下开放项", "生成同构画面", "同构画面",
    "以模板参考图为构图", "仅修改开放项", "仅修改以下开放项",
)
GENERIC_SUGGESTIONS = {
    "HELLO", "TODAY", "保持可爱", "复古版本", "明亮活泼版本", "克制极简版本",
}
IDENTITY_SEMANTIC_TYPES = {
    "subject_identity", "person_identity", "pet_identity", "animal_identity",
    "character_identity", "object_identity",
}
IDENTITY_RESTRICTION_RE = re.compile(
    r"猫咪|小猫|猫|小狗|狗狗|狗|宠物|人物|人像|肖像|女孩|男孩|女人|男人|"
    r"女性|男性|动物|角色|商品|物体"
)
MECHANICAL_SUGGESTION_RE = re.compile(
    r"^(?:简洁款|彩色手绘|用户自定义|简洁的|夸张的|柔和的).{1,30}$"
)
SCENE_SUGGESTION_RE = re.compile(
    r"城市|街景|海边|日落|森林|薄雾|田野|天空|草地|海湾|灯塔|雪景|风景|道路|户外|山谷|湖泊|池塘"
)
SCENE_CAPABLE_SEMANTICS = {
    "background_content", "background_design", "embedded_content",
    "embedded_image_content", "embedded_content_image_content", "image_content",
}
REFERENCE_INSTRUCTION_MARKERS = (
    "模板参考图是构图与视觉风格的最高权限",
    "只允许替换",
    "禁止重新设计",
    "finalPrompt",
)
REFERENCE_CONSTRAINT_CATEGORIES = {
    "composition": re.compile(r"构图|位置|区域|版式|排布|画幅|镜头|景别|裁切|留白|比例"),
    "style": re.compile(r"风格|媒介|材质|质感|笔触|网点|拼贴|剪纸|摄影|插画|线稿|纸张"),
    "relationship": re.compile(r"遮挡|层级|相对|关系|前景|背景|环绕|重叠|阅读顺序|融合"),
}
TOKEN_STOPWORDS = {
    "主体", "内容", "造型", "图案", "颜色", "配色", "背景", "装饰", "风格", "款式",
    "画面", "区域", "关系", "保持", "完整", "一个", "一只", "用户", "自定义", "简洁",
    "红色", "蓝色", "白色", "黑色", "粉色", "黄色", "绿色", "整体", "效果", "设计",
}
FALLBACK_RE = re.compile(r"\{\{\s*([a-zA-Z][a-zA-Z0-9_-]*)[^}]*\|\s*\"([^\"]*)\"\s*\}\}")
PLACEHOLDER_RE = re.compile(r"\{\{.*?\}\}")
SIZE_RE = re.compile(r"^(\d{2,4})x(\d{2,4})$")
INTERNAL_PRESERVE_ID_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+_\d+$", re.IGNORECASE)
INTERNAL_INSTRUCTION_RE = re.compile(
    r"按.{0,60}组件图|可编辑组件区域|组件化.{0,30}展示模板|"
    r"\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+_\d+\b",
    re.IGNORECASE,
)


def ratio_for_size(image_size: str) -> str | None:
    match = SIZE_RE.fullmatch(image_size)
    if not match:
        return None
    width, height = int(match.group(1)), int(match.group(2))
    candidates = [(16, 9), (1, 1), (9, 16), (3, 4), (4, 3)]
    best = min(candidates, key=lambda ratio: abs(width / height - ratio[0] / ratio[1]))
    return f"{best[0]}:{best[1]}"


def visible_prompt_text(prompt: str) -> str:
    return PLACEHOLDER_RE.sub("", prompt)


def looks_like_slot_inventory(prompt: str) -> bool:
    skeleton = PLACEHOLDER_RE.sub("§", prompt)
    placeholder_tail = re.search(
        r"(?:^|[：:])\s*§(?:\s*[；;,，、]\s*§){1,}\s*[。.!！]?$",
        skeleton,
    )
    labeled_items = re.findall(
        r"(?:^|[，；。:：])\s*[\u4e00-\u9fffA-Za-z0-9_]{1,12}(?:为|是|：)\s*§",
        skeleton,
    )
    return bool(placeholder_tail) or len(labeled_items) >= 2


def salient_tokens(value: str) -> set[str]:
    tokens: set[str] = set()
    for chunk in re.findall(r"[\u4e00-\u9fff]+", value):
        for size in (2, 3, 4):
            for start in range(0, len(chunk) - size + 1):
                token = chunk[start:start + size]
                if token not in TOKEN_STOPWORDS and not any(stop in token for stop in ("用户自定义", "简洁款")):
                    tokens.add(token)
    tokens.update(word.casefold() for word in re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", value))
    return tokens


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
    leaked_prompt_markers = [marker for marker in PROMPT_AUTHORING_MARKERS if marker in prompt]
    if leaked_prompt_markers:
        errors.append(
            "promptTemplate exposes backend authoring instructions: " + ", ".join(leaked_prompt_markers)
        )
    if looks_like_slot_inventory(prompt):
        errors.append("promptTemplate is a slot inventory instead of a complete user-facing image description")
    if re.search(r"制作[“\"]?.{0,80}模板", prompt):
        errors.append("promptTemplate describes authoring a template instead of the user's image intent")

    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    enhancement = data.get("promptEnhancement") if isinstance(data.get("promptEnhancement"), dict) else {}
    instruction = str(enhancement.get("instruction") or "")
    if instruction:
        if INTERNAL_INSTRUCTION_RE.search(instruction):
            errors.append("promptEnhancement.instruction exposes internal component-diagram language")
        if "只输出最终成图" not in instruction:
            errors.append("promptEnhancement.instruction must forbid rendering editor annotations")
    for field, values in (
        ("promptEnhancement.preserve", enhancement.get("preserve")),
        (
            "metadata.templateSource.preserve",
            metadata.get("templateSource", {}).get("preserve")
            if isinstance(metadata.get("templateSource"), dict) else None,
        ),
    ):
        if isinstance(values, list):
            leaked = [str(value) for value in values if INTERNAL_PRESERVE_ID_RE.fullmatch(str(value).strip())]
            if leaked:
                errors.append(f"{field} contains internal enumerated ids: {', '.join(leaked)}")
    semantics = metadata.get("inputSemantics") if isinstance(metadata.get("inputSemantics"), dict) else {}
    fallbacks = {match.group(1): match.group(2) for match in FALLBACK_RE.finditer(prompt)}
    prompt_static = visible_prompt_text(prompt)
    subjects = []
    editable_tokens: dict[str, set[str]] = {}
    for index, item in enumerate(data.get("inputSchema") or []):
        if not isinstance(item, dict):
            continue
        input_id = str(item.get("id") or "")
        required = item.get("required") is True
        has_fallback = bool(fallbacks.get(input_id))
        if item.get("type") == "subject":
            subjects.append(item)
            text = item.get("text") if isinstance(item.get("text"), dict) else {}
            default_value = str(text.get("defaultValue") or "")
            has_fallback = has_fallback or bool(str(text.get("defaultValue") or "").strip())
            slot_semantics = semantics.get(input_id) if isinstance(semantics.get(input_id), dict) else {}
            for key in ("semanticType", "defaultStateLabel", "textInputLabel", "uploadLabel"):
                if not str(slot_semantics.get(key) or "").strip():
                    errors.append(f"inputSchema[{index}] subject is missing metadata.inputSemantics.{input_id}.{key}")
            semantic_type = str(slot_semantics.get("semanticType") or "")
            label = str(item.get("label") or "")
            image = item.get("image") if isinstance(item.get("image"), dict) else {}
            if semantic_type in IDENTITY_SEMANTIC_TYPES or semantic_type.endswith("_identity"):
                if semantic_type != "subject_identity":
                    errors.append(f"inputSchema[{index}] {input_id!r} identity uploads must use semanticType=subject_identity")
                for field_name, field_value in (
                    ("label", label),
                    ("image.promptValue", str(image.get("promptValue") or "")),
                    ("metadata.inputSemantics.defaultStateLabel", str(slot_semantics.get("defaultStateLabel") or "")),
                    ("metadata.inputSemantics.textInputLabel", str(slot_semantics.get("textInputLabel") or "")),
                    ("metadata.inputSemantics.uploadLabel", str(slot_semantics.get("uploadLabel") or "")),
                ):
                    if IDENTITY_RESTRICTION_RE.search(field_value):
                        errors.append(
                            f"inputSchema[{index}] {input_id!r} {field_name} restricts uploaded subject identity: {field_value}"
                        )
                if not str(image.get("promptValue") or "").startswith("用户上传图中的"):
                    errors.append(
                        f"inputSchema[{index}] {input_id!r} identity image.promptValue must neutrally reference the uploaded image"
                    )
        if required and has_fallback:
            errors.append(f"inputSchema[{index}] {input_id!r} is required even though the template has a usable fallback")
        values: list[str] = []
        if item.get("type") == "prompt":
            values = [str(value) for value in item.get("suggestions") or []]
            default_value = str(fallbacks.get(input_id) or (values[0] if values else ""))
        elif item.get("type") == "subject" and isinstance(item.get("text"), dict):
            values = [str(value) for value in item["text"].get("suggestions") or []]
            default_value = str(item["text"].get("defaultValue") or "")
        else:
            default_value = str(fallbacks.get(input_id) or "")
        distinct_values = {value.strip() for value in values if value.strip()}
        if values and len(distinct_values) < 3:
            errors.append(
                f"inputSchema[{index}] {input_id!r} offers fewer than 3 distinct suggestions; "
                "omit suggestions for free-text-only input or provide meaningful alternatives"
            )
        tokens = salient_tokens(default_value)
        editable_tokens[input_id] = tokens
        leaked_tokens = sorted((token for token in tokens if token in prompt_static), key=lambda token: (-len(token), token))
        if leaked_tokens:
            errors.append(
                f"inputSchema[{index}] {input_id!r} default attribute leaks outside its placeholder: {', '.join(leaked_tokens[:5])}"
            )
        bad = sorted(set(values) & GENERIC_SUGGESTIONS)
        if bad:
            errors.append(f"inputSchema[{index}] {input_id!r} contains mechanical suggestions: {', '.join(bad)}")
        mechanical = sorted({value for value in values if MECHANICAL_SUGGESTION_RE.fullmatch(value.strip())})
        if mechanical:
            errors.append(
                f"inputSchema[{index}] {input_id!r} contains label-derived filler suggestions: {', '.join(mechanical)}"
            )
        slot_semantics = semantics.get(input_id) if isinstance(semantics.get(input_id), dict) else {}
        semantic_type = str(slot_semantics.get("semanticType") or "")
        scene_values = [value for value in values if SCENE_SUGGESTION_RE.search(value)]
        label = str(item.get("label") or "")
        label_allows_scene = bool(re.search(r"背景|环境|场景|风景|画面|图像|图片|页内|屏幕|窗口|镜中", label))
        if len(scene_values) >= 2 and semantic_type not in SCENE_CAPABLE_SEMANTICS and not label_allows_scene:
            errors.append(
                f"inputSchema[{index}] {input_id!r} mixes external scene suggestions into {semantic_type or 'an unspecified semantic axis'}: "
                + ", ".join(scene_values)
            )

    token_owners: dict[str, list[str]] = {}
    for input_id, tokens in editable_tokens.items():
        for token in tokens:
            token_owners.setdefault(token, []).append(input_id)
    for token, owners in sorted(token_owners.items()):
        unique_owners = list(dict.fromkeys(owners))
        if len(unique_owners) > 1:
            errors.append(
                f"editable slots overlap on the same attribute {token!r}: {', '.join(unique_owners)}; merge them or separate the component semantics"
            )

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
    if data.get("referenceImage"):
        missing_markers = [marker for marker in REFERENCE_INSTRUCTION_MARKERS if marker not in instruction]
        if missing_markers:
            errors.append(
                "promptEnhancement.instruction does not enforce reference-first generation: "
                + ", ".join(missing_markers)
            )
        constraints = [
            str(value).strip()
            for value in (enhancement.get("lockedConstraints") or []) + (enhancement.get("preserve") or [])
            if str(value).strip()
        ]
        categories = {
            name for name, pattern in REFERENCE_CONSTRAINT_CATEGORIES.items()
            if any(pattern.search(value) for value in constraints)
        }
        descriptive = [value for value in constraints if len(value) >= 12]
        if len(constraints) < 3 or len(descriptive) < 2 or len(categories) < 3:
            errors.append(
                "template reference constraints must contain image-specific composition, style and spatial-relationship evidence"
            )
        template_source = metadata.get("templateSource") if isinstance(metadata.get("templateSource"), dict) else {}
        authority = template_source.get("authority") if isinstance(template_source.get("authority"), dict) else {}
        if (
            authority.get("composition_authority") != "high"
            or authority.get("style_authority") != "high"
            or authority.get("identity_authority") != "none"
        ):
            errors.append("metadata.templateSource.authority must reserve high composition/style authority and no identity authority")
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
