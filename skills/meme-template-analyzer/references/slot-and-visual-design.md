# 槽位与视觉设计

## 目录

- Meme 公式与槽位最小化
- 组件图与编辑意图
- Slot 反思
- 输入类型与角色
- 视觉层分解
- 关系与融合分析

## Meme 公式与槽位最小化

先按 `cultural-reference-discovery.md` 完成参照发现和 `formula_reflection_review`，再用一句 `meme_formula` 解释梗成立机制并设计 2-4 个核心业务槽位。槽位是用户自然会修改的变量，不是画面元素清单。容器、镜头、字体、道具和表情先作为候选，再决定暴露、锁定、降为约束或仅写渲染说明。

文化识别锚点优先视为 `locked_invariant` 或 `constraint_only`。角色替换型戏仿中，原作姿态、构图、标志道具和固定文案通常属于模板权限；不要把它们泛化成可自由替换的“造型”或“风格”槽。

默认把完整分析写入 `image-edit-analysis.json`：

- `component_graph`
- `edit_intent_candidates`
- `slot_intelligence_review`
- `meme_formula`
- `reading_model`
- `slot_minimization_review`
- `slot_reflection_review`
- `co_variation_constraints`
- `fusion_model`
- `variable_slots`

## 组件图与编辑意图

槽位从可指认组件及其可编辑属性产生。先建立 `component_graph.components[]`，每个组件至少写：

- `id`：稳定、具体的组件 id，例如 `headline`、`pet_subject`、`outfit`、`outer_background`、`notebook_art_region`。
- `type`：`canvas | subject | text | accessory | apparel | background | container | embedded_content | decoration | object | panel`。
- `parentId`：父组件；根画布使用 `null`。
- `visibleEvidence[]`：支持该组件存在的可见证据。
- `editableProperties[]`：用户可能修改的具体属性，例如 `text`、`identity`、`color`、`garment`、`image_content`。
- `lockedProperties[]`：需要维持的几何、关系或识别属性。

再为每个显著可编辑属性建立 `edit_intent_candidates[]`：

- `id`
- `componentId`
- `property`
- `operation`：`replace_identity | replace_text | replace_image | recolor | restyle | change_apparel | change_accessory | change_background | stylize_and_embed | adjust_layout`。
- `userEditLikelihood`、`visualSalience`：0-1。
- `templateIntegrityRisk`：`low | medium | high`。
- `frontendControl`：对应 `text | prompt | select | image_upload | subject`。
- `decision`：`expose | locked_invariant | constraint_only | style_note | too_minor | backend_only`。
- `slotId`：仅 `expose` 时必填，必须与最终 `slots[]` 对齐。
- `reason`：说明开放或不开放的依据。

像素只能提供“用户可能想改什么”的证据。优先使用以下产品先验：

1. 海报：主体、主标题、次级文字、整套配色常可编辑；版式层级和装饰位置通常保留。
2. 角色穿搭：身份、服装、配饰分别评估；配饰只有参与文化识别或梗公式时才锁定。
3. 嵌套内容：外层背景、容器颜色、页内/屏幕内内容分别建组件；需要文字与图片双输入时使用 `subject`。
4. 文字卡片：文字内容优先于宽泛主体槽；纸张、箭头和排版节奏通常保留。
5. 拼贴/网格：照片内容、中心意象和配色可开放；网格、遮挡和阅读顺序优先保留。
6. 物体融合：被融合的身份与容器/食物/服饰分开评估，并记录重映射关系。

禁止把下列组合作为批量默认答案：`subject + scene + style + caption`。`scene`、`style`、`caption` 只有在绑定具体组件和属性时才可保留；优先使用 `background`、`outfit`、`accessory`、`headline`、`palette`、`embedded_art` 等业务名称。

`slot_intelligence_review` 至少包含：

- `mechanismClass`
- `selectedSlotIds[]`
- `genericSlotReuseRisk`
- `componentCoveragePassed`
- `textSlotAuditPassed`
- `compositeInputAuditPassed`
- `passed`
- `reviewReasons[]`

`mechanismClass` 必须由非循环的可见证据支持。`reaction_portrait` 至少要在主体证据中出现头像、面部、头部、表情、肖像或特写；“画面呈现 reaction_portrait 结构”不构成证据。单条鱼、单件物品或普通全身角色不得仅因单主体构图套用该机制。机制名只用于分析分类，不生成带序号的 `preserve` 项，也不决定面板数量。

## Slot 反思

生成 `slots[]` 前按顺序检查：

1. `candidate_scan`：覆盖语义、文案、显性视觉变量、构图、图片引用和约束。
2. `user_edit_likelihood`：普通用户是否自然会修改。
3. `visual_salience_check`：颜色、背景、主体色、文字色、主体数量、文字位置和画幅是否遗漏。
4. `template_integrity_check`：改动是否破坏模板公式；会破坏则锁定或降为约束。
5. `frontend_control_check`：能否用现有 input kind 清楚表达。
6. `omission_review`：未暴露项必须标记 `locked_invariant | constraint_only | style_note | too_minor | backend_only`。
7. `semantic_merge_review`：合并表达同一意图、通常同步修改或可从其他输入推导的维度。
8. `component_binding_review`：每个槽位必须绑定一个组件和具体属性；无法绑定则降级或删除。
9. `mechanism_specificity_review`：槽位名称和控件必须体现当前模板机制，避免跨图片复用宽泛字段。

`missing_obvious_slots` 应为空，`exposed_slots` 必须与最终 `slots[]` 一致。积极文案、困倦场景和固定困倦表情已经形成反差时，不再默认添加必填 `irony_mood`。

显著文字组件必须有对应候选，允许开放、锁定或降级，但不得静默遗漏。没有可见文字组件时，不得习惯性增加 `caption`。

## 输入类型与角色

`inputKind`：

- `text`：短文本替换。
- `prompt`：较长提示词片段。
- `select`：候选选择；允许自定义时最终编译为 prompt。
- `image_upload`：用户上传图。
- `image_select`：素材选择；v1 只支持选项注入文字，不支持把所选图作为运行时参考图。
- `subject`：复合主体输入；同一前端控件支持预设、自由文本和图片上传，最终编译为 Gallery v2 的 `subject`。

`slotRole`：

- `semantic_replacement`
- `prompt_fragment`
- `visual_variable`
- `identity_reference`
- `edit_target`
- `style_reference`
- `composition_reference`

文本槽给 3-8 个与原模板同类的 suggestions，默认用 `string[]`。图片槽必须写 `extract`、`maxCount`、`private`、`sourceOptions`。

候选项沿同一语义轴展开：人物身份只提供人物，宠物身份只提供宠物，穿着只改变服装，配色只描述色彩系统。每个槽位记录 `semanticType`；禁止用“复古版本”等风格版本名填充与风格无关的槽位。

`subject` 另记录面向用户的 `defaultStateLabel`、`textInputLabel` 和 `uploadLabel`。例如人物槽可使用“保留原人物 / 或用文字描述人物 / 上传人物图”，背景内容槽使用“保留原背景 / 或用文字描述背景 / 上传背景图”。

主体一旦允许上传图片，不要再创建互相独立、用户难以理解的“主体文本”和“主体参考图”两个控件；优先使用 `subject`。图片存在时 `resolutionStrategy` 固定为 `image_over_text`，`imagePromptValue` 使用“用户上传图中的主体”等中性描述，禁止重复默认的猫、狗、人物或商品身份。

背景、页内画作、屏幕内容和包装图案也可使用 `subject` 复合输入。此时 `slotRole` 可为 `composition_reference` 或 `edit_target`，`imagePromptValue` 使用“用户上传图中的外层背景环境”“用户上传图中的页内绘画内容”等角色化中性描述；`extract` 必须说明文字模式、图片模式、目标区域和风格转换。

## 视觉层分解

颜色分析前先区分：

- `canvas_background`：铺满画布、位于所有元素后的底色或场景。
- `frame_border`：沿画布或内容容器边缘形成的闭合/连续外框。
- `subject_outline`：贴合主体轮廓的描边、剪纸白边、阴影或贴纸边。
- `content_panel`：报纸、卡片、对话框等局部前景容器。

记录每层范围、是否闭合、与主体/画布边缘的关系。背景与边框可独立变化时分为 `background_color` 和 `border_color`/`border_style`；需要协调时合并为 `palette` 或 `surface_style`，并记录同步规则。

不要因参考图存在边框就锁死。只有边框参与梗结构、遮挡或阅读顺序时才设为 `locked_invariant`。测试改变背景时，明确边框/描边是保持、同步变化还是独立变化。

## 关系与融合分析

`co_variation_constraints` 记录跨槽同步关系，每条包含 `source_slot`、`dependent_slot`、同步规则、失配风险和 QA。

`fusion_model` 判断主体是否与物件、文字、UI、场景或身体结构融合，记录 `fused_slots`、`replacement_sensitivity` 和 `requires_remap_if_subject_changes`。替换主体会影响姿势、遮挡、道具或文字关系时，必须列出 remap 目标。
