---
name: meme-template-analyzer
description: Use when 需要分析 meme 图片、截图、图片 URL 或 meme 创意，并产出可复用模板、槽位绑定、提示词包、稳定性测试集、文字笑点分析、背景说明或批量模板库。
---

# Meme Template Analyzer

## 核心目标

把 meme 拆成可复用的模板、变量槽、阅读模型、风格约束和 prompt-ready artifact。除非用户要求或策略必须拒绝，不要静默净化、替换主体，或重写用户看起来想保留的元素。

默认输出简体中文。JSON key、路径、mode、enum、placeholder、命令、hash、URL、模型名，以及 meme 中检测到的原文保持原样。

## 按需读取

入口文件只保留执行路由和硬规则；需要细节时读取这些文件：

| 文件 | 何时读取 |
| --- | --- |
| `references/gallery-authoring-contract.md` | 非测试、非调试场景；需要识别模板内容、批量生成模板、录入后台或输出 `meme-template.json`。 |
| `references/json-contract.md` | 需要 prompt contract、prompt pack、内部分析结构、compare 输出、严格 schema 或下游处理字段。 |
| `references/stability-testset-contract.md` | 用户要求 `stability-testset`、稳定性测试、reference test matrix 或 high-fidelity/free-creative 测试案例。 |
| `scripts/validate_stability_testset.py` | 写入或收到 `stability-testset.json` 后验证参考图追踪完整性。 |

不要把 reference 文件里的 schema 大段复制到聊天里。默认写入 artifact 文件，只向用户报告路径和简短验证结果。

## 输出语言

所有面向用户或业务人员可读的内容默认写中文：

- `index.md`、聊天摘要、进度报告。
- JSON 中的自由文本 value，例如摘要、限制、警告、prompt、criteria、示例、风险和后处理说明。
- 渲染后的 prompt 文本，除非用户明确要求给下游图像模型使用英文 prompt。

以下内容保持技术原文：

- JSON key、JSONPath、mode、enum、placeholder、文件名、路径、命令、hash、URL。
- 源 meme 上可见文字；可另加中文解释或翻译。
- 用户要求保留原语言的替换文本。

完成前检查业务可读 artifact 是否为中文。

## Purpose 路由

先判断用户目的，再决定输出格式：

| Purpose | 触发场景 | 默认输出 |
| --- | --- | --- |
| `authoring` | 识别模板内容、批量生成模板、录入后台、生成 gallery template、template-library-entry。 | `meme-template.json`，使用 Gallery Template Authoring JSON v1。 |
| `validation` | 测试规范、高保真/自由创意是否符合预期、稳定复现、negative controls、真实生成图。 | `stability-testset.json`、`prompt-pack.json`、`output/` 按请求组合。 |
| `debug` | 调试 skill、查看 VLM mock、槽位绑定、prompt 模板、rendered prompt 或完整 pipeline。 | 展开中间 JSON 和可选 `_analysis`。 |

快速解释、预览或评审模板归入 `authoring`，可以只写 `index.md` 或简短摘要；不要另设第四类目的。

## Artifact 规则

默认创建结果目录，而不是在聊天里倾倒 JSON：

1. 工作区可写时使用 `artifacts/meme-template-analyzer/<template_id-or-timestamp>/`。
2. 否则使用 `$CODEX_HOME/generated_artifacts/meme-template-analyzer/<template_id-or-timestamp>/`。
3. 默认使用紧凑交付，只写用户需要的主产物：
   - `index.md`
   - `meme-template.json`，用于 authoring，格式为 Gallery Template Authoring JSON v1
   - `prompt-pack.json`，用于 prompt contract、render-prompts 或 render-prompt-pack 输出
   - `stability-testset.json`，仅在用户要求测试集时写
   - `output/`，仅在用户要求真实生成结果、mock 用户侧输出、测试输出图或结果图时创建
4. 只有用户要求完整 pipeline、debug、严格分步产物、下游系统按分文件读取，或需要排查中间步骤时，才额外写：
   - `vlm-recognition-mock.json`
   - `normalized-input.json`
   - `slot-bindings.json`
   - `prompt-templates.json`
   - `rendered-prompts.json`

如果用户明确要求内联 JSON，只返回合法 JSON；不要用 Markdown 代码块包裹，也不要在 JSON 外解释。不确定性、限制和后处理需求写入字段。

## Mode 路由

从用户请求推断 `mode`，优先遵循用户明确指定：

| Mode | 用途 |
| --- | --- |
| `analyze` | 描述源 meme，不生成可复用变体。 |
| `template` | 默认 authoring 模式，输出可录入后台的业务收集 JSON。 |
| `variants` | 基于模板生成 faithful 和 creative 变体规则。 |
| `prompt-contract` | 为图像生成系统产出 prompt-ready JSON 约束。 |
| `render-prompts` | 标准化用户输入、绑定变量并渲染 faithful/creative prompts。 |
| `batch` | 将多个 meme 分析为批量业务收集 JSON。 |
| `compare` | 比较多个 meme，提取共享公式、差异和系列方向。 |

命令别名：

| Command | 输出 |
| --- | --- |
| `render-prompt-pack` | 紧凑 prompt pack；用户要求 debug 或分步产物时再展开完整 pipeline。 |
| `stability-testset` | high-fidelity 与 free-creative 稳定性测试集。 |
| `template-library-entry` | 可录入后台的 Gallery Template Authoring JSON。 |

## 标准工作流

1. 加载用户提供的图片、截图、URL、本地路径、纯文字创意或批量集合。访问失败时写入 `source_access.limitations`。
2. 先形成 VLM recognition mock：识别主体、物体、场景、可见文字、构图、风格线索、幽默信号、不确定性和下游映射候选。默认内嵌到主 JSON；只有展开 pipeline 时才单独写 `vlm-recognition-mock.json`。
3. 将 meme 分类为 `image_driven`、`text_driven` 或 `hybrid`。
4. 提取可见文字，保留原文、语言、大小写、位置、换行和字体处理。
5. 建立 meme 阅读模型：`first_read`、`second_read`、`reading_order`、`misdirection_or_reinterpretation`、`salience_model`、`role_mapping`、`failure_modes`。image-driven 和 hybrid 必须包含；纯文字 meme 用阅读顺序和修辞模型表达。
6. 分析笑点机制：铺垫、预期、转折、包袱、情绪驱动、受众知识，以及图文组合为什么成立。
7. 记录语言、俚语、公共事件、平台语境或已知 meme 格式。不要编造起源；证据弱时写 `unknown` 和置信度。
8. 先压缩出一句 `meme_formula`：用抽象变量描述梗为什么成立，例如“【主体】因为像【食物】而处在【误认关系】中”。这一步必须先于 slot 设计；不要从画面物体清单直接建槽。
9. 从 `meme_formula` 推导 `core_variable_slots`。业务槽位只保留用户自然会改、会改变梗主题、属于公式核心变量，或必须与其他核心变量联动的项。
10. 把容器、工具、姿势、镜头、表情、文字位置、风格等非核心画面元素降级为 `locked_constraints`、`default_rendering`、`style_constraints` 或 debug 分析层；除非用户明确要编辑它们，默认不要放进 `prompt.slots[]`。
11. 提取可用于 prompt 的设计特征：构图、裁切、主体角色、表情、姿势、镜头、色彩、纹理、文字位置、字体、视觉层级、artifact 和风格。
12. 执行关系不变量反思，提取 `co_variation_constraints`：找出核心变量之间的视觉押韵和共同变化规则，例如主体与食物的颜色、明度、材质相近，文字标签与表情互相解释，截图 UI 与文案位置互相绑定。不要把共同变化规则拆成额外业务槽位。
13. 提取 `fusion_model`：判断主体是否和食物、物件、文字、UI、场景或身体结构融合成一个不可独立替换的结构，并记录 `fused_slots`、融合类型、`replacement_sensitivity` 和主体变化时是否必须重映射。
14. 执行 `remix_suitability` 判断：先基于 `fusion_model` 和 `co_variation_constraints` 评估源 meme 是否适合高保真主体替换，再决定使用 high-fidelity、creative remap、两者都生成，或明确不建议高保真。这个判断必须基于源模板本身和用户目标之间的兼容性，不能把 creative remap 的新隐喻倒灌进源模板分析。
15. 执行 `hifi_free_boundary_reflection`：把约束分成 `hifi_must_keep`、`free_must_keep` 和 `free_can_change`。高保真可以锁定源图构图锚点；自由创意只锁笑点公式、阅读顺序、关系不变量和融合逻辑。不要把三连队列、固定数量、白底、容器、镜头或具体 `composition_pattern` 自动放进 `free_must_keep`，除非它们本身就是梗成立条件。
16. 建立变量槽，并为每个槽标记 `locked`、`faithful_editable`、`creative_editable` 或 `fully_editable`。先做 `slot_minimization_review`：如果一个槽只是实现公式的道具、容器、动作细节或风格锚点，把它移出业务槽位；如果用户要求自由创意，可把 `misread_target`、`fusion_context`、`composition_pattern`、`reveal_cue` 或参照物数量作为 creative-only 控制项。
17. 先锁定模板元属性、`meme_formula`、`co_variation_constraints`、`fusion_model`、`remix_suitability` 和 `hifi_free_boundary_reflection`，再开放 creative 维度。`creative_level` 是槽位开放预算，不是重新设计 meme 的许可。
18. 判断参考图策略，区分分析参考和生成参考。
19. `authoring` 场景读取 `references/gallery-authoring-contract.md`，把分析中间层转换成业务收集 JSON：`key/topic/title/description/assets/inputs/prompt/modes/output`。
20. 用户要求 prompt、提供目标内容、要求无参考图生成或 `render-prompt-pack` 时，构建 `generation_pipeline`，并默认写入 `prompt-pack.json`；只有展开 pipeline 时才拆出中间 JSON。
21. 同时区分 `faithful_variant` 和 `creative_variant`。二者共享 base template；faithful 改更少槽，creative 开放更多可编辑维度，但不得打破 `meme_formula`、`co_variation_constraints`、`fusion_model`、`remix_suitability` 或 `hifi_free_boundary_reflection` 结论。
22. 用户要求稳定性测试时读取 `references/stability-testset-contract.md`，写入 `stability-testset.json` 并运行 validator。
23. 用户要求真实输出图、测试生成结果或展示 results/images 时，优先使用可用图像生成工具产出真实 PNG/JPEG，并保存到 `<result_directory>/output/`。生成图 QA 必须检查跨槽关系、融合关系和 remix 适配性是否成立，而不是只检查主体、道具、文字等元素是否出现；如果用户要求高自由度，还要检查 `composition_pattern` 是否真的允许重构，不能只换皮复用高保真构图。
24. 记录风险和约束；除非用户要求安全替代方案或策略阻断，否则不要默认替换用户主体。
25. 写入 artifact，回复中列出结果目录、关键文件路径和验证情况。

## 模板纪律

分析中间层必须足够支持业务录入 JSON，但默认不要把它们作为 `meme-template.json` 主格式暴露给运营。每个模板至少分析出：

- `meme_formula`：一句话说明梗成立的抽象机制，使用 2-4 个核心变量表达。先写公式，再抽槽位。
- `variable_slots`：稳定 `slot_id`、笑点角色、源值、faithful/creative 可改范围、`lock_level` 和下游提示。
- `slot_minimization_review`：说明哪些候选元素被保留为核心变量，哪些被降级为约束或默认渲染。业务槽位不是画面元素清单。
- `template_alignment`：锁定元属性、可编辑维度、主体形态逻辑、拟人化程度、文字存在性、构图关系、阅读顺序、显著性和失效模式。
- `prompt_style_profile`：不要只写 "anime"、"photo"、"cartoon" 或 "screenshot"。必须描述媒介、渲染方法、线条/形状、色彩/光照、材质纹理、镜头/景深、字体处理和负向风格漂移。
- `reading_model`：观众第一眼看到什么、第二眼重新解释什么、注意力如何移动、哪些元素主导/微妙/隐藏/误导，以及哪些修改会破坏笑点。
- `co_variation_constraints`：记录核心变量之间的共同变化规则。每条必须说明 `source_slot`、`dependent_slot`、依赖维度、同步规则、不同步时的失败方式和生成 QA 标准。尤其检查颜色、明度、材质、形状、尺寸、位置、文字指代、动作方向和语义标签是否需要联动。
- `fusion_model`：识别主体是否与食物、物件、文字、UI、场景或身体结构融合。必须说明 `has_fused_subject`、`fusion_type`、`fused_slots`、`replacement_sensitivity`、主体是否能独立替换，以及 `requires_remap_if_subject_changes`。这用于区分“主体旁边有道具”和“主体本身就是道具/食物结构的一部分”。
- `remix_suitability`：判断模板是否适合高保真主体替换、是否应改用 creative remap、哪些替换会让梗失效，以及是否应该直接告诉用户“不建议高保真替换”。尤其对“主体与食物/物件融合”“主体颜色/材质就是笑点”“第一眼误读依赖源主体”的梗，必须先评估目标主体和源依赖槽是否兼容。
- `hifi_free_boundary_reflection`：生成高保真或自由创意前的边界反思。必须分别写出 `hifi_must_keep`、`free_must_keep` 和 `free_can_change`，并说明哪些源图锚点只属于高保真，哪些才是自由创意也必须保留的梗成立条件。`composition_pattern`、参照物数量、容器、背景和镜头通常先视为高保真锚点或 `free_can_change`，除非阅读模型证明它们是转折本身。
- `faithful_variant` 和 `creative_variant`：两者必须从同一个 base template 派生，不能写成两个无关 prompt。

优先使用少量高层槽类目，例如 `subject`、`target_object`、`relationship`、`caption`、`role_mapping`、`punchline`、`audience_assumption`、`reveal`、`misdirection`。`setting`、`gesture`、`expression`、`camera`、`crop`、`color`、`typography`、`layout`、`texture`、`platform_artifact` 等通常是约束或默认渲染；只有它们本身就是梗公式变量，或用户明确要编辑时，才提升为业务槽位。

`authoring` 输出时，把这些分析结果映射为 Gallery Template Authoring JSON v1：

- `prompt.master` 使用自然语言完整描述，并用 `【槽位名：原文】` 标记变量。
- `prompt.slots[]` 只写业务可理解的 `id`、`policy`、`from`，`policy` 为 `required` 或 `extensible`。
- `inputs[]` 只写用户需要提供的内容；图片输入必须写 `extract`。
- 默认把 `prompt.slots[]` 控制在 2-4 个核心槽位。超过 4 个时先做压缩：检查是否把容器、工具、姿势、风格或局部道具误当成槽位。
- `modes.hifi.useTemplateImage` 根据模板是否依赖原图像素判断。
- `modes.free.enabled` 默认 `false`，但用户明确要求自由创意、高自由度、free-creative 或 creative remap 时应设为 `true`，或输出 prompt pack 而不是让用户误以为后台模板已开放。`mustKeep` 来自 `free_must_keep`；`canChange` 来自 `free_can_change`，不得把 `hifi_must_keep` 中的源图构图锚点原样塞进自由模式。

## Creative Level

始终先保留锁定模板元属性：

- 视觉媒介和风格家族。
- 主体形态逻辑和拟人化程度。
- 构图关系、裁切压力、面板结构、镜头角度和前景/背景角色。
- 文字存在性、文字位置、字体处理和修辞结构。
- 阅读顺序、显著性模型、角色映射、笑点公式和失效模式。
- 跨槽关系和共同变化规则，例如颜色、明度、材质、形状、尺寸、位置、文字指代或动作方向的联动。
- 用户要求插入具体主体时的用户上传主体身份。

`creative_level` 解释：

| Level | 开放范围 |
| --- | --- |
| `1` | 只替换用户请求的主体或最小变量。 |
| `2` | 开放小道具、标签、颜色、配饰或措辞。 |
| `3` | 开放动作、姿势、反应或局部物体变化。 |
| `4` | 在模板支持时开放场景家族、背景条件、关系映射或隐喻。 |
| `5` | 重组所有可编辑维度，但仍保留锁定元属性和失效模式。 |

模板无文字时默认不要添加 caption；模板有文字时保留等价文字结构和位置。

自由创意的 `creative_level >= 4` 应允许改变 `composition_pattern`，例如从固定三连队列改为单体伪装、成堆混入、角落露馅、物件队列或局部露出。仅保留原图数量和横向布局的输出，不能称为高自由度，除非用户明确要求“自由但保持构图”。

## 关系不变量反思

在生成模板、prompt pack、测试集或真实图片前，必须做一次关系不变量反思：

1. 不只问“画面里有什么”，还要问“哪些元素为什么会互相解释”。
2. 对每个关键笑点关系记录 `co_variation_constraints`：
   - `source_slot`：变化来源，例如主体宠物。
   - `dependent_slot`：必须跟随变化的槽，例如点心颜色。
   - `dimensions`：依赖维度，例如颜色、明度、材质、形状、尺寸、位置、文字指代、动作方向或语义标签。
   - `sync_rule`：共同变化规则。
   - `failure_if_unsynced`：如果只改一个槽而不改依赖槽，笑点如何失效。
   - `qa_check`：生成图 QA 如何判断关系是否成立。
3. creative mode 可以开放更多槽，但不能把共同变化关系拆散。
4. 如果用户替换主体，检查是否有依赖槽必须同步更新。典型失败：深色宠物仍配纯白包子，导致“宠物像点心”的颜色/材质误读失效。

## Fusion Model 判断

在判断主体能否替换前，必须先判断 meme 是否存在融合关系。`fusion_model` 回答的是“主体和其他槽位是不是已经合成一个结构”，不是“画面里是否同时出现两个元素”。

必须区分：

| 类型 | 判断标准 | 替换影响 |
| --- | --- | --- |
| `none` | 主体和道具、文字、背景只是并列出现。 | 主体通常可以独立替换，再检查普通跨槽约束。 |
| `adjacent_reference` | 旁边物件提供比例、类别或弱提示，但主体身体没有成为物件结构。 | 可替换性中等，参照物可按需要保留或同步调整。 |
| `body_object_fusion` | 主体身体、轮廓、纹理或切面就是食物/物件结构的一部分。 | 高保真主体替换敏感；换主体通常需要 creative remap。 |
| `semantic_role_fusion` | 主体身份和标签、文字、截图 UI 或角色语义不可拆。 | 换主体必须同步换语义标签或角色映射。 |
| `scene_fusion` | 主体动作或位置让场景成为身体/情绪/功能的一部分。 | 换主体必须保留动作、位置或重映射场景。 |

`fusion_model` 至少记录：

- `has_fused_subject`：是否存在融合主体。
- `fusion_type`：融合类型，例如 `body_object_fusion`。
- `fused_slots`：被融合的槽位，例如 `subject_animal` 与 `food_body_structure`。
- `fusion_dimensions`：颜色、明度、材质、形状、轮廓、切面、纹理、位置、语义或动作。
- `replacement_sensitivity`：`low | medium | high`。
- `subject_replaceability`：`independent | constrained | low | not_recommended`。
- `requires_remap_if_subject_changes`：主体变化时是否必须同步重映射食物、物件、文字、场景或构图。

如果 `has_fused_subject: true` 且 `replacement_sensitivity: high`，不能默认输出高保真主体替换。必须在 `remix_suitability.high_fidelity_subject_replaceability` 中降级或说明不推荐，并把更合适的方向放入 `creative_remap_recommended`。

典型例子：源图第一眼是剥开的橘子，第二眼发现小动物身体与橘瓣/橘皮融为一体。这不是“动物旁边有水果”，而是 `body_object_fusion`。如果目标主体变成黑色狗狗，主体毛色、轮廓和橘瓣结构不再天然融合，因此 `subject_replaceability` 应偏低，并建议 creative remap 到更适合黑狗的水果或食物结构。

## Remix Suitability 判断

当用户要求换主体、生成 high-fidelity/free-creative、render prompt pack、稳定性测试或真实图片结果时，必须先写入 `remix_suitability`。判断对象是“源模板能否承受这个替换”，不是“能不能想出一个新图”。`remix_suitability` 必须引用 `fusion_model` 结论，尤其是 `has_fused_subject`、`fused_slots`、`replacement_sensitivity` 和 `requires_remap_if_subject_changes`。

必须区分三种结论：

| 结论 | 使用条件 | 行为 |
| --- | --- | --- |
| `high_fidelity_subject_replaceable` | 目标主体可以替换源主体，同时不破坏源模板的第一眼误读、角色关系、颜色/材质/形状绑定和构图锚点。 | 可以生成高保真，faithful prompt 只替换必要槽位。 |
| `creative_remap_recommended` | 目标主体与源依赖槽不兼容，但 meme 公式可以迁移到新的食物、道具、构图或场景。 | 不把新隐喻写回源模板；高保真标低置信或不建议，free-creative 重新映射依赖槽。 |
| `not_recommended_for_subject_replacement` | 梗依赖源主体身份、源主体和依赖物的强绑定、或替换会让第一眼误读和第二眼揭示都失效。 | 明确告诉用户不适合主体替换；只在用户坚持时给低置信实验 prompt。 |

判断维度至少包括：

- `high_fidelity_subject_replaceability`：源模板是否允许只替换主体而保留依赖物、构图和阅读顺序。
- 目标主体与源依赖槽的颜色、明度、材质、形状、尺寸、位置和语义兼容性。
- 第一眼误读是否仍成立；如果目标主体太醒目或与依赖物不融合，高保真应降级。
- 源模板参照物是否是必需锚点、弱提示、比例提示或可删除道具。
- free creative 是否需要换食物、换容器、换视角或换场景才能保留“同一类梗”，并记录为 creative remap，而不是源模板事实。

典型例子：源图是“剥开的橘子里藏着橘色小动物”的可爱融合梗。若目标是黑色狗狗，高保真主体替换很可能不适合，因为黑色主体和橘子瓣的颜色/材质融合弱；更稳的结论是 `creative_remap_recommended`，重新选择黑狗能自然融入的深色食物或水果，同时保留“第一眼食物、第二眼小动物”的阅读模型。

## 参考图策略

只要输出可能发送给图像模型，就写 `reference_requirements`。完整字段见 `references/json-contract.md`。

决策顺序：

1. 用户替换主体是否需要视觉身份保留？需要时要求用户主体参考图，并绑定到主体槽。
2. 源 meme 是否需要提供难以用文字稳定表达的构图、风格、布局、文字位置或姿势？需要时可作为生成参考。
3. 源 meme 是否会与用户主体参考图冲突，或导致复制源主体、文字、Logo、UI、artifact？会则不要作为生成参考，改写为文本锁定锚点。
4. 请求是否直接编辑上传/源图片？是则用 `edit_target`；否则只在身份、风格或构图需要时用 `image_reference`。
5. 用户主体参考图低质但可识别时，保留它，添加 VLM 身份摘要，降低身份置信度；不要直接丢弃。
6. 不需要视觉身份、源布局或风格锚定时，使用 `none`。

## Prompt Pack

对 `render-prompt-pack`、`render-prompts` 和 prompt-generation 请求，读取 `references/json-contract.md`，默认产出：

1. `prompt-pack.json`：内嵌 VLM recognition、normalized input、meme template、slot bindings、prompt templates、rendered prompts 和 reference requirements。
2. `index.md`：中文摘要和文件清单。

只有用户要求完整 pipeline、debug、严格分步产物或下游系统需要分文件读取时，再额外产出：

- `vlm-recognition-mock.json`
- `normalized-input.json`
- `slot-bindings.json`
- `prompt-templates.json`
- `rendered-prompts.json`

`prompt_templates` 使用双花括号 `{{snake_case}}` placeholder；`rendered_prompts` 不能留下未解析 placeholder。缺失值必须使用模板默认值或推断值，并在 `user_input_normalization.inferred_fields` 记录。

聊天中只报告 result directory、主 JSON、测试集和图片输出路径；除非用户要求，不粘贴完整 JSON 或完整 prompt。

## 稳定性测试

用户要求 `stability-testset`、稳定复现、high-fidelity/free-creative 测试案例或 negative controls 时：

1. 读取 `references/stability-testset-contract.md`。
2. 创建 `stability-testset.json`，包含 faithful cases、creative cases、negative controls、evaluation rubric、repeatability protocol 和 reference test matrix。
3. 对 reference-sensitive 图像生成，默认覆盖 `text_only_baseline`、`user_subject_reference_only`、`user_subject_plus_source_meme_reference`，除非源材料让某个模式不可能。
4. 每个 case 写明 `reference_usage`，明确用户主体参考图和源 meme 图是否使用、来源、质量、收益和风险。
5. 写入后运行：

```powershell
python skills\meme-template-analyzer\scripts\validate_stability_testset.py <path-to-stability-testset.json>
```

## 真实图片输出

当用户要求“开始测试”“mock actual user generation”“show output”“give me results”“I want images”或类似生成结果语言时，最终结果必须是 raster 图片，而不是 JSON 报告或占位图。

执行规则：

- 创建或复用 `<result_directory>/output/`。
- high-fidelity 和 creative 场景至少产出 `high-fidelity-result.png` 和 `free-creative-result.png`。
- 如果图像工具保存到自己的目录，将 PNG/JPEG 复制到 `output/`，保留原文件。
- 报告文件可放在 `output/`，但只是辅助证据。
- 不要用 SVG、Pillow 草图、vector-looking mock、图表或程序化 placeholder 代替真实生成图。
- 声称完成前验证图片存在、非空、格式为 PNG/JPEG 且尺寸合理。

## 常见错误

- 只解释“为什么好笑”，却没有转成变量、规则和可复用模板。
- 把最醒目的物体自动锁成最大视觉强调，忽略原模板的显著性模型。
- 让替换主体的默认外观覆盖 meme 机制。
- high-fidelity 替换时把源主体身份写进 `locked_features`，而不是放进可编辑槽和替换策略。
- 用宽泛风格词代替可执行的 prompt style profile。
- 只保留元素存在性，忽略跨槽关系和视觉押韵；例如宠物像点心可能依赖颜色、明度、材质相近，而不只是都在蒸笼里。
- creative 模式改变主体后，没有同步改变依赖槽，导致 meme 公式断裂。
- 把 high-fidelity 和 creative prompts 写成两个无关 prompt。
- 把 `creative_level: 5` 当作修改媒介、主体形态逻辑、文字结构或构图锚点的许可。
- 身份保留重要时只依赖纯文字 prompt，不要求用户参考图。
- 低质但可识别的用户参考图被直接丢弃。
- 源 meme 图会导致源主体泄漏或复制 artifact 时仍自动作为生成参考。
- 自动替换角色、品牌、公众人物、UI、Logo 或截图，而不是记录风险和约束。
- 编造 meme 起源或文化背景。
- 用户要求图片结果时，用 JSON、测试集或 mock 描述当最终输出。
