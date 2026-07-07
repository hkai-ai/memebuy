---
name: meme-template-analyzer
description: Use when analyzing meme images, screenshots, image URLs, or user-provided meme ideas to produce reusable meme templates, prompt packs, slot bindings, high-fidelity and free-creative generation prompts, stability test sets, text-joke analysis, meme background notes, or batch meme template libraries.
---

# Meme Template Analyzer

## Overview

Analyze memes into reusable template artifacts and generation prompt packs. Preserve the user's creative intent: do not silently sanitize, replace subjects, or rewrite protected-looking elements unless the user asks or active policy requires refusal.

## Artifact-First Output Rule

Default to writing machine-readable artifacts into a result directory instead of dumping JSON in chat.

Use this directory convention:

1. If the current workspace is writable, create `artifacts/meme-template-analyzer/<template_id-or-timestamp>/`.
2. Otherwise create `$CODEX_HOME/generated_artifacts/meme-template-analyzer/<template_id-or-timestamp>/`.
3. Use stable filenames:
   - `normalized-input.json`
   - `meme-template.json`
   - `slot-bindings.json`
   - `prompt-templates.json`
   - `rendered-prompts.json`
   - `prompt-pack.json`
   - `stability-testset.json` when the user requests test sets
   - `index.md` as a short human-readable manifest

At the end, tell the user the work is complete and list the saved file paths. Do not paste full JSON into the chat unless the user explicitly requests inline JSON, strict schema output, or the filesystem is unavailable.

When inline JSON is explicitly requested, return valid JSON only. Do not wrap JSON in Markdown fences. Include uncertainty, missing evidence, and postprocessing needs as data fields instead of prose outside the JSON.

For the full output contract, read `references/json-contract.md` when the user needs a template entry, prompt contract, batch output, downstream processing, or strict schema.
For artifact file contents and stability test set schema, read `references/json-contract.md` and `references/stability-testset-contract.md`.

## Modes And Commands

Infer `mode` from the request, or use the user's explicit mode:

| Mode | Use for |
| --- | --- |
| `analyze` | Describe the source meme without generating reusable variants. |
| `template` | Default. Extract a reusable meme-template library entry. |
| `variants` | Generate faithful and creative variant rules from an analyzed template. |
| `prompt-contract` | Produce prompt-ready JSON constraints for image generation systems. |
| `render-prompts` | Normalize user input, bind variables, and render faithful/creative text-to-image prompts without requiring a reference image. |
| `batch` | Analyze multiple memes into a `template_library` array. |
| `compare` | Compare multiple memes and extract shared formulas, differences, and series direction. |

Use these command aliases when the user asks for them:

| Command | Output |
| --- | --- |
| `render-prompt-pack` | Full pipeline artifacts: user input normalization -> template variable slot bindings -> prompt template placeholder replacement -> final faithful and creative prompts. |
| `stability-testset` | A high-fidelity and free-creative test set for checking whether the template can be reproduced consistently. |
| `template-library-entry` | A reusable template JSON entry plus variant rules. |

## Workflow

1. Load every provided artifact: uploaded image, local image path, URL, screenshot, or batch set. If a URL or cultural reference is unavailable, record it in `source_access.limitations`.
2. Classify the meme as `image_driven`, `text_driven`, or `hybrid`.
3. Extract visible text. Preserve original text, language, casing, placement, line breaks, and approximate typography when visible.
4. Analyze the joke mechanism: setup, expectation, turn, payoff, emotional charge, audience knowledge, and why the image/text pairing works.
5. Build the meme reading model before extracting replaceable subjects:
   - `first_read`: what the viewer should perceive at first glance.
   - `second_read`: what the viewer discovers after looking again, reading text, or reinterpreting labels.
   - `reading_order`: the intended scan path through image regions, text, expressions, labels, or hidden details.
   - `misdirection_or_reinterpretation`: what is initially misunderstood and how the payoff changes it.
   - `salience_model`: which elements must be obvious, subtle, hidden, backgrounded, delayed, or visually misleading.
   - `role_mapping`: what each person, object, text block, UI element, or visual artifact represents in the joke.
   - `failure_modes`: changes that would make the meme stop working.
   This is mandatory for image-driven and hybrid memes. For text-only memes, express the same model as reading order and rhetorical reveal.
6. If the meme depends on language, slang, public events, platform context, or a known meme format, add `text_analysis.background_context`. Do not invent origin stories; use `unknown` plus confidence when evidence is weak.
7. Extract design features: composition, crop, subject roles, expression, gesture, camera angle, color, texture, text placement, typography, visual hierarchy, artifacts, and style.
8. Convert the meme into variable slots. Mark each slot as `locked`, `faithful_editable`, `creative_editable`, or `fully_editable`.
9. Normalize user-provided replacement content through the reading model. Do not let a strong subject identity override the original meme mechanism. If the target is a recognizable character, product, public figure, or object, decide whether the template needs the full appearance, silhouette cues, label text, pose, expression, color, scale, motion, texture, or only semantic role. Bind only the needed cues.
10. When the user provides target content, asks for image-generation prompts, wants no-reference generation, or asks for `render-prompt-pack`, build the full prompt pipeline:
   - `user_input_normalization`: convert raw user input into standardized JSON.
   - `slot_bindings`: bind standardized values to meme template variable slots.
   - `prompt_templates`: define a shared `base` template plus faithful and creative prompt templates with `{{snake_case}}` placeholders.
   - `rendered_prompts`: replace every placeholder and output final base, high-fidelity, and free-creative prompts.
   - `render_warnings`: record inferred or unresolved decisions.
11. Produce both variant scopes:
   - `faithful_variant`: change only core requested slots or a small number of high-impact slots; preserve composition, style, visual hierarchy, humor rhythm, reading model, salience model, and most variables.
   - `creative_variant`: keep the meme formula, reading model, salience model, and style family, but allow broader changes to subject, scene, metaphor, setting, text, emotional angle, and context.
12. When the user asks for `stability-testset`, create deterministic test cases that compare faithful and creative prompt stability. Include normal cases, boundary cases, and negative controls.
13. Record risk and constraint notes without changing the template by default. Do not replace a subject with a safer alternative unless the user asks for that policy or a safety rule blocks the requested output.
14. Write artifacts to the result directory and report paths to the user.

## Prompt Pack Pipeline

Use this exact pipeline for `render-prompt-pack`, `render-prompts`, and prompt-generation requests:

1. `normalized-input.json`: store the raw user request and standardized fields such as `subject`, `object`, `setting`, `caption`, `style_intensity`, `constraints`, and `negative_constraints`.
2. `meme-template.json`: store the analyzed meme template, reading model, salience model, joke formula, visual anchors, text formula, and variable slots.
3. `slot-bindings.json`: map each normalized field to a `variable_slots[*].slot_id` and a prompt placeholder such as `{{primary_subject}}`.
4. `prompt-templates.json`: store one shared base template and two variant templates:
   - `base`: shared meme formula, reading model, salience model, and invariant constraints.
   - `faithful`: high-fidelity remix; preserve recognition anchors, layout, style, humor rhythm, and most locked slots.
   - `creative`: free-creative remix; preserve the joke formula and style family while allowing broader subject, object, scene, and metaphor changes.
5. `rendered-prompts.json`: store final base, faithful, and creative prompts after placeholder replacement. Never leave unresolved `{{placeholder}}` text.
6. `prompt-pack.json`: store the complete combined object for downstream systems.
7. `index.md`: summarize what was generated and list the artifact files.

Report in chat:

- result directory path
- prompt pack path
- faithful prompt path or JSON path
- creative prompt path or JSON path
- stability test set path when generated

Do not paste the full JSON or full prompts unless the user asks for inline content.

## Variable Slot Discipline

Every reusable template must identify:

- `slot_id`: stable snake_case name.
- `role`: what the slot does in the joke or design.
- `current_value`: what appears in the source.
- `allowed_faithful_changes`: narrow substitutions that keep the original template recognizable.
- `allowed_creative_changes`: broader substitutions that keep the same series identity.
- `lock_level`: `locked`, `faithful_editable`, `creative_editable`, or `fully_editable`.
- `downstream_hint`: how a generator or editor should apply this slot.

Useful slot categories: `subject`, `object`, `caption`, `reaction`, `setting`, `gesture`, `expression`, `camera`, `crop`, `color`, `typography`, `layout`, `texture`, `platform_artifact`, `cultural_reference`, `punchline`, `audience_assumption`, `reading_order`, `salience`, `role_mapping`, `reveal`, `misdirection`.

## Meme Reading Model

Do not analyze memes as ordinary image descriptions. Model how the audience reads and reinterprets the artifact.

Every reusable template should answer:

- `first_read`: what appears to be happening before the joke lands.
- `second_read`: what new detail, label, hidden element, expression, or contradiction changes the meaning.
- `reading_order`: where attention should go first, second, and last.
- `salience_model`: whether each key element should be dominant, secondary, hidden, low-contrast, delayed, misleading, or backgrounded.
- `role_mapping`: what visual/text elements stand for in the joke, not just what they literally depict.
- `failure_modes`: what common edits would break the meme, even if the image still looks polished.

If a user asks to replace a subject, bind the replacement to the subject's role in the reading model. Do not automatically render the full visual identity. Some templates need only a label, silhouette, color trace, pose, expression, shadow, reflection, scale relationship, or background clue.

For high-fidelity prompts, lock the reading model and salience model as strongly as composition and style. For creative prompts, allow more visual variables, but preserve the reading model and the reason the joke lands.

## Generation Pipeline

Use `generation_pipeline` when mode is `render-prompts`, when the user gives target content for a template, or when the downstream flow is text-to-image without a reference image.

- `user_input_normalization`: convert raw user intent into canonical fields such as `subject`, `task`, `caption`, `setting`, `style_intensity`, `constraints`, and `negative_constraints`.
- `slot_bindings`: map normalized values or inferred defaults to `variable_slots`. Use stable placeholders like `{{primary_subject}}`; every placeholder in a prompt template must have one binding.
- `prompt_templates`: provide machine-renderable `base`, `faithful`, and `creative` templates before replacement. Keep placeholders in double braces and snake_case.
- `rendered_prompts`: provide final prompts after replacement. Do not leave unresolved placeholders; if a value is missing, use a template default or inferred value and add `render_warnings`.
- `reference_strategy`: use `none` for no-reference text-to-image generation, `image_reference` when the source image should guide style/composition, and `edit_target` when editing the source image directly.

For faithful rendering, bind fewer slots and preserve locked features, reading order, and salience. For creative rendering, bind broader editable dimensions while preserving the formula, style family, recognition anchors, and reading model.

## Stability Test Set Command

Use `stability-testset` when the user asks to test whether high-fidelity and free-creative outputs are stable, reproducible, or consistently remix the meme.

Create `stability-testset.json` with:

- `faithful_cases`: 3-8 cases that change only one or two editable slots while preserving locked anchors.
- `creative_cases`: 3-8 cases that preserve the meme formula while changing animal/subject, object/food, scene, metaphor, or emotional angle.
- `negative_controls`: 1-4 cases that intentionally violate one key anchor, used to reveal when the template stops being recognizable.
- `evaluation_rubric`: scored criteria for recognition anchors, slot adherence, humor formula, style fidelity, text accuracy, and safety/rights constraints.
- `repeatability_protocol`: how many generations per case to run, what to compare, and what counts as stable.

For each case include:

- `case_id`
- `variant_scope`: `faithful | creative | negative_control`
- `raw_user_input`
- `expected_locked_features`
- `allowed_changes`
- `forbidden_drift`
- `expected_prompt_json_paths`
- `pass_criteria`

Read `references/stability-testset-contract.md` for the detailed schema.

## Text Meme Handling

For text-driven or hybrid memes, include:

- Literal OCR/transcription and uncertain characters.
- Text layout map: region, line breaks, emphasis, and reading order.
- Rhetorical pattern: contrast, misdirection, escalation, anti-climax, absurd specificity, role reversal, caption-label mapping, or bait-and-switch.
- Background notes: slang, meme format, historical context, platform convention, or referenced event when relevant.
- Reusable text formula with variables, not just rewritten examples.
- Chinese and multilingual handling when present: preserve source language and add translation or localization fields only when useful.

## Prompt Contract

When the user asks for prompts, output prompt data as JSON fields, not free prose:

- `faithful_prompt_contract`: constraints, editable slots, locked slots, negative constraints, text rendering notes.
- `creative_prompt_contract`: series style, allowed explorations, preserved formula, optional directions.
- `generation_pipeline`: normalized user input, slot bindings, placeholder templates, rendered prompts, reference strategy, and render warnings when downstream prompt replacement is needed.
- `postprocessing_required`: true when the image generator may need manual text layout, OCR correction, compositing, inpainting, or policy review.

## Common Mistakes

- Do not stop at "this is funny because..." Convert the observation into reusable variables and rules.
- Do not treat the most recognizable object as automatically needing maximum visual emphasis. Preserve whether the original template makes it obvious, subtle, hidden, mislabeled, delayed, distorted, or backgrounded.
- Do not let a replacement subject's default appearance override the meme mechanism. If a character is requested but the template needs only a faint silhouette, label, or semantic role, encode that constraint explicitly.
- Do not make high-fidelity and creative prompts two unrelated prompts. They should derive from the same base template; faithful changes fewer slots, creative changes more slots.
- Do not merge high-fidelity and free creative versions. They must be separately controllable.
- Do not auto-replace characters, brands, public figures, UI, logos, or screenshots. Record risks and constraints; preserve the user's requested target unless instructed otherwise or blocked.
- Do not fabricate meme origins or cultural background. Use confidence scores and `unknown`.
- Do not emit Markdown around JSON when downstream processing is expected.
