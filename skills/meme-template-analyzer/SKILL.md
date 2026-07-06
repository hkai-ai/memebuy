---
name: meme-template-analyzer
description: Use when analyzing meme images, screenshots, image URLs, or user-provided meme ideas to produce reusable JSON meme template entries, variant rules, prompt contracts, slot bindings, rendered no-reference image-generation prompts, text-joke analysis, meme background notes, high-fidelity meme remixes, free creative meme variations, or batch meme template libraries.
---

# Meme Template Analyzer

## Overview

Analyze memes into reusable template-library JSON. Preserve the user's creative intent: do not silently sanitize, replace subjects, or rewrite protected-looking elements unless the user asks or active policy requires refusal.

## Output Rule

Return valid JSON only unless the user explicitly asks for explanation. Do not wrap JSON in Markdown fences. Include uncertainty, missing evidence, and postprocessing needs as data fields instead of prose outside the JSON.

For the full output contract, read `references/json-contract.md` when the user needs a template entry, prompt contract, batch output, downstream processing, or strict schema.

## Modes

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

## Workflow

1. Load every provided artifact: uploaded image, local image path, URL, screenshot, or batch set. If a URL or cultural reference is unavailable, record it in `source_access.limitations`.
2. Classify the meme as `image_driven`, `text_driven`, or `hybrid`.
3. Extract visible text. Preserve original text, language, casing, placement, line breaks, and approximate typography when visible.
4. Analyze the joke mechanism: setup, expectation, turn, payoff, emotional charge, audience knowledge, and why the image/text pairing works.
5. If the meme depends on language, slang, public events, platform context, or a known meme format, add `text_analysis.background_context`. Do not invent origin stories; use `unknown` plus confidence when evidence is weak.
6. Extract design features: composition, crop, subject roles, expression, gesture, camera angle, color, texture, text placement, typography, visual hierarchy, artifacts, and style.
7. Convert the meme into variable slots. Mark each slot as `locked`, `faithful_editable`, `creative_editable`, or `fully_editable`.
8. When the user provides target content, asks for image-generation prompts, or wants no-reference generation, build `generation_pipeline`: normalize the raw request, bind normalized values to variable slots, define placeholder prompt templates, render final prompts, and list unresolved or inferred fields.
9. Produce both variant scopes:
   - `faithful_variant`: change only core requested slots or a small number of high-impact slots; preserve composition, style, visual hierarchy, humor rhythm, and most variables.
   - `creative_variant`: keep the meme formula and style family, but allow broader changes to subject, scene, metaphor, setting, text, emotional angle, and context.
10. Record risk and constraint notes without changing the template by default. Do not replace a subject with a safer alternative unless the user asks for that policy or a safety rule blocks the requested output.

## Variable Slot Discipline

Every reusable template must identify:

- `slot_id`: stable snake_case name.
- `role`: what the slot does in the joke or design.
- `current_value`: what appears in the source.
- `allowed_faithful_changes`: narrow substitutions that keep the original template recognizable.
- `allowed_creative_changes`: broader substitutions that keep the same series identity.
- `lock_level`: `locked`, `faithful_editable`, `creative_editable`, or `fully_editable`.
- `downstream_hint`: how a generator or editor should apply this slot.

Useful slot categories: `subject`, `object`, `caption`, `reaction`, `setting`, `gesture`, `expression`, `camera`, `crop`, `color`, `typography`, `layout`, `texture`, `platform_artifact`, `cultural_reference`, `punchline`, `audience_assumption`.

## Generation Pipeline

Use `generation_pipeline` when mode is `render-prompts`, when the user gives target content for a template, or when the downstream flow is text-to-image without a reference image.

- `user_input_normalization`: convert raw user intent into canonical fields such as `subject`, `task`, `caption`, `setting`, `style_intensity`, `constraints`, and `negative_constraints`.
- `slot_bindings`: map normalized values or inferred defaults to `variable_slots`. Use stable placeholders like `{{primary_subject}}`; every placeholder in a prompt template must have one binding.
- `prompt_templates`: provide machine-renderable `faithful` and `creative` templates before replacement. Keep placeholders in double braces and snake_case.
- `rendered_prompts`: provide final prompts after replacement. Do not leave unresolved placeholders; if a value is missing, use a template default or inferred value and add `render_warnings`.
- `reference_strategy`: use `none` for no-reference text-to-image generation, `image_reference` when the source image should guide style/composition, and `edit_target` when editing the source image directly.

For faithful rendering, bind fewer slots and preserve locked features. For creative rendering, bind broader editable dimensions while preserving the formula, style family, and recognition anchors.

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
- Do not merge high-fidelity and free creative versions. They must be separately controllable.
- Do not auto-replace characters, brands, public figures, UI, logos, or screenshots. Record risks and constraints; preserve the user's requested target unless instructed otherwise or blocked.
- Do not fabricate meme origins or cultural background. Use confidence scores and `unknown`.
- Do not emit Markdown around JSON when downstream processing is expected.
