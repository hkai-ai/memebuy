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

## Debug 附加

只有 `purpose: debug` 或用户明确要求时，才允许在主 JSON 中加入 `_analysis`，或额外写 `vlm-recognition-mock.json`、`slot-bindings.json`、`prompt-templates.json`、`rendered-prompts.json`。
