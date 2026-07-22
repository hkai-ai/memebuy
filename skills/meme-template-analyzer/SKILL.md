---
name: meme-template-analyzer
description: Use when 需要分析 meme 图片、截图、图片 URL 或 meme 创意，并产出严格 GalleryTemplateImport JSON、后端可入库模板、前端编辑草稿、文本/图片槽位、候选替换项、真实生成测试或批量模板库。
---

# Meme Template Analyzer

## 核心目标

把 meme 或图片创意转换成两个层次：

- `image-edit-template.json`：Agent 分析与前端编辑草稿。
- `meme-template.json`：严格符合后端 `GalleryTemplateImport` 的入库文件。

正式链路以后端为 source of truth：本 Skill 先生成并校验本地路径版 JSON；用户明确要求最终交付时再上传 OSS、回填 URL，后端项目按 `key` upsert。不要把草稿里的 `editConfig` 直接入库。

提示词严格分三层：`promptTemplate` 是前端可见、可按产品能力自由编辑的基础提示词；`promptEnhancement` 是仅后端可见的二次编辑策略；`resolvedPrompt` 是运行时结果，只交给图片网关，不写入模板 JSON。

默认输出简体中文。JSON key、路径、mode、enum、placeholder、命令、hash、URL、模型名和图片中的原文保持原样。

## 强制门禁

1. 先分离视觉事实与解释，再按 `cultural-reference-discovery.md` 做参照发现、多假设竞争和公式前提审计；不要把 `unknown` 写成 `none`。
2. 只有 `formula_reflection_review` 通过后才设计槽位；文化识别锚点默认锁定，不要把画面元素清单直接变成表单。
3. 槽位设计前必须建立 `component_graph` 和 `edit_intent_candidates`；每个槽位绑定可指认组件、具体属性和编辑操作。禁止批量套用 `subject/scene/style/caption` 通用四槽。
4. 默认设计 2-4 个核心槽位。主体、道具、配饰、服装、文字、容器内容和嵌套内容可以开放；背景内容、背景颜色、整体配色或色调在用户编辑意图明确、组件可独立替换且不破坏模板公式时也可以开放。构图、画幅、镜头、姿态、光影、风格、媒介和材质默认由参考图锁定。禁止给每张图机械追加背景或色调槽。
5. 区分模板资产图与用户主体图；模板图负责构图/风格，用户图通常只负责身份。
6. 同一可编辑内容需要兼容文字描述和上传图时使用 `subject` 复合槽；该规则也适用于可替换背景、页内画作、盒内内容和嵌套图像，不限于人物或宠物身份。背景未开放时由参考图控制，开放时必须绑定具体背景组件，并明确是替换背景内容、背景图片、背景颜色还是整体色调。
7. `promptTemplate` 只表达用户创作意图；长度、参考图权限、锁定构图和安全约束写入后端专用 `promptEnhancement`，结构副本保留在 `metadata.templateSource`。
8. `preprocessSteps` 默认 `[]`；用户原图默认直通生成，运维绑定 `gallery.vision` 前不要创建 vision step。
9. 输出前依次运行 `scripts/validate_semantic_analysis.py`、`scripts/validate_slot_intelligence.py`、`scripts/validate_gallery_template.py` 和 `scripts/validate_frontend_experience.py`。只有全部返回 `PASS` 才能交付或上传。
10. 不默认生成真实图片；只有用户明确要求测试效果时才进入 `generation_test`。用户要求“看槽位挖得怎么样”属于槽位审核，不进入图片生成。
11. 存在 `tag-catalog.snapshot.json` 或锁定人工标签时，必须按 `tagging-and-taxonomy.md` 读取并原样保留；词库只包含普通 tags，`group` 仅用于 UI 整理，不写入 taxonomy 或模板 tags。
12. `description` 是独立的前端短描述，最多 20 个字符；不得从 title、summary、文件名、批次号、图片序号或槽位数量拼接。
13. title、description 和 `promptTemplate` 必须是用户面向的内容。`promptTemplate` 必须是一段可直接理解和生成的完整画面描述，把槽位自然嵌入主体、动作、关系、环境和风格语句；禁止退化为 placeholder 清单，也禁止暴露“沿用原画面”“以下开放项”“生成同构画面”“以模板参考图为基准”“仅修改开放项”“组件槽位版”“制作…模板”等内部编排或后处理语言。
14. 有可用 fallback 或默认值的槽位默认 `required: false`；全文自由编辑不得被隐藏的必填槽位阻断。提供 suggestions/预设交互时必须给 3-8 个去重、同类且符合模板情景的真实选项；无法可靠给出至少 3 个时省略 suggestions、保留自由输入或标记 `needsReview`，禁止显示单选项候选控件。候选必须回答同一个槽位问题并沿同一语义轴变化；禁止把主体/容器内容与城市、海边、森林等外部场景混在同一候选组，也不得使用“复古版本/简洁款某某/彩色手绘某某/用户自定义某某”等填充项。
15. 身份类 `subject` 上传槽统一使用 `semanticType: subject_identity` 和中性字段：普通身份槽使用“主体 / 用户上传图中的主体”，盒内内容、左侧主体、右页画作等可保留空间或功能角色；label、`imagePromptValue`、`defaultStateLabel/textInputLabel/uploadLabel` 不得出现猫、狗、宠物、人物、性别、商品等默认身份限定。文字模式仍可保留原图默认主体。最终模板必须声明 `metadata.runtimeRequirements` 和与 `imageSize` 匹配的默认输出比例。
16. 组件图、槽位图和机制分类只用于分析与校验，禁止进入生成指令。`promptEnhancement` 和 `metadata.templateSource.preserve` 不得包含 `character_styling_1`、`reaction_portrait_2` 等枚举 ID；必须明确要求只输出干净成图，禁止渲染槽位框、标签、连线、图例、模板标题或编辑说明。
17. 只要存在 `referenceImage`，模板参考图在构图、镜头、姿态、风格、材质和光影等未开放呈现维度拥有最高权限；背景或色调被明确开放时，对应维度由用户输入决定。`instruction` 必须完整体现全部开放槽位；`lockedConstraints` 只指名仍需沿用的视觉维度，不复述参考图具体内容，也不得锁定已开放维度；`preserve` 只保存模板成立所需的语义锚点，不复制视觉约束。
18. 每个可编辑属性只能有一个数据源。默认值及其显著概念不得同时散落在静态 prompt、模板主题名或多个相互重叠的槽位中；同一水果、角色、配色或内容会被用户视为整体替换时合并成一个槽位，并在 prompt 中复用同一 placeholder。确需独立编辑时，使用“果酱口味/顶部装饰水果”等互斥组件名称和不重叠默认值。
19. 全文自由编辑先合并到基础提示词，再进入 `promptEnhancement`；用户在开放内容上的改写优先于旧槽位默认值。当前运行时只把 `prompt` 和 `subject` 的 label 作为开放内容信号，同款模板不要使用纯 `select` 承载可替换内容。

## 请求路由

| 用户意图 | 内部流程 | 默认产物 | 必须读取 |
| --- | --- | --- | --- |
| 单图打样、图片编辑模板、可替换槽位 | `frontend_editing` | `image-edit-template.json`、`meme-template.json`、`index.md` | `slot-and-visual-design.md`、`reference-authority.md`、`prompt-and-validation.md`、`prompt-enhancement-v2.md` |
| 后台录入、模板库、批量入库 | `authoring` | 每模板一个 `meme-template.json`，批量另写 manifest | `gallery-authoring-contract.md`、`prompt-enhancement-v2.md`、`batch-and-review.md`、`tagging-and-taxonomy.md`、严格 schema |
| 上传 OSS、最终 JSON、交给后端批量导入 | `authoring-handoff` | handoff 目录内每模板一个纯 JSON | `gallery-authoring-contract.md`、`batch-and-review.md`、`oss-handoff.md`、严格 schema |
| 分析生成测试、看看效果、输出真实图片 | `generation_test` | 默认 3 张真实图、`generation-results.json`、`summary.md` | `generation-testing.md` 及默认单图 references |
| 批量整理台、素材分组 | `batch-review-workbench` | 优先使用本地业务管理台；无需服务时使用静态整理工具 | `batch-and-review.md`、`tagging-and-taxonomy.md` |
| 生成审核页、给运营看 | `template-review-page` | 同目录 `review.html` | `batch-and-review.md` |
| debug、检查草稿或编译结果 | `debug` | 按请求展开当前流程中间结构 | `json-contract.md` |

用户只要求快速解释、预览或评审时，按 `frontend_editing` 理解，但不要在未要求修改时写文件。

## Reference 导航

按路由读取所需文件，不要把所有 references 一次性加载：

- `references/slot-and-visual-design.md`：meme 公式、槽位最小化、语义合并、背景/边框/描边分层、关系与融合分析。
- `references/cultural-reference-discovery.md`：文化参照发现、多假设竞争、非梗识别、检索升级与公式前提审计。
- `references/reference-authority.md`：`templateSource`、`userSubjectInput`、`imageRefs` 和 authority 边界。
- `references/prompt-and-validation.md`：受限 placeholder 语法、草稿到 GalleryTemplate 的编译、强制校验与脚本命令。
- `references/prompt-enhancement-v2.md`：全文编辑合并顺序、参考图与用户内容权限、约束写法、开放槽位边界和当前运行时事实。
- `references/generation-testing.md`：3 张真实生成测试、差异覆盖、QA 和结果文件。
- `references/batch-and-review.md`：批量预审、批量整理台、批量入库和审核页。
- `references/tagging-and-taxonomy.md`：人工普通标签、AI 标签、外部平台标签及扁平兼容规则。
- `references/oss-handoff.md`：上传触发边界、OSS 配置、失败恢复和最终纯 JSON 交付。
- `references/json-contract.md`：草稿、mock、debug 和生成结果 JSON 详细字段。
- `references/gallery-authoring-contract.md`：最终入库契约和 metadata 规则。
- `references/gallery-template-import.schema.json`：最终 JSON 的严格 Schema 副本。
- `references/gallery-template-import.sample.json`：prompt/select/image/subject 全特性样例。

不要在聊天中大段复制 reference 或 schema；默认写 artifact，只报告路径和验证结果。

## 默认单图流程

1. 加载用户提供的图片、截图、URL、本地路径、文字创意或已有模板。
2. 先写 `visual_observations` 和 `distinctive_feature_bundle`，区分可见事实与语义解释。
3. 生成外部参照、图片内生笑点和非梗图片三类候选，写 `reference_discovery`、`interpretation_hypotheses` 和分项 `confidence`；疑似圈层梗时检索或进入人审。
4. 完成 `formula_reflection_review` 后再确定 `meme_formula`；无法确认时保留 `unknown/suspected`，不要伪装成无参照。
5. 按 `slot-and-visual-design.md` 建立 `component_graph`，列出 `edit_intent_candidates`，再完成 `slot_minimization_review`、`slot_reflection_review` 和 `slot_intelligence_review`。先识别可指认组件及其属性，再决定槽位。
6. 先写一段完整自然语言 `templateText`，用 `【槽位：默认值】` 在句内替换对应成分；它应在不读取后端约束时也能独立描述成图。再生成代入默认值后的无标记 `editablePrompt`，并设置 `allowFullRewrite: true`。参考图权限、锁定项和“仅修改开放槽位”等后处理要求只写入 `promptEnhancement`。
7. 写 `slots[]`。提供预设交互的文本槽给 3-8 个去重同类 suggestions；`subject` 复合槽必须给至少 3 个文字预设。无法可靠生成 3 个选项的普通自由输入槽省略 suggestions，并记录人审原因。逐项执行“能否自然替换到同一个 label 问句中、是否只改变目标属性”的检查；图片槽必须有 `extract`、`maxCount`、`private`、`sourceOptions`。同一主体需要支持预设、自由文本和上传图时使用 `inputKind: subject`，图片按 `image_over_text` 覆盖文本身份，上传态字段保持身份中性。
8. 按 `reference-authority.md` 和 `prompt-enhancement-v2.md` 写 `templateSource`、`userSubjectInput`、`imageRefs`、`backendHint` 和后端专用 `promptEnhancement`。
9. 审计静态 prompt 与槽位默认值：删除槽位 placeholder 之外重复出现的默认属性；检查多个槽位是否共享同一显著概念，共享时优先合并并复用同一 input id。
10. 按 `tagging-and-taxonomy.md` 写顶层 `tagAssignments[]`；人工 tags 原样保留，没有词库输入时仍区分 `ai` 与 `external`。
11. 写轻量 `image-edit-template.json`；完整参照发现、公式、阅读模型、槽位反思和 QA 写入 `image-edit-analysis.json`，并由 `analysisRef` 引用。
12. 先验证分析 sidecar，再运行槽位智能 validator；通过后运行转换器生成 `meme-template.json`，最后运行 Gallery validator。任一失败都要修复并重跑。
13. 写 `index.md`，记录理解摘要、参照状态、核心槽位、锁定约束和验证命令。

## 默认目录与产物

工作区可写时使用 `artifacts/meme-template-analyzer/<template-id-or-timestamp>/`，否则使用 `$CODEX_HOME/generated_artifacts/meme-template-analyzer/<...>/`。

普通单图默认写：

- `source.<ext>`
- `image-edit-template.json`
- `meme-template.json`
- 可选 `image-edit-analysis.json`
- `index.md`

批量另写 `batch-manifest.json`；审核页和真实生成测试按对应 reference 增加文件。用户明确要求内联 JSON 时，只返回合法 JSON，不加 Markdown 代码块或额外解释。

批量文件的用途必须明确区分：

- `<template>/meme-template.json` 是保留本地图片路径的单模板校验产物。
- `batch-manifest.json` 是 Agent 批次追踪清单，记录源文件、状态、校验和产物位置；它不是后端导入文件。
- `handoff/<batch-id>/` 才是 OSS 最终交付批次；目录内每个 `<template-key>.json` 都是一个可供后端导入的模板。
- 后端批量导入提交整个 handoff 目录或目录内全部 JSON，不提交 `batch-manifest.json`，也不提交本地路径版 `meme-template.json`。

## 编译与验证

先验证语义分析：

```bash
python skills/meme-template-analyzer/scripts/validate_semantic_analysis.py artifacts/meme-template-analyzer/<id>/image-edit-analysis.json
```

验证槽位是否绑定具体组件、是否出现机械通用槽、文字与复合输入是否合理：

```bash
python skills/meme-template-analyzer/scripts/validate_slot_intelligence.py artifacts/meme-template-analyzer/<id>
```

从草稿编译最终模板：

```bash
python skills/meme-template-analyzer/scripts/convert_image_edit_to_meme_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json
```

交付前强制验证：

```bash
python skills/meme-template-analyzer/scripts/validate_gallery_template.py artifacts/meme-template-analyzer/<id>/meme-template.json
python skills/meme-template-analyzer/scripts/validate_frontend_experience.py artifacts/meme-template-analyzer/<id>/meme-template.json
```

validator 检查严格字段类型/范围、三层提示词边界、复合主体槽、prompt placeholder、跨字段引用、`metadata.inputSemantics`、用户面向文案、必填/fallback 一致性、候选项语义、默认比例、运行时图片槽能力、本地 `cover/referenceImage` 文件和 template source 对齐。批量流程必须逐个 `PASS` 后才上传 OSS。

用户明确要求 OSS 最终交付时，在所有本地模板通过 validator 后执行：

```bash
pnpm gallery:finalize artifacts/meme-template-analyzer/<batch> --output artifacts/meme-template-analyzer/handoff/<batch-id>
```

按 `oss-handoff.md` 检查结果。不得在普通分析请求中自动上传，不得覆盖本地路径版模板。只有用户在
管理台明确触发原图辅助重传，或明确要求 `--write-back` 时，才可在 PUT、HEAD 和 remote validator
全部通过后原子回写 `cover/referenceImage` URL；不要覆盖标签等其他字段。

清洗历史草稿：

```bash
python skills/meme-template-analyzer/scripts/clean_image_edit_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json
```

只模拟前端 API 字段时加 `--profile frontend`。不要默认覆盖原文件；用户明确要求替换时才加 `--in-place`。

## 独立流程

### 分析生成测试

用户要求真实图片时，不要停在 JSON。先完成默认单图流程，再按 `generation-testing.md` 默认生成 3 张明显不同的 PNG/JPEG/WebP，保存每张完整 `prompt`、槽位值、差异要求和 QA。

### 批量与审核

批量请求先做预审；一个模板一个目录和一个 `meme-template.json`。平铺目录可能包含多个模板簇时，先输出预审并确认分类策略。具体使用 `batch-and-review.md`。

`batch-review-workbench` 默认推荐仓库内 `apps/meme-admin` 本地业务管理台；它支持批次、分组、参数、任务状态、失败重试和结果审核。用户只要轻量离线整理或不希望启动服务时，使用 `assets/batch-workbench.html` 静态工具。`template-review-page` 只在用户要求审核页时生成；不要默认创建或打开 `review.html`。

## 常见失败

- 只输出完整 prompt，没有 `slots[]`、`inputKind`、`slotRole` 和 suggestions。
- 暴露过多重复维度，没有做语义合并；或遗漏背景、颜色等显性变量。
- 批量套用 `subject/scene/style/caption`，槽位没有绑定具体组件、属性和编辑操作。
- 把“眼镜、服装、页内画作、海报主标题”等明确组件压缩成宽泛 `scene` 或 `style`。
- 画面没有文字却自动添加 `caption`；画面有显著文字区却没有逐项决定开放或锁定。
- 给整批模板机械追加背景环境、背景颜色或整体色调槽；背景/色调没有绑定具体组件与编辑意图，或与参考图锁定约束冲突；把页内画作、盒内内容等可替换内容只提供图片上传而不支持文字描述。
- 混淆 `canvas_background`、`frame_border`、`subject_outline` 和 `content_panel`。
- 同一属性既有动态槽位又在静态 prompt 中写死，造成颜色等约束冲突。
- 同一概念被拆进多个重叠槽位，例如“草莓甜品内容”和“草莓装饰水果”；用户修改一个槽位后旧值仍从另一个 fallback 或静态主题名回流。
- 已传 `referenceImage`，但 instruction 没有给参考图呈现维度权限，或没有明确排除开放内容和主体身份；`lockedConstraints` 用“图像依据”复述参考图内容，固化旧主体和道具。
- 把字符限制、参考图权限、锁定构图或安全约束暴露在 `promptTemplate`，没有放进 `promptEnhancement`。
- 把 `promptTemplate` 写成“沿用原画面，通过以下开放项生成同构画面：A；B；C”或“主体为 A；道具为 B”的槽位清单。
- 删除机械候选后只剩默认值，仍让前端显示只有一个选项的候选控件。
- 主体允许上传图，但基础提示词仍在图片模式下写死默认猫、狗或人物身份。
- 把用户身份图用于构图，覆盖模板图的版式权限。
- 把机制名、组件图或带序号的内部 ID 写进 `promptEnhancement/preserve`，导致模型输出槽位展示板、四宫格组件图或标注连线。
- 把 `lockedConstraints` 原样复制到 `preserve`，或要求最终提示词复述“以参考图为基准”等元指令。
- 开放槽位没有自然出现在 `promptTemplate`，或使用纯 `select` 导致运行时开放槽位清单缺少该 label。
- 丢失 `arrangement_pattern`、文字区域、遮挡关系或镜头裁切。
- 图片槽缺少 `extract`、`maxCount`、`private` 或 `sourceOptions`。
- 生成结果只写摘要，没有保存每张完整 prompt。
- validator 未通过就交付，或用 JSON/mock 代替用户要求的真实图片。

## 回复规则

完成后简洁报告：

- 本地批次目录、`batch-manifest.json` 和每模板本地 `meme-template.json` 的路径，并说明它们只用于追踪或本地校验。
- 用户要求 OSS 最终交付时，明确给出 handoff 目录和其中实际交给后端的 `<template-key>.json`；不要只给 `batch-manifest.json`。
- semantic validator、本地 Gallery validator、OSS PUT/HEAD、remote validator 的结果；未执行的阶段明确写“未执行”。
- 模板数量、最终 JSON 数量、上传/复用数量、是否回写源模板，以及 `metadata.needsReview` 对导入状态的影响。
- 是否修改仓库内 skill，是否同步全局运行副本。

除非用户明确要求，不在回复中粘贴完整 JSON 或完整 prompt。
