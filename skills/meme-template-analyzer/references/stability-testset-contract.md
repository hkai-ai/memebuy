# Stability Test Set Contract

Use this file when the user requests `stability-testset`, stable remix tests, high-fidelity/free-creative test cases, or reproducibility checks.

## Language Contract

Write all business-readable test content in Simplified Chinese by default. Keep JSON keys, enum values, case IDs, JSONPath values, mode names, and other technical identifiers in English.

Chinese fields include `test_goal`, `raw_user_input`, `expected_locked_features`, `expected_editable_slots`, `expected_reading_model`, `expected_salience_model`, `expected_style_profile`, `expected_subject_replacement_policy`, `expected_creative_freedom_controls`, `allowed_changes`, `forbidden_drift`, `pass_criteria`, `compare_dimensions`, `stable_if`, `unstable_if`, `expected_benefit`, `risk_to_watch`, and `test_purpose`.

If the source meme contains English or another language, preserve the original visible text exactly and add Chinese explanation or localization notes where useful.

## Purpose

Create a persistent test set that checks whether a meme template can be rendered repeatedly without losing:

- recognition anchors
- reading model and attention order
- salience model
- humor formula
- variable slot discipline
- prompt style profile fidelity
- high-fidelity vs free-creative separation
- text and layout constraints
- reference image usage effects, especially whether user subject reference images or source meme reference images were passed to generation

## Output File

Write `stability-testset.json` into the result directory.

## Schema

```json
{
  "schema_version": "1.1",
  "artifact_type": "meme_stability_testset",
  "source_template_id": "short_snake_case_id",
  "test_goal": "",
  "reference_test_matrix": [
    {
      "reference_mode": "text_only_baseline | user_subject_reference_only | user_subject_plus_source_meme_reference",
      "uses_user_subject_reference": false,
      "uses_source_meme_reference": false,
      "source_meme_usage": "none | textual_locked_anchors_only | image_reference",
      "reference_priority": "user_subject_first | source_meme_first | balanced | none",
      "test_purpose": ""
    }
  ],
  "faithful_cases": [],
  "creative_cases": [],
  "negative_controls": [],
  "evaluation_rubric": [],
  "repeatability_protocol": {
    "generations_per_case": 3,
    "reference_modes_per_case": [],
    "compare_dimensions": [],
    "stable_if": [],
    "unstable_if": []
  }
}
```

## Test Case Object

```json
{
  "case_id": "faithful_01",
  "variant_scope": "faithful",
  "reference_mode": "text_only_baseline | user_subject_reference_only | user_subject_plus_source_meme_reference",
  "reference_usage": {
    "uses_user_subject_reference": false,
    "user_subject_reference_source": "none | uploaded_user_image | mock_user_upload | generated_user_upload | artifact_path",
    "user_subject_reference_quality": "not_applicable | low | medium | high",
    "uses_source_meme_reference": false,
    "source_meme_reference_source": "none | uploaded_source_meme | artifact_path",
    "source_meme_usage": "none | textual_locked_anchors_only | image_reference",
    "reference_priority": "user_subject_first | source_meme_first | balanced | none",
    "expected_benefit": "",
    "risk_to_watch": [],
    "test_purpose": ""
  },
  "raw_user_input": "",
  "expected_locked_features": [],
  "expected_editable_slots": [],
  "expected_reading_model": [],
  "expected_salience_model": [],
  "expected_style_profile": [],
  "expected_subject_replacement_policy": {},
  "expected_creative_freedom_controls": {},
  "allowed_changes": [],
  "forbidden_drift": [],
  "expected_prompt_json_paths": [
    "$.normalized_input",
    "$.slot_bindings",
    "$.prompt_templates.faithful",
    "$.rendered_prompts.faithful.prompt"
  ],
  "pass_criteria": []
}
```

## Case Design

Reference mode cases:

- Include `reference_test_matrix` whenever the test set is meant to inform downstream image generation quality.
- For identity-sensitive templates, create comparable cases across these modes:
  - `text_only_baseline`: no user subject image and no source meme image; use only rendered prompt text. Use this to measure baseline drift.
  - `user_subject_reference_only`: pass the user-uploaded or mock user-uploaded subject image; do not pass the source meme image; encode source meme style, layout, composition, and text rules as textual locked anchors.
  - `user_subject_plus_source_meme_reference`: pass both the user subject reference and the source meme reference; use this to test whether the source meme improves layout/style or causes source-subject leakage, copied text, logos, UI, or artifacts.
- Each test case must state `reference_mode` and fill `reference_usage`; do not leave reference usage implicit.
- If a test uses a mock user-upload image, mark `user_subject_reference_source: "mock_user_upload"` or provide the artifact path. Do not describe it as a real uploaded user image.
- If the source meme is not passed to generation, set `uses_source_meme_reference: false` and `source_meme_usage: "textual_locked_anchors_only"`.
- Compare outputs within the same prompt case across reference modes before making quality claims.

Faithful cases:

- Change the requested replacement subject or one or two editable slots only.
- Preserve camera, crop, composition, text rhythm, style family, and recognition anchors.
- Preserve the prompt style profile unless the case explicitly tests an allowed style attribute.
- Preserve the reading model, first-read/second-read relationship, and salience requirements.
- Use close substitutes for subjects, objects, expressions, captions, or settings.
- Do not expect the source subject identity to remain locked when the case provides a replacement subject; expect the source subject role, salience, pose/expression/scale relationship, and joke function to remain stable.

Creative cases:

- Preserve the joke formula and style family.
- Preserve the reading model and salience model even when setting, metaphor, or subject changes.
- Allow larger changes to subject, object, setting, metaphor, and emotional angle.
- Keep enough anchors for the output to belong to the same meme series.
- Follow `creative_freedom_controls`; dimensions marked `locked` must not change, dimensions marked `limited` need a specific rule, and dimensions marked `open` may vary broadly.

Negative controls:

- Deliberately remove or mutate one essential anchor.
- Use them to detect where the template stops being recognizable.
- Label them as negative controls; do not present them as recommended prompts.

## Evaluation Rubric

Use 0-2 scoring per dimension:

- `recognition_anchors`: locked visual or textual anchors remain visible.
- `reading_model`: first read, second read, reveal, and attention order still match the template.
- `salience_model`: dominant, subtle, hidden, misleading, and backgrounded elements keep their intended emphasis.
- `slot_adherence`: requested variables appear and forbidden drift is absent.
- `formula_preservation`: setup, turn, and payoff still work.
- `style_fidelity`: rendering style, composition, and hierarchy match the intended scope.
- `faithful_creative_separation`: faithful stays narrow; creative explores without breaking the series.
- `replacement_policy`: faithful replaces the requested subject through editable slots without locking the source subject identity.
- `reference_usage_traceability`: each result can be traced to whether user subject reference, source meme reference, both, or neither were used.
- `reference_mode_effect`: comparing reference modes explains whether identity preservation, composition fidelity, or source-artifact leakage changed.
- `creative_freedom_controls`: creative outputs only vary dimensions that the operator marked as open or limited.
- `text_accuracy`: exact text appears only when requested and is spelled correctly.
- `safety_and_rights`: risks are recorded without silent replacement unless policy requires it.

Stable if most repeated generations score at least 10/14 and no critical locked anchor is missing.
