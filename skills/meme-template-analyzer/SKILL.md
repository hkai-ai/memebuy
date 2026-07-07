---
name: meme-template-analyzer
description: Use when analyzing meme images, screenshots, image URLs, or user-provided meme ideas to produce reusable meme templates, prompt packs, slot bindings, high-fidelity and free-creative generation prompts, stability test sets, text-joke analysis, meme background notes, or batch meme template libraries.
---

# Meme Template Analyzer

## Overview

Analyze memes into reusable template artifacts and generation prompt packs. Preserve the user's creative intent: do not silently sanitize, replace subjects, or rewrite protected-looking elements unless the user asks or active policy requires refusal.

## Chinese Output Contract

Default all user-visible and business-readable output to Simplified Chinese.

Use English only for stable technical identifiers:

- file names, directory names, paths, JSON keys, JSONPath, mode names, enum values, placeholders, command names, model/tool names, hashes, URLs, and code-like identifiers.
- source text detected in the meme. Preserve the original text exactly, then add Chinese explanation, translation, or localization notes when useful.
- user-provided replacement text that must remain in its original language.

Write these fields and files in Chinese by default:

- every free-text JSON value such as summaries, limitations, notes, warnings, prompts, risk descriptions, case goals, pass criteria, examples, and postprocessing steps.
- `index.md` and any other human-readable Markdown artifact.
- chat summaries and progress reports.
- final rendered prompt text, unless the user explicitly asks for English prompts for a specific downstream image model.

When a downstream field uses an English technical label such as `high_fidelity`, keep the label stable but make the adjacent `prompt`, `notes`, `criteria`, and explanation strings Chinese. If a field mixes technical IDs and prose, keep IDs as-is and write the prose around them in Chinese.

## Artifact-First Output Rule

Default to writing machine-readable artifacts into a result directory instead of dumping JSON in chat.

Use this directory convention:

1. If the current workspace is writable, create `artifacts/meme-template-analyzer/<template_id-or-timestamp>/`.
2. Otherwise create `$CODEX_HOME/generated_artifacts/meme-template-analyzer/<template_id-or-timestamp>/`.
3. Use stable filenames:
   - `vlm-recognition-mock.json`
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
| `render-prompt-pack` | Full pipeline artifacts: user upload VLM recognition mock -> user input normalization -> template variable slot bindings -> prompt template placeholder replacement -> final faithful and creative prompts. |
| `stability-testset` | A high-fidelity and free-creative test set for checking whether the template can be reproduced consistently. |
| `template-library-entry` | A reusable template JSON entry plus variant rules. |

## Workflow

1. Load every provided artifact: uploaded image, local image path, URL, screenshot, or batch set. If a URL or cultural reference is unavailable, record it in `source_access.limitations`.
2. Create `vlm-recognition-mock.json` before normalization. Treat it as the mocked output of a VLM pass over the user-uploaded content: recognized subjects, objects, scene, visible text, composition, style cues, humor signals, uncertainty, and downstream mapping candidates. This mock should contain visual facts and confidence, not final prompt decisions.
3. Classify the meme as `image_driven`, `text_driven`, or `hybrid` from the VLM recognition mock plus user request.
4. Extract visible text. Preserve original text, language, casing, placement, line breaks, and approximate typography when visible.
5. Analyze the joke mechanism: setup, expectation, turn, payoff, emotional charge, audience knowledge, and why the image/text pairing works.
6. Build the meme reading model before extracting replaceable subjects:
   - `first_read`: what the viewer should perceive at first glance.
   - `second_read`: what the viewer discovers after looking again, reading text, or reinterpreting labels.
   - `reading_order`: the intended scan path through image regions, text, expressions, labels, or hidden details.
   - `misdirection_or_reinterpretation`: what is initially misunderstood and how the payoff changes it.
   - `salience_model`: which elements must be obvious, subtle, hidden, backgrounded, delayed, or visually misleading.
   - `role_mapping`: what each person, object, text block, UI element, or visual artifact represents in the joke.
   - `failure_modes`: changes that would make the meme stop working.
   This is mandatory for image-driven and hybrid memes. For text-only memes, express the same model as reading order and rhetorical reveal.
7. If the meme depends on language, slang, public events, platform context, or a known meme format, add `text_analysis.background_context`. Do not invent origin stories; use `unknown` plus confidence when evidence is weak.
8. Extract design features from `vlm-recognition-mock.json`: composition, crop, subject roles, expression, gesture, camera angle, color, texture, text placement, typography, visual hierarchy, artifacts, and style. Style must be prompt-usable, not a vague label: describe art medium, rendering method, line/shape language, color and lighting, texture/material, camera/lens/depth, postprocessing look, and negative style drift.
9. Convert the meme into variable slots. Mark each slot as `locked`, `faithful_editable`, `creative_editable`, or `fully_editable`.
10. Normalize user-provided replacement content through the reading model and VLM recognition mock. Do not let a strong subject identity override the original meme mechanism. In high-fidelity generation, the requested target subject is normally an editable slot; do not place the source subject's identity in `locked_features` unless the source identity itself is the non-replaceable joke anchor and the user did not ask to replace it. If the target is a recognizable character, product, public figure, or object, decide whether the template needs the full appearance, silhouette cues, label text, pose, expression, color, scale, motion, texture, or only semantic role. Bind only the needed cues.
11. When the user provides target content, asks for image-generation prompts, wants no-reference generation, or asks for `render-prompt-pack`, build the full prompt pipeline:
   - `user_input_normalization`: convert raw user input and VLM recognition mock into standardized JSON.
   - `slot_bindings`: bind standardized values and VLM-derived candidates to meme template variable slots.
   - `prompt_templates`: define a shared `base` template plus faithful and creative prompt templates with `{{snake_case}}` placeholders.
   - `rendered_prompts`: replace every placeholder and output final base, high-fidelity, and free-creative prompts.
12. Produce both variant scopes:
   - `faithful_variant`: change the requested replacement slots, especially the target subject when provided, while preserving composition, prompt style profile, visual hierarchy, humor rhythm, reading model, salience model, and recognition anchors.
   - `creative_variant`: keep the meme formula, reading model, salience model, and style family, but allow broader changes to subject, action, scene, metaphor, setting, text, emotional angle, and context according to operator-editable creative freedom controls.
13. When the user asks for `stability-testset`, create deterministic test cases that compare faithful and creative prompt stability. Include normal cases, boundary cases, and negative controls.
14. Record risk and constraint notes without changing the template by default. Do not replace a subject with a safer alternative unless the user asks for that policy or a safety rule blocks the requested output.
15. Write artifacts to the result directory and report paths to the user.
16. Before finishing, check that business-readable artifact content is Chinese. Technical keys and IDs may remain English, but summaries, warnings, prompts, examples, criteria, and Markdown prose should not be English by default.

## Prompt Pack Pipeline

Use this exact pipeline for `render-prompt-pack`, `render-prompts`, and prompt-generation requests:

1. `vlm-recognition-mock.json`: store the mocked VLM recognition result for the uploaded image, screenshot, URL capture, or text-only creative input. This is the source observation layer for downstream normalization.
2. `normalized-input.json`: store the raw user request, link to `vlm-recognition-mock.json`, and standardized fields such as `subject`, `object`, `setting`, `caption`, `style_intensity`, `constraints`, and `negative_constraints`.
3. `meme-template.json`: store the analyzed meme template, reading model, salience model, joke formula, visual anchors, text formula, and variable slots derived from the VLM recognition mock.
4. `slot-bindings.json`: map each normalized field and VLM-derived candidate to a `variable_slots[*].slot_id` and a prompt placeholder such as `{{primary_subject}}`.
5. `prompt-templates.json`: store one shared base template and two variant templates:
   - `base`: shared meme formula, reading model, salience model, prompt style profile, and invariant constraints.
   - `faithful`: high-fidelity remix; replace requested editable slots while preserving recognition anchors, layout, prompt style profile, humor rhythm, reading order, and salience.
   - `creative`: free-creative remix; preserve the joke formula, reading model, salience model, and style family while allowing operator-approved subject, action, object, scene, text, and metaphor changes.
6. `rendered-prompts.json`: store final base, faithful, and creative prompts after placeholder replacement. Never leave unresolved `{{placeholder}}` text.
7. `prompt-pack.json`: store the complete combined object for downstream systems, including the VLM recognition mock or a path reference to it.
8. `index.md`: summarize what was generated and list the artifact files in Chinese.

Report in chat:

- result directory path
- VLM recognition mock path
- prompt pack path
- faithful prompt path or JSON path
- creative prompt path or JSON path
- stability test set path when generated

Do not paste the full JSON or full prompts unless the user asks for inline content.

The chat report should be Chinese by default and should list only the saved paths plus a short verification summary.

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

## Prompt Style Profile

Every image-driven or hybrid template must include a prompt-usable style profile. Do not stop at broad labels such as "anime", "photo", "cartoon", or "screenshot". Describe the visual recipe that a downstream image model can follow:

- `art_medium`: photo, 3D render, ink drawing, pixel art, collage, UI screenshot, macro shot, hand-drawn illustration, etc.
- `rendering_method`: flat color, cel shading, painterly brushwork, halftone print, low-poly, photoreal lighting, vector-like edges, rough marker, etc.
- `line_and_shape_language`: thick outline, no outline, soft rounded forms, angular silhouettes, distorted proportions, sticker-like cutout, etc.
- `color_and_lighting`: palette, contrast, saturation, shadow hardness, ambient light, screen glow, flash, daylight, night lighting.
- `texture_material_surface`: paper grain, compression artifacts, glossy plastic, fabric, metal, skin texture, watercolor bleed, poster print, etc.
- `camera_lens_and_depth`: viewpoint, focal length feel, perspective compression, depth of field, motion blur, crop pressure.
- `typography_style`: font-like appearance, casing, stroke, outline, drop shadow, caption box, label sticker, UI text treatment.
- `style_prompt_fragments`: reusable short prompt fragments for base, high-fidelity, and free-creative prompts.
- `negative_style_constraints`: style drift to avoid, such as photorealism, 3D gloss, watercolor, grunge, over-rendering, clean vector UI, or cinematic lighting when those would break the template.

High-fidelity prompts should preserve the full `prompt_style_profile`. Free-creative prompts may loosen individual style attributes only when `creative_freedom_controls` explicitly allows that dimension.

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

## Replacement And Locking Rules

Treat `locked_features` as invariant anchors, not as a dump of everything visible in the source image.

High-fidelity remix:

- The user's requested replacement subject is editable by default.
- Preserve the subject's role, salience, pose/expression requirement, scale relationship, reading order, and joke function.
- Do not lock the source subject identity unless that exact identity is the point of the meme and the user did not ask to replace it.
- Put replaceable source identity details in `editable_slots`, `slot_bindings`, and `subject_replacement_policy`, not in `locked_features`.
- Lock composition, crop, layout, typography treatment, style profile, recognition anchors, reading model, salience model, and failure modes.

Free-creative remix:

- Allow broader changes to subject, action, scene, object, metaphor, caption, emotional angle, and setting.
- Preserve the meme formula, reading model, salience model, style family, and any anchors marked as non-negotiable.
- Use `creative_freedom_controls` so an operator can explicitly set which dimensions are open, limited, or locked for a campaign or template library.

## Generation Pipeline

Use `generation_pipeline` when mode is `render-prompts`, when the user gives target content for a template, or when the downstream flow is text-to-image without a reference image.

- `user_input_normalization`: convert raw user intent into canonical fields such as `subject`, `task`, `caption`, `setting`, `style_intensity`, `constraints`, and `negative_constraints`.
- `slot_bindings`: map normalized values or inferred defaults to `variable_slots`. Use stable placeholders like `{{primary_subject}}`; every placeholder in a prompt template must have one binding.
- `prompt_templates`: provide machine-renderable `base`, `faithful`, and `creative` templates before replacement. Keep placeholders in double braces and snake_case.
- `rendered_prompts`: provide final prompts after replacement. Do not leave unresolved placeholders; if a value is missing, use a template default or inferred value and record the decision in `user_input_normalization.inferred_fields`.
- `reference_strategy`: use `none` for no-reference text-to-image generation, `image_reference` when the source image should guide style/composition, and `edit_target` when editing the source image directly.

For faithful rendering, bind the requested replacement slots and preserve invariant anchors, reading order, salience, and prompt style profile. For creative rendering, bind broader editable dimensions while preserving the formula, style family, recognition anchors, and reading model.

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

- `faithful_prompt_contract`: constraints, editable replacement slots, invariant locked anchors, subject replacement policy, negative constraints, text rendering notes.
- `creative_prompt_contract`: series style, operator-controlled creative freedoms, preserved formula, optional directions.
- `generation_pipeline`: normalized user input, slot bindings, placeholder templates, rendered prompts, and reference strategy when downstream prompt replacement is needed.
- `postprocessing_required`: true when the image generator may need manual text layout, OCR correction, compositing, inpainting, or policy review.

## Common Mistakes

- Do not stop at "this is funny because..." Convert the observation into reusable variables and rules.
- Do not treat the most recognizable object as automatically needing maximum visual emphasis. Preserve whether the original template makes it obvious, subtle, hidden, mislabeled, delayed, distorted, or backgrounded.
- Do not let a replacement subject's default appearance override the meme mechanism. If a character is requested but the template needs only a faint silhouette, label, or semantic role, encode that constraint explicitly.
- Do not put the source subject identity in `locked_features` when the user is asking for a high-fidelity replacement. Lock the role and visual relationship; bind the new subject through slots.
- Do not describe style only as a genre label. Add concrete medium, rendering, line, color, lighting, texture, camera, typography, and negative drift constraints.
- Do not make high-fidelity and creative prompts two unrelated prompts. They should derive from the same base template; faithful changes fewer slots, creative changes more slots.
- Do not merge high-fidelity and free creative versions. They must be separately controllable.
- Do not auto-replace characters, brands, public figures, UI, logos, or screenshots. Record risks and constraints; preserve the user's requested target unless instructed otherwise or blocked.
- Do not fabricate meme origins or cultural background. Use confidence scores and `unknown`.
- Do not emit Markdown around JSON when downstream processing is expected.
