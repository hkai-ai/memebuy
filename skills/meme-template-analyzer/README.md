# Meme Template Analyzer

Analyze meme images, screenshots, image URLs, or meme ideas into persistent template artifacts and generation prompt packs.

## Main Outputs

By default, this skill saves results to an artifact directory instead of pasting full JSON in chat.

Preferred workspace path:

```text
artifacts/meme-template-analyzer/<template_id-or-timestamp>/
```

Fallback path when the workspace is unavailable:

```text
$CODEX_HOME/generated_artifacts/meme-template-analyzer/<template_id-or-timestamp>/
```

Expected files:

```text
normalized-input.json
meme-template.json
slot-bindings.json
prompt-templates.json
rendered-prompts.json
prompt-pack.json
stability-testset.json
index.md
```

## Commands

### render-prompt-pack

Use this when the user wants image-generation-ready prompts from a meme template.

Pipeline:

```text
user input
-> normalized-input.json
-> slot-bindings.json
-> prompt-templates.json
-> rendered-prompts.json
-> prompt-pack.json
```

The final prompt pack must contain two prompt scopes:

- `faithful`: high-fidelity remix that preserves recognition anchors, composition, style, visual hierarchy, and humor rhythm.
- `creative`: free-creative remix that preserves the joke formula and style family while allowing broader changes.

### stability-testset

Use this when the user wants to test whether a meme template can be reproduced consistently.

The test set should include:

- `faithful_cases`: narrow changes that should keep the original template recognizable.
- `creative_cases`: broader changes that should still belong to the same meme series.
- `negative_controls`: deliberate anchor violations that reveal when the template stops working.
- `evaluation_rubric`: scoring dimensions for repeatability and fidelity.
- `repeatability_protocol`: how many generations to run per case and what counts as stable.

## Chat Response Rule

After generating artifacts, respond with a concise completion note and saved file paths.

Do not paste full JSON or full prompts into chat unless the user explicitly asks for inline JSON, inline prompts, or strict schema output.

## Reference Files

- `SKILL.md`: main operating instructions.
- `references/json-contract.md`: artifact and prompt pack schema.
- `references/stability-testset-contract.md`: stability test set schema.
