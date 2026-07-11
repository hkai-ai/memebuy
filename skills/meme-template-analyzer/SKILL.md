---
name: meme-template-analyzer
description: Use when 需要分析 meme 图片、截图、图片 URL 或 meme 创意，并产出严格 GalleryTemplateImport JSON、后端可入库模板、前端编辑草稿、文本/图片槽位、候选替换项、真实生成测试或批量模板库。
---

# Meme Template Analyzer

## 核心目标

把 meme 或图片创意转换成两个层次：

- `image-edit-template.json`：Agent 分析与前端编辑草稿。
- `meme-template.json`：严格符合后端 `GalleryTemplateImport` 的入库文件。

正式链路以后端为 source of truth：校验 JSON，上传本地图到 OSS，回填 URL，再按 `key` upsert。不要把草稿里的 `editConfig` 直接入库。

默认输出简体中文。JSON key、路径、mode、enum、placeholder、命令、hash、URL、模型名和图片中的原文保持原样。

## 强制门禁

1. 先理解图片和梗成立机制，再设计槽位；不要把画面元素清单直接变成表单。
2. 默认设计 2-4 个核心业务槽位，辅助颜色和图片参考可以可选。
3. 区分模板资产图与用户主体图；模板图负责构图/风格，用户图通常只负责身份。
4. 将硬构图约束同时写进 `promptTemplate` 和 `metadata.templateSource`。
5. `preprocessSteps` 默认 `[]`；用户原图默认直通生成，运维绑定 `gallery.vision` 前不要创建 vision step。
6. 输出前必须运行 `scripts/validate_gallery_template.py`。只有返回 `PASS` 才能交付或上传。
7. 不默认生成 legacy `prompt-pack.json`、`stability-testset.json` 或真实图片。

## 请求路由

| 用户意图 | 内部流程 | 默认产物 | 必须读取 |
| --- | --- | --- | --- |
| 单图打样、图片编辑模板、可替换槽位 | `frontend_editing` | `image-edit-template.json`、`meme-template.json`、`index.md` | `slot-and-visual-design.md`、`reference-authority.md`、`prompt-and-validation.md` |
| 后台录入、模板库、批量入库 | `authoring` | 每模板一个 `meme-template.json`，批量另写 manifest | `gallery-authoring-contract.md`、`batch-and-review.md`、严格 schema |
| 分析生成测试、看看效果、输出真实图片 | `generation_test` | 默认 3 张真实图、`generation-results.json`、`summary.md` | `generation-testing.md` 及默认单图 references |
| 批量整理台、素材分组 | `batch-review-workbench` | 静态整理工具写回 workspace/manifest/group config | `batch-and-review.md` |
| 生成审核页、给运营看 | `template-review-page` | 同目录 `review.html` | `batch-and-review.md` |
| debug、旧 prompt pipeline | `debug` | 按请求展开中间结构 | `json-contract.md` |
| stability-testset、旧稳定性测试 | `legacy_validation` | legacy testset/prompt pack/output | `stability-testset-contract.md` |

用户只要求快速解释、预览或评审时，按 `frontend_editing` 理解，但不要在未要求修改时写文件。

## Reference 导航

按路由读取所需文件，不要把所有 references 一次性加载：

- `references/slot-and-visual-design.md`：meme 公式、槽位最小化、语义合并、背景/边框/描边分层、关系与融合分析。
- `references/reference-authority.md`：`templateSource`、`userSubjectInput`、`imageRefs` 和 authority 边界。
- `references/prompt-and-validation.md`：受限 placeholder 语法、草稿到 GalleryTemplate 的编译、强制校验与脚本命令。
- `references/generation-testing.md`：3 张真实生成测试、差异覆盖、QA 和结果文件。
- `references/batch-and-review.md`：批量预审、批量整理台、批量入库和审核页。
- `references/json-contract.md`：草稿、mock、debug 和 legacy JSON 详细字段。
- `references/gallery-authoring-contract.md`：最终入库契约和 metadata 规则。
- `references/gallery-template-import.schema.json`：最终 JSON 的严格 Schema 副本。
- `references/gallery-template-import.sample.json`：prompt/select/image 全特性样例。
- `references/stability-testset-contract.md`：仅 legacy 稳定性测试读取。

不要在聊天中大段复制 reference 或 schema；默认写 artifact，只报告路径和验证结果。

## 默认单图流程

1. 加载用户提供的图片、截图、URL、本地路径、文字创意或已有模板。
2. 识别主体、物体、场景、可见文字、构图、风格、幽默信号、不确定性和可编辑候选。
3. 提取一句 `meme_formula`，用 2-4 个核心变量解释梗成立机制。
4. 按 `slot-and-visual-design.md` 做 `slot_minimization_review`、`slot_reflection_review` 和视觉层分解。
5. 生成 `templateText`，用 `【槽位：默认值】` 标记变量；生成代入默认值后的 `editablePrompt`，并设置 `allowFullRewrite: true`。
6. 写 `slots[]`。文本槽给 3-8 个同类 suggestions；图片槽必须有 `extract`、`maxCount`、`private`、`sourceOptions`。
7. 按 `reference-authority.md` 写 `templateSource`、`userSubjectInput`、`imageRefs` 和 `backendHint`。
8. 写轻量 `image-edit-template.json`；完整公式、阅读模型、槽位反思和 QA 写入可选 `image-edit-analysis.json`。
9. 运行转换器生成 `meme-template.json`，再运行 validator；失败则修复并重跑。
10. 写 `index.md`，记录理解摘要、核心槽位、锁定约束和验证命令。

## 默认目录与产物

工作区可写时使用 `artifacts/meme-template-analyzer/<template-id-or-timestamp>/`，否则使用 `$CODEX_HOME/generated_artifacts/meme-template-analyzer/<...>/`。

普通单图默认写：

- `source.<ext>`
- `image-edit-template.json`
- `meme-template.json`
- 可选 `image-edit-analysis.json`
- `index.md`

批量另写 `batch-manifest.json`；审核页和真实生成测试按对应 reference 增加文件。用户明确要求内联 JSON 时，只返回合法 JSON，不加 Markdown 代码块或额外解释。

## 编译与验证

从草稿编译最终模板：

```bash
python skills/meme-template-analyzer/scripts/convert_image_edit_to_meme_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json
```

交付前强制验证：

```bash
python skills/meme-template-analyzer/scripts/validate_gallery_template.py artifacts/meme-template-analyzer/<id>/meme-template.json
```

validator 检查严格字段类型/范围、prompt placeholder、跨字段引用、`metadata.inputSemantics`、本地 `cover/referenceImage` 文件和 template source 对齐。批量流程必须逐个 `PASS` 后才上传 OSS。

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

`batch-review-workbench` 是 `assets/batch-workbench.html` 静态工具，只在用户要求整理素材时使用。`template-review-page` 只在用户要求审核页时生成；不要默认创建或打开 `review.html`。

### Legacy

只有用户明确点名 `prompt-pack.json`、`render-prompt-pack`、`stability-testset`、旧 high-fidelity/free-creative 测试或旧 pipeline 时进入 legacy。普通模板请求不得自动进入。

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

- 结果目录和主产物路径。
- 是否通过 validator/测试。
- 是否修改仓库内 skill，是否同步全局运行副本。

除非用户明确要求，不在回复中粘贴完整 JSON 或完整 prompt。
