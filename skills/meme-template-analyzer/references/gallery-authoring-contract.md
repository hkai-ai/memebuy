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
  "templates": []
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
  "output": {
    "size": "1024x1024",
    "n": 1
  }
}
```

## 字段规则

- `key`: 英文小写连字符，模板内稳定。识别不出时从标题语义生成短 key，并在 `index.md` 标注需人工确认。
- `topic`、`title`、`description`: 面向 C 端展示，中文优先。
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
- `output`: 默认 `{ "size": "1024x1024", "n": 1 }`，除非用户或项目规范要求其他值。

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
- 将可替换元素转成 `prompt.master` 里的 `【槽位名：原文】`，再在 `prompt.slots[]` 里声明 `policy` 和 `from`。
- 必须由用户提供或选择的内容用 `required`，例如主体照片、人格选项、主标文本。
- 模板原有但可在自由模式扩展的内容用 `extensible`，例如场景、道具、配色、文案。
- 高保真模式只替换 `required` 槽，可扩展槽回落原文。
- 自由创意模式保留 `mustKeep`，允许 `canChange` 范围内重构。

## 质量检查

生成 `meme-template.json` 前检查：

- `master` 去掉槽位标记并代回原文后，能准确描述模板图或模板风格。
- 每个 `【槽位名：原文】` 都在 `prompt.slots[]` 有对应 `id`。
- 每个 `image` input 都有 `extract`。
- `free.examples` 为空数组。
- `hifi.useTemplateImage` 有明确判断依据。
- 业务可读文本为中文；技术 key、enum、URL、源图可见文字保持原文。

## Debug 附加

只有 `purpose: debug` 或用户明确要求时，才允许在主 JSON 中加入 `_analysis`，或额外写 `vlm-recognition-mock.json`、`slot-bindings.json`、`prompt-templates.json`、`rendered-prompts.json`。
