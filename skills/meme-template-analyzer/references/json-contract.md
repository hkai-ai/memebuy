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
    "vlm_recognition_mock": "vlm-recognition-mock.json",
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
  "vlm_recognition": {},
  "meme_template": {},
  "generation_pipeline": null,
  "faithful_variant": {},
  "creative_variant": {},
  "postprocessing": {}
}
```

For `batch`, replace `meme_template` with `template_library`. For `compare`, include `comparison`.

## VLM Recognition Mock Object

Use for `vlm-recognition-mock.json`. It represents the mocked structured output of a VLM pass over user-uploaded content before normalization and prompt rendering.

```json
{
  "schema_version": "1.0",
  "artifact_type": "vlm_recognition_mock",
  "created_at": "ISO-8601 timestamp",
  "source_upload": {
    "type": "local_image | uploaded_image | image_url | screenshot | text_idea",
    "path": "",
    "url": "",
    "mime_type": "",
    "width": 0,
    "height": 0,
    "sha256": ""
  },
  "vlm_provider": {
    "type": "mock",
    "model": "human_observed_or_agent_visual_inspection",
    "notes": "说明这是 mock 识别结果，不是线上 VLM API 返回。"
  },
  "recognized_content": {
    "subjects": [],
    "objects": [],
    "scene": "",
    "visible_text": [],
    "composition": "",
    "style_and_rendering": "",
    "color_and_lighting": [],
    "camera_and_crop": "",
    "humor_signals": []
  },
  "reading_candidates": {
    "first_read": "",
    "second_read": "",
    "attention_order": [],
    "possible_misdirection": "",
    "role_mapping_candidates": []
  },
  "uncertainties": [
    {
      "field": "",
      "issue": "",
      "confidence": 0.0
    }
  ],
  "downstream_mapping": {
    "candidate_meme_type": "image_driven | text_driven | hybrid",
    "candidate_template_id": "short_snake_case_id",
    "candidate_variable_slots": [],
    "locked_anchor_candidates": [],
    "editable_candidate_slots": []
  }
}
```

Business-readable values in this object must be Chinese by default. Technical IDs and enum values stay English.

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
  "template_alignment": {
    "locked_meta_properties": [
      {
        "property": "visual_style | subject_form_logic | humanization_degree | composition | text_structure | reading_order | salience | joke_formula | user_subject_identity",
        "rule": "",
        "evidence": "",
        "failure_if_changed": ""
      }
    ],
    "editable_dimensions": [
      {
        "dimension": "subject | action | scene | object | prop | clothing | background | metaphor | caption | emotion | style_detail | camera | typography",
        "min_creative_level": 1,
        "max_scope": "",
        "must_align_to": "",
        "forbidden_drift": []
      }
    ],
    "creative_level_policy": {
      "level_1": "",
      "level_2": "",
      "level_3": "",
      "level_4": "",
      "level_5": "",
      "global_limits": []
    }
  },
  "visual_analysis": {
    "composition": "",
    "subjects": [],
    "scene": "",
    "camera_and_crop": "",
    "color_palette": [],
    "texture_and_rendering": "",
    "style_family": "",
    "prompt_style_profile": {
      "art_medium": "",
      "rendering_method": "",
      "line_and_shape_language": "",
      "color_and_lighting": "",
      "texture_material_surface": "",
      "camera_lens_and_depth": "",
      "composition_rhythm": "",
      "typography_style": "",
      "postprocessing_look": "",
      "style_prompt_fragments": {
        "base": [],
        "faithful": [],
        "creative": []
      },
      "negative_style_constraints": []
    },
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
  "min_creative_level": 1,
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
  },
  "subject_replacement_policy": {
    "default_for_faithful": "replace_when_user_provides_target | preserve_source_when_no_target | preserve_source_identity",
    "default_for_creative": "operator_controlled | free_replace | preserve_role_only",
    "replaceable_aspects": [],
    "preserved_aspects": [],
    "operator_notes": ""
  }
}
```

`min_creative_level` records the first level where this slot can change. A slot with `lock_level: "locked"` must not open at any creative level.

`subject_replacement_policy` is required for `category: "subject"` slots and optional for other slots. In high-fidelity prompt packs, a user-provided replacement subject should normally bind to an editable subject slot; the source subject's identity should not appear in `faithful_variant.locked_features` unless preserving that exact identity is essential to the joke and no replacement was requested.

## Faithful Variant Object

```json
{
  "goal": "Preserve recognizability while replacing requested editable slots.",
  "locked_features": [],
  "locked_reading_model": [],
  "locked_salience_model": [],
  "locked_style_profile": [],
  "editable_slots": [],
  "subject_replacement_policy": {
    "requested_subject_is_editable": true,
    "lock_source_subject_identity": false,
    "preserve_subject_role": true,
    "preserve_pose_expression_or_scale_when_needed": true,
    "notes": ""
  },
  "max_change_budget": {
    "description": "在失去高保真识别度前，最多允许改变多少个维度。",
    "recommended_changed_slots": 1,
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

`locked_features` must list invariant anchors such as layout, crop, text placement, reading-order cues, role relationships, and style features. Do not list the source subject identity as locked when the user provides a replacement subject. Put that subject in `editable_slots` and describe the preserved role in `subject_replacement_policy`.

## Creative Variant Object

```json
{
  "goal": "Preserve formula and style family while expanding the meme series.",
  "preserved_principles": [],
  "preserved_reading_model": [],
  "preserved_salience_model": [],
  "preserved_style_profile": [],
  "editable_dimensions": [],
  "creative_freedom_controls": {
    "operator_editable_dimensions": [
      {
        "dimension": "subject | action | scene | object | metaphor | caption | emotion | style_detail | camera | typography",
        "freedom": "open | limited | locked",
        "rule": ""
      }
    ],
    "requires_operator_approval": [],
    "must_preserve": []
  },
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

`creative_freedom_controls` lets an operator decide which dimensions are open for a template library or campaign. Free-creative output should not automatically rewrite every dimension; it should follow these controls while preserving formula, reading model, salience model, and style family.

## Prompt Contract Object

Use when `mode` is `prompt-contract` or the user asks for image-generation-ready output.

```json
{
  "faithful_prompt_contract": {
    "prompt": "",
    "locked_elements": [],
    "editable_elements": [],
    "subject_replacement_policy": {},
    "prompt_style_profile": {},
    "negative_prompt": [],
    "text_instructions": [],
    "postprocessing_notes": []
  },
  "creative_prompt_contract": {
    "prompt": "",
    "style_rules": [],
    "creative_freedom_controls": {},
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
  "reference_requirements": {
    "needs_user_subject_reference": false,
    "user_subject_reference_role": "none | identity_reference | style_reference | edit_target",
    "user_subject_reference_quality": {
      "quality_score": "unknown | low | medium | high",
      "usable_for_identity": false,
      "issues": [],
      "identity_cues_detected": [],
      "identity_confidence": "unknown | low | medium | high",
      "vlm_identity_summary": "",
      "generation_policy": "none | use_reference_only | use_reference_plus_vlm_identity_summary | semantic_replacement_only",
      "fallback_if_too_poor": "none | ask_for_better_reference | lower_identity_confidence | semantic_replacement_only"
    },
    "needs_source_meme_reference": false,
    "source_meme_reference_role": "none | composition_reference | style_reference | layout_reference | typography_reference | edit_target",
    "reference_priority": "user_subject_first | source_meme_first | balanced | none",
    "use_source_meme_as_generation_reference": false,
    "source_meme_reference_risk": [],
    "identity_preservation_targets": [],
    "template_alignment_targets": [],
    "decision_notes": []
  },
  "vlm_recognition_ref": "vlm-recognition-mock.json",
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
  "downstream_generation_notes": {
    "text_to_image_ready": true,
    "needs_reference_image": false,
    "needs_user_subject_reference_image": false,
    "needs_source_meme_reference_image": false,
    "uses_vlm_identity_summary": false,
    "identity_preservation_confidence": "not_applicable | low | medium | high",
    "manual_steps": []
  }
}
```

Placeholder rules:

- Use `{{snake_case}}` placeholders only.
- Resolve every placeholder through `slot_bindings` before writing `rendered_prompts`.
- Do not leave unresolved placeholders in `rendered_prompts`.
- If the user omits content, use an inferred value or template default, then record the decision in `user_input_normalization.inferred_fields`.
- Use `reference_strategy: "none"` when the output is intended for text-to-image generation without a source image.
- Set `needs_user_subject_reference: true` when a specific uploaded subject must remain recognizable. Do not claim identity preservation is verified from a text-only prompt.
- When the user subject reference is low-quality but recognizable, keep `needs_user_subject_reference: true`, fill `user_subject_reference_quality`, set `generation_policy: "use_reference_plus_vlm_identity_summary"`, and lower `identity_preservation_confidence` instead of dropping the image.
- If the user subject cannot be identified from the upload, set `usable_for_identity: false` and choose either `fallback_if_too_poor: "ask_for_better_reference"` or `generation_policy: "semantic_replacement_only"`.
- Set `use_source_meme_as_generation_reference: false` when the original meme image would compete with the user subject reference, leak source-subject identity, or encourage copying source text, logos, UI, or protected-looking artifacts.

## Prompt Pack Object

Use for `prompt-pack.json`. It is the complete persistent artifact for user input -> normalized JSON -> slot binding -> prompt template replacement -> final faithful and creative prompts.

```json
{
  "schema_version": "1.2",
  "artifact_type": "meme_prompt_pack",
  "created_at": "ISO-8601 timestamp",
  "source_access": {},
  "vlm_recognition": {},
  "normalized_input": {},
  "meme_template": {},
  "reference_requirements": {},
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
      "prompt_style_profile": {},
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
      "locked_style_profile": [],
      "subject_replacement_policy": {},
      "editable_slots": []
    },
    "creative": {
      "label": "free_creative",
      "prompt": "",
      "negative_prompt": [],
      "preserved_formula": [],
      "preserved_reading_model": [],
      "preserved_salience_model": [],
      "preserved_style_profile": [],
      "creative_freedom_controls": {},
      "editable_dimensions": []
    }
  },
  "postprocessing": {}
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
