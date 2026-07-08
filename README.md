# Memebuy Codex Skills

这个仓库用于维护可复用的 Codex Skills。仓库按多 Skill 结构组织，每个 Skill 独立放在 `skills/<skill-name>/` 目录中。

## 当前 Skills

- `skills/meme-template-analyzer`
  - 用于分析梗图、截图、本地图片、网络图片或用户输入的梗图创意。
  - 默认输出前端可用的 `image-edit-template.json`。
  - 支持生成 `templateText`、`editablePrompt`、`allowFullRewrite`、文本/图片槽位、候选替换项、`mockUserInput` 和 `backendHint`。
  - 支持用户只改槽位，也支持用户整段删除、重写提示词。
  - 支持用户上传图或选择图作为 `identity_reference`、`edit_target`、`style_reference` 或 `composition_reference`。
  - 仍保留后台批量入库和 legacy prompt/stability 工具，但它们不是默认主路径。

## 安装

先克隆仓库：

```powershell
git clone https://github.com/techidsk/memebuy.git C:\Code\memebuy
```

把需要的 Skill 同步到本地 Codex skills 目录：

```powershell
scripts\sync-skill.ps1 -SkillName meme-template-analyzer
```

检查仓库副本和全局运行副本是否一致：

```powershell
scripts\check-skill-sync.ps1 -SkillName meme-template-analyzer
```

安装后可以在 Codex 中通过 `$meme-template-analyzer` 调用。

### 自动同步 Git hook

为了避免修改仓库内 Skill 后忘记同步到全局运行副本，可以启用本仓库的 Git hook：

```powershell
scripts\install-git-hooks.ps1 -Verify
```

启用后，每次 `git commit` 前会自动执行：

```powershell
scripts\sync-skill.ps1 -SkillName meme-template-analyzer
scripts\check-skill-sync.ps1 -SkillName meme-template-analyzer
```

如果同步或校验失败，commit 会被阻止。

## meme-template-analyzer 使用场景

适合这些任务：

- 分析一张梗图并生成前端图片编辑模板。
- 从纯文字梗图创意生成可编辑模板。
- 提取用户可改的文本槽位，例如主体、食物、动作、文案或场景。
- 提取用户可上传或选择的图片槽位。
- 为文本槽生成 3-8 个候选替换项。
- 生成 `mockUserInput`，方便前端预览。
- 生成 `backendHint`，帮助后端把用户最终输入拼成图像编辑指令。
- 批量分析文件夹并生成后台入库 JSON。

## 支持输入

可以给 Codex 提供：

- 上传图片
- 本地图片路径
- 网络图片 URL
- 截图
- 多张图片批量分析
- 纯文字梗图创意
- 已有编辑模板 JSON 加新的用户目标内容

## 常用调用方式

### 1. 生成前端图片编辑模板

```text
使用 $meme-template-analyzer 分析这张图，输出前端可用的 image-edit-template.json。
```

输出会包含：

- `templateText`
- `editablePrompt`
- `allowFullRewrite`
- `slots[]`
- `suggestions`
- `mockUserInput`
- `backendHint`

### 2. 生成可替换槽位

```text
使用 $meme-template-analyzer 识别这张图，生成用户可编辑槽位和候选替换项。
```

槽位支持：

- `text`
- `prompt`
- `select`
- `image_upload`
- `image_select`

图片槽位角色支持：

- `identity_reference`
- `edit_target`
- `style_reference`
- `composition_reference`

### 3. Mock 用户输入

```text
使用 $meme-template-analyzer 基于这个模板生成 mock 用户输入，方便前端预览。
```

mock 应包含 `slotValues`、`imageSelections`、`renderedTemplateText` 和 `renderedPromptPreview`。

### 4. 批量建立后台模板库

```text
使用 $meme-template-analyzer 批量分析这个文件夹里的梗图，输出 meme-template.json 和 batch-manifest.json。
```

批量流程仍包含批量预审、自动聚类、`taxonomy`、`generationFit`、source hash 和 `review.html` 可选审核页。

## 输出格式

默认 artifact-first，不在聊天里粘贴完整 JSON。

常见结果目录：

```text
artifacts/meme-template-analyzer/<template_id-or-timestamp>/
```

常见文件：

```text
image-edit-template.json
index.md
meme-template.json
batch-manifest.json
review.html
prompt-pack.json
stability-testset.json
output/
```

`prompt-pack.json`、`stability-testset.json` 和 `output/` 只在 legacy/debug 或用户显式要求时创建。

## 维护和更新

修改 Skill 后先校验：

```powershell
$env:PYTHONUTF8='1'
python C:\Users\<username>\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Code\memebuy\skills\meme-template-analyzer
```

运行内容合同测试：

```powershell
python skills\meme-template-analyzer\scripts\test_skill_content_contract.py
```

运行 legacy 稳定性 validator 单测：

```powershell
python skills\meme-template-analyzer\scripts\test_validate_stability_testset.py
```

新增 Skill 时继续使用这个结构：

```text
skills/
  skill-name/
    SKILL.md
    references/
    agents/
```

不要把整个本地 `.codex` 目录提交到仓库，只提交需要分享的 Skill 子目录和必要文档。
