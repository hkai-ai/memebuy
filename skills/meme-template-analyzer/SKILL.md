---
name: meme-template-analyzer
description: Use when 需要分析 meme 图片、截图、图片 URL 或 meme 创意，并产出前端图片编辑模板、可编辑提示词、文本/图片槽位、候选替换项、mock 用户输入、槽位绑定、背景说明或批量模板库。
---

# Meme Template Analyzer

## 核心目标

默认把 meme 或图片创意转换成面向前端的图片编辑模板，而不是直接生成高保真/自由创意图片链路。主产物是 `image-edit-template.json`，用于前端渲染可编辑提示词、文本槽位、图片槽位、候选项和 mock 用户输入；后端再按自身图像模型把 `editablePrompt + slots + imageRefs` 做后端拼接。

默认输出简体中文。JSON key、路径、mode、enum、placeholder、命令、hash、URL、模型名，以及 meme 中检测到的原文保持原样。

## 按需读取

| 文件 | 何时读取 |
| --- | --- |
| `references/json-contract.md` | 需要 `image-edit-template.json`、前端槽位 schema、mock 用户输入、prompt/debug/legacy prompt pack 或严格 JSON 字段。 |
| `references/gallery-authoring-contract.md` | 需要后台录入模板、批量生成模板、`meme-template.json`、`batch-manifest.json` 或把编辑模板映射到后台字段。 |
| `references/stability-testset-contract.md` | 仅用户显式要求 legacy `stability-testset`、稳定性测试、reference test matrix 时读取。 |
| `scripts/validate_stability_testset.py` | 写入或收到 legacy `stability-testset.json` 后验证参考图追踪完整性。 |

不要把 reference 文件里的 schema 大段复制到聊天里。默认写入 artifact 文件，只向用户报告路径和简短验证结果。

## 默认输出

默认创建结果目录，而不是在聊天里倾倒 JSON：

1. 工作区可写时使用 `artifacts/meme-template-analyzer/<template_id-or-timestamp>/`。
2. 否则使用 `$CODEX_HOME/generated_artifacts/meme-template-analyzer/<template_id-or-timestamp>/`。
3. 图片编辑或前端模板请求默认写：
   - `image-edit-template.json`
   - `index.md`
4. 批量后台入库请求默认写：
   - `meme-template.json`
   - `batch-manifest.json`
   - `index.md`
5. `prompt-pack.json` 不再是默认主产物；只有用户显式要求 legacy `render-prompt-pack`、debug、旧链路对接或分步 prompt pipeline 时才写。
6. `stability-testset.json` 和 `output/` 只在用户显式要求 legacy 稳定性测试或真实图片生成验证时创建。

如果用户明确要求内联 JSON，只返回合法 JSON；不要用 Markdown 代码块包裹，也不要在 JSON 外解释。不确定性、限制和后处理需求写入字段。

## Purpose 路由

先判断用户目的，再决定输出格式：

| Purpose | 触发场景 | 默认输出 |
| --- | --- | --- |
| `frontend_editing` | 图片编辑方案、前端编辑模板、用户可编辑提示词、生成可替换槽位、mock 用户输入、用户上传图/选择图槽位。 | `image-edit-template.json`。 |
| `authoring` | 后台录入模板、批量生成模板、template-library-entry、批量入库。 | `meme-template.json`，使用 Gallery Template Authoring JSON v1。 |
| `debug` | 调试 skill、查看 VLM mock、slot binding、prompt template、legacy prompt pack 或完整 pipeline。 | 展开中间 JSON 和可选 `_analysis`。 |
| `legacy_validation` | 显式要求旧稳定性测试、reference test matrix、旧 high-fidelity/free-creative 测试案例。 | `stability-testset.json`、legacy `prompt-pack.json`、`output/` 按请求组合。 |

快速解释、预览或评审模板归入 `frontend_editing`，除非用户明确说要后台录入或批量入库。

## 业务口令

| 业务口令 | 内部别名 | 默认流程 |
| --- | --- | --- |
| `单图打样` | `single-image-prototype` | 对一张 meme 或图片创意生成前端编辑模板：理解画面、提取 `meme_formula`、设计 2-4 个核心编辑槽位、生成候选替换项和 `mockUserInput`。默认不生成真实 PNG/JPEG，不创建 legacy prompt pack。 |
| `图片编辑模板` | `image-edit-template` | 生成可给前端直接渲染的 `image-edit-template.json`，包含 `templateText`、`editablePrompt`、`allowFullRewrite`、`slots[]`、图片引用槽和 `backendHint`。 |
| `分析生成测试` | `analyze-and-generate-test` | 一次完成梗图分析、前端编辑模板和真实生成测试。先写 `image-edit-template.json` 和 `index.md`，再进入真实生成测试，默认生成 3 张真实 PNG/JPEG/WebP，写 `output/generation-results.json` 和 `output/summary.md`。 |
| `批量入库` | `batch-ingestion` | 对一批 meme 做批量预审、结构检查、自动聚类、分类标签、每张源图独立工作目录处理，生成 `meme-template.json`、`batch-manifest.json` 和 `index.md`。 |
| `批量整理台` | `batch-review-workbench` | 单独调用的 Chrome 静态 HTML 小工具，用于快速管理图、把相似图归到同一文件夹、给文件夹勾选标签和配置模板参考类型。工具文件是 `assets/batch-workbench.html`，不需要 Python，可直接写回 `batch-workspace.json`、`batch-manifest.json` 和各组 `group-config.json`。 |

`模板测试`、`render-prompt-pack`、`stability-testset` 属于 legacy 显式流程：只有用户点名这些命令、要求旧 prompt pipeline、要求真实生成结果或要求稳定性测试时才使用。

## analyze-and-generate-test 命令

当用户说“分析生成测试”“分析+测试”“分析并生成测试”“分析并跑真实生成测试”“一键分析生成”“上传图片和需求后直接分析测试”或类似请求时，使用 `analyze-and-generate-test`。

默认流程：

1. 先按 `image-edit-template` 完整分析输入，写入 `image-edit-template.json` 和 `index.md`。
2. 如果用户提供多张图，默认把图1当作 `template_reference`；把用户说明为宠物、角色、商品、人物、主体参考的图片作为 `identity_reference`。如果角色不明确，在分析中写入不确定性并继续用最合理映射。
3. 如果用户只提出文字需求，没有上传主体参考图，则用文字主体作为 `userSubjectInput.currentKind: "text"`，不要伪造用户上传图。
4. 紧接着进入真实生成测试，不要停在 JSON 报告。
5. 默认生成 3 张明显不同的真实 PNG/JPEG/WebP：
   - 第 1 张覆盖用户主需求或 mock 用户输入。
   - 第 2 张改变至少一个显性视觉变量，例如背景色、主色、文字色、主体颜色或画幅内视觉风格。
   - 第 3 张改变另一个核心槽位，例如主体、动作、表情、道具、文案或场景。
6. 每张结果必须保存到同一模板目录的 `output/`，并写完整 prompt、槽位值、差异要求和 QA 到 `output/generation-results.json`。
7. 同时写 `output/summary.md`，列出结果图、可用性、主要差异和失败风险。
8. 最终回复只报告结果目录、主产物、真实生成测试产物、验证命令和是否修改/同步 skill，不要粘贴完整 JSON。

推荐用户口令：

```text
使用 $meme-template-analyzer 执行分析生成测试：图1是源梗图 template_reference，图2是用户主体 identity_reference。请先生成 image-edit-template.json，再继续生成 3 张真实 PNG 测试图，并写 generation-results.json 和 summary.md。
```

## image-edit-template 命令

当用户说“图片编辑方案”“前端编辑模板”“用户可编辑提示词”“生成可替换槽位”“mock 用户输入”“让用户上传/选择图片槽位”或类似请求时，使用 `image-edit-template`。

默认流程：

1. 加载用户提供的图片、截图、URL、本地路径、纯文字创意或已有模板。
2. 形成轻量 VLM recognition mock：识别主体、物体、场景、可见文字、构图、风格线索、幽默信号、不确定性和可编辑候选。
3. 提取一句 `meme_formula`，用 2-4 个核心变量说明梗或图片编辑意图，例如“【主体】在【动作】中与【对象】形成反差”。
4. 从 `meme_formula` 推导 `core_variable_slots`，再做 `slot_minimization_review` 和 `slot_reflection_review`。业务槽位不是画面元素清单；容器、镜头、字体、表情、背景等默认先进入候选，再通过反思逻辑判断是暴露、锁定、降级为约束，还是只写入渲染说明。
5. 为前端生成 `templateText`，使用 `【槽位：默认值】` 标记变量，例如 `这是一只【主体：狗】在吃【食物：哈密瓜】`。
6. 生成 `editablePrompt`，初始值通常等于代入默认值后的可读提示词；设置 `allowFullRewrite: true`。用户可以整段删除、重写或只改槽位，槽位只是辅助输入。
7. 为每个槽写 `slots[]`：
   - `inputKind`: `text | prompt | select | image_upload | image_select`
   - `slotRole`: `semantic_replacement | prompt_fragment | visual_variable | identity_reference | edit_target | style_reference | composition_reference`
   - `defaultValue`、`currentValue`、`suggestions`、`allowCustom`、`required`
   - 图片槽必须写 `extract`、`maxCount`、`private`、`sourceOptions`
8. 为文本槽生成 3-8 个 `suggestions`。候选项只是建议，必须服务原模板句；用户可自定义、清空或改写，不再区分 high-fidelity/free-creative。
9. 生成 `mockUserInput`，用当前槽位给出一个示例用户填写结果；mock 不再按 hifi/free 分支生成。
10. 写 `backendHint`，只说明后端拼接策略，不绑定具体图像 API。示例可写：`参考图1，将小狗改为小猪，让小猪在吃西瓜`。
11. 写入 `image-edit-template.json` 和 `index.md`。

### 模板资产图与用户主体输入分层

当源梗图被封装为模板时，不要把它当成普通用户上传图处理。必须区分：

- `templateSource`：模板资产图，`role: "template_reference"`。它提供梗图公式、构图、排布、镜头、遮挡关系、文字位置和风格锚点；默认每次后端生成都可参与 reference-aware prompt 编译。
- `userSubjectInput`：用户主体输入，可以来自 `text`、`image_upload`、`image_select` 或默认值。用户可能上传角色图，也可能只输入角色名、商品名、一条狗、一只猫或其他文字主体。
- `imageRefs[]`：只记录当前会话可用图片引用；其中模板资产图和用户上传图必须写清楚不同 authority，不要混成同一种“参考图”。

模板资产图的 authority 要显式声明：

- `composition_authority`：保留主体位置、画幅、镜头、前景遮挡、版式、文字区域和 `arrangement_pattern`。
- `style_authority`：保留媒介、线稿、色彩节奏和材质感。
- `identity_authority`：通常为 `none`，除非模板本身就是固定角色模板。

用户主体输入的 authority 要按输入类型声明：

- 用户上传图或素材选择图：`identity_authority`，用于保留身份、轮廓、颜色、服饰、表情线索；不要让它覆盖模板构图。
- 用户文字输入：`semantic_authority`，用于生成或替换主体语义；不要假装存在用户上传图。
- 未提供用户主体时：使用模板默认主体或槽位默认值。

构图候选不能把“整体排布规则”误降级为“每个元素的精确位置”。例如源图出现规整行列、货架式矩阵、贴纸墙、聊天气泡栅格、证件照九宫格时，必须把 `arrangement_pattern` 写入 `analysis.locked_composition_constraints`、`templateSource.preserve`、`backendHint.generationModes.reference_aware_prompt.mustPreserve` 和真实生成 QA。可以不暴露成前端槽位，但不能静默丢失。

### 后端生成模式编译

用户侧输入可以保持一致；后端侧必须把同一份模板编译为两种执行提示：

- `reference_aware_prompt`：默认优先。使用 `templateSource` 作为结构参考图，用用户上传图或文字作为主体来源。提示词职责是说明“保留模板资产图的哪些结构”和“替换/生成哪些槽位”，例如保留 `arrangement_pattern`、中心位置、前景遮挡，同时替换主体或包围物。
- `text_only_prompt` / `prompt_mode`：当后端不能使用参考图、用户要求自由变体，或只做提示词导出时使用。必须把模板资产图中的构图、排布、遮挡、文字位置和风格完整转成文字，不要只写“密集”“包围”“堆叠”这类弱约束。

`backendHint.generationModes` 至少应包含：

- `reference_aware_prompt.templateSourcePolicy`：模板资产图的 role、authority、preserve、doNotUseFor。
- `reference_aware_prompt.userInputPolicy`：用户主体输入为图片、文字、素材选择或缺省时如何处理。
- `reference_aware_prompt.promptSkeleton`：可直接拼接的参考图模式提示词骨架。
- `prompt_mode.promptMustInclude`：无参考图时必须文字化保留的结构约束。
- `prompt_mode.promptMustAvoid`：例如 `random pile`、`scattered heap`、错误遮挡、错用用户图构图等。

## 槽位设计纪律

每个槽位必须回答“前端如何展示”和“后端如何理解”：

- `inputKind: text`：短文本替换，例如主体、食物、动作。
- `inputKind: prompt`：较长的提示词片段，例如氛围、额外要求、负向约束。
- `inputKind: select`：固定候选选择，但仍可用 `allowCustom` 允许自定义。
- `inputKind: image_upload`：用户上传图片，常用于 `identity_reference` 或 `edit_target`。
- `inputKind: image_select`：用户从素材库、示例图或历史上传中选择图片。

图片槽位角色：

- `identity_reference`：保留用户上传主体身份，例如宠物、商品、人物、物件。
- `edit_target`：直接编辑用户上传图或源图。
- `style_reference`：提取风格、材质、色彩或媒介。
- `composition_reference`：提取构图、镜头、布局或文字位置。

如果一个槽只是实现公式的道具、容器、动作细节或风格锚点，把它移出前端业务槽位，写入 `lockedConstraints`、`styleNotes` 或 `backendHint`。如果用户明确要编辑它，再提升为槽位。

### Slot 反思逻辑

每次生成 `slots[]` 前必须写 `slot_reflection_review`。它不是泛泛解释，而是一个防漏槽和防槽位爆炸的自检步骤。

反思顺序：

1. `candidate_scan`：按语义、文案、显性视觉变量、构图、图片引用、约束六类列出候选，不要只从 `meme_formula` 的 2-4 个核心变量里找。
2. `user_edit_likelihood`：判断普通前端用户是否自然会想改它；会改的候选优先进入槽位。
3. `visual_salience_check`：检查颜色、背景、主体色、文字色、主体数量、文字位置、画幅等第一眼变量是否被遗漏。
4. `template_integrity_check`：判断改它是否会破坏模板公式；会破坏的变量应锁定或降级为约束，而不是静默删除。
5. `frontend_control_check`：判断它能否用 `text`、`prompt`、`select`、`image_upload` 或 `image_select` 清楚表达；不能表达的候选写进 `backendHint` 或 QA。
6. `omission_review`：列出没有暴露成前端槽位的候选及原因，原因必须是 `locked_invariant`、`constraint_only`、`style_note`、`too_minor` 或 `backend_only` 之一。

最低要求：

- `slot_reflection_review.missing_obvious_slots` 必须为空；如果不为空，需要补槽或写明为什么锁定。
- `slot_reflection_review.exposed_slots` 与最终 `slots[]` 要一致。
- `slot_reflection_review.locked_or_demoted_candidates` 要解释为什么某些可见元素没有成为前端槽位。
- 真实生成测试要从 `slot_reflection_review.coverage_requirements` 读取覆盖要求，例如至少改变一个颜色或背景槽。

### 显性视觉变量

显性视觉变量必须进入前端槽位候选，而不是默认降级成纯约束。尤其是颜色、背景、主体色、文字色、画幅、文字位置、主体数量、边框/贴纸感这类用户一眼会感知并可能想改的变量。

规则：

- 如果某个视觉属性占据大面积、决定第一眼识别、影响系列变化，默认提升为前端槽位。
- 背景色、主色调、主体色、文字色至少应作为 `inputKind: select` 或 `text` 的可选槽位出现。
- 如果该属性是模板必须锁死的识别锚点，也要显式写成 `locked` 或 `allowCustom: false`，不要静默消失。
- 如果它只是风格描述且不适合用户编辑，再写入 `styleNotes` 或 `backendHint.notes`。

例如红底黑猫模板中，红色背景是大面积第一眼变量，应作为 `background_color` slot；如果真实生成测试只改主体和文案、不改颜色，会漏掉这个前端编辑能力。

## Mock 用户输入

`mockUserInput` 用于前端预览和产品验证，不是生成结果，也不是旧 prompt pack。

规则：

1. 基于 `slots[]` 生成示例值，不能随便编一个与模板无关的新主体。
2. 文本槽从 `suggestions` 中选一个合理值，或使用与源模板同类的替换。
3. 图片槽用 `mock_user_upload`、`selected_asset` 或 `none` 标记来源；不要伪装成真实用户上传。
4. mock 必须能渲染出一段 `renderedPromptPreview`。
5. 如果用户可以整段重写，mock 仍保留槽位值，便于前端展示“槽位编辑”和“完整 prompt 编辑”的关系。

## 关系与融合分析

虽然默认交付改成前端编辑模板，仍要保留足够的 meme 理解，避免槽位误导用户。

- `co_variation_constraints`：记录核心变量之间的跨槽关系，例如主体和食物的颜色、明度、材质相近，文字标签与表情互相解释。每条包含 `source_slot`、`dependent_slot`、同步规则、`failure_if_unsynced` 和生成图 QA 标准。
- `fusion_model`：判断主体是否与食物、物件、文字、UI、场景或身体结构融合；记录 `has_fused_subject`、`fusion_type`、`fused_slots`、`replacement_sensitivity`、`requires_remap_if_subject_changes`。
- `meme_formula`：先抽象梗成立机制，再抽槽位。
- `slot_minimization_review`：说明哪些候选元素被保留为核心变量，哪些被降级为约束或默认渲染。

这些分析可以内嵌到 `image-edit-template.json.analysis`，或在 debug 时展开。默认不要把复杂分析当成前端必填表单。

## 后台 authoring 与批量

用户要求后台录入、批量生成模板库、`template-library-entry` 或 `批量入库` 时，读取 `references/gallery-authoring-contract.md`。

- 批量集合必须先做批量预审：统计有效图片、格式、尺寸、目录层级、重复文件、缩略图、生成结果和非源图。
- 平铺目录可能包含多个模板簇时，先输出预审报告并请求确认分类策略。
- 每张源图独立工作目录，推荐 `<template-cluster>/<source-id>/source.<ext>`。
- 批量输出必须包含 `batch-manifest.json`、稳定 `key`、`taxonomy`、`generationFit`、`folderAsSeries`、`templateMechanism`、`needs_review` 和 source hash。
- 批量完成后询问是否需要查看 `review.html`，不要自动生成或打开 `review.html`，除非用户已经明确要求。

`generationFit` 可以继续存在于后台 authoring JSON，但只作为 legacy 兼容和运营参考；不要让它影响前端图片编辑模板默认流程。

## batch-review-workbench 批量整理台

当用户说“批量整理台”“整理这些图”“先按相似图归文件夹”“给这些图做管理工具”“单独调用整理工具”或类似请求时，使用 `batch-review-workbench`。它可以单独调用，不要求先生成 `image-edit-template.json` 或 `meme-template.json`。

工具文件：`skills/meme-template-analyzer/assets/batch-workbench.html`。用户用 Chrome 或 Edge 双击打开，页面通过 File System Access API 选择素材文件夹、读取图片、直接写回 JSON；不需要 Python、Node、本地服务或 Codex 参与。

默认目标不是替用户做最终判断，而是提供一个静态 HTML 工作台，帮助用户快速把相似图归到同一组，并为每组配置：

- `status`: `ready_for_template | needs_review | skipped`
- `referenceConfig`: `template_reference`、`style_reference`、`composition_reference`、`identity_reference` 和 `other`
- `referenceDependencyLevel`: `low | medium | high | blocked`
- `testModeRecommendation`: `text_only_ok | reference_aware_preferred | reference_aware_required | do_not_test_without_reference`
- `tags` 和 `notes`

用户操作：

1. 用 Chrome/Edge 打开 `assets/batch-workbench.html`。
2. 点击“选择素材文件夹”并授权读写。
3. 在页面中多选图片、创建分组、配置标签和参考类型。
4. 点击“写入 JSON”，直接写回素材目录。
5. 如需整理文件，点击“复制到分组文件夹”，工具会可选复制图片到对应分组目录，原文件不删除。

输出：

- 根目录 `batch-workspace.json`: 图片清单、分组、hash 和配置。
- 根目录 `batch-manifest.json`: 后续批量处理读取的总清单。
- 每个分组目录 `group-config.json`: 该组的标签、参考配置和测试建议。

规则：

- 工具只支持 Chrome/Edge 的 File System Access API；其他浏览器只能作为不完整降级环境。
- 默认只直接写回 JSON；复制素材是用户显式点击的可选复制操作，不删除原文件。
- 不提供删除源文件或移动源文件能力，避免误伤素材库。
- 整理后的每个文件夹必须写 `group-config.json`，总清单写 `batch-manifest.json`。
- 如果用户在文档或页面里选择了参考类型，后续模板分析必须读取这些配置，优先使用用户确认的 `referenceConfig`，不要重新假设参考用途。

## template-review-page

当用户要求“生成审核页”“给运营看”“做个预览页”“人审预览”“review page”或“让业务人员快速审查这些 meme 怎么生成”时，使用 `template-review-page`。

默认流程：

1. 优先复用同目录已有 `image-edit-template.json` 或 `meme-template.json`；如果当前还没有模板 JSON，先按当前目的生成。
2. 在同一个结果目录写入 `review.html`，不要单独创建无关目录。
3. 页面必须是可直接双击打开的静态 HTML 人审预览页，不依赖本地服务、外部 CDN 或长期运行进程。
4. 单模板页面展示封面图、快速结论、理解核对卡、槽位与输入、`templateText`、`editablePrompt`、`backendHint`、相关文件和 Raw JSON。
5. 批量审核页展示批次摘要、模板列表、`key`、标题、文件夹/系列、`taxonomy`、`generationFit`、待确认项和 Raw JSON。
6. 提供“复制核对卡”和“复制批量摘要”按钮。

## Legacy 显式流程

`prompt-pack.json`、`render-prompt-pack`、`variants`、`stability-testset`、旧 high-fidelity/free-creative 测试案例和真实生成 `output/` 都是 legacy/debug 路径。

只有这些情况才进入 legacy：

- 用户明确点名 `render-prompt-pack`、`prompt-pack.json`、`stability-testset`、`模板测试`。
- 用户要排查旧下游 prompt pipeline。
- 用户要真实生成图片结果或旧的 reference test matrix。
- 用户提供已有 legacy artifact 并要求继续补齐。

legacy 路径可继续使用 `references/stability-testset-contract.md` 和 `scripts/validate_stability_testset.py`。不要在普通“图片编辑模板”“单图打样”“前端配置”请求中主动生成 legacy prompt pack、稳定性测试集或真实 PNG/JPEG。

## 真实生成测试

当用户明确说“输出真实图片”“跑一组生成图”“看看效果”“用这个模板生成图”或类似请求时，进入真实生成测试。不要停在 JSON 报告。

执行规则：

1. 在当前模板目录下创建或复用 `output/`。
2. 默认生成 3 张明显不同于原图的结果图，而不是复刻源图：
   - 每张都必须替换至少一个核心槽位，例如 `subject`、`expression`、`caption` 或背景/风格槽。
   - 三张之间也要有明确差异，不能只是同一 prompt 的随机变体。
   - 仍保留 `meme_formula`、阅读关系、关键构图和必要风格锚点。
   - 如果模板有 `templateSource`，默认优先按 `reference_aware_prompt` 生成；只有后端不可用参考图或用户明确要纯提示词时，才使用 `text_only_prompt` / `prompt_mode`。
   - 如果模板记录了 `arrangement_pattern`、文字位置、规整版式、遮挡关系或镜头裁切，这些必须作为 QA 项检查，不能只检查“密集”“背景”“构图大致存在”。
   - 如果模板存在颜色、背景、主体色或文字色槽，至少 1 张必须改变颜色或背景槽。
3. 每张结果必须记录完整 `prompt`，写入 `output/generation-results.json`。不要只记录 promptSummary。
4. `generation-results.json` 每个 result 至少包含：
   - `caseId`
   - `file`
   - `variantIntent`
   - `prompt`
   - `mustDifferFromSource`
   - `slotValues`
   - `qa`
   - `notes`
5. 同时写 `output/summary.md`，列出结果图、差异点、可用性和主要失败风险。
6. 图片必须是真实 PNG/JPEG/WebP 结果；不要用 SVG、Pillow 草图、程序化占位图或 JSON 报告冒充。
7. 生成后检查文件存在、非空、格式合理，并人工检查主体、文案、风格、构图和不应出现的水印/标识。

示例：源图是黑猫 `GOOD LUCK`，真实生成测试不要只产出原黑猫复刻图。更好的 3 张是黑狗 `加油吧`、熊猫 `HAVE FUN`、上班族小人 `别太倒霉`，并分别记录完整 prompt。

## 常见错误

- 把 `image-edit-template` 请求误导到 legacy prompt pack。
- 把 high-fidelity/free-creative 当作默认产品入口。
- 只输出完整 prompt，却没有 `slots[]`、`inputKind`、`slotRole` 和 `suggestions`。
- 不设置 `allowFullRewrite: true`，导致前端误以为用户不能整段改写。
- 图片槽没有 `extract`、`maxCount`、`private` 或 `sourceOptions`。
- 生成候选项时脱离原模板句，变成另一个梗。
- 把 mock 用户上传描述成真实上传。
- 把业务槽位做成画面元素清单。
- 身份保留重要时只依赖纯文字，不提供 `image_upload` 或 `image_select` 槽。
- 真实生成测试只生成和源图几乎一样的复刻图，没有覆盖槽位变化。
- 生成结果只写 `promptSummary`，没有保存每张完整 `prompt`。
- 有模板资产图时，只把源图分析成普通文字 prompt，没有生成 reference-aware prompt。
- 把 `arrangement_pattern`、规整行列、文字区域、前景遮挡等模板结构降级成“密集”“包围”“堆叠”，导致提示词模式或参考图模式丢失版式。
- 用户上传图只应用于 `identity_authority`，却误用于构图或风格，覆盖了模板资产图的结构权限。
- 用户要求图片结果时，用 JSON、测试集或 mock 描述当最终输出；如果进入真实生成路径，最终结果必须是 PNG/JPEG。

## 回复规则

生成产物后，回复应简洁说明：

- 结果目录。
- `image-edit-template.json` 或其他主产物路径。
- 是否运行了验证命令。
- 是否只修改仓库内副本，是否同步到全局运行副本。

除非用户明确要求内联 JSON、内联提示词或严格 schema 输出，否则不要在聊天中粘贴完整 JSON 或完整 prompt。
