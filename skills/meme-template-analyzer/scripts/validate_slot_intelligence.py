#!/usr/bin/env python3
"""Validate component-bound, mechanism-specific slot mining."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


COMPONENT_TYPES = {
    "canvas", "subject", "text", "accessory", "apparel", "background",
    "container", "embedded_content", "decoration", "object", "panel",
}
OPERATIONS = {
    "replace_identity", "replace_text", "replace_image", "recolor", "restyle",
    "change_apparel", "change_accessory", "change_background",
    "stylize_and_embed", "adjust_layout",
}
DECISIONS = {
    "expose", "locked_invariant", "constraint_only", "style_note",
    "too_minor", "backend_only",
}
RISKS = {"low", "medium", "high"}
CONTROLS = {"text", "prompt", "select", "image_upload", "subject"}
GENERIC_IDS = {"subject", "scene", "style", "caption"}
ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,79}$")
REACTION_PORTRAIT_EVIDENCE = (
    "头像", "头部", "脸", "面部", "表情", "正脸", "肖像", "特写", "半身",
    "headshot", "face", "facial", "portrait", "close-up",
)


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def template_dir(path: Path) -> Path:
    resolved = path.resolve()
    if resolved.is_dir():
        return resolved
    if resolved.name in {"image-edit-analysis.json", "image-edit-template.json"}:
        return resolved.parent
    raise ValueError(f"expected a template directory or analysis/template JSON: {path}")


def nonempty_strings(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(x, str) and x.strip() for x in value) and bool(value)


def validate(directory: Path) -> tuple[list[str], tuple[str, ...], str]:
    errors: list[str] = []
    analysis_file = directory / "image-edit-analysis.json"
    template_file = directory / "image-edit-template.json"
    if not analysis_file.is_file() or not template_file.is_file():
        return ["directory must contain image-edit-analysis.json and image-edit-template.json"], (), ""
    analysis_doc = load_json(analysis_file)
    template = load_json(template_file)
    analysis = analysis_doc.get("analysis", analysis_doc)
    if not isinstance(analysis, dict):
        return ["analysis must be an object"], (), ""

    graph = analysis.get("component_graph")
    if not isinstance(graph, dict):
        errors.append("analysis.component_graph must be an object")
        graph = {}
    components = graph.get("components")
    if not isinstance(components, list) or not components:
        errors.append("component_graph.components must be a non-empty array")
        components = []
    component_ids: set[str] = set()
    text_component_ids: set[str] = set()
    editable_text_components: set[str] = set()
    subject_visible_evidence: list[str] = []
    for index, component in enumerate(components):
        if not isinstance(component, dict):
            errors.append(f"component_graph.components[{index}] must be an object")
            continue
        component_id = str(component.get("id") or "")
        if not ID_RE.fullmatch(component_id):
            errors.append(f"component {index} has invalid id")
        elif component_id in component_ids:
            errors.append(f"duplicate component id: {component_id}")
        component_ids.add(component_id)
        component_type = component.get("type")
        if component_type not in COMPONENT_TYPES:
            errors.append(f"component {component_id!r} has invalid type")
        if not nonempty_strings(component.get("visibleEvidence")):
            errors.append(f"component {component_id!r} requires visibleEvidence")
        editable = component.get("editableProperties")
        locked = component.get("lockedProperties")
        if not isinstance(editable, list) or any(not isinstance(x, str) or not x.strip() for x in editable):
            errors.append(f"component {component_id!r}.editableProperties must be an array of strings")
            editable = []
        if not isinstance(locked, list) or any(not isinstance(x, str) or not x.strip() for x in locked):
            errors.append(f"component {component_id!r}.lockedProperties must be an array of strings")
        parent_id = component.get("parentId")
        if parent_id is not None and not isinstance(parent_id, str):
            errors.append(f"component {component_id!r}.parentId must be string or null")
        if component_type == "text":
            text_component_ids.add(component_id)
            if "text" in editable:
                editable_text_components.add(component_id)
        if component_type == "subject":
            subject_visible_evidence.extend(str(value) for value in component.get("visibleEvidence") or [])
    for component in components:
        if isinstance(component, dict):
            parent_id = component.get("parentId")
            if parent_id and parent_id not in component_ids:
                errors.append(f"component {component.get('id')!r} references missing parentId {parent_id!r}")

    candidates = analysis.get("edit_intent_candidates")
    if not isinstance(candidates, list) or not candidates:
        errors.append("analysis.edit_intent_candidates must be a non-empty array")
        candidates = []
    exposed_by_slot: dict[str, list[dict[str, Any]]] = {}
    candidate_text_components: set[str] = set()
    candidate_ids: set[str] = set()
    for index, candidate in enumerate(candidates):
        if not isinstance(candidate, dict):
            errors.append(f"edit_intent_candidates[{index}] must be an object")
            continue
        candidate_id = str(candidate.get("id") or "")
        if not ID_RE.fullmatch(candidate_id) or candidate_id in candidate_ids:
            errors.append(f"candidate {index} has invalid or duplicate id")
        candidate_ids.add(candidate_id)
        component_id = str(candidate.get("componentId") or "")
        if component_id not in component_ids:
            errors.append(f"candidate {candidate_id!r} references missing component {component_id!r}")
        property_name = str(candidate.get("property") or "").strip()
        if not property_name:
            errors.append(f"candidate {candidate_id!r} requires property")
        if candidate.get("operation") not in OPERATIONS:
            errors.append(f"candidate {candidate_id!r} has invalid operation")
        for field in ["userEditLikelihood", "visualSalience"]:
            value = candidate.get(field)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 1:
                errors.append(f"candidate {candidate_id!r}.{field} must be 0-1")
        if candidate.get("templateIntegrityRisk") not in RISKS:
            errors.append(f"candidate {candidate_id!r} has invalid templateIntegrityRisk")
        if candidate.get("frontendControl") not in CONTROLS:
            errors.append(f"candidate {candidate_id!r} has invalid frontendControl")
        decision = candidate.get("decision")
        if decision not in DECISIONS:
            errors.append(f"candidate {candidate_id!r} has invalid decision")
        if not str(candidate.get("reason") or "").strip():
            errors.append(f"candidate {candidate_id!r} requires reason")
        if component_id in text_component_ids and property_name == "text":
            candidate_text_components.add(component_id)
        if decision == "expose":
            slot_id = str(candidate.get("slotId") or "")
            if not ID_RE.fullmatch(slot_id):
                errors.append(f"candidate {candidate_id!r} expose decision requires valid slotId")
            exposed_by_slot.setdefault(slot_id, []).append(candidate)

    slots = template.get("slots")
    if not isinstance(slots, list):
        errors.append("image-edit-template.slots must be an array")
        slots = []
    slot_ids = tuple(str(slot.get("id") or "") for slot in slots if isinstance(slot, dict))
    if len(slot_ids) != len(set(slot_ids)):
        errors.append("template slot ids must be unique")
    for slot_id in slot_ids:
        bindings = exposed_by_slot.get(slot_id, [])
        if not bindings:
            errors.append(f"slot {slot_id!r} has no exposed component/property binding")
    unexpected = sorted(set(exposed_by_slot) - set(slot_ids))
    if unexpected:
        errors.append("exposed candidates reference missing slots: " + ", ".join(unexpected))
    generic_count = sum(slot_id in GENERIC_IDS for slot_id in slot_ids)
    if generic_count >= 3:
        errors.append("mechanical generic slot set detected; bind business-specific component slots")
    if "caption" in slot_ids and not text_component_ids:
        errors.append("caption slot exists but component graph has no visible text component")
    missing_text_audits = sorted(editable_text_components - candidate_text_components)
    if missing_text_audits:
        errors.append("editable text components lack edit candidates: " + ", ".join(missing_text_audits))

    review = analysis.get("slot_intelligence_review")
    if not isinstance(review, dict):
        errors.append("analysis.slot_intelligence_review must be an object")
        review = {}
    mechanism = str(review.get("mechanismClass") or "").strip()
    if not mechanism:
        errors.append("slot_intelligence_review.mechanismClass is required")
    if mechanism == "reaction_portrait":
        evidence_text = " ".join(subject_visible_evidence).casefold()
        if not any(marker.casefold() in evidence_text for marker in REACTION_PORTRAIT_EVIDENCE):
            errors.append("reaction_portrait requires visible face, headshot, expression, portrait, or close-up evidence")
    selected = review.get("selectedSlotIds")
    if not isinstance(selected, list) or set(map(str, selected)) != set(slot_ids) or len(selected) != len(slot_ids):
        errors.append("slot_intelligence_review.selectedSlotIds must exactly match template slots")
    if review.get("genericSlotReuseRisk") not in RISKS:
        errors.append("slot_intelligence_review.genericSlotReuseRisk is invalid")
    for field in ["componentCoveragePassed", "textSlotAuditPassed", "compositeInputAuditPassed", "passed"]:
        if review.get(field) is not True:
            errors.append(f"slot_intelligence_review.{field} must be true")
    if not isinstance(review.get("reviewReasons"), list):
        errors.append("slot_intelligence_review.reviewReasons must be an array")
    return errors, tuple(sorted(slot_ids)), mechanism


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate component-bound slot intelligence.")
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()
    directories: list[Path] = []
    for path in args.paths:
        directory = template_dir(path)
        if directory not in directories:
            directories.append(directory)
    failed = False
    signatures: Counter[tuple[str, ...]] = Counter()
    mechanisms: Counter[str] = Counter()
    for directory in directories:
        try:
            errors, signature, mechanism = validate(directory)
        except Exception as exc:
            errors, signature, mechanism = [str(exc)], (), ""
        if errors:
            failed = True
            print(f"FAIL {directory}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"PASS {directory}")
            signatures[signature] += 1
            mechanisms[mechanism] += 1
    count = len(directories)
    if not failed and count >= 10:
        most_common_signature, most_common_count = signatures.most_common(1)[0]
        if most_common_count / count > 0.55:
            failed = True
            print(f"FAIL BATCH: slot signature {most_common_signature} reused by {most_common_count}/{count} templates")
        elif count >= 20 and len(mechanisms) < 3:
            failed = True
            print(f"FAIL BATCH: only {len(mechanisms)} mechanism classes across {count} templates")
        else:
            print(f"PASS BATCH: {count} templates, {len(signatures)} slot signatures, {len(mechanisms)} mechanisms")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
