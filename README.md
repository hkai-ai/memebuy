# Memebuy Codex Skills

这个仓库用于维护可复用的 Codex Skills。仓库按多 Skill 结构组织，每个 Skill 独立放在 `skills/<skill-name>/` 目录中。

## 当前 Skills

- `skills/meme-template-analyzer`
  - 用于分析梗图、截图、本地图片、网络图片或用户输入的梗图创意。
  - 输出可后处理的 JSON 梗图模板。
  - 支持高保真变体和自由创作变体。
  - 支持把用户输入标准化为变量槽，并渲染成可直接用于文生图的 base / 高保真 / 自由创作提示词。
  - 支持分析梗图阅读机制和显著性规则，例如第一眼看到什么、第二眼发现什么、哪些元素必须显眼或隐藏。

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

- 分析一张梗图的视觉结构、设计要点和笑点机制。
- 分析梗图的阅读模型：第一眼、第二眼、视线顺序、误导/重解释、显著性规则和失败模式。
- 把梗图整理成可复用模板库 JSON。
- 从模板中提取可替换变量，例如主体、场景、文字、动作、表情、构图、风格等。
- 同时生成两套变体规则：
  - 高保真版本：只替换少量核心变量，尽量保留原图结构和识别点。
  - 自由创作版本：保留梗图公式和风格系列，但允许更大范围变化。
- 分析文字梗、混合图文梗、平台截图梗。
- 输出给后处理程序使用的 JSON schema。
- 在不用参考图的情况下，把用户输入渲染成文生图提示词。

## 支持输入

可以给 Codex 提供：

- 上传图片
- 本地图片路径
- 网络图片 URL
- 截图
- 多张图片批量分析
- 纯文字梗图创意
- 已有模板 JSON 加新的用户目标内容

## 常用调用方式

### 1. 分析梗图并生成模板

```text
使用 $meme-template-analyzer 分析这张梗图，输出可复用模板 JSON。
```

输出会包含：

- `meme_template`
- `visual_analysis`
- `reading_model`
- `salience_model`
- `text_analysis`
- `variable_slots`
- `faithful_variant`
- `creative_variant`

### 2. 生成高保真和自由创作两套变体规则

```text
使用 $meme-template-analyzer 基于这张图生成模板，并给我高保真版本和自由创作版本的生成约束。
```

高保真版本会尽量保留：

- 原构图
- 原视觉层级
- 原画风
- 原笑点节奏
- 原阅读顺序和显著性规则
- 主要识别锚点

自由创作版本会保留：

- 核心梗图公式
- 第一眼/第二眼的阅读机制
- 显著性规则
- 风格系列感
- 情绪机制
- 可扩展的创意方向

### 3. 输入新内容并渲染提示词

适合“不使用参考图，只通过模板和用户输入生成新图”的流程。

```text
使用 $meme-template-analyzer 的 render-prompts 模式。
模板使用这张梗图，目标主体你帮我自动选择一个匹配的内容。
输出 base、faithful 和 creative 三层 rendered_prompts。
```

输出会包含 `generation_pipeline`：

```json
{
  "generation_pipeline": {
    "reference_strategy": "none",
    "user_input_normalization": {},
    "slot_bindings": [],
    "prompt_templates": {
      "base": "",
      "faithful": "",
      "creative": ""
    },
    "rendered_prompts": {
      "base": "",
      "faithful": "",
      "creative": ""
    }
  }
}
```

其中：

- `user_input_normalization`：把用户输入标准化成字段。
- `slot_bindings`：把字段绑定到模板变量槽。
- `prompt_templates`：保留 `{{placeholder}}` 的基础模板和变体模板提示词。
- `rendered_prompts`：替换完成后的最终提示词。
- `reference_strategy: "none"`：表示下游可以按纯文生图处理。

### 4. 分析文字梗

```text
使用 $meme-template-analyzer 分析这个文字梗，输出 JSON 模板，并说明文字笑点公式和背景语境。
```

文字梗会重点分析：

- 原文和语言
- 文字布局
- 反差、误导、递进、反转等修辞模式
- 背景语境
- 可复用文本公式
- 可替换变量

### 5. 批量建立模板库

```text
使用 $meme-template-analyzer 批量分析这些梗图，输出 template_library 数组。
```

适合把多张图整理成统一模板库。

## 输出格式

默认输出有效 JSON，不使用 Markdown 代码块。

常见顶层字段：

```json
{
  "schema_version": "1.0",
  "mode": "template",
  "source_access": {},
  "meme_template": {},
  "generation_pipeline": null,
  "faithful_variant": {},
  "creative_variant": {},
  "postprocessing": {}
}
```

完整 JSON contract 位于：

```text
skills/meme-template-analyzer/references/json-contract.md
```

## 模式说明

| 模式 | 用途 |
| --- | --- |
| `analyze` | 只分析来源梗图，不生成模板变体。 |
| `template` | 默认模式，提取可复用梗图模板。 |
| `variants` | 基于模板生成高保真和自由创作变体规则。 |
| `prompt-contract` | 输出适合图像生成系统使用的提示词约束。 |
| `render-prompts` | 标准化用户输入、绑定变量槽、渲染最终提示词。 |
| `batch` | 批量分析多张梗图，输出模板库数组。 |
| `compare` | 对比多张梗图，提取共同公式和系列方向。 |

## 维护和更新

修改 Skill 后先校验：

```powershell
python C:\Users\<username>\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Code\memebuy\skills\meme-template-analyzer
```

提交更新：

```powershell
git add .
git commit -m "docs: update meme template analyzer usage"
git push
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
