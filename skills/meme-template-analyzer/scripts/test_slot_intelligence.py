#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from validate_slot_intelligence import validate


def write_case(root: Path, slots: list[dict], components: list[dict], candidates: list[dict], selected: list[str]) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    analysis = {
        "analysis": {
            "component_graph": {"components": components, "relationships": []},
            "edit_intent_candidates": candidates,
            "slot_intelligence_review": {
                "mechanismClass": "poster_layout",
                "selectedSlotIds": selected,
                "genericSlotReuseRisk": "low",
                "componentCoveragePassed": True,
                "textSlotAuditPassed": True,
                "compositeInputAuditPassed": True,
                "passed": True,
                "reviewReasons": [],
            },
        }
    }
    (root / "image-edit-analysis.json").write_text(json.dumps(analysis), encoding="utf-8")
    (root / "image-edit-template.json").write_text(json.dumps({"slots": slots}), encoding="utf-8")
    return root


def component(component_id: str, component_type: str, editable: list[str]) -> dict:
    return {
        "id": component_id,
        "type": component_type,
        "parentId": None,
        "visibleEvidence": [f"visible {component_id}"],
        "editableProperties": editable,
        "lockedProperties": [],
    }


def candidate(candidate_id: str, component_id: str, property_name: str, slot_id: str) -> dict:
    return {
        "id": candidate_id,
        "componentId": component_id,
        "property": property_name,
        "operation": "replace_text" if property_name == "text" else "recolor",
        "userEditLikelihood": 0.9,
        "visualSalience": 0.9,
        "templateIntegrityRisk": "low",
        "frontendControl": "prompt",
        "decision": "expose",
        "slotId": slot_id,
        "reason": "specific visible component",
    }


def main() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        good = write_case(
            root / "good",
            [{"id": "headline"}, {"id": "palette"}],
            [component("headline_component", "text", ["text"]), component("background", "background", ["color"])],
            [candidate("edit_headline", "headline_component", "text", "headline"), candidate("edit_palette", "background", "color", "palette")],
            ["headline", "palette"],
        )
        errors, _, _ = validate(good)
        assert not errors, errors

        generic = write_case(
            root / "generic",
            [{"id": "subject"}, {"id": "scene"}, {"id": "style"}, {"id": "caption"}],
            [component("subject_component", "subject", ["identity"]), component("scene_component", "background", ["content"]), component("style_component", "canvas", ["style"]), component("caption_component", "text", ["text"])],
            [candidate("edit_subject", "subject_component", "identity", "subject"), candidate("edit_scene", "scene_component", "content", "scene"), candidate("edit_style", "style_component", "style", "style"), candidate("edit_caption", "caption_component", "text", "caption")],
            ["subject", "scene", "style", "caption"],
        )
        errors, _, _ = validate(generic)
        assert any("mechanical generic slot set" in error for error in errors), errors
    print("PASS slot intelligence tests")


if __name__ == "__main__":
    main()
