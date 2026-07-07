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
8. 提取可用于 prompt 的设计特征：构图、裁切、主体角色、表情、姿势、镜头、色彩、纹理、文字位置、字体、视觉层级、artifact 和风格。
9. 建立变量槽，并为每个槽标记 `locked`、`faithful_editable`、`creative_editable` 或 `fully_editable`。
10. 先锁定模板元属性，再开放 creative 维度。`creative_level` 是槽位开放预算，不是重新设计 meme 的许可。
11. 判断参考图策略，区分分析参考和生成参考。
12. `authoring` 场景读取 `references/gallery-authoring-contract.md`，把分析中间层转换成业务收集 JSON：`key/topic/title/description/assets/inputs/prompt/modes/output`。
13. 用户要求 prompt、提供目标内容、要求无参考图生成或 `render-prompt-pack` 时，构建 `generation_pipeline`，并默认写入 `prompt-pack.json`；只有展开 pipeline 时才拆出中间 JSON。
14. 同时区分 `faithful_variant` 和 `creative_variant`。二者共享 base template；faithful 改更少槽，creative 开放更多可编辑维度。
15. 用户要求稳定性测试时读取 `references/stability-testset-contract.md`，写入 `stability-testset.json` 并运行 validator。
16. 用户要求真实输出图、测试生成结果或展示 results/images 时，优先使用可用图像生成工具产出真实 PNG/JPEG，并保存到 `<result_directory>/output/`。
17. 记录风险和约束；除非用户要求安全替代方案或策略阻断，否则不要默认替换用户主体。
18. 写入 artifact，回复中列出结果目录、关键文件路径和验证情况。

## 模板纪律

分析中间层必须足够支持业务录入 JSON，但默认不要把它们作为 `meme-template.json` 主格式暴露给运营。每个模板至少分析出：

- `variable_slots`：稳定 `slot_id`、笑点角色、源值、faithful/creative 可改范围、`lock_level` 和下游提示。
- `template_alignment`：锁定元属性、可编辑维度、主体形态逻辑、拟人化程度、文字存在性、构图关系、阅读顺序、显著性和失效模式。
- `prompt_style_profile`：不要只写 "anime"、"photo"、"cartoon" 或 "screenshot"。必须描述媒介、渲染方法、线条/形状、色彩/光照、材质纹理、镜头/景深、字体处理和负向风格漂移。
- `reading_model`：观众第一眼看到什么、第二眼重新解释什么、注意力如何移动、哪些元素主导/微妙/隐藏/误导，以及哪些修改会破坏笑点。
- `faithful_variant` 和 `creative_variant`：两者必须从同一个 base template 派生，不能写成两个无关 prompt。

有用槽类目包括 `subject`、`object`、`caption`、`reaction`、`setting`、`gesture`、`expression`、`camera`、`crop`、`color`、`typography`、`layout`、`texture`、`platform_artifact`、`cultural_reference`、`punchline`、`audience_assumption`、`reading_order`、`salience`、`role_mapping`、`reveal`、`misdirection`。

`authoring` 输出时，把这些分析结果映射为 Gallery Template Authoring JSON v1：

- `prompt.master` 使用自然语言完整描述，并用 `【槽位名：原文】` 标记变量。
- `prompt.slots[]` 只写业务可理解的 `id`、`policy`、`from`，`policy` 为 `required` 或 `extensible`。
- `inputs[]` 只写用户需要提供的内容；图片输入必须写 `extract`。
- `modes.hifi.useTemplateImage` 根据模板是否依赖原图像素判断。
- `modes.free.enabled` 默认 `false`，`mustKeep` 和 `canChange` 由阅读模型、显著性模型和模板元属性压缩生成。

## Creative Level

始终先保留锁定模板元属性：

- 视觉媒介和风格家族。
- 主体形态逻辑和拟人化程度。
- 构图关系、裁切压力、面板结构、镜头角度和前景/背景角色。
- 文字存在性、文字位置、字体处理和修辞结构。
- 阅读顺序、显著性模型、角色映射、笑点公式和失效模式。
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
- 把 high-fidelity 和 creative prompts 写成两个无关 prompt。
- 把 `creative_level: 5` 当作修改媒介、主体形态逻辑、文字结构或构图锚点的许可。
- 身份保留重要时只依赖纯文字 prompt，不要求用户参考图。
- 低质但可识别的用户参考图被直接丢弃。
- 源 meme 图会导致源主体泄漏或复制 artifact 时仍自动作为生成参考。
- 自动替换角色、品牌、公众人物、UI、Logo 或截图，而不是记录风险和约束。
- 编造 meme 起源或文化背景。
- 用户要求图片结果时，用 JSON、测试集或 mock 描述当最终输出。
