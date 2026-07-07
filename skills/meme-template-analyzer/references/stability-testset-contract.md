# Stability Test Set Contract

Use this file when the user requests `stability-testset`, stable remix tests, high-fidelity/free-creative test cases, or reproducibility checks.

## Language Contract

Write all business-readable test content in Simplified Chinese by default. Keep JSON keys, enum values, case IDs, JSONPath values, mode names, and other technical identifiers in English.

Chinese fields include `test_goal`, `raw_user_input`, `expected_locked_features`, `expected_reading_model`, `expected_salience_model`, `allowed_changes`, `forbidden_drift`, `pass_criteria`, `compare_dimensions`, `stable_if`, and `unstable_if`.

If the source meme contains English or another language, preserve the original visible text exactly and add Chinese explanation or localization notes where useful.

## Purpose

Create a persistent test set that checks whether a meme template can be rendered repeatedly without losing:

- recognition anchors
- reading model and attention order
- salience model
- humor formula
- variable slot discipline
- high-fidelity vs free-creative separation
- text and layout constraints

## Output File

Write `stability-testset.json` into the result directory.

## Schema

```json
{
  "schema_version": "1.0",
  "artifact_type": "meme_stability_testset",
  "source_template_id": "short_snake_case_id",
  "test_goal": "",
  "faithful_cases": [],
  "creative_cases": [],
  "negative_controls": [],
  "evaluation_rubric": [],
  "repeatability_protocol": {
    "generations_per_case": 3,
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
  "raw_user_input": "",
  "expected_locked_features": [],
  "expected_reading_model": [],
  "expected_salience_model": [],
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

Faithful cases:

- Change one or two editable slots only.
- Preserve camera, crop, composition, text rhythm, style family, and recognition anchors.
- Preserve the reading model, first-read/second-read relationship, and salience requirements.
- Use close substitutes for subjects, objects, expressions, captions, or settings.

Creative cases:

- Preserve the joke formula and style family.
- Preserve the reading model and salience model even when setting, metaphor, or subject changes.
- Allow larger changes to subject, object, setting, metaphor, and emotional angle.
- Keep enough anchors for the output to belong to the same meme series.

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
- `text_accuracy`: exact text appears only when requested and is spelled correctly.
- `safety_and_rights`: risks are recorded without silent replacement unless policy requires it.

Stable if most repeated generations score at least 10/14 and no critical locked anchor is missing.
