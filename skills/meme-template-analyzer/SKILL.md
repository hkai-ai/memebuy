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

默认输出简体中文。JSON key、路径、mode、enum、placeholder、命令、hash、URL、模型名和图片中的原文保持原样。

## 强制门禁

1. 先分离视觉事实与解释，再按 `cultural-reference-discovery.md` 做参照发现、多假设竞争和公式前提审计；不要把 `unknown` 写成 `none`。
2. 只有 `formula_reflection_review` 通过后才设计槽位；文化识别锚点默认锁定，不要把画面元素清单直接变成表单。
3. 默认设计 2-4 个核心业务槽位，辅助颜色和图片参考可以可选。
4. 区分模板资产图与用户主体图；模板图负责构图/风格，用户图通常只负责身份。
5. 将硬构图约束同时写进 `promptTemplate` 和 `metadata.templateSource`。
6. `preprocessSteps` 默认 `[]`；用户原图默认直通生成，运维绑定 `gallery.vision` 前不要创建 vision step。
7. 输出前先运行 `scripts/validate_semantic_analysis.py`，再运行 `scripts/validate_gallery_template.py`。只有都返回 `PASS` 才能交付或上传。
8. 不默认生成真实图片；只有用户明确要求测试效果时才进入 `generation_test`。
9. 存在 `tag-catalog.snapshot.json` 或锁定人工标签时，必须按 `tagging-and-taxonomy.md` 读取并原样保留；词库只包含普通 tags，`group` 仅用于 UI 整理，不写入 taxonomy 或模板 tags。

## 请求路由

| 用户意图 | 内部流程 | 默认产物 | 必须读取 |
| --- | --- | --- | --- |
| 单图打样、图片编辑模板、可替换槽位 | `frontend_editing` | `image-edit-template.json`、`meme-template.json`、`index.md` | `slot-and-visual-design.md`、`reference-authority.md`、`prompt-and-validation.md` |
| 后台录入、模板库、批量入库 | `authoring` | 每模板一个 `meme-template.json`，批量另写 manifest | `gallery-authoring-contract.md`、`batch-and-review.md`、`tagging-and-taxonomy.md`、严格 schema |
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
- `references/generation-testing.md`：3 张真实生成测试、差异覆盖、QA 和结果文件。
- `references/batch-and-review.md`：批量预审、批量整理台、批量入库和审核页。
- `references/tagging-and-taxonomy.md`：人工普通标签、AI 标签、外部平台标签及扁平兼容规则。
- `references/oss-handoff.md`：上传触发边界、OSS 配置、失败恢复和最终纯 JSON 交付。
- `references/json-contract.md`：草稿、mock、debug 和生成结果 JSON 详细字段。
- `references/gallery-authoring-contract.md`：最终入库契约和 metadata 规则。
- `references/gallery-template-import.schema.json`：最终 JSON 的严格 Schema 副本。
- `references/gallery-template-import.sample.json`：prompt/select/image 全特性样例。

不要在聊天中大段复制 reference 或 schema；默认写 artifact，只报告路径和验证结果。

## 默认单图流程

1. 加载用户提供的图片、截图、URL、本地路径、文字创意或已有模板。
2. 先写 `visual_observations` 和 `distinctive_feature_bundle`，区分可见事实与语义解释。
3. 生成外部参照、图片内生笑点和非梗图片三类候选，写 `reference_discovery`、`interpretation_hypotheses` 和分项 `confidence`；疑似圈层梗时检索或进入人审。
4. 完成 `formula_reflection_review` 后再确定 `meme_formula`；无法确认时保留 `unknown/suspected`，不要伪装成无参照。
5. 按 `slot-and-visual-design.md` 做 `slot_minimization_review`、`slot_reflection_review` 和视觉层分解。
6. 生成 `templateText`，用 `【槽位：默认值】` 标记变量；生成代入默认值后的 `editablePrompt`，并设置 `allowFullRewrite: true`。
7. 写 `slots[]`。文本槽给 3-8 个同类 suggestions；图片槽必须有 `extract`、`maxCount`、`private`、`sourceOptions`。
8. 按 `reference-authority.md` 写 `templateSource`、`userSubjectInput`、`imageRefs` 和 `backendHint`。
9. 按 `tagging-and-taxonomy.md` 写顶层 `tagAssignments[]`；人工 tags 原样保留，没有词库输入时仍区分 `ai` 与 `external`。
10. 写轻量 `image-edit-template.json`；完整参照发现、公式、阅读模型、槽位反思和 QA 写入 `image-edit-analysis.json`，并由 `analysisRef` 引用。
11. 先验证分析 sidecar，再运行转换器生成 `meme-template.json`，最后运行 Gallery validator；失败则修复并重跑。
12. 写 `index.md`，记录理解摘要、参照状态、核心槽位、锁定约束和验证命令。

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

从草稿编译最终模板：

```bash
python skills/meme-template-analyzer/scripts/convert_image_edit_to_meme_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json
```

交付前强制验证：

```bash
python skills/meme-template-analyzer/scripts/validate_gallery_template.py artifacts/meme-template-analyzer/<id>/meme-template.json
```

validator 检查严格字段类型/范围、prompt placeholder、跨字段引用、`metadata.inputSemantics`、本地 `cover/referenceImage` 文件和 template source 对齐。批量流程必须逐个 `PASS` 后才上传 OSS。

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
- 混淆 `canvas_background`、`frame_border`、`subject_outline` 和 `content_panel`。
- 同一属性既有动态槽位又在静态 prompt 中写死，造成颜色等约束冲突。
- 把用户身份图用于构图，覆盖模板图的版式权限。
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
