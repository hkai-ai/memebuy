# JSON Contract

Use this contract for `template`, `variants`, `prompt-contract`, `render-prompts`, `batch`, and `compare` modes. Return JSON that is machine-readable first and human-readable second.

Default skill behavior writes these objects to files. Inline JSON is only for explicit JSON requests or unavailable filesystem output.

## Language Contract

All business-readable content must be Simplified Chinese by default.

Keep technical identifiers unchanged:

- JSON keys, schema names, file names, paths, JSONPath, placeholders, mode names, enum values, labels, IDs, hashes, URLs, and code-like values.
- source text that is visibly present in the meme; preserve it verbatim and add Chinese explanation or translation fields when helpful.
- user-provided strings that must remain in their original language.

Use Chinese for:

- every prose string value in JSON, including summaries, limitations, notes, prompts, warnings, examples, pass criteria, postprocessing steps, risk descriptions, and explanation fields.
- all Markdown prose in `index.md`.
- rendered prompt text in `rendered_prompts` and `prompt-pack.json`, unless the user explicitly requests English prompts for a downstream model.

Do not use English example prose as filler in output artifacts. If a value is inferred, explain the inference in Chinese and include a confidence score.

## Artifact Directory Shape

```json
{
  "result_directory": "artifacts/meme-template-analyzer/<template_id-or-timestamp>/",
  "files": {
    "normalized_input": "normalized-input.json",
    "meme_template": "meme-template.json",
    "slot_bindings": "slot-bindings.json",
    "prompt_templates": "prompt-templates.json",
    "rendered_prompts": "rendered-prompts.json",
    "prompt_pack": "prompt-pack.json",
    "stability_testset": "stability-testset.json",
    "manifest": "index.md"
  }
}
```

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
  "reading_model": {
    "first_read": "",
    "second_read": "",
    "reading_order": [],
    "misdirection_or_reinterpretation": "",
    "role_mapping": [],
    "failure_modes": []
  },
  "salience_model": {
    "primary_attention": [],
    "secondary_attention": [],
    "hidden_or_delayed_elements": [],
    "must_remain_subtle": [],
    "must_remain_obvious": [],
    "forbidden_emphasis": []
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
  "downstream_hint": "",
  "salience_requirement": "dominant | secondary | subtle | hidden | delayed | misleading | backgrounded | not_applicable",
  "identity_binding": {
    "bind_full_appearance": false,
    "bind_silhouette": false,
    "bind_label": false,
    "bind_color": false,
    "bind_pose": false,
    "bind_expression": false,
    "bind_semantic_role": false,
    "notes": ""
  }
}
```

## Faithful Variant Object

```json
{
  "goal": "Preserve recognizability while changing only core variables.",
  "locked_features": [],
  "locked_reading_model": [],
  "locked_salience_model": [],
  "editable_slots": [],
  "max_change_budget": {
    "description": "在失去高保真识别度前，最多允许改变多少个维度。",
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
  "preserved_reading_model": [],
  "preserved_salience_model": [],
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
      "confidence": 0.0,
      "binding_mode": "full_appearance | silhouette_cues | label_only | color_trace | pose_only | expression_only | semantic_role | texture_or_artifact",
      "salience_requirement": "dominant | secondary | subtle | hidden | delayed | misleading | backgrounded | not_applicable"
    }
  ],
  "prompt_templates": {
    "base": "",
    "faithful": "",
    "creative": ""
  },
  "rendered_prompts": {
    "base": "",
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

## Prompt Pack Object

Use for `prompt-pack.json`. It is the complete persistent artifact for user input -> normalized JSON -> slot binding -> prompt template replacement -> final faithful and creative prompts.

```json
{
  "schema_version": "1.1",
  "artifact_type": "meme_prompt_pack",
  "created_at": "ISO-8601 timestamp",
  "source_access": {},
  "normalized_input": {},
  "meme_template": {},
  "slot_bindings": [],
  "prompt_templates": {
    "base": "",
    "faithful": "",
    "creative": ""
  },
  "rendered_prompts": {
    "base": {
      "label": "base_template",
      "prompt": "",
      "locked_reading_model": [],
      "locked_salience_model": [],
      "failure_modes": []
    },
    "faithful": {
      "label": "high_fidelity",
      "prompt": "",
      "negative_prompt": [],
      "locked_features": [],
      "locked_reading_model": [],
      "locked_salience_model": [],
      "editable_slots": []
    },
    "creative": {
      "label": "free_creative",
      "prompt": "",
      "negative_prompt": [],
      "preserved_formula": [],
      "preserved_reading_model": [],
      "preserved_salience_model": [],
      "editable_dimensions": []
    }
  },
  "render_warnings": [],
  "postprocessing": {},
  "risk_notes": []
}
```

The `faithful.prompt` and `creative.prompt` fields must contain final Chinese text with no unresolved `{{placeholder}}` strings, unless the user explicitly requested English prompts.

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
