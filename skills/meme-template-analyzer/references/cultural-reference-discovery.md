# 文化参照发现与公式审计

## 目标

在设计槽位前判断图片是否引用名画、影视、游戏、动漫、广告、人物照片、既有 meme 或地区文化。流程的目标不是强行找到出处，而是避免把“没有识别出来”误写成“没有参照”。

## 五步流程

1. `visual_observations`：只写可直接观察的主体、道具、服饰、姿态、视线、裁切、文字、媒介和空间关系，不写出处解释。
2. `distinctive_feature_bundle`：选择 3-8 个同时出现且最有区分度的特征组合。组合证据优先于孤立元素。
3. `interpretation_hypotheses`：至少比较 `external_reference`、`intrinsic_visual_joke`、`standalone_image` 三类解释；无证据的候选可以低分，但不能跳过类别。
4. `reference_discovery`：记录参照状态、类型、候选、证据、反证和是否需要检索。
5. `formula_reflection_review`：审计最终公式是否解释最独特的组合、是否只是泛化复述、是否锁定文化识别锚点。

## 参照状态

- `confirmed`：可靠来源或用户上下文明确确认。
- `probable`：多个独特特征高度吻合，且明显优于其他解释。
- `suspected`：存在具体候选，但证据不足或有明显冲突。
- `none`：完成三类假设比较后，证据支持它是独立图片。
- `unknown`：疑似存在外部语境，但当前无法形成可靠候选。

`none` 必须有 `none_evidence`。`unknown` 和 `suspected` 必须设置 `human_review_required: true`，并写非空 `review_reasons`。不要为了完成模板而降低不确定性。

## 参照类型

使用 `artwork | film | television | game | anime | celebrity | advertisement | internet_meme | regional_culture | none | unknown`。一个图片含多重引用时，候选可以有多个类型，最终 `reference_discovery.reference_type` 写主导类型。

## 假设比较

每个候选至少写：

- `kind`：三类解释之一。
- `claim`：一句可证伪的解释。
- `explains[]`：能解释的独特特征。
- `unexplained[]`：无法解释或冲突的特征。
- `assumptions[]`：必须额外假设的内容。
- `confidence`：0-1。

优先选择覆盖关键特征最多、额外假设最少的解释。必须回答：“为什么这些独特元素恰好同时存在？”只复述“动物戴了首饰”“人物表情奇怪”属于高泛化风险。

## 检索升级

当状态为 `unknown/suspected`，或两个候选置信度差小于 0.15 时，允许联网则检索；用户明确禁止联网时直接进入人审。检索词使用区分性组合、可见原文、角色名或作品媒介，不使用宽泛词。

优先顺序：

1. 可见文字、标题、文件名和用户上下文。
2. 区分性组合关键词。
3. 作品、角色、镜头或游戏 UI 的官方资料和可靠数据库。
4. 图片搜索或反向图片线索。

检索结果只改变参照置信度，不覆盖可见事实。找不到不等于 `none`。

## 非梗图片

允许 `content_function` 为 `meme_template | reaction_image | cute_pet | aesthetic_image | ordinary_photo | original_visual_joke | unknown`。如果是单纯萌宠或普通照片，`meme_formula` 可以为 `null`；只有用户明确要求模板化时，才另行设计可编辑机制。

## 文化识别锚点

`reference_anchors[]` 是维持出处可识别性的最小特征集合。名画姿态、电影镜头、游戏 HUD、角色标志物或固定文案通常应是 `locked_invariant` 或 `constraint_only`，不能全部变成自由槽位。角色替换型戏仿通常只开放替换角色，保留原作构图与图像符号。

## 分项置信度

分别记录：

- `visual_observation`
- `reference_identification`
- `context_understanding`
- `meme_formula`
- `slot_design`

看清图片不等于知道出处；知道出处也不等于掌握传播语境。任何一项低置信度都只能影响对应结论，不得用整体高置信度掩盖。

## 公式前提门禁

`formula_reflection_review` 至少包含：

- `distinctive_bundle_explained: boolean`
- `alternative_hypotheses_compared: boolean`
- `generic_description_risk: low | medium | high`
- `reference_anchors_identified: string[]`
- `unknown_as_none_risk: low | medium | high`
- `passed: boolean`
- `review_reasons: string[]`

只有 `passed: true` 才进入槽位设计。`unknown/suspected` 可以完成 DRAFT 模板，但必须保留待审核原因；`generic_description_risk: high` 或 `distinctive_bundle_explained: false` 时不得声称理解完成。
