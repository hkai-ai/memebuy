# 槽位与视觉设计

## 目录

- Meme 公式与槽位最小化
- Slot 反思
- 输入类型与角色
- 视觉层分解
- 关系与融合分析

## Meme 公式与槽位最小化

先用一句 `meme_formula` 解释梗成立机制，再设计 2-4 个核心业务槽位。槽位是用户自然会修改的变量，不是画面元素清单。容器、镜头、字体、道具和表情先作为候选，再决定暴露、锁定、降为约束或仅写渲染说明。

默认把完整分析写入 `image-edit-analysis.json`：

- `meme_formula`
- `reading_model`
- `slot_minimization_review`
- `slot_reflection_review`
- `co_variation_constraints`
- `fusion_model`
- `variable_slots`

## Slot 反思

生成 `slots[]` 前按顺序检查：

1. `candidate_scan`：覆盖语义、文案、显性视觉变量、构图、图片引用和约束。
2. `user_edit_likelihood`：普通用户是否自然会修改。
3. `visual_salience_check`：颜色、背景、主体色、文字色、主体数量、文字位置和画幅是否遗漏。
4. `template_integrity_check`：改动是否破坏模板公式；会破坏则锁定或降为约束。
5. `frontend_control_check`：能否用现有 input kind 清楚表达。
6. `omission_review`：未暴露项必须标记 `locked_invariant | constraint_only | style_note | too_minor | backend_only`。
7. `semantic_merge_review`：合并表达同一意图、通常同步修改或可从其他输入推导的维度。

`missing_obvious_slots` 应为空，`exposed_slots` 必须与最终 `slots[]` 一致。积极文案、困倦场景和固定困倦表情已经形成反差时，不再默认添加必填 `irony_mood`。

## 输入类型与角色

`inputKind`：

- `text`：短文本替换。
- `prompt`：较长提示词片段。
- `select`：候选选择；允许自定义时最终编译为 prompt。
- `image_upload`：用户上传图。
- `image_select`：素材选择；v1 只支持选项注入文字，不支持把所选图作为运行时参考图。

`slotRole`：

- `semantic_replacement`
- `prompt_fragment`
- `visual_variable`
- `identity_reference`
- `edit_target`
- `style_reference`
- `composition_reference`

文本槽给 3-8 个与原模板同类的 suggestions，默认用 `string[]`。图片槽必须写 `extract`、`maxCount`、`private`、`sourceOptions`。

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
