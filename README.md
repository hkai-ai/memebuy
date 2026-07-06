# Codex Skills

This repository stores reusable Codex skills. Each skill lives in its own folder under `skills/`.

## Skills

- `skills/meme-template-analyzer`: Analyze meme images and meme ideas into reusable JSON templates, prompt contracts, slot bindings, and rendered generation prompts.

## Install A Skill

Clone the repository, then copy the skill folder you need into your local Codex skills directory.

```powershell
git clone https://github.com/techidsk/memebuy.git C:\Code\memebuy
Copy-Item -Recurse C:\Code\memebuy\skills\meme-template-analyzer C:\Users\<username>\.codex\skills\
```

If the skill already exists locally, update it with `-Force`:

```powershell
Copy-Item -Recurse -Force C:\Code\memebuy\skills\meme-template-analyzer C:\Users\<username>\.codex\skills\
```

## Maintain Skills

Validate a skill before committing changes:

```powershell
python C:\Users\<username>\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Code\memebuy\skills\meme-template-analyzer
```

Keep each skill self-contained:

```text
skills/
  skill-name/
    SKILL.md
    references/
    agents/
```
