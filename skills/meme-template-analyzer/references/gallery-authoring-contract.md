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
  "promptTemplate": "可执行提示词",
  "metadata": {"tags": [], "version": "1.0.0"}
}
```

必填字段是 `key`、`title`、`promptTemplate`、`inputSchema`。Schema 设置
`additionalProperties: false`，不要输出旧的 `version`、`taxonomy`、`assets`、`editConfig`、
`ingestion` 或 `exampleWorks` 顶层块。

字段映射：

| Agent 草稿 | GalleryTemplate 导入字段 |
| --- | --- |
| `templateId` | `key` |
| `title` / `summary` | `title` / `description` |
| `templateSource.path` | `cover` + `referenceImage` |
| `templateText` + `slots[]` | `promptTemplate` |
| `slots[]` | `inputSchema[]` |
| `templateSource`、`taxonomy`、槽位语义 | `metadata` |
| `ingestion`、source hash、追踪状态 | 不入库，写 `import-report.json` |

`cover` 是列表展示图；`referenceImage` 是生成时固定参考图。本地产物默认可指向同一个文件；
OSS 收尾脚本只上传一次并复用 URL。最终交付 JSON 中二者为指定 assets 域名下的 HTTPS URL。

## promptTemplate

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
- `templateSource.preserve` 和 `lockedConstraints` 中影响出图的硬约束必须烘进文本；
  结构副本同时写入 `metadata.templateSource`。
- 语法是受限兜底链，不是完整 LiquidJS：不允许控制标签、循环或任意 filter，fallback 必须是 JSON 双引号字符串。
- 同一视觉属性只能有一个动态来源；存在颜色槽时，静态描述不得再写死冲突颜色。
- 文案槽在草稿中使用 `validation.maxLength`，转换器把长度要求烘进 prompt。

## inputSchema 映射

后端只支持 `prompt | select | image`：

| Agent `inputKind` | 后端类型 | 规则 |
| --- | --- | --- |
| `text` / `prompt` | `prompt` | `suggestions` 保持 `string[]` |
| `select` + `allowCustom: true` | `prompt` | 预设项转 `suggestions[]` |
| `select` + `allowCustom: false` | `select` | `options` 必须为 `{value,label}[]` |
| `image_upload` | `image` | 用户原图默认直通生成 |
| `image_select`，只注入文字 | `select` | option 可带 `thumbnail` |
| `image_select`，选中图片作为参考图 | 不支持 | v1 拒绝转换；固定素材改用 `referenceImage` |

`select.options` 不能简化成 `string[]`，因为后端 Schema 强制 `value` 和 `label`。只有
`prompt.suggestions` 使用 `string[]`。

图片槽不要默认创建 vision 步。用户上传原图默认直通；挂 vision 会让原图退出直通，
变为“读图转文字且不把原图传给生成模型”。槽位的 `extract` 暂存于
`metadata.inputSemantics`。

## preprocessSteps 与 stageKey

- 顶层 `stageKey` 默认省略，后端自动使用 `gallery.template_image`。
- `preprocessSteps` 默认 `[]`。
- 运维尚未绑定 `gallery.vision` 前，禁止输出 vision 步。
- 未来需要读图转文字时，vision step 使用 `stageKey: gallery.vision`；step prompt 自己定义
  输出 JSON，`promptTemplate` 用同名 `{{stepId.field}}` 引用。
- 不要填写未经绑定的 stageKey；它会静默回落到文本模型并导致图片流程出错。

## metadata

后端未设专列但有价值的数据放 `metadata`：

- `tags[]`: 从 taxonomy 非空值铺平并去重。
- `version`: Agent artifact/schema 版本。
- `taxonomy`: 保留完整分类结构。
- `templateSource`: 保留 authority、preserve、locked constraints；图片路径改为
  `referenceField: "referenceImage"`，避免留下本地路径。
- `inputSemantics`: 保留 `slotRole`、默认值、`extract`、`sourceOptions` 等不可执行语义。
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
- 所有 promptTemplate 引用的 head id 已定义。
- 所有模板硬约束既保存在 metadata，也出现在可执行 promptTemplate。
- 用户图片槽默认原图直通，`preprocessSteps` 为 `[]`。
- taxonomy 未完成人审时，`metadata.needsReview` 非空。
- 文件通过内置 Schema/validator 后再交给导入脚本。
- validator 必须检查严格字段类型和范围、prompt 语法、preprocess 引用顺序、本地资产存在性与 metadata/input 对齐。
- 颜色分析先区分 `canvas_background`、`frame_border`、`subject_outline` 和 `content_panel`；改变背景时明确边框是独立、同步还是锁定。
