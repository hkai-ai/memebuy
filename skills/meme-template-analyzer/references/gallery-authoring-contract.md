# GalleryTemplate 导入契约

本文件用于后台录入、批量入库和 `meme-template.json`。后端仓库中的
`docs/gallery-template-import/{schema.json,sample.json,README.md}` 是最终唯一标准；本 Skill
内置同步副本：

- `gallery-template-import.schema.json`
- `gallery-template-import.sample.json`

## 文件与职责

一个模板输出一个 `meme-template.json`。它必须直接符合 `GalleryTemplateImport` Schema。
默认产物使用本地图片路径；用户明确要求最终交付时，本仓库按 `oss-handoff.md` 上传 OSS 并输出
URL 版纯 JSON，之后由后端项目按 `key` upsert。

`image-edit-template.json` 是 Agent 的分析与编辑草稿，不是入库文件。二者通过
`scripts/convert_image_edit_to_meme_template.py` 确定性转换。

## 顶层结构

```json
{
  "key": "laser-cat-beach-ufo",
  "title": "激光眼巨型萌宠海滩 UFO",
  "description": "模板简介",
  "cover": "./source.png",
  "referenceImage": "./source.png",
  "imageSize": "1024x1024",
  "imageN": 1,
  "inputSchema": [],
  "preprocessSteps": [],
  "promptTemplate": "前端可编辑的基础提示词",
  "promptEnhancement": {
    "stageKey": "gallery.prompt_rewrite",
    "instruction": "后端二次编辑指令",
    "lockedConstraints": [],
    "preserve": [],
    "output": {"format": "json", "promptField": "finalPrompt"}
  },
  "metadata": {"tags": [], "version": "2.0.0"}
}
```

必填字段是 `key`、`title`、`promptTemplate`、`promptEnhancement`、`inputSchema`。Schema 设置
`additionalProperties: false`，不要输出旧的 `version`、`taxonomy`、`assets`、`editConfig`、
`ingestion` 或 `exampleWorks` 顶层块。

字段映射：

| Agent 草稿 | GalleryTemplate 导入字段 |
| --- | --- |
| `templateId` | `key` |
| `title` / 独立 `description` | `title` / `description` |
| `templateSource.path` | `cover` + `referenceImage` |
| `templateText` + `slots[]` | `promptTemplate` |
| `promptEnhancement` + `templateSource` 约束 | `promptEnhancement` |
| `slots[]` | `inputSchema[]` |
| `templateSource`、`taxonomy`、槽位语义 | `metadata` |
| `ingestion`、source hash、追踪状态 | 不入库，写 `import-report.json` |

`cover` 是列表展示图；`referenceImage` 是生成时固定参考图。本地产物默认可指向同一个文件；
OSS 收尾脚本只上传一次并复用 URL。最终交付 JSON 中二者为指定 assets 域名下的 HTTPS URL。

`description` 是前端纯描述，最多 20 个字符。不得从 `summary` 兜底，也不得包含批次号、图片序号、文件名、模板 key 或“开放 N 个槽位”等分析信息。

## 三层提示词

| 层 | 字段 | 前端可见 | 用户可编辑 | 是否入库 |
| --- | --- | --- | --- | --- |
| 基础创作层 | `promptTemplate`、`inputSchema` | 是 | 是；可编辑整段或只改槽位 | 是 |
| 后端增强层 | `promptEnhancement` | 否 | 否 | 是 |
| 网关执行层 | `resolvedPrompt` | 否 | 否 | 否，仅存在于单次生成任务 |

### promptTemplate

`promptTemplate` 是前端可见的基础提示词模板。前端可以提供整段自由编辑，也可以只展示 `inputSchema` 控件后渲染预览。它只表达用户创作意图：

使用后端兜底链语法：

```text
{{ term | term | "字面量默认" }}
```

- `{{inputId}}` 读取输入值。
- `{{selectId.key}}` 读取所选 option 的 `payload[key]`。
- `{{stepId.field}}` 读取预处理 JSON 字段。
- head id 必须存在于 `inputSchema` 或 `preprocessSteps`。
- 把 `【主体：白猫】` 编译为 `{{ subject | "白猫" }}`，使用稳定 slot id，不能使用 label。
- 不在槽位中的静态画面描述原样保留。
- `templateSource.preserve`、`lockedConstraints`、字符限制、参考图权限和安全规则不得烘进该字段。
- 语法是受限兜底链，不是完整 LiquidJS：不允许控制标签、循环或任意 filter，fallback 必须是 JSON 双引号字符串。
- 同一视觉属性只能有一个动态来源；存在颜色槽时，静态描述不得再写死冲突颜色。
- 文案槽长度使用 `inputSchema.minLength/maxLength`，由前端和后端校验。

### promptEnhancement

`promptEnhancement` 仅后端可见。后端先用输入值渲染 `promptTemplate`，再把基础提示词、复合主体模式、用户参考图和模板参考图上下文交给指定 LLM stage。它包含：

- `stageKey`：二次编辑能力，例如 `gallery.prompt_rewrite`。
- `instruction`：内部改写目标，不改变用户创作意图。
- `referenceField`：存在模板参考图时固定为 `referenceImage`。
- `lockedConstraints` / `preserve`：必须由最终提示词执行的结构和风格约束。
- `output`：固定为 `{ "format": "json", "promptField": "finalPrompt" }`。

### resolvedPrompt

`resolvedPrompt` 是 `promptEnhancement` 的运行时输出，只传给图片网关，不写入 GalleryTemplate、artifact 或前端 API。后端不得把内部 instruction 和约束回显到用户编辑器。

## inputSchema 映射

GalleryTemplateImport v2 支持 `prompt | select | image | subject`：

| Agent `inputKind` | 后端类型 | 规则 |
| --- | --- | --- |
| `text` / `prompt` | `prompt` | `suggestions` 保持 `string[]` |
| `select` + `allowCustom: true` | `prompt` | 预设项转 `suggestions[]` |
| `select` + `allowCustom: false` | `select` | `options` 必须为 `{value,label}[]` |
| `image_upload` | `image` | 用户原图默认直通生成 |
| `subject` | `subject` | 同一控件支持预设、自由文本和图片上传；图片优先 |
| `image_select`，只注入文字 | `select` | option 可带 `thumbnail` |
| `image_select`，选中图片作为参考图 | 不支持 | v2 仍拒绝转换；固定素材改用 `referenceImage`，主体多来源改用 `subject` |

`select.options` 不能简化成 `string[]`，因为后端 Schema 强制 `value` 和 `label`。只有
`prompt.suggestions` 使用 `string[]`。

图片槽不要默认创建 vision 步。用户上传原图默认直通；挂 vision 会让原图退出直通，
变为“读图转文字且不把原图传给生成模型”。槽位的 `extract` 暂存于
`metadata.inputSemantics`。

`subject` 是 Gallery v2 新增的复合输入。它包含 `text`、`image` 和固定的 `resolutionStrategy: image_over_text`。身份类槽统一使用 `semanticType: subject_identity`；普通身份槽的图片模式解析为“用户上传图中的主体”，盒内内容、右页画作等嵌套槽可保留空间或功能角色，同时把原图作为 identity reference 传给网关。label、`image.promptValue`、`defaultStateLabel`、`textInputLabel` 和 `uploadLabel` 均不得继续注入默认“猫”“狗”、人物类型、性别或商品身份。

建议后端接收以下运行时值：

```json
{"mode": "text", "value": "穿西装坐沙发的狗"}
```

或：

```json
{"mode": "image", "assetIds": ["asset-id"]}
```

后端批处理顺序固定为：

1. 解析 `inputSchema`；`subject.mode=image` 时使用 `image.promptValue` 渲染占位，同时收集 `assetIds`。
2. 渲染前端基础 `promptTemplate`，得到 `basePrompt`。
3. 调用 `promptEnhancement.stageKey`，输入 `basePrompt`、`instruction`、`lockedConstraints`、`preserve`、模板参考图上下文和主体模式。
4. 只接受 JSON 对象中的 `finalPrompt`，作为本次任务的 `resolvedPrompt`。
5. 图片网关接收 `resolvedPrompt`、`referenceImage` 和 subject image assets；前端 API 不返回后端 instruction、约束或 `resolvedPrompt`。

## preprocessSteps 与 stageKey

- 顶层 `stageKey` 默认省略，后端自动使用 `gallery.template_image`。
- `preprocessSteps` 默认 `[]`。
- 运维尚未绑定 `gallery.vision` 前，禁止输出 vision 步。
- 未来需要读图转文字时，vision step 使用 `stageKey: gallery.vision`；step prompt 自己定义
  输出 JSON，`promptTemplate` 用同名 `{{stepId.field}}` 引用。
- 不要填写未经绑定的 stageKey；它会静默回落到文本模型并导致图片流程出错。

## metadata

后端未设专列但有价值的数据放 `metadata`：

- `tags[]`: 从已有可信 taxonomy 和 `accepted` 标签分配铺平并去重；普通人工标签不需要归入 taxonomy。
- `tagAssignments[]`: 按 `tagging-and-taxonomy.md` 保留标签层级、来源、状态、AI 置信度和外部平台；只有 `accepted` label 铺入 `tags[]`。
- `version`: GalleryTemplateImport 契约版本；v2 固定为 `2.0.0`，便于后端拒绝旧批次。
- `taxonomy`: 保留完整分类结构。
- `templateSource`: 保留 authority、preserve、locked constraints；图片路径改为
  `referenceField: "referenceImage"`，避免留下本地路径。
- `inputSemantics`: 保留 `slotRole`、默认值、`extract`、`sourceOptions` 等不可执行语义。
- `inputSemantics`: `subject` 另保留 `semanticType`、`defaultStateLabel`、`textInputLabel`和 `uploadLabel`，前端不再硬编码“自动”或“或描述主体”。
- `presentation`: 保留 `recommendedOutputRatio` 和 `referenceImageRemovable`；模板参考图默认固定。
- `runtimeRequirements`: 声明 `subjectInputVersion`、`supportsMultipleSubjectImages` 和 `imageSlotAddressing: input_id`。导入目标不支持时必须阻断发布。
- `needsReview`: 非空字符串会让导入脚本强制写入 `DRAFT`；为空时默认 `PUBLISHED`。

`topicId`、`status`、`sortOrder` 不由 Agent 产出。`topicId` 由导入运维指定；status 默认
`PUBLISHED`，但 `metadata.needsReview` 非空时强制 `DRAFT`；sortOrder 默认 0。

## 批量规则

- 一个模板一个 JSON 文件，不再输出顶层 `templates[]` 聚合文件供导入。
- `batch-manifest.json` 只用于 Agent 批次追踪，不进入 GalleryTemplate 表。
- 每张源图使用独立目录，JSON 中图片路径相对当前 JSON 文件解析。
- OSS 收尾脚本负责上传、hash 去重与 URL 回填；后端项目负责按 key upsert 和数据库导入报告。
- Agent 输出后运行：

```bash
python skills/meme-template-analyzer/scripts/validate_gallery_template.py <template>/meme-template.json
```

## 质量检查

- `key` 满足 `^[a-z][a-z0-9-]{1,59}$`，批次内唯一。
- 每个 input id 唯一，且与 preprocess step id 共享命名空间。
- 有 fallback/defaultValue 的 input 默认非必填，用户打开模板后可直接生成。
- title、description、promptTemplate 不包含“组件槽位版”或“制作…模板”等编排文案。
- suggestions 回答同一个槽位问题并只改变目标属性；主体/容器内容不得混入外部风景，且不使用批量通用版本名或“简洁款/彩色手绘/用户自定义”填充项。
- 所有 promptTemplate 引用的 head id 已定义。
- `description` 是 20 字以内的独立纯描述。
- `promptTemplate` 只包含前端可编辑创作意图，不含后端约束。
- `promptTemplate` 必须用一段完整自然语言描述成图，placeholder 自然嵌入句子；不得使用“沿用原画面/以下开放项/同构画面/以模板参考图为基准/仅修改开放项”等后处理文案，也不得退化为槽位清单。
- `prompt.suggestions` 存在时必须有 3-10 个去重候选；`subject.text.suggestions` 必须有 3-10 个去重预设；纯 `select` 至少提供 2 个选项。候选不足时，普通 prompt 省略 suggestions 并使用自由输入，或标记 `needsReview`。
- 所有模板硬约束写入 `promptEnhancement`，并在 `metadata.templateSource` 保留结构副本。
- `promptEnhancement.instruction` 必须要求只输出最终干净成图；禁止出现“按某某组件图执行”、内部组件 ID、槽位展示、标注框、连线或图例。
- 有 `referenceImage` 时，`promptEnhancement.instruction` 必须声明模板图拥有最高构图/风格权限，`finalPrompt` 显式采用参考图，只改开放槽位并禁止从零重新设计；约束必须包含当前图片特有的构图、媒介和空间关系证据。
- 槽位默认属性不得在 placeholder 之外静态写死，也不得被多个重叠槽位同时拥有；例如用户选择水蜜桃后，旧的“草莓”不能从模板主题、甜品内容 fallback 或另一个装饰槽回流。
- `promptEnhancement.preserve` 与 `metadata.templateSource.preserve` 只能写可直接理解的视觉不变量；禁止使用 `character_styling_1`、`reaction_portrait_2` 等机制名加序号的内部 ID。
- 复合主体图片模式不重复默认文本主体，固定按 `image_over_text` 解析。
- 用户图片槽默认原图直通，`preprocessSteps` 为 `[]`。
- taxonomy 未完成人审时，`metadata.needsReview` 非空。
- 文件通过内置 Schema/validator 后再交给导入脚本。
- validator 必须检查严格字段类型和范围、prompt 语法、preprocess 引用顺序、本地资产存在性与 metadata/input 对齐。
- 颜色分析先区分 `canvas_background`、`frame_border`、`subject_outline` 和 `content_panel`；改变背景时明确边框是独立、同步还是锁定。
