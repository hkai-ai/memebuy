# Gallery Template Authoring Contract

用于非测试、非调试场景下的 `meme-template.json` 主输出。目标是生成可给后台录入、seed 脚本或运营审核使用的业务收集 JSON，而不是分析报告。

## Purpose 路由

只保留三类顶层目的：

| purpose | 触发场景 | 主输出 |
| --- | --- | --- |
| `authoring` | 用户要识别模板内容、批量生成模板、录入后台、产出 gallery template、template-library-entry。 | `meme-template.json`，格式为业务收集 JSON v1。 |
| `validation` | 用户要测试规范、验证高保真/自由创意是否稳定、跑 faithful/free/negative cases、看真实生成图。 | `stability-testset.json`、`prompt-pack.json`、`output/`，按请求组合。 |
| `debug` | 用户要调试 skill、查看 VLM mock、slot binding、prompt template、rendered prompt 或完整 pipeline。 | 展开中间 JSON 文件和可选 `_analysis`。 |

快速解释、预览或评审模板，默认归入 `authoring`，但可以只写 `index.md` 或内联摘要；不要另设第四类目的。

## 默认文件

`authoring` 默认写：

```text
meme-template.json
index.md
```

批量场景仍写同一个 `meme-template.json`，顶层使用：

```json
{
  "version": 1,
  "batch": {
    "batchId": "",
    "sourceFolder": "",
    "createdAt": "",
    "operatorGrouping": {
      "folderAsSeries": true,
      "seriesName": ""
    }
  },
  "templates": []
}
```

批量场景同时写 `batch-manifest.json`。它面向脚本入库和排查，不替代 `meme-template.json`：

```json
{
  "version": 1,
  "batchId": "",
  "sourceFolder": "",
  "createdAt": "",
  "outputs": {
    "memeTemplate": "meme-template.json",
    "reviewHtml": "review.html",
    "index": "index.md"
  },
  "sources": [
    {
      "sourceId": "",
      "sourcePath": "",
      "sourceSha256": "",
      "folder": "",
      "templateKey": "",
      "status": "processed | skipped | failed",
      "error": "",
      "notes": []
    }
  ]
}
```

单模板场景直接输出业务收集 JSON object。

## 业务收集 JSON v1

```json
{
  "version": 1,
  "key": "",
  "topic": "",
  "title": "",
  "description": "",
  "taxonomy": {
    "category": "",
    "templateMechanism": "",
    "scenes": [],
    "topics": [],
    "styles": [],
    "emotions": [],
    "useCases": [],
    "series": [],
    "parentTemplateKey": "",
    "variantName": "",
    "needs_review": []
  },
  "assets": {
    "templateImage": "",
    "cover": "",
    "exampleWorks": []
  },
  "inputs": [],
  "prompt": {
    "master": "",
    "slots": []
  },
  "modes": {
    "hifi": {
      "enabled": true,
      "useTemplateImage": false,
      "note": ""
    },
    "free": {
      "enabled": false,
      "mustKeep": [],
      "canChange": "",
      "baseDescription": "",
      "examples": []
    }
  },
  "generationFit": {
    "hifi": "recommended | usable | not_recommended",
    "free": "recommended | usable | not_recommended",
    "reason": ""
  },
  "output": {
    "size": "1024x1024",
    "n": 1
  },
  "ingestion": {
    "sourceId": "",
    "sourcePath": "",
    "sourceSha256": "",
    "status": "ready_for_import | needs_human_review | skipped",
    "notes": []
  }
}
```

## 字段规则

- `key`: 英文小写连字符，模板内稳定。批量场景使用 `<series-or-topic-slug>-<formula-slug>-<short-hash>`。识别不出时从标题语义生成短 key，并在 `index.md` 标注需人工确认。
- `topic`、`title`、`description`: 面向 C 端展示，中文优先。
- `taxonomy`: 面向搜索、瀑布流、专题页和运营组织，不替代模板本质边界。缺少明确判断时使用空数组、空字符串或保守标签，不要硬编；不确定项写入 `needs_review`。
- `assets.templateImage`: 模板原图或风格类模板代表图。没有素材 URL 时填本地 artifact 路径或空字符串，并在 `index.md` 标注缺口。
- `assets.cover`: 默认同 `templateImage`。
- `assets.exampleWorks`: 只有用户提供示例图时填；图片输入无法预填时不要伪造对应 input。
- `inputs`: 只写用户需要提供的内容，建议不超过 3 个。
- `prompt.master`: 完整画面描述，使用 `【槽位名：原文】` 标记可变部分。标记外的文字是锁定部分。
- `prompt.slots`: 每个槽写 `id`、`policy` 和 `from`。`policy` 只能是 `required` 或 `extensible`。
- `modes.hifi.enabled`: 默认 `true`。
- `modes.hifi.useTemplateImage`: 画风/构图依赖原图像素时为 `true`；风格可由文字稳定锁定时为 `false`。
- `modes.free.enabled`: 默认 `false`。只有用户明确要自由创意，或已有足够测试/范例时才建议 `true`。
- `modes.free.mustKeep`: 写 3-5 条具体可判定的灵魂属性。
- `modes.free.examples`: 业务不填，保持空数组。
- `generationFit`: 只说明高保真和自由模式适配性，不输出 AI 分数，不替运营做上线裁决。取值只能是 `recommended`、`usable`、`not_recommended`。
- `ingestion`: 批量入库追踪字段。`sourceSha256` 用源文件内容 hash；无法读取源文件时填空字符串并在 `notes` 说明。`status` 默认 `ready_for_import`，只有缺素材、解析失败或需要人补关键信息时用 `needs_human_review` 或 `skipped`。
- `output`: 默认 `{ "size": "1024x1024", "n": 1 }`，除非用户或项目规范要求其他值。

## Taxonomy 候选

这些值是首批推荐候选，不是封闭枚举；后续可以扩展，但分类增长必须受控。输出时使用中文 label，必要时可在后台脚本再映射成内部 ID。

- `category`: 梗机制或模板类型，category 控制在 20-40 个左右。优先使用误读揭示、角色贴标签、对比、反应图、物体融合、聊天截图、多格叙事、前后变化等大类；不要把宠物、情侣、亲子等主题词作为唯一 category。
- `templateMechanism`: 从 `meme_formula` 推导的更具体模板机制，用于判断是否属于同一个模板簇，例如 `food-fusion`、`hidden-reveal`、`caption-reversal`。
- `scenes`: 家庭、办公室、餐桌、街头、校园、社媒、头像、聊天、节日、旅行、商品展示。
- `topics`: 宠物、情侣、儿童、亲子、闺蜜、职场、游戏、美食、魔法、治愈、反差、搞笑、日常、复古、天气、运动、商品、包装、截图。
- `styles`: 手绘、水彩、油画、彩铅、复古、极简、低饱和、可爱、写实照片、截图风、3D、像素风。
- `emotions`: 可爱、治愈、荒诞、松弛、温暖、困惑、尴尬、惊喜、反差、呆萌。
- `useCases`: 头像、表情包、朋友圈配图、小红书封面、聊天配图、节日祝福图、运营活动图。
- `needs_review`: 待确认项列表，记录自动聚类、模板边界、OCR、category 或 topics 中需要用户/运营确认的原因。

运营按文件夹组织素材时，把文件夹名写入 `batch.operatorGrouping.seriesName` 和每个模板的 `taxonomy.series[]` 候选。文件夹名只表示运营分组，不表示这些素材一定属于同一个模板；是否同模板仍由核心梗点、主体关系和观看逻辑判断。

## 批量预审

批量 authoring 前必须先做批量预审。预审不替代深度模板分析，只判断输入结构是否适合批处理，并把需要人审的边界提前暴露。

预审报告至少覆盖：

- 图片数量、有效格式、尺寸异常、路径层级、平铺程度、是否已有每张源图独立文件夹。
- 重复图、缩略图、生成结果、截图副本、非源图或无法读取文件。
- 初步自动聚类结果：模板簇候选、每簇代表图、置信度、可能的 `category`、`templateMechanism` 和待确认原因。
- 建议结构：按模板簇组织，但每张源图独立工作目录，例如 `<template-cluster>/<source-id>/source.<ext>`。

如果一个文件夹中平铺大量图片，且自动聚类显示可能包含多个模板或分类，先让用户确认分组策略，再移动文件或开始批量模板输出。用户明确允许自动整理时，也要把低置信分组写入 `taxonomy.needs_review` 和 `batch-manifest.json.sources[].notes`。

## Key 规范

批量模板 key 使用：

```text
<series-or-topic-slug>-<formula-slug>-<short-hash>
```

规则：

- 只使用小写英文、数字和连字符。
- `series-or-topic-slug` 优先来自文件夹/系列名；没有时来自主要 topic 或 scene。
- `formula-slug` 来自 `meme_formula`，例如 `food-fusion`、`hidden-reveal`、`caption-reversal`。
- `short-hash` 使用源文件 hash 或源路径 hash 的前 6 位，避免批次内冲突。
- 批次内 key 必须唯一；冲突时追加或替换 short hash，不要覆盖前一个模板。
- 不要让中文标题决定 key，标题可改，key 应保持稳定。

## Generation Fit

`generationFit` 表达“这个模板更适合哪种生成模式”，不是质量分。

- `recommended`: 推荐作为默认模式，模板结构和输入条件支持稳定生成。
- `usable`: 可用但需要运营理解边界，或需要更强 prompt/参考图约束。
- `not_recommended`: 不建议作为该模式开放；如果业务仍要试，应在备注中说明风险。

判断规则：

- 高保真适合保留源图构图、画风、主体关系和少量核心变量替换时，`hifi` 用 `recommended`。
- 高保真主体替换会破坏融合关系、颜色/材质押韵或第一眼误读时，`hifi` 用 `usable` 或 `not_recommended`。
- 自由模式能保留 `meme_formula`、阅读顺序、关系不变量和融合逻辑，并允许重构场景或构图时，`free` 用 `recommended` 或 `usable`。
- 自由模式很容易变成另一个梗、失去观看逻辑或无法定义 `free_must_keep` 时，`free` 用 `not_recommended`。
- 不要输出数值分数；`reason` 用中文说明具体原因。

## Hifi / Free 边界反思

生成 `modes.hifi` 和 `modes.free` 前必须先完成 `hifi_free_boundary_reflection`，即使该结构不写入主业务 JSON，也要用它推导字段：

- `hifi_must_keep`: 高保真要锁定的源图识别锚点，例如构图、数量、镜头、白底、画风、裁切、文字位置或参照物队列。
- `free_must_keep`: 自由创意也必须保留的梗成立条件，例如 meme_formula、第一眼误认、第二眼揭示、阅读顺序、关系不变量、融合逻辑和失效条件。
- `free_can_change`: 自由创意可重构的维度，例如 `misread_target`、`fusion_context`、`composition_pattern`、参照物数量、容器、场景、镜头、背景或揭示方式。

不要把 `hifi_must_keep` 直接复制到 `modes.free.mustKeep`。`composition_pattern` 默认属于 `hifi_must_keep` 或 `free_can_change`；只有当构图模式本身就是梗公式变量时，才可进入 `free_must_keep`。

## 输入类型

```json
{
  "type": "image | select | prompt",
  "id": "",
  "label": "",
  "required": true
}
```

`image` 输入必须包含：

```json
{
  "hint": "",
  "private": true,
  "maxCount": 1,
  "extract": ""
}
```

`extract` 用中文说明视觉模型要提取哪些特征。人脸、宠物、商品等身份保留输入必须写清楚应提取的稳健身份线索，以及应忽略的隐私、Logo、无关持有物或照片质量细节。

`select` 输入可包含：

```json
{
  "options": [
    {
      "value": "",
      "label": "",
      "thumbnail": "",
      "extra": {}
    }
  ]
}
```

`prompt` 输入可包含：

```json
{
  "hint": "",
  "suggestions": []
}
```

## 从 meme 分析映射到业务 JSON

- `reading_model`、`salience_model`、`template_alignment`、`prompt_style_profile` 是生成业务 JSON 的分析中间层，不默认暴露为主字段。
- 先写一句 `meme_formula`，把梗压缩成 2-4 个核心变量；再把这些核心变量转成 `prompt.master` 里的 `【槽位名：原文】`，并在 `prompt.slots[]` 里声明 `policy` 和 `from`。
- `prompt.slots[]` 不是画面元素清单。容器、工具、姿势、镜头、表情、字体、风格、局部道具等默认属于锁定描述、默认渲染或生成约束；只有它们本身改变梗公式，或用户明确要编辑，才可以成为业务槽位。
- 默认控制在 2-4 个业务槽位。超过 4 个时必须先合并到更高层变量，例如把“筷子/蒸笼/夹起姿势”压缩成“空间关系/误认关系”。
- 必须由用户提供或选择的内容用 `required`，例如主体照片、人格选项、主标文本。
- 模板原有但可在自由模式扩展的核心变量用 `extensible`，例如误认对象、关系映射、场景家族、主文案。
- 高保真模式只替换 `required` 槽，可扩展槽回落原文。
- 自由创意模式保留 `free_must_keep` 映射出的 `mustKeep`，允许 `free_can_change` 范围内重构；用户明确要求高自由度时，至少开放一个结构性维度，例如 `composition_pattern`、场景家族、关系映射或误认对象类别，而不是只替换主体和局部道具。

## 质量检查

生成 `meme-template.json` 前检查：

- `master` 去掉槽位标记并代回原文后，能准确描述模板图或模板风格。
- 每个 `【槽位名：原文】` 都在 `prompt.slots[]` 有对应 `id`。
- 每个槽位都能追溯到 `meme_formula` 的核心变量；如果只是画面道具或渲染细节，应从 `prompt.slots[]` 移除。
- 每个 `image` input 都有 `extract`。
- `free.examples` 为空数组。
- `hifi.useTemplateImage` 有明确判断依据。
- `modes.free.mustKeep` 没有混入只属于高保真的数量、横向队列、镜头、容器或白底锚点，除非 `hifi_free_boundary_reflection` 说明它们是梗成立条件。
- 高自由度请求的 `modes.free.canChange` 明确包含 `composition_pattern` 或同等级结构性开放项。
- 业务可读文本为中文；技术 key、enum、URL、源图可见文字保持原文。
- 批量输出有 `batch.batchId`、`batch.operatorGrouping.folderAsSeries`、每个模板的 `taxonomy`、`generationFit` 和 `ingestion`。
- `batch-manifest.json` 中每个 source 都能追踪到 `templateKey` 或失败/跳过原因。
- 批次内 `key` 唯一，且符合 `<series-or-topic-slug>-<formula-slug>-<short-hash>`。
- `ingestion.sourceSha256` 与 `batch-manifest.json.sources[].sourceSha256` 一致；无法计算时两边都留空并说明。
- `generationFit` 没有使用数值分、星级或“可上线”等替运营裁决的结论。

## Debug 附加

只有 `purpose: debug` 或用户明确要求时，才允许在主 JSON 中加入 `_analysis`，或额外写 `vlm-recognition-mock.json`、`slot-bindings.json`、`prompt-templates.json`、`rendered-prompts.json`。
