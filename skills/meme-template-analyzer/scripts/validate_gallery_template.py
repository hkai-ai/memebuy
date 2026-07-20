#!/usr/bin/env python3
"""Validate GalleryTemplate import JSON without third-party dependencies."""

from __future__ import annotations

import argparse
import json
import os
import re
from urllib.parse import urlparse
from pathlib import Path
from typing import Any


KEY_RE = re.compile(r"^[a-z][a-z0-9-]{1,59}$")
ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,39}$")
SIZE_RE = re.compile(r"^\d{2,4}x\d{2,4}$")
TAG_ID_RE = re.compile(r"^[a-z][a-z0-9._-]{1,79}$")
TAG_DIMENSION_RE = re.compile(r"^[a-z][a-z0-9_-]{1,39}$")
PLACEHOLDER_RE = re.compile(r"{{\s*(.*?)\s*}}")
PATH_TERM_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,39}(?:\.[a-zA-Z][a-zA-Z0-9_-]{0,39})*$")
OSS_OBJECT_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
    r"\.(?:png|jpe?g|webp|gif|avif)$",
    re.IGNORECASE,
)
ROOT_KEYS = {
    "key", "title", "description", "cover", "referenceImage", "imageSize",
    "imageN", "stageKey", "promptTemplate", "promptEnhancement", "inputSchema", "preprocessSteps", "metadata",
}
INPUT_KEYS = {
    "prompt": {"type", "id", "label", "placeholder", "required", "minLength", "maxLength", "suggestions"},
    "select": {"type", "id", "label", "required", "options"},
    "image": {
        "type", "id", "label", "hint", "required", "maxCount", "minWidth", "minHeight", "private",
    },
    "subject": {"type", "id", "label", "required", "text", "image", "resolutionStrategy"},
}
SUBJECT_TEXT_KEYS = {"defaultValue", "placeholder", "allowCustom", "suggestions"}
SUBJECT_IMAGE_KEYS = {
    "enabled", "promptValue", "hint", "extract", "maxCount", "minWidth", "minHeight", "private", "sourceOptions",
}
PROMPT_ENHANCEMENT_KEYS = {
    "stageKey", "instruction", "referenceField", "lockedConstraints", "preserve", "output",
}
STEP_KEYS = {
    "vision": {"type", "id", "stageKey", "imageInputId", "prompt", "maxOutputTokens", "cache"},
    "text": {"type", "id", "stageKey", "prompt", "maxOutputTokens", "temperature", "cache"},
}


def check_string(errors: list[str], path: str, value: Any, minimum: int, maximum: int) -> None:
    if not isinstance(value, str) or not minimum <= len(value) <= maximum:
        errors.append(f"{path} must be a string with {minimum}-{maximum} characters")


def check_boolean(errors: list[str], path: str, value: Any) -> None:
    if not isinstance(value, bool):
        errors.append(f"{path} must be a boolean")


def check_integer(errors: list[str], path: str, value: Any, minimum: int, maximum: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        errors.append(f"{path} must be an integer from {minimum} to {maximum}")


def split_fallback_terms(expression: str) -> list[str] | None:
    terms: list[str] = []
    current: list[str] = []
    quoted = False
    escaped = False
    for char in expression:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\" and quoted:
            current.append(char)
            escaped = True
        elif char == '"':
            current.append(char)
            quoted = not quoted
        elif char == "|" and not quoted:
            terms.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    if quoted or escaped:
        return None
    terms.append("".join(current).strip())
    return terms


def prompt_expressions(errors: list[str], path: str, prompt: str) -> list[list[str]]:
    if "{%" in prompt or "%}" in prompt:
        errors.append(f"{path} contains unsupported Liquid control syntax")
    stripped = PLACEHOLDER_RE.sub("", prompt)
    if "{{" in stripped or "}}" in stripped:
        errors.append(f"{path} contains an unclosed or unmatched placeholder")
    parsed: list[list[str]] = []
    for expression in PLACEHOLDER_RE.findall(prompt):
        terms = split_fallback_terms(expression)
        if terms is None or not terms or any(not term for term in terms):
            errors.append(f"{path} contains an invalid fallback expression: {expression}")
            continue
        for term in terms:
            if term.startswith('"'):
                try:
                    literal = json.loads(term)
                except json.JSONDecodeError:
                    errors.append(f"{path} contains an invalid string literal: {term}")
                else:
                    if not isinstance(literal, str):
                        errors.append(f"{path} fallback literals must be strings: {term}")
            elif not PATH_TERM_RE.fullmatch(term):
                errors.append(f"{path} contains an invalid placeholder term: {term}")
        parsed.append(terms)
    return parsed


def validate_prompt_references(
    errors: list[str], path: str, prompt: str, defined: set[str], select_payloads: dict[str, set[str]]
) -> None:
    for terms in prompt_expressions(errors, path, prompt):
        for term in terms:
            if term.startswith('"'):
                continue
            head, _, field = term.partition(".")
            if head not in defined:
                errors.append(f"{path} references undefined id: {head}")
            elif field and head in select_payloads and field not in select_payloads[head]:
                errors.append(f"{path} references undefined select payload field: {term}")


def reject_extra(errors: list[str], path: str, value: dict[str, Any], allowed: set[str]) -> None:
    extra = sorted(set(value) - allowed)
    if extra:
        errors.append(f"{path} contains unsupported fields: {', '.join(extra)}")


def validate_input(errors: list[str], item: Any, index: int) -> None:
    path = f"inputSchema[{index}]"
    if not isinstance(item, dict):
        errors.append(f"{path} must be an object")
        return
    kind = item.get("type")
    if kind not in INPUT_KEYS:
        errors.append(f"{path}.type must be prompt, select, image, or subject")
        return
    reject_extra(errors, path, item, INPUT_KEYS[kind])
    for field in ["type", "id", "label"]:
        if field not in item:
            errors.append(f"{path}.{field} is required")
    if kind == "select" and "options" not in item:
        errors.append(f"{path}.options is required")
    if kind == "subject":
        for field in ["text", "image", "resolutionStrategy"]:
            if field not in item:
                errors.append(f"{path}.{field} is required")
    if not ID_RE.fullmatch(str(item.get("id", ""))):
        errors.append(f"{path}.id is invalid")
    check_string(errors, f"{path}.label", item.get("label"), 1, 40)
    if "required" in item:
        check_boolean(errors, f"{path}.required", item["required"])

    if kind == "prompt":
        if "placeholder" in item:
            check_string(errors, f"{path}.placeholder", item["placeholder"], 0, 120)
        for field, minimum, maximum in [("minLength", 0, 4000), ("maxLength", 1, 4000)]:
            if field in item:
                check_integer(errors, f"{path}.{field}", item[field], minimum, maximum)
        if isinstance(item.get("minLength"), int) and isinstance(item.get("maxLength"), int) and item["minLength"] > item["maxLength"]:
            errors.append(f"{path}.minLength must not exceed maxLength")
        if "suggestions" in item:
            suggestions = item.get("suggestions")
            if not isinstance(suggestions, list) or not 3 <= len(suggestions) <= 10:
                errors.append(f"{path}.suggestions must contain 3-10 strings when provided")
            elif any(not isinstance(value, str) or not 1 <= len(value) <= 120 for value in suggestions):
                errors.append(f"{path}.suggestions contains an invalid value")
            elif len(set(suggestions)) != len(suggestions):
                errors.append(f"{path}.suggestions must contain distinct values")
    elif kind == "select":
        options = item.get("options")
        if not isinstance(options, list) or not 2 <= len(options) <= 30:
            errors.append(f"{path}.options must contain 2-30 items")
        else:
            for option_index, option in enumerate(options):
                option_path = f"{path}.options[{option_index}]"
                if not isinstance(option, dict):
                    errors.append(f"{option_path} must be an object")
                    continue
                reject_extra(errors, option_path, option, {"value", "label", "thumbnail", "payload"})
                check_string(errors, f"{option_path}.value", option.get("value"), 1, 120)
                check_string(errors, f"{option_path}.label", option.get("label"), 1, 40)
                payload = option.get("payload")
                if payload is not None and (
                    not isinstance(payload, dict)
                    or any(not isinstance(v, str) or len(v) > 4000 for v in payload.values())
                ):
                    errors.append(f"{option_path}.payload must contain string values up to 4000 characters")
                thumbnail = option.get("thumbnail")
                if thumbnail is not None:
                    if not isinstance(thumbnail, str) or len(thumbnail) > 500:
                        errors.append(f"{option_path}.thumbnail must be a URI up to 500 characters")
                    else:
                        parsed = urlparse(thumbnail)
                        if not parsed.scheme:
                            errors.append(f"{option_path}.thumbnail must be an absolute URI")
    elif kind == "image":
        if "hint" in item:
            check_string(errors, f"{path}.hint", item["hint"], 0, 120)
        if "maxCount" in item:
            check_integer(errors, f"{path}.maxCount", item["maxCount"], 1, 6)
        for field in ["minWidth", "minHeight"]:
            if field in item:
                check_integer(errors, f"{path}.{field}", item[field], 64, 8192)
        if "private" in item:
            check_boolean(errors, f"{path}.private", item["private"])
    else:
        text = item.get("text")
        if not isinstance(text, dict):
            errors.append(f"{path}.text must be an object")
        else:
            reject_extra(errors, f"{path}.text", text, SUBJECT_TEXT_KEYS)
            for field in ["defaultValue", "allowCustom", "suggestions"]:
                if field not in text:
                    errors.append(f"{path}.text.{field} is required")
            check_string(errors, f"{path}.text.defaultValue", text.get("defaultValue"), 1, 120)
            if "placeholder" in text:
                check_string(errors, f"{path}.text.placeholder", text["placeholder"], 0, 120)
            if "allowCustom" in text:
                check_boolean(errors, f"{path}.text.allowCustom", text["allowCustom"])
            suggestions = text.get("suggestions")
            if not isinstance(suggestions, list) or not 3 <= len(suggestions) <= 10:
                errors.append(f"{path}.text.suggestions must contain 3-10 strings")
            elif any(not isinstance(value, str) or not 1 <= len(value) <= 120 for value in suggestions):
                errors.append(f"{path}.text.suggestions contains an invalid value")
            elif len(set(suggestions)) != len(suggestions):
                errors.append(f"{path}.text.suggestions must contain distinct values")
        image = item.get("image")
        if not isinstance(image, dict):
            errors.append(f"{path}.image must be an object")
        else:
            reject_extra(errors, f"{path}.image", image, SUBJECT_IMAGE_KEYS)
            for field in ["enabled", "promptValue", "extract", "maxCount", "private", "sourceOptions"]:
                if field not in image:
                    errors.append(f"{path}.image.{field} is required")
            if image.get("enabled") is not True:
                errors.append(f"{path}.image.enabled must be true")
            check_string(errors, f"{path}.image.promptValue", image.get("promptValue"), 1, 120)
            if isinstance(text, dict) and image.get("promptValue") == text.get("defaultValue"):
                errors.append(f"{path}.image.promptValue must not repeat the default text subject")
            if "hint" in image:
                check_string(errors, f"{path}.image.hint", image["hint"], 0, 120)
            if "extract" in image:
                check_string(errors, f"{path}.image.extract", image["extract"], 1, 1000)
            if "maxCount" in image:
                check_integer(errors, f"{path}.image.maxCount", image["maxCount"], 1, 6)
            for field in ["minWidth", "minHeight"]:
                if field in image:
                    check_integer(errors, f"{path}.image.{field}", image[field], 64, 8192)
            if "private" in image:
                check_boolean(errors, f"{path}.image.private", image["private"])
            source_options = image.get("sourceOptions")
            allowed_sources = {"upload", "recent_upload", "asset_library"}
            sources_are_strings = isinstance(source_options, list) and all(isinstance(source, str) for source in source_options)
            if (
                not sources_are_strings
                or not source_options
                or len(source_options) != len(set(source_options))
                or any(source not in allowed_sources for source in source_options)
            ):
                errors.append(f"{path}.image.sourceOptions is invalid")
        if item.get("resolutionStrategy") != "image_over_text":
            errors.append(f"{path}.resolutionStrategy must be image_over_text")


def validate_prompt_enhancement(errors: list[str], value: Any) -> None:
    path = "promptEnhancement"
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return
    reject_extra(errors, path, value, PROMPT_ENHANCEMENT_KEYS)
    for field in ["stageKey", "instruction", "lockedConstraints", "preserve", "output"]:
        if field not in value:
            errors.append(f"{path}.{field} is required")
    check_string(errors, f"{path}.stageKey", value.get("stageKey"), 1, 60)
    check_string(errors, f"{path}.instruction", value.get("instruction"), 1, 8000)
    if "referenceField" in value and value["referenceField"] != "referenceImage":
        errors.append(f"{path}.referenceField must be referenceImage")
    for field, maximum, item_maximum in [("lockedConstraints", 30, 500), ("preserve", 30, 120)]:
        items = value.get(field)
        if not isinstance(items, list) or len(items) > maximum:
            errors.append(f"{path}.{field} must be an array with at most {maximum} items")
        elif any(not isinstance(item, str) or not 1 <= len(item) <= item_maximum for item in items):
            errors.append(f"{path}.{field} contains an invalid value")
    output = value.get("output")
    if not isinstance(output, dict):
        errors.append(f"{path}.output must be an object")
    else:
        reject_extra(errors, f"{path}.output", output, {"format", "promptField"})
        if output.get("format") != "json":
            errors.append(f"{path}.output.format must be json")
        if output.get("promptField") != "finalPrompt":
            errors.append(f"{path}.output.promptField must be finalPrompt")


def validate_step(errors: list[str], step: Any, index: int, image_ids: set[str]) -> None:
    path = f"preprocessSteps[{index}]"
    if not isinstance(step, dict):
        errors.append(f"{path} must be an object")
        return
    kind = step.get("type")
    if kind not in STEP_KEYS:
        errors.append(f"{path}.type must be vision or text")
        return
    reject_extra(errors, path, step, STEP_KEYS[kind])
    required = ["type", "id", "stageKey", "prompt"]
    if kind == "vision":
        required.append("imageInputId")
    for field in required:
        if field not in step:
            errors.append(f"{path}.{field} is required")
    if not ID_RE.fullmatch(str(step.get("id", ""))):
        errors.append(f"{path}.id is invalid")
    check_string(errors, f"{path}.stageKey", step.get("stageKey"), 1, 60)
    check_string(errors, f"{path}.prompt", step.get("prompt"), 1, 8000)
    if kind == "vision" and step.get("imageInputId") not in image_ids:
        errors.append(f"{path}.imageInputId must reference an image input")
    if "maxOutputTokens" in step:
        check_integer(errors, f"{path}.maxOutputTokens", step["maxOutputTokens"], 256, 32000)
    if "cache" in step:
        check_boolean(errors, f"{path}.cache", step["cache"])
    if "temperature" in step and (
        isinstance(step["temperature"], bool)
        or not isinstance(step["temperature"], (int, float))
        or not 0 <= step["temperature"] <= 2
    ):
        errors.append(f"{path}.temperature must be a number from 0 to 2")


def validate(data: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["document must be an object"]
    reject_extra(errors, "$", data, ROOT_KEYS)
    for field in ["key", "title", "promptTemplate", "promptEnhancement", "inputSchema"]:
        if field not in data:
            errors.append(f"{field} is required")
    if not KEY_RE.fullmatch(str(data.get("key", ""))):
        errors.append("key must match ^[a-z][a-z0-9-]{1,59}$")
    check_string(errors, "title", data.get("title"), 1, 80)
    if data.get("description") is not None:
        check_string(errors, "description", data.get("description"), 0, 20)
    for field in ["cover", "referenceImage"]:
        if field in data and data[field] is not None and not isinstance(data[field], str):
            errors.append(f"{field} must be a string or null")
    if "imageSize" in data and (not isinstance(data["imageSize"], str) or not SIZE_RE.fullmatch(data["imageSize"])):
        errors.append("imageSize must look like 1024x1024")
    if "imageN" in data:
        check_integer(errors, "imageN", data["imageN"], 1, 4)
    if data.get("stageKey") is not None:
        check_string(errors, "stageKey", data["stageKey"], 0, 60)
    check_string(errors, "promptTemplate", data.get("promptTemplate"), 1, 4000)
    for marker in [
        "文案长度要求：", "使用模板固定参考图作为构图和风格参考", "必须遵守：",
        "保留模板参考图的这些结构和风格特征：", "沿用原画面", "以下开放项",
        "生成同构画面", "以模板参考图为构图", "仅修改开放项", "仅修改以下开放项",
    ]:
        if marker in str(data.get("promptTemplate", "")):
            errors.append(f"promptTemplate contains backend-only constraint text: {marker}")
    validate_prompt_enhancement(errors, data.get("promptEnhancement"))

    inputs = data.get("inputSchema")
    if not isinstance(inputs, list) or len(inputs) > 20:
        errors.append("inputSchema must be an array with at most 20 items")
        inputs = []
    for index, item in enumerate(inputs):
        validate_input(errors, item, index)
    input_ids = [item.get("id") for item in inputs if isinstance(item, dict)]
    if len(input_ids) != len(set(input_ids)):
        errors.append("inputSchema ids must be unique")
    image_ids = {
        str(item.get("id"))
        for item in inputs
        if isinstance(item, dict) and item.get("type") in {"image", "subject"}
    }
    select_payloads: dict[str, set[str]] = {}
    for item in inputs:
        if not isinstance(item, dict) or item.get("type") != "select":
            continue
        payload_keys: set[str] = set()
        for option in item.get("options", []):
            if isinstance(option, dict) and isinstance(option.get("payload"), dict):
                payload_keys.update(str(key) for key in option["payload"])
        select_payloads[str(item.get("id"))] = payload_keys

    steps = data.get("preprocessSteps", [])
    if not isinstance(steps, list) or len(steps) > 4:
        errors.append("preprocessSteps must be an array with at most 4 items")
        steps = []
    for index, step in enumerate(steps):
        validate_step(errors, step, index, image_ids)
    step_ids = [step.get("id") for step in steps if isinstance(step, dict)]
    all_ids = input_ids + step_ids
    if len(all_ids) != len(set(all_ids)):
        errors.append("inputSchema and preprocessSteps ids must share a unique namespace")

    defined = set(str(value) for value in all_ids)
    validate_prompt_references(
        errors, "promptTemplate", str(data.get("promptTemplate", "")), defined, select_payloads
    )
    available = set(str(value) for value in input_ids)
    for index, step in enumerate(steps):
        if isinstance(step, dict):
            validate_prompt_references(
                errors,
                f"preprocessSteps[{index}].prompt",
                str(step.get("prompt", "")),
                available,
                select_payloads,
            )
            available.add(str(step.get("id")))
    metadata = data.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        errors.append("metadata must be an object")
    elif isinstance(metadata, dict):
        tags = metadata.get("tags")
        if tags is not None and (
            not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags)
        ):
            errors.append("metadata.tags must be an array of strings")
        assignments = metadata.get("tagAssignments")
        if assignments is not None:
            if not isinstance(assignments, list) or len(assignments) > 40:
                errors.append("metadata.tagAssignments must be an array with at most 40 items")
            else:
                accepted_labels: list[str] = []
                seen_assignments: set[tuple[str, str]] = set()
                allowed_keys = {"tagId", "label", "dimension", "level", "source", "status", "confidence", "provider", "evidence"}
                for index, assignment in enumerate(assignments):
                    prefix = f"metadata.tagAssignments[{index}]"
                    if not isinstance(assignment, dict):
                        errors.append(f"{prefix} must be an object")
                        continue
                    unknown_keys = sorted(set(assignment) - allowed_keys)
                    if unknown_keys:
                        errors.append(f"{prefix} has unknown keys: {', '.join(unknown_keys)}")
                    label = assignment.get("label")
                    dimension = assignment.get("dimension")
                    level = assignment.get("level")
                    source = assignment.get("source")
                    status = assignment.get("status")
                    if not isinstance(label, str) or not 1 <= len(label) <= 80:
                        errors.append(f"{prefix}.label must contain 1-80 characters")
                    if not isinstance(dimension, str) or not TAG_DIMENSION_RE.fullmatch(dimension):
                        errors.append(f"{prefix}.dimension is invalid")
                    if level not in {"category", "tag"}:
                        errors.append(f"{prefix}.level is invalid")
                    if source not in {"operator", "template", "ai", "external"}:
                        errors.append(f"{prefix}.source is invalid")
                    if status not in {"accepted", "suggested", "rejected"}:
                        errors.append(f"{prefix}.status is invalid")
                    if source in {"operator", "template"} and status != "accepted":
                        errors.append(f"{prefix} locked source must be accepted")
                    tag_id = assignment.get("tagId")
                    if tag_id is not None and (not isinstance(tag_id, str) or not TAG_ID_RE.fullmatch(tag_id)):
                        errors.append(f"{prefix}.tagId is invalid")
                    confidence = assignment.get("confidence")
                    if confidence is not None and (source != "ai" or isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1):
                        errors.append(f"{prefix}.confidence is only valid for ai from 0 to 1")
                    provider = assignment.get("provider")
                    if source == "external" and (not isinstance(provider, str) or not provider.strip()):
                        errors.append(f"{prefix}.provider is required for external source")
                    if provider is not None and (not isinstance(provider, str) or len(provider) > 80):
                        errors.append(f"{prefix}.provider must contain at most 80 characters")
                    evidence = assignment.get("evidence")
                    if evidence is not None and (not isinstance(evidence, str) or len(evidence) > 300):
                        errors.append(f"{prefix}.evidence must contain at most 300 characters")
                    assignment_key = (str(source), str(tag_id or label).casefold())
                    if assignment_key in seen_assignments:
                        errors.append(f"{prefix} duplicates a tag from the same source")
                    seen_assignments.add(assignment_key)
                    if status == "accepted" and isinstance(label, str):
                        accepted_labels.append(label)
                if isinstance(tags, list):
                    missing_labels = sorted(set(accepted_labels) - set(tags))
                    if missing_labels:
                        errors.append("metadata.tags is missing accepted assignment labels: " + ", ".join(missing_labels))
        input_semantics = metadata.get("inputSemantics")
        if input_semantics is not None:
            if not isinstance(input_semantics, dict):
                errors.append("metadata.inputSemantics must be an object")
            else:
                missing_semantic_ids = sorted(set(input_semantics) - defined)
                if missing_semantic_ids:
                    errors.append(
                        "metadata.inputSemantics references undefined input ids: "
                        + ", ".join(missing_semantic_ids)
                    )
    return errors


def normalize_domain(value: str | None) -> str:
    domain = (value or "").strip().lower().rstrip(".")
    if not domain:
        return ""
    try:
        parsed = urlparse(f"//{domain}")
        port = parsed.port
    except ValueError:
        return ""
    if parsed.hostname != domain or port is not None or any(char in domain for char in "/?#@"):
        return ""
    return domain


def normalize_key_prefix(value: str | None) -> str:
    cleaned = (value or "").strip().strip("/")
    return f"{cleaned}/" if cleaned else ""


def validate_remote_asset_url(
    field: str,
    value: str,
    assets_domain: str,
    key_prefix: str,
) -> list[str]:
    parsed = urlparse(value)
    errors: list[str] = []
    if parsed.scheme != "https":
        errors.append(f"{field} remote URL must use https")
    if not assets_domain:
        errors.append(f"{field} remote URL validation requires a valid assets domain")
    elif (parsed.hostname or "").lower() != assets_domain or parsed.port is not None:
        errors.append(f"{field} remote URL host must be {assets_domain}")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        errors.append(f"{field} remote URL must not contain credentials, query, or fragment")
    expected_prefix = f"/{key_prefix}gallery/templates/"
    if not parsed.path.startswith(expected_prefix):
        errors.append(f"{field} remote URL path must start with {expected_prefix}")
    elif not OSS_OBJECT_RE.fullmatch(parsed.path[len(expected_prefix):]):
        errors.append(f"{field} remote URL object name must be a UUID v4 plus a supported image extension")
    return errors


def validate_artifact_paths(
    data: Any,
    base_dir: Path,
    asset_mode: str = "either",
    assets_domain: str | None = None,
    key_prefix: str = "",
) -> list[str]:
    if not isinstance(data, dict):
        return []
    errors: list[str] = []
    normalized_domain = normalize_domain(assets_domain)
    normalized_prefix = normalize_key_prefix(key_prefix)
    for field in ["cover", "referenceImage"]:
        value = data.get(field)
        if not isinstance(value, str) or not value:
            continue
        parsed = urlparse(value)
        if parsed.scheme:
            if asset_mode == "local":
                errors.append(f"{field} must be a local file path in local mode")
            elif parsed.scheme not in {"http", "https"}:
                errors.append(f"{field} URL scheme is not supported: {parsed.scheme}")
            else:
                errors.extend(validate_remote_asset_url(field, value, normalized_domain, normalized_prefix))
            continue
        if asset_mode == "remote":
            errors.append(f"{field} must be a remote URL in remote mode")
            continue
        path = (base_dir / value).resolve()
        if not path.is_file():
            errors.append(f"{field} local file does not exist: {value}")
    source = data.get("metadata", {}).get("templateSource") if isinstance(data.get("metadata"), dict) else None
    if isinstance(source, dict) and source.get("referenceField") != "referenceImage":
        errors.append("metadata.templateSource.referenceField must be referenceImage")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate GalleryTemplate import JSON v1.")
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--asset-mode", choices=["either", "local", "remote"], default="either")
    parser.add_argument("--assets-domain", default=os.environ.get("ALIYUN_OSS_ASSETS_DOMAIN", ""))
    parser.add_argument("--key-prefix", default=os.environ.get("ALIYUN_OSS_KEY_PREFIX", ""))
    args = parser.parse_args()
    failed = False
    for path in args.files:
        data = json.loads(path.read_text(encoding="utf-8"))
        errors = validate(data) + validate_artifact_paths(
            data,
            path.parent,
            asset_mode=args.asset_mode,
            assets_domain=args.assets_domain,
            key_prefix=args.key_prefix,
        )
        if errors:
            failed = True
            print(f"FAIL {path}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"PASS {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
