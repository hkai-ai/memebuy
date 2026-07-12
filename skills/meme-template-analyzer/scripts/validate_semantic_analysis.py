#!/usr/bin/env python3
"""Validate cultural-reference discovery and formula-reflection analysis sidecars."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


REFERENCE_STATUSES = {"confirmed", "probable", "suspected", "none", "unknown"}
REFERENCE_TYPES = {
    "artwork", "film", "television", "game", "anime", "celebrity", "advertisement",
    "internet_meme", "regional_culture", "none", "unknown",
}
HYPOTHESIS_KINDS = {"external_reference", "intrinsic_visual_joke", "standalone_image"}
CONTENT_FUNCTIONS = {
    "meme_template", "reaction_image", "cute_pet", "aesthetic_image", "ordinary_photo",
    "original_visual_joke", "unknown",
}
CONFIDENCE_FIELDS = {
    "visual_observation", "reference_identification", "context_understanding",
    "meme_formula", "slot_design",
}


def nonempty_strings(value: Any) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(item, str) and item.strip() for item in value)


def validate_analysis(document: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(document, dict):
        return ["document must be an object"]
    analysis = document.get("analysis", document)
    if not isinstance(analysis, dict):
        return ["analysis must be an object"]

    if not nonempty_strings(analysis.get("visual_observations")):
        errors.append("analysis.visual_observations must contain non-empty strings")
    bundle = analysis.get("distinctive_feature_bundle")
    if not isinstance(bundle, list) or not 3 <= len(bundle) <= 8 or any(not isinstance(x, str) or not x.strip() for x in bundle):
        errors.append("analysis.distinctive_feature_bundle must contain 3-8 non-empty strings")
    if analysis.get("content_function") not in CONTENT_FUNCTIONS:
        errors.append("analysis.content_function is invalid")

    discovery = analysis.get("reference_discovery")
    if not isinstance(discovery, dict):
        errors.append("analysis.reference_discovery must be an object")
        discovery = {}
    status = discovery.get("reference_status")
    if status not in REFERENCE_STATUSES:
        errors.append("analysis.reference_discovery.reference_status is invalid")
    if discovery.get("reference_type") not in REFERENCE_TYPES:
        errors.append("analysis.reference_discovery.reference_type is invalid")
    if status in {"confirmed", "probable", "suspected"} and not str(discovery.get("primary_reference", "")).strip():
        errors.append(f"reference_status {status} requires primary_reference")
    if status == "none" and not nonempty_strings(discovery.get("none_evidence")):
        errors.append("reference_status none requires non-empty none_evidence")
    if status in {"unknown", "suspected"}:
        if discovery.get("human_review_required") is not True:
            errors.append(f"reference_status {status} requires human_review_required: true")
        if not nonempty_strings(discovery.get("review_reasons")):
            errors.append(f"reference_status {status} requires non-empty review_reasons")

    hypotheses = analysis.get("interpretation_hypotheses")
    if not isinstance(hypotheses, list):
        errors.append("analysis.interpretation_hypotheses must be an array")
        hypotheses = []
    kinds = {item.get("kind") for item in hypotheses if isinstance(item, dict)}
    missing = sorted(HYPOTHESIS_KINDS - kinds)
    if missing:
        errors.append("interpretation_hypotheses missing kinds: " + ", ".join(missing))
    for index, item in enumerate(hypotheses):
        if not isinstance(item, dict):
            errors.append(f"interpretation_hypotheses[{index}] must be an object")
            continue
        confidence = item.get("confidence")
        if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
            errors.append(f"interpretation_hypotheses[{index}].confidence must be 0-1")
        if not str(item.get("claim", "")).strip():
            errors.append(f"interpretation_hypotheses[{index}].claim is required")

    reflection = analysis.get("formula_reflection_review")
    if not isinstance(reflection, dict):
        errors.append("analysis.formula_reflection_review must be an object")
        reflection = {}
    for field in ["distinctive_bundle_explained", "alternative_hypotheses_compared", "passed"]:
        if not isinstance(reflection.get(field), bool):
            errors.append(f"formula_reflection_review.{field} must be boolean")
    if reflection.get("generic_description_risk") not in {"low", "medium", "high"}:
        errors.append("formula_reflection_review.generic_description_risk is invalid")
    if reflection.get("unknown_as_none_risk") not in {"low", "medium", "high"}:
        errors.append("formula_reflection_review.unknown_as_none_risk is invalid")
    if status in {"confirmed", "probable", "suspected"} and not nonempty_strings(reflection.get("reference_anchors_identified")):
        errors.append("identified references require reference_anchors_identified")
    if reflection.get("passed") is True and (
        reflection.get("distinctive_bundle_explained") is not True
        or reflection.get("alternative_hypotheses_compared") is not True
        or reflection.get("generic_description_risk") == "high"
    ):
        errors.append("formula_reflection_review.passed conflicts with failed premise checks")

    confidence = analysis.get("confidence")
    if not isinstance(confidence, dict):
        errors.append("analysis.confidence must be an object")
    else:
        for field in sorted(CONFIDENCE_FIELDS):
            value = confidence.get(field)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 1:
                errors.append(f"analysis.confidence.{field} must be 0-1")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate meme semantic analysis sidecar.")
    parser.add_argument("files", nargs="+", type=Path)
    args = parser.parse_args()
    failed = False
    for path in args.files:
        data = json.loads(path.read_text(encoding="utf-8"))
        errors = validate_analysis(data)
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
