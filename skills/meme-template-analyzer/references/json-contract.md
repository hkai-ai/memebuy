# JSON Contract

Use this contract for `template`, `variants`, `prompt-contract`, `render-prompts`, `batch`, and `compare` modes. Return JSON that is machine-readable first and human-readable second.

## Top-Level Shape

```json
{
  "schema_version": "1.0",
  "mode": "template",
  "postprocessing_required": true,
  "source_access": {
    "inputs": [],
    "limitations": [],
    "analysis_confidence": 0.0
  },
  "meme_template": {},
  "generation_pipeline": null,
  "faithful_variant": {},
  "creative_variant": {},
  "postprocessing": {},
  "risk_notes": []
}
```

For `batch`, replace `meme_template` with `template_library`. For `compare`, include `comparison`.

## Template Object

```json
{
  "template_id": "short_snake_case_id",
  "title": "",
  "meme_type": "image_driven | text_driven | hybrid",
  "one_sentence_summary": "",
  "core_joke_formula": {
    "setup": "",
    "turn": "",
    "payoff": "",
    "emotional_engine": "",
    "audience_assumption": "",
    "reuse_formula": ""
  },
  "visual_analysis": {
    "composition": "",
    "subjects": [],
    "scene": "",
    "camera_and_crop": "",
    "color_palette": [],
    "texture_and_rendering": "",
    "style_family": "",
    "visual_hierarchy": "",
    "recognition_anchors": []
  },
  "text_analysis": {
    "has_text": false,
    "detected_text": [],
    "language": [],
    "layout": [],
    "rhetorical_pattern": "",
    "background_context": {
      "needed": false,
      "notes": "",
      "confidence": 0.0
    },
    "text_formula": "",
    "localization_notes": []
  },
  "variable_slots": [],
  "series_potential": {
    "can_expand": true,
    "best_use_cases": [],
    "weak_use_cases": [],
    "template_family": ""
  }
}
```

## Variable Slot Object

```json
{
  "slot_id": "subject_primary",
  "category": "subject",
  "role": "",
  "current_value": "",
  "lock_level": "locked | faithful_editable | creative_editable | fully_editable",
  "faithful_change_rule": "",
  "creative_change_rule": "",
  "examples": {
    "faithful": [],
    "creative": []
  },
  "downstream_hint": ""
}
```

## Faithful Variant Object

```json
{
  "goal": "Preserve recognizability while changing only core variables.",
  "locked_features": [],
  "editable_slots": [],
  "max_change_budget": {
    "description": "How many dimensions may change before the meme stops being high-fidelity.",
    "recommended_changed_slots": 0,
    "must_not_change": []
  },
  "generation_constraints": {
    "positive": [],
    "negative": [],
    "text_rendering": [],
    "layout_preservation": []
  },
  "example_variants": []
}
```

## Creative Variant Object

```json
{
  "goal": "Preserve formula and style family while expanding the meme series.",
  "preserved_principles": [],
  "editable_dimensions": [],
  "series_style_rules": [],
  "generation_constraints": {
    "positive": [],
    "negative": [],
    "text_rendering": [],
    "style_preservation": []
  },
  "example_variants": []
}
```

## Prompt Contract Object

Use when `mode` is `prompt-contract` or the user asks for image-generation-ready output.

```json
{
  "faithful_prompt_contract": {
    "prompt": "",
    "locked_elements": [],
    "editable_elements": [],
    "negative_prompt": [],
    "text_instructions": [],
    "postprocessing_notes": []
  },
  "creative_prompt_contract": {
    "prompt": "",
    "style_rules": [],
    "formula_rules": [],
    "negative_prompt": [],
    "text_instructions": [],
    "postprocessing_notes": []
  }
}
```

## Generation Pipeline Object

Use when `mode` is `render-prompts`, when the user provides target content to insert into a meme template, or when downstream generation should run without a reference image.

```json
{
  "source_template_id": "short_snake_case_id",
  "reference_strategy": "none | image_reference | edit_target",
  "user_input_normalization": {
    "raw_user_input": "",
    "normalized_fields": {
      "subject": "",
      "task": "",
      "caption": "",
      "setting": "",
      "style_intensity": "faithful | creative | both",
      "constraints": [],
      "negative_constraints": []
    },
    "inferred_fields": [
      {
        "field": "",
        "value": "",
        "reason": "",
        "confidence": 0.0
      }
    ],
    "missing_fields": []
  },
  "slot_bindings": [
    {
      "slot_id": "subject_primary",
      "placeholder": "{{primary_subject}}",
      "value": "",
      "source": "user_input | inferred | template_default",
      "applies_to": "faithful | creative | both",
      "confidence": 0.0
    }
  ],
  "prompt_templates": {
    "faithful": "",
    "creative": ""
  },
  "rendered_prompts": {
    "faithful": "",
    "creative": ""
  },
  "render_warnings": [],
  "downstream_generation_notes": {
    "text_to_image_ready": true,
    "needs_reference_image": false,
    "manual_steps": []
  }
}
```

Placeholder rules:

- Use `{{snake_case}}` placeholders only.
- Resolve every placeholder through `slot_bindings` before writing `rendered_prompts`.
- Do not leave unresolved placeholders in `rendered_prompts`.
- If the user omits content, use an inferred value or template default, then record the decision in `inferred_fields` and `render_warnings`.
- Use `reference_strategy: "none"` when the output is intended for text-to-image generation without a source image.

## Postprocessing Object

```json
{
  "required": true,
  "steps": [
    {
      "step": "manual_text_compositing",
      "reason": "",
      "applies_to": "faithful | creative | both"
    }
  ],
  "json_paths_for_downstream": [
    "$.generation_pipeline.user_input_normalization.normalized_fields",
    "$.generation_pipeline.slot_bindings",
    "$.generation_pipeline.prompt_templates",
    "$.generation_pipeline.rendered_prompts"
  ]
}
```

## Risk Notes

Use `risk_notes` to preserve issues without silently rewriting the user's target.

```json
{
  "risk_type": "copyright | trademark | public_figure | private_person | platform_ui | readable_logo | watermark | cultural_context | text_rendering | unknown",
  "description": "",
  "impact_on_generation": "",
  "suggested_user_decision": "",
  "confidence": 0.0
}
```

## Compare Mode

```json
{
  "comparison": {
    "shared_formula": "",
    "shared_style_rules": [],
    "shared_variable_slots": [],
    "differences": [],
    "series_strategy": {
      "faithful_series": "",
      "creative_series": ""
    }
  }
}
```
