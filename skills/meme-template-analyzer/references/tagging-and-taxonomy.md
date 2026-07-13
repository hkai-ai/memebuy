# 标签词库与来源

标签同时区分层级与来源。不要用“大标签/小标签”代替来源，也不要把 Pinterest、Instagram、Tumblr 的原始标签伪装成 AI 推断。

## 输入

批量管理台会提供：

- `tag-catalog.snapshot.json`：当前批次的运营词库快照。
- 锁定 `tagAssignments`：分组已选择的运营大类和模板固定标签。
- 可选旧版 `category`、`tags`：只作兼容输入，按 `operator` 处理，不覆盖结构化标签。

必须读取词库快照。`operator` 和 `template` 分配属于锁定事实，原样复制到草稿顶层 `tagAssignments[]`；不要删除、改名、降级为 `suggested`，也不要让 AI 生成同义项覆盖它们。

## 层级与来源

`level`：

- `category`：场景、主题、风格、情绪、用途等运营大类。
- `tag`：主体、动作、视觉细节、模板机制等细标签。

`source`：

- `operator`：业务人员选择或补录。
- `template`：模板固定机制标签。
- `ai`：模型根据图片内容推断。
- `external`：素材来源平台携带的原始标签；必须写 `provider`。

Pinterest、Instagram、Tumblr 原始标签使用 `external`。只有模型自行看图生成的描述才使用 `ai`。

## TagAssignment

```json
{
  "tagId": "scene.pet",
  "label": "宠物",
  "dimension": "scene",
  "level": "category",
  "source": "operator",
  "status": "accepted",
  "confidence": 0.94,
  "provider": "pinterest",
  "evidence": "画面主体为家养猫"
}
```

规则：

- `label`、`dimension`、`level`、`source`、`status` 必填。
- 词库标签写稳定 `tagId`；AI 自由细标签和旧版人工补录可省略。
- `operator`、`template` 必须为 `accepted`。
- `external` 必须写 `provider`，保留原文，不翻译后冒充原始标签。
- `confidence` 只用于 `ai`，范围 `0-1`；没有可信依据时写 `suggested`。
- AI 大类只能从 `aiAssignable: true` 的已启用词库项选择。
- AI 可生成少量自由细标签，默认最多 12 个，避免把画面元素清单全部标签化。
- 同一来源、同一 `tagId` 或同一规范化 label 去重。

## taxonomy 与扁平兼容

草稿 `taxonomy` 保留已接受的大类，按维度组织，例如：

```json
{
  "scene": ["宠物"],
  "theme": ["反应图"],
  "style": ["复古"],
  "emotion": ["尴尬"],
  "useCase": ["聊天回复"],
  "needs_review": []
}
```

转换后：

- `metadata.taxonomy` 保留结构化大类。
- `metadata.tagAssignments` 保留全部来源、状态、置信度和平台。
- `metadata.tags` 铺平 taxonomy 非空值和所有 `accepted` assignment label，供现有搜索兼容。
- `suggested`、`rejected` 不进入 `metadata.tags`。

词库没有匹配的大类时不要自创新的大类 ID。保留 AI 自由细标签，必要时写入审核原因，交由运营在“标签词库”中新增后重跑或补录。
