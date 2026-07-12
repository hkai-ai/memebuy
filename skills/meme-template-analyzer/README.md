# Meme Template Analyzer

将 meme 图片、截图、图片 URL 或 meme 创意分析成 Agent 编辑草稿，并编译成后端可直接批量导入的 GalleryTemplate JSON。

## 新默认目标

正式链路中，`image-edit-template.json` 保存 Agent 对模板、槽位和约束的分析；
`meme-template.json` 严格符合后端 GalleryTemplateImport Schema。导入脚本校验 JSON、上传本地图到 OSS、回填 URL，再按 `key` upsert。前端只从后端 API 获取 `inputSchema` 等运行配置，不直接读取本地 artifact。

编辑配置草稿默认产物：

```text
meme-template.json
image-edit-template.json
index.md
```

`image-edit-template.json` 是本地 Agent 编辑草稿，包含：

- `templateText`: 带 `【槽位：默认值】` 的模板句。
- `templateSource`: 模板资产图，封装源梗图的构图、排布、遮挡、风格和保留约束。
- `userSubjectInput`: 用户主体输入，可以是文字、用户上传图、素材选择或默认主体。
- `editablePrompt`: 当前可编辑完整提示词。
- `allowFullRewrite`: 默认 `true`，用户可以整段删除、重写或只改槽位。
- `slots[]`: 前端控件定义，支持文本、选择、长 prompt、上传图片和选择图片。
- `suggestions`: 每个核心文本槽的候选替换项，默认用 `string[]`，不重复写相同的 `value`/`label`，也不默认写 `reason`。
- `mockUserInput`: 可选，仅用于 demo 或产品验收预览，默认不写入轻量运行文件。
- `backendHint`: 后端拼接提示，不绑定具体图像模型 API。
- `analysisRef`: 可选，指向同目录 `image-edit-analysis.json`。

候选项只是建议，前端不能把它们当成封闭枚举，除非后端下发的单个槽明确 `allowCustom: false`。

完整分析、自检和 QA 依据默认放入 `image-edit-analysis.json`，不要塞进主 `image-edit-template.json`。历史产物过长时可清洗：

分析必须先完成文化参照发现：分离视觉事实与解释，比较外部参照、图片内生笑点和独立图片三类假设，再通过 `formula_reflection_review` 确认公式。`unknown` 表示疑似有出处但无法确认，不能当成 `none`；疑似游戏、动漫、地域或小圈层梗应检索或进入 DRAFT 人审。

```bash
python skills/meme-template-analyzer/scripts/clean_image_edit_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json
```

默认生成 `image-edit-template.clean.json` 和 `image-edit-analysis.json`，不覆盖原文件。只需要模拟后端 API 返回给前端的字段时使用：

```bash
python skills/meme-template-analyzer/scripts/clean_image_edit_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json --profile frontend
```

清洗脚本默认还会删除 `slots[].ui`。如果后台配置页确实需要候选解释或 UI 分组，可加 `--keep-suggestion-reasons` 或 `--keep-slot-ui`。

清洗脚本默认也会删除 `mockUserInput`。如果需要固定示例给 demo 页使用，可加 `--keep-mock-user-input`。

如果历史目录只有 `image-edit-template.json`，编译 GalleryTemplate 入库主文件：

```bash
python skills/meme-template-analyzer/scripts/convert_image_edit_to_meme_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json
```

转换脚本输出 `key/title/description/cover/referenceImage/imageSize/imageN/inputSchema/preprocessSteps/promptTemplate/metadata`。转换后校验：

```bash
python skills/meme-template-analyzer/scripts/validate_gallery_template.py artifacts/meme-template-analyzer/<id>/meme-template.json
```

该命令是交付和上传前的强制门禁，检查字段类型/范围、prompt 占位表达式、跨字段引用、metadata 对齐和本地图片路径；只有 `PASS` 才继续上传。

`promptTemplate/inputSchema/preprocessSteps` 是后端直接执行的固定结构；taxonomy、模板结构和槽位语义放 `metadata`。`ingestion` 和 source hash 由导入脚本写入 `import-report.json`。

## 语言约定

面向用户的说明、教程和示例默认使用中文。命令名、mode 名、JSON key、schema 字段、文件名、路径和第三方专有术语按原文保留。

artifact 中所有业务人员会阅读的内容也默认使用简体中文。只有稳定技术标识、路径、文件名、JSON key、enum、placeholder、hash、URL、可见源文字，以及用户明确要求保留原语言的文本保持原文。

## 常用入口

| 用户想要 | 推荐说法 | 默认输出 |
| --- | --- | --- |
| 生成编辑器配置草稿 | `生成图片编辑模板` / `做一个前端编辑模板` / `image-edit-template` | Agent 草稿 + GalleryTemplateImport `meme-template.json` |
| 一张图快速打样 | `单图打样` / `single-image-prototype` | `meme-template.json` + `image-edit-template.json` + `index.md` |
| 一次完成分析和出图测试 | `分析生成测试` / `分析+测试` / `analyze-and-generate-test` | `image-edit-template.json` + `output/generation-results.json` + 真实 PNG/JPEG/WebP |
| 生成可替换槽位和候选项 | `识别这张图，生成用户可改的槽位和建议值` | `slots[]` + `suggestions` |
| 模拟用户填写 | `生成 mock 用户输入` | `mockUserInput` |
| 后台批量入库 | `批量入库` / `batch-ingestion` | 一个模板一个 `meme-template.json` + Agent 侧 `batch-manifest.json` |
| 批量整理图片 | `批量整理台` / `batch-review-workbench` | `assets/batch-workbench.html` 写回 JSON |

## 示例：文本槽位

模板句：

```text
这是一只【主体：狗】在吃【食物：哈密瓜】
```

后端 API 可下发两个槽位给前端展示：

```json
{
  "templateText": "这是一只【主体：狗】在吃【食物：哈密瓜】",
  "editablePrompt": "这是一只狗在吃哈密瓜",
  "allowFullRewrite": true,
  "slots": [
    {
      "id": "subject",
      "label": "主体",
      "inputKind": "text",
      "slotRole": "semantic_replacement",
      "defaultValue": "狗",
      "currentValue": "狗",
      "suggestions": ["小猪", "猫"],
      "allowCustom": true,
      "required": true
    },
    {
      "id": "food",
      "label": "食物",
      "inputKind": "text",
      "slotRole": "semantic_replacement",
      "defaultValue": "哈密瓜",
      "currentValue": "哈密瓜",
      "suggestions": ["西瓜", "草莓蛋糕"],
      "allowCustom": true,
      "required": true
    }
  ]
}
```

用户可以只改槽位，也可以把 `editablePrompt` 整段改成：

```text
参考图1，把画面里的狗改成一只穿雨衣的小猪，正在吃西瓜，保持原图构图和可爱风格。
```

后端拼接时可使用 `backendHint`，例如：

```text
参考图1，将小狗改为小猪，让小猪在吃西瓜。
```

## 示例：图片槽位

图片槽用于用户上传图或选择图：

```json
{
  "id": "subject_reference",
  "label": "主体参考图",
  "inputKind": "image_upload",
  "slotRole": "identity_reference",
  "required": false,
  "extract": "提取主体类别、颜色、轮廓、表情和可稳定复现的身份线索。",
  "maxCount": 1,
  "private": true,
  "sourceOptions": ["upload", "recent_upload", "asset_library"],
  "allowCustom": false
}
```

支持的 `inputKind`：

- `text`: 短文本替换。
- `prompt`: 长提示词片段。
- `select`: 选项选择。
- `image_upload`: 用户上传图片。
- `image_select`: 从素材库或历史上传中选择图片。

支持的 `slotRole`：

- `semantic_replacement`: 替换模板句变量。
- `prompt_fragment`: 额外 prompt 片段。
- `visual_variable`: 颜色、背景、主体色、文字色、画幅、文字位置等显性视觉变量。
- `identity_reference`: 主体身份参考。
- `edit_target`: 直接编辑目标图。
- `style_reference`: 风格参考。
- `composition_reference`: 构图参考。

编译到后端时只保留 `prompt | select | image` 三类：允许自填的 `select` 转成
`prompt + suggestions[]`；纯下拉转成 `select + options[{value,label}]`，这里不能使用
`string[]`；`image_upload` 转成原图直通的 image 输入。选择图片本身作为动态参考图在 v1
不支持，固定素材使用顶层 `referenceImage`。

颜色、背景、主体色、文字色这类一眼可见的变量，默认应进入槽位候选。即使业务决定锁定它，也要显式写成不可改或低优先级槽位，不要让它从前端消失。

颜色分析先区分四层：画布背景 `canvas_background`、画布/容器外框 `frame_border`、贴合主体的 `subject_outline`、局部前景容器 `content_panel`。背景和边框可独立变化时分槽；需要协调变化时合并为 `palette`/`surface_style` 并写同步规则，不要把参考图中的边框颜色无条件锁死。

### 模板资产图与用户主体输入

图生模板时要区分两类输入：

- 模板资产图：写入 `templateSource`，角色是 `template_reference`。它是模板自带资产，不是用户每次上传的图。它负责 `composition_authority` 和风格锚点，例如竖版构图、中心主体位置、文字区域、前景遮挡、规整行列墙面、货架式矩阵、贴纸墙等。
- 用户主体输入：写入 `userSubjectInput` 或对应槽位。用户可以上传角色图，也可以只输入角色名、一条狗、一只猫、商品名，或不填使用默认主体。上传图只提供 `identity_authority`，不能覆盖模板资产图的构图权限。

如果源图里的排布方式是梗成立关键，要显式记录 `arrangement_pattern`。例如“规整行列墙面”和“自然堆叠包围”是不同结构；不要只写“密集”“包围”“层层堆叠”。

### 后端双模式编译

用户侧输入可以一致，后端侧按能力编译成两种方案：

- `reference-aware prompt`: 默认优先。带模板资产图作为结构参考，保留 `templateSource.preserve` 和 `locked_composition_constraints`；用户上传图或文字只负责主体身份/语义。
- `prompt_mode`: 也可记为 `text_only_prompt`。当后端不能带参考图或用户要求自由变体时使用，必须把模板资产图中的构图、`arrangement_pattern`、遮挡、文字位置和风格完整写进提示词。

真实生成测试要检查 `arrangement_pattern`，不能只检查“背景存在”或“密集感存在”。

### Slot 反思逻辑

生成 `slots[]` 前必须做 `slot_reflection_review`，按六类候选自检：

- 语义替换：主体、对象、动作、场景。
- 文案内容：可见文字、口号、短句和可改 prompt 片段。
- 显性视觉变量：颜色、背景、主体色、文字色、主体数量、文字位置、画幅。
- 构图关系：视角、裁切、文字区域、主体位置。
- 图片引用：用户上传、素材选择、身份参考、风格参考、编辑目标图。
- 约束项：水印、Logo、可读性、主体背景对比、不可破坏的模板公式。

反思结论必须说明哪些候选成为前端槽位，哪些被锁定或降级为约束，以及是否存在 `missing_obvious_slots`。如果发现明显候选被遗漏，要补槽；如果不能补，要写明 `locked_invariant`、`constraint_only`、`style_note`、`too_minor` 或 `backend_only` 的原因。

## 推荐工作流

### 1. 生成后端入库模板和编辑配置

请求：

```text
使用 $meme-template-analyzer 分析这张图，先输出 image-edit-template.json 草稿，再编译严格符合 GalleryTemplateImport 的 meme-template.json。
要求最终文件包含 promptTemplate、inputSchema、preprocessSteps 和 metadata，并通过内置 validator。
```

预期行为：

1. 识别图片或文字创意。
2. 提取一句 `meme_formula`。
3. 设计 2-4 个核心槽位，并通过 `slot_reflection_review` 检查是否漏掉用户自然会编辑的显性变量，避免把画面元素清单全变成表单。
4. 如果有源梗图作为模板资产，写 `templateSource`、`composition_authority`、`style_authority` 和保留约束。
5. 写 `userSubjectInput`，允许同一主体槽接收文字、上传图、素材选择或默认值。
6. 写 `templateText` 和 `editablePrompt`。
7. 设置 `allowFullRewrite: true`。
8. 为核心文本槽写 3-8 个 `suggestions`。
9. 为图片槽写 `extract`、`maxCount`、`private` 和 `sourceOptions`。
10. 把固定参考图、构图和锁定约束编译进 `promptTemplate`，结构副本放 `metadata.templateSource`。
11. 保存两个 JSON，并运行 GalleryTemplate validator。

### 2. 单图打样

`单图打样` 现在默认等价于单图后端模板打样：

```text
对这张图做单图打样，重点是生成 GalleryTemplateImport meme-template.json 和 Agent 编辑草稿。
```

默认不生成真实 PNG/JPEG；只有用户明确要求测试效果时才进入真实生成流程。

### 3. 生成候选替换项

请求：

```text
根据这张图生成前端槽位，并给每个文本槽 3-8 个可替换建议。
```

候选生成规则：

- 必须服务原模板句。
- 不能把候选项变成另一个梗。
- 候选项只是建议，用户可以自定义或清空。
- 如果槽位需要图片身份保留，使用图片槽，不要只靠文字候选。

### 4. Mock 用户输入

请求：

```text
基于这个编辑模板，生成一组 mock 用户输入，方便前端预览。
```

mock 输出应包含：

- `slotValues`
- `imageSelections`
- `renderedTemplateText`
- `renderedPromptPreview`

mock 图片来源必须标明 `mock_user_upload`、`selected_asset` 或 `none`，不要描述成真实用户上传。

### 5. 后台入库

后台入库是正式产品链路的 source of truth：

```text
使用 $meme-template-analyzer 批量分析这个文件夹里的梗图，生成可入库的 meme-template.json 和 batch-manifest.json。
```

批量输出仍检查：

- 批量预审。
- `batch-manifest.json`
- `taxonomy`
- 一个模板一个 JSON 文件
- `promptTemplate/inputSchema/preprocessSteps`
- 每张源图独立文件夹
- 自动聚类
- 批量完成后是否需要查看 `review.html`
- 下一步选择

`meme-template.json` 不包含 `editConfig`、`ingestion` 或 `generationFit`。后端导入后由 API 返回 `inputSchema` 等运行配置；taxonomy、模板结构和待审核原因放在 `metadata`。

### 6. 真实生成测试

当用户说：

```text
用这个模板跑一组生成图，看看效果。
```

或：

```text
做模板测试，并输出真实图片结果。
```

进入真实生成测试。默认生成 3 张明显不同于原图的结果图，并保存到当前模板目录的 `output/`。

规则：

- 每张至少替换一个核心槽位，例如主体、表情、文案或背景。
- 三张之间要有明确差异，不能只是同一 prompt 的随机变体。
- 如果模板有颜色或背景槽，至少 1 张必须改变颜色或背景槽。
- 仍保留模板的核心公式、阅读关系和必要风格锚点。
- 记录每张完整 prompt，写入 `output/generation-results.json`。
- 不要只记录 promptSummary。
- 同时写 `output/summary.md`，说明结果图、差异点、QA 和主要风险。

`generation-results.json` 每个 result 至少包含：

- `caseId`
- `file`
- `variantIntent`
- `prompt`
- `mustDifferFromSource`
- `slotValues`
- `qa`
- `notes`

### 7. 分析生成测试

`分析生成测试` 是一键命令，适合用户每次都会上传源梗图、主体参考图和需求，希望一次完成分析与出图测试。

推荐请求：

```text
使用 $meme-template-analyzer 执行分析生成测试：图1是源梗图 template_reference，图2是用户主体 identity_reference。请先生成 image-edit-template.json，再继续生成 3 张真实 PNG 测试图，并写 generation-results.json 和 summary.md。
```

预期行为：

1. 先生成 `image-edit-template.json` 和 `index.md`。
2. 然后直接进入真实生成测试，不再等第二次用户确认。
3. 默认生成 3 张真实 PNG/JPEG/WebP，每张至少改变一个核心槽位。
4. 至少 1 张改变背景、颜色、主体色、文字色或其他显性视觉变量。
5. 写入 `output/generation-results.json` 和 `output/summary.md`。
6. 检查图片存在、非空、格式合理、无水印、无错误文字，并报告主要风险。

## template-review-page

当业务人员需要快速审查模板，使用：

```text
生成审核页
```

或：

```text
给运营看一下这个模板
```

默认输出：

```text
artifacts/meme-template-analyzer/<template_id-or-timestamp>/review.html
```

页面应展示：

- 快速结论。
- 业务人员理解核对卡。
- `templateText`。
- `editablePrompt`。
- 前端槽位与输入。
- `backendHint`。
- Raw JSON。
- `复制核对卡`。
- 批量时提供 `复制批量摘要`。

`review.html` 是静态页面，不需要运行 `pnpm dev`、`wrangler dev` 或其他本地服务。

业务人员可以直接双击打开，也可以把本地路径换成浏览器地址：

```text
file:///C:/Code/memebuy/artifacts/meme-template-analyzer/<目录>/review.html
```

## batch-review-workbench 批量整理台

当图片较多、自动化无法可靠判断模板分组时，先单独调用批量整理台。工具文件：

```text
skills/meme-template-analyzer/assets/batch-workbench.html
```

用 Chrome 或 Edge 双击打开即可。不需要 Python、Node、本地服务或 Codex。页面通过 File System Access API 选择素材文件夹，并直接写回 JSON。

在页面里可以快速：

- 多选图片并归到同一分组。
- 给分组设置 `ready_for_template`、`needs_review` 或 `skipped`。
- 勾选参考类型：`template_reference`、`style_reference`、`composition_reference`、`identity_reference`。
- 设置 `referenceDependencyLevel` 和 `testModeRecommendation`。
- 填写标签和备注。
- 直接写回根目录 `batch-workspace.json` 和 `batch-manifest.json`。
- 直接写回每个分组目录的 `group-config.json`。
- 可选复制素材到分组目录，原文件不删除。

后续运行本 skill 做批量模板分析时，如果目录里已有 `group-config.json`，必须优先读取用户确认的参考配置，不要重新猜测该组参考什么。

## 输出格式

默认使用 artifact-first，不在聊天里粘贴完整 JSON。结果目录：

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
output/
```

`output/` 只在用户明确要求真实生成测试时创建。

## 维护和更新

本仓库副本是开发源文件：

```text
skills/meme-template-analyzer/
```

全局运行副本用于 Codex 自动发现 skill：

```text
$env:USERPROFILE\.codex\skills\meme-template-analyzer
```

修改此 skill 时：

1. 先更新仓库副本。
2. 当行为、schema、命令或用户可见输出发生变化时，更新 `skill-manifest.json`。
3. 如果需要当前 Codex 会话使用新行为，将仓库副本同步到全局运行副本：

```powershell
scripts\sync-skill.ps1 -SkillName meme-template-analyzer
```

4. 验证仓库副本和全局副本是否一致：

```powershell
scripts\check-skill-sync.ps1 -SkillName meme-template-analyzer
```

修改后先校验：

```powershell
python C:\Users\<username>\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Code\memebuy\skills\meme-template-analyzer
```

## 参考文件

- `SKILL.md`: 主要运行说明。
- `skill-manifest.json`: 版本和 tracked-file 元数据。
- `references/json-contract.md`: `image-edit-template.json`、分析和生成结果 JSON schema。
- `references/cultural-reference-discovery.md`: 文化参照发现、多假设竞争、非梗识别和公式前提审计。
- `references/gallery-authoring-contract.md`: GalleryTemplate 映射和批量入库规则。
- `references/gallery-template-import.schema.json`: 后端严格导入 Schema 副本。
- `references/gallery-template-import.sample.json`: prompt/select/image 全特性样例。
