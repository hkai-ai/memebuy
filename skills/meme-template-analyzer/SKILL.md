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
10. Extract template alignment rules before creative variants: locked meme meta-properties, editable expression dimensions, subject-form logic, humanization degree, text presence, visual style, composition relationship, reading order, salience, and failure modes. `creative_level` can only open editable dimensions; it must never override locked template meta-properties.
11. Decide reference image requirements before rendering prompts. Distinguish analysis references from generation references:
   - Source meme images are always analysis inputs when available, but should only be passed to downstream image generation when they are needed to preserve fragile composition, style, typography, or layout.
   - User-uploaded subject images should be required as generation references when identity consistency matters, such as a specific pet, person, product, object, character, or branded item. Text-only descriptions are not enough to verify identity preservation.
   - User-uploaded subject images may be low-resolution, compressed, blurry, cropped, or poorly lit. Still treat them as the preferred user subject reference when the subject is recognizable; run or mock a VLM pass first, extract identity cues and quality issues, and pass both the image reference and the VLM-derived identity summary downstream.
   - Do not reject a low-quality user subject reference just because it is imperfect. Degrade the identity promise instead: preserve robust cues such as species/category, main colors, face markings, body shape, proportions, distinctive accessories, and temperament; avoid claiming exact identity preservation when evidence is weak.
   - The original meme reference can be inaccurate for generation when it competes with the replacement subject, causes source-subject leakage, copies text/logos/UI, or overfits the source image. Prefer textual locked anchors over passing the original image in those cases.
   - Use `edit_target` only when the task is to directly edit the source image. Use `image_reference` when one or more images should guide identity, style, composition, or layout. Use `none` only when no visual identity or source layout needs image-grounded preservation.
12. Normalize user-provided replacement content through the reading model and VLM recognition mock. Do not let a strong subject identity override the original meme mechanism. In high-fidelity generation, the requested target subject is normally an editable slot; do not place the source subject's identity in `locked_features` unless the source identity itself is the non-replaceable joke anchor and the user did not ask to replace it. If the target is a recognizable character, product, public figure, pet, or object, decide whether the template needs the full appearance, silhouette cues, label text, pose, expression, color, scale, motion, texture, or only semantic role. Bind only the needed cues and record whether a user reference image is required for those cues.
13. When the user provides target content, asks for image-generation prompts, wants no-reference generation, or asks for `render-prompt-pack`, build the full prompt pipeline:
   - `user_input_normalization`: convert raw user input and VLM recognition mock into standardized JSON.
   - `slot_bindings`: bind standardized values and VLM-derived candidates to meme template variable slots.
   - `prompt_templates`: define a shared `base` template plus faithful and creative prompt templates with `{{snake_case}}` placeholders.
   - `rendered_prompts`: replace every placeholder and output final base, high-fidelity, and free-creative prompts.
14. Produce both variant scopes:
   - `faithful_variant`: change the requested replacement slots, especially the target subject when provided, while preserving composition, prompt style profile, visual hierarchy, humor rhythm, reading model, salience model, and recognition anchors.
   - `creative_variant`: keep the meme formula, reading model, salience model, and style family, but allow broader changes to subject, action, scene, metaphor, setting, text, emotional angle, and context according to operator-editable creative freedom controls.
15. When the user asks for `stability-testset`, create deterministic test cases that compare faithful and creative prompt stability. Include normal cases, boundary cases, and negative controls.
16. Record risk and constraint notes without changing the template by default. Do not replace a subject with a safer alternative unless the user asks for that policy or a safety rule blocks the requested output.
17. Write artifacts to the result directory and report paths to the user.
18. Before finishing, check that business-readable artifact content is Chinese. Technical keys and IDs may remain English, but summaries, warnings, prompts, examples, criteria, and Markdown prose should not be English by default.

## Template Alignment And Creative Levels

Treat `creative_level` as a slot-opening budget, not permission to redesign the meme. First extract template-specific locked meta-properties, then decide which dimensions each level may open.

Always preserve locked template meta-properties:

- visual style and medium, such as low-resolution photo, screenshot, comic, 3D render, or illustration
- subject form logic and humanization degree, such as realistic pet, human, object, UI element, mascot, or fully anthropomorphic character
- composition relationship, crop pressure, panel structure, camera angle, and foreground/background roles
- text presence, text placement, typography treatment, and rhetorical structure
- reading order, salience model, role mapping, joke formula, and failure modes
- user-uploaded subject identity when the user asks to insert a specific subject

Use this generic `creative_level` interpretation:

| Level | Meaning |
| --- | --- |
| `1` | Replace only the user-requested subject or smallest viable variable. Preserve nearly all anchors. |
| `2` | Open small local variables such as minor props, labels, colors, accessories, or wording while preserving structure. |
| `3` | Open template-internal expression variables such as action, gesture, reaction, or localized object changes. |
| `4` | Open larger template-approved variables such as scene family, background condition, relationship mapping, or metaphor when the original template supports that kind of change. |
| `5` | Recombine all editable dimensions while preserving every locked meta-property and failure-mode constraint. |

Do not introduce outside context just because a high level was requested. For example, if a template has no office, worker identity, system-error joke, or caption, do not add those elements unless the user explicitly supplied that context or the template's own variable slots include it.

When a template has no text, do not add captions by default. When a template has text, preserve equivalent text structure and placement, then bind user-provided or inferred text slots.

## Reference Image Decision Rules

Write a `reference_requirements` object whenever output may be sent to an image model.

Ask these questions:

1. Does the user-provided replacement subject need visual identity preservation? If yes, require a user subject reference image and bind it to the subject slot.
2. Does the source meme image need to guide composition, style, layout, text placement, or pose beyond what text can reliably specify? If yes, allow source meme as an image reference.
3. Would passing the source meme image conflict with the user subject reference or cause the generator to copy the source subject, text, logo, UI, or protected-looking elements? If yes, do not use it as a generation reference; convert the needed aspects into locked textual anchors.
4. Is the request to directly edit the uploaded/source image? If yes, use `edit_target`; otherwise use `image_reference` only for identity/style/composition guidance.
5. Is the user subject reference low-quality but recognizable? If yes, keep it as the generation reference, add `user_subject_reference_quality`, and include a VLM-derived identity summary in the prompt contract.
6. If no image-grounded identity, source layout, or style preservation is needed, use `none` and explain that the output is text-to-image ready.

For low-quality user subject references, record:

- `quality_score`: `low`, `medium`, or `high`
- `usable_for_identity`: whether the image can support any identity preservation
- `issues`: low resolution, compression, motion blur, bad lighting, partial crop, occlusion, tiny subject, or unusual angle
- `identity_cues_detected`: visual cues the VLM can still recognize
- `identity_confidence`: `low`, `medium`, or `high`
- `generation_policy`: usually `use_reference_plus_vlm_identity_summary`
- `fallback_if_too_poor`: ask for another image, lower identity confidence, or perform only semantic/category replacement

Common decisions:

| Situation | Downstream reference decision |
| --- | --- |
| User uploads a pet/product/person to insert into a meme | require user subject reference for generation |
| User uploads a low-resolution but recognizable pet/product/person | require user subject reference, add VLM identity summary, and lower identity confidence |
| User uploads an unusable reference where the subject cannot be identified | ask for a better reference or mark generation as semantic/category replacement only |
| User only asks to analyze a meme | no generation reference decision is needed |
| User asks for a prompt pack from a known meme image | use source meme for analysis; pass source meme to generation only if layout/style cannot be described reliably |
| Source meme and user subject references conflict | prioritize user subject identity; encode source meme style/layout as textual locked anchors |
| User asks to edit the original image directly | use `edit_target` and preserve unchanged regions |

## Prompt Pack Pipeline

Use this exact pipeline for `render-prompt-pack`, `render-prompts`, and prompt-generation requests:

1. `vlm-recognition-mock.json`: store the mocked VLM recognition result for the uploaded image, screenshot, URL capture, or text-only creative input. This is the source observation layer for downstream normalization.
   - When the upload is a user subject reference, include quality issues, identity cues, and identity confidence. This VLM pass should help the generator use poor images more reliably; it does not replace passing the user subject reference when identity matters.
2. `normalized-input.json`: store the raw user request, link to `vlm-recognition-mock.json`, and standardized fields such as `subject`, `object`, `setting`, `caption`, `style_intensity`, `constraints`, and `negative_constraints`.
3. `meme-template.json`: store the analyzed meme template, locked meta-properties, editable dimensions, reading model, salience model, joke formula, visual anchors, text formula, and variable slots derived from the VLM recognition mock.
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
- `reference_requirements`: record whether downstream generation needs user subject reference images, source meme reference images, both, or neither, and explain why.

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
- Do not treat `creative_level: 5` as permission to change visual medium, subject form logic, text structure, or composition anchors that the source template locked.
- Do not rely on text-only prompts when the user expects a specific uploaded pet, product, person, or object to remain recognizable; require a user reference image and record it in `reference_requirements`.
- Do not discard low-quality user uploads when the subject is still recognizable. Use the image plus VLM-derived identity cues, and state lower identity confidence instead of pretending the output can preserve exact details.
- Do not automatically pass the source meme image as a generation reference when it will pull the model back toward the source subject or copied source artifacts. Use textual locked anchors instead.
- Do not auto-replace characters, brands, public figures, UI, logos, or screenshots. Record risks and constraints; preserve the user's requested target unless instructed otherwise or blocked.
- Do not fabricate meme origins or cultural background. Use confidence scores and `unknown`.
- Do not emit Markdown around JSON when downstream processing is expected.
