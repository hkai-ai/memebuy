# 普通标签与来源

管理台的标签词库只维护扁平、具体的普通 tags，不承担场景、主题、用途或模板机制分类。词库中的 `group` 仅用于整理 8 组风格标签和 4 组情绪标签，不是标签，也不写入 `taxonomy` 或 `metadata.tags`。不要把 Pinterest、Instagram、Tumblr 的原始标签伪装成 AI 推断。

## 输入

批量管理台会提供：

- `tag-catalog.snapshot.json`：当前批次的普通标签词库快照。
- 锁定 `tagAssignments`：分组已选择的人工普通标签。
- 可选旧版 `category`、`tags`：只作兼容输入，按 `operator` 处理，不覆盖结构化标签。

必须读取词库快照。锁定的 `operator` 分配属于人工事实，原样复制到草稿顶层 `tagAssignments[]`；不要删除、改名、降级为 `suggested`，也不要让 AI 生成同义项覆盖它们。

匹配词库标签时使用具体词条的 `id`、`label` 和 `aliases`；不要把 `group` 当成可分配标签。

## 层级与来源

管理台词库标签统一写 `level: "tag"`、`dimension: "manual"`。`category` 仅用于读取历史产物，不再由当前管理台创建。

`source`：

- `operator`：业务人员选择或补录。
- `template`：历史模板固定标签来源，仅兼容读取；当前管理台不再创建。
- `ai`：模型根据图片内容推断。
- `external`：素材来源平台携带的原始标签；必须写 `provider`。

Pinterest、Instagram、Tumblr 原始标签使用 `external`。只有模型自行看图生成的描述才使用 `ai`。

## TagAssignment

```json
{
  "tagId": "tag.lolcat",
  "label": "lolcat",
  "dimension": "manual",
  "level": "tag",
  "source": "operator",
  "status": "accepted"
}
```

规则：

- `label`、`dimension`、`level`、`source`、`status` 必填。
- 词库标签写稳定 `tagId`；AI 自由细标签和旧版人工补录可省略。
- 管理台锁定的 `operator` 标签必须为 `accepted`。
- `external` 必须写 `provider`，保留原文，不翻译后冒充原始标签。
- `confidence` 只用于 `ai`，范围 `0-1`；没有可信依据时写 `suggested`。
- AI 可生成少量自由细标签，默认最多 12 个，避免把画面元素清单全部标签化。
- 同一来源、同一 `tagId` 或同一规范化 label 去重。

## 扁平兼容

不要为了填充 `taxonomy`，把人工普通标签强行映射成场景、主题、风格、情绪、用途或模板机制。只有输入已经带有可信结构化 taxonomy 时才原样保留；否则允许省略或保持空结构。

转换后：

- `metadata.taxonomy` 仅保留输入中已有的可信结构化数据。
- `metadata.tagAssignments` 保留全部来源、状态、置信度和平台。
- `metadata.tags` 铺平 taxonomy 非空值和所有 `accepted` assignment label，供现有搜索兼容。
- `suggested`、`rejected` 不进入 `metadata.tags`。

AI 标签不需要先进入人工词库。对低置信度识别使用 `suggested` 或写入审核原因，不要为了套分类而自创大类。
