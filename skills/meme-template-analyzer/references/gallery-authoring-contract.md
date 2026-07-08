# Gallery Template Authoring Contract

本文件用于后台录入、批量入库和 `meme-template.json`。新默认前端图片编辑交付应优先使用 `image-edit-template.json`；后台 authoring 只在用户明确要求入库、批量模板或 seed 脚本时使用。

## Purpose 路由

| purpose | 触发场景 | 主输出 |
| --- | --- | --- |
| `frontend_editing` | 图片编辑方案、前端编辑模板、用户可编辑提示词、用户上传/选择图槽位。 | `image-edit-template.json`，详见 `references/json-contract.md`。 |
| `authoring` | 用户要识别模板内容、批量生成模板、录入后台、产出 gallery template、template-library-entry。 | `meme-template.json`，格式为业务收集 JSON v1。 |
| `debug` | 用户要调试 skill、查看 VLM mock、slot binding、prompt template、legacy rendered prompt。 | 展开中间 JSON 文件和可选 `_analysis`。 |

快速解释、预览或评审模板，默认归入 `frontend_editing`。只有明确要求后台模板时才走 `authoring`。

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

批量场景同时写 `batch-manifest.json`，用于脚本入库和排查。

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
      "note": "legacy compatibility field; not the new front-end default."
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

`modes.hifi`、`modes.free` 和 `generationFit` 是 legacy 兼容字段，用于已有后台或历史批量入库。不要让这些字段决定新 `image-edit-template.json` 的前端编辑体验。

## 字段规则

- `key`: 英文小写连字符，模板内稳定。批量场景使用 `<series-or-topic-slug>-<formula-slug>-<short-hash>`。
- `topic`、`title`、`description`: 面向 C 端展示，中文优先。
- `taxonomy`: 面向搜索、瀑布流、专题页和运营组织，不替代模板本质边界；不确定项写入 `needs_review`。
- `assets.templateImage`: 模板原图或代表图。没有素材 URL 时填本地 artifact 路径或空字符串，并在 `index.md` 标注缺口。
- `inputs`: 后台需要的内容，建议不超过 3 个。新前端槽位应优先写入 `image-edit-template.json.slots[]`。
- `prompt.master`: 完整画面描述，使用 `【槽位名：原文】` 标记可变部分。
- `prompt.slots`: 每个槽写 `id`、`policy` 和 `from`。`policy` 只能是 `required` 或 `extensible`。
- `output`: 默认 `{ "size": "1024x1024", "n": 1 }`。

## 前端编辑模板映射

当同一模板需要给前端使用时，优先输出 `image-edit-template.json`。从后台模板映射到前端编辑模板时：

- `prompt.master` -> `templateText`。
- `prompt.master` 去掉槽位标记并代入默认值 -> `editablePrompt`。
- `prompt.slots[]` -> `slots[]`，每个槽补齐 `inputKind`、`slotRole`、`defaultValue`、`currentValue`、`suggestions` 和 `allowCustom`。
- `inputs[]` 中的图片输入 -> `inputKind: image_upload` 或 `image_select`，并写入 `extract`、`maxCount`、`private`、`sourceOptions`。
- 后台 `modes.hifi/free` 不映射成前端模式开关；如需保留，只写入 `backendHint.notes` 或 legacy 附注。
- 前端必须设置 `allowFullRewrite: true`，允许用户整段删除、重写或只改槽位。

示例：

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
      "suggestions": [{"value": "小猪", "label": "小猪"}],
      "allowCustom": true,
      "required": true
    }
  ]
}
```

## 输入类型

后台 `inputs[]` 可继续使用：

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

`select` 输入可包含 `options[]`。`prompt` 输入可包含 `hint` 和 `suggestions`。如果目标是前端新编辑器，请改用 `image-edit-template.json.slots[]` 的 `inputKind` 和 `slotRole`。

## 从 meme 分析映射到业务 JSON

- 先写一句 `meme_formula`，把梗压缩成 2-4 个核心变量；再把这些变量转成 `prompt.master` 里的 `【槽位名：原文】`。
- `prompt.slots[]` 不是画面元素清单。容器、工具、姿势、镜头、表情、字体、风格、局部道具等默认属于锁定描述、默认渲染或生成约束。
- 默认控制在 2-4 个业务槽位。超过 4 个时必须先合并到更高层变量。
- 每个槽位都能追溯到 `meme_formula` 的核心变量；如果只是画面道具或渲染细节，应从 `prompt.slots[]` 移除。
- 每个 `image` input 都有 `extract`。

## Taxonomy 候选

- `category`: 梗机制或模板类型，category 控制在 20-40 个左右。优先使用误读揭示、角色贴标签、对比、反应图、物体融合、聊天截图、多格叙事、前后变化等大类。
- `templateMechanism`: 从 `meme_formula` 推导的更具体模板机制，用于判断是否属于同一个模板簇，例如 `food-fusion`、`hidden-reveal`、`caption-reversal`。
- `scenes`: 家庭、办公室、餐桌、街头、校园、社媒、头像、聊天、节日、旅行、商品展示。
- `topics`: 宠物、情侣、儿童、亲子、闺蜜、职场、游戏、美食、魔法、治愈、反差、搞笑、日常、复古、天气、运动、商品、包装、截图。
- `styles`: 手绘、水彩、油画、彩铅、复古、极简、低饱和、可爱、写实照片、截图风、3D、像素风。
- `emotions`: 可爱、治愈、荒诞、松弛、温暖、困惑、尴尬、惊喜、反差、呆萌。
- `useCases`: 头像、表情包、朋友圈配图、小红书封面、聊天配图、节日祝福图、运营活动图。
- `needs_review`: 待确认项列表，记录自动聚类、模板边界、OCR、category 或 topics 中需要用户/运营确认的原因。

## 批量预审

批量 authoring 前必须先做批量预审。预审报告至少覆盖：

- 图片数量、有效格式、尺寸异常、路径层级、平铺程度、是否已有每张源图独立文件夹。
- 重复图、缩略图、生成结果、截图副本、非源图或无法读取文件。
- 初步自动聚类结果：模板簇候选、每簇代表图、置信度、可能的 `category`、`templateMechanism` 和待确认原因。
- 建议结构：按模板簇组织，但每张源图独立工作目录，例如 `<template-cluster>/<source-id>/source.<ext>`。

如果一个文件夹中平铺大量图片，且自动聚类显示可能包含多个模板或分类，先让用户确认分组策略，再移动文件或开始批量模板输出。

## Key 规范

批量模板 key 使用：

```text
<series-or-topic-slug>-<formula-slug>-<short-hash>
```

规则：

- 只使用小写英文、数字和连字符。
- `series-or-topic-slug` 优先来自文件夹/系列名；没有时来自主要 topic 或 scene。
- `formula-slug` 来自 `meme_formula`。
- `short-hash` 使用源文件 hash 或源路径 hash 的前 6 位。
- 批次内 key 必须唯一。

## Generation Fit

`generationFit` 只作为 legacy 后台兼容字段，不输出数值分，不替运营做上线裁决。新前端编辑模板不需要用户选择高保真或自由模式。

## 质量检查

生成 `meme-template.json` 前检查：

- `master` 去掉槽位标记并代回原文后，能准确描述模板图或模板风格。
- 每个 `【槽位名：原文】` 都在 `prompt.slots[]` 有对应 `id`。
- 每个槽位都能追溯到 `meme_formula` 的核心变量。
- 每个 `image` input 都有 `extract`。
- 批量输出有 `batch.batchId`、`batch.operatorGrouping.folderAsSeries`、每个模板的 `taxonomy`、`generationFit` 和 `ingestion`。
- `batch-manifest.json` 中每个 source 都能追踪到 `templateKey` 或失败/跳过原因。
- `ingestion.sourceSha256` 与 `batch-manifest.json.sources[].sourceSha256` 一致；无法计算时两边都留空并说明。

## Debug 附加

只有 `purpose: debug` 或用户明确要求时，才允许在主 JSON 中加入 `_analysis`，或额外写 VLM mock、slot bindings、prompt templates、rendered prompts 等 legacy 中间文件。
