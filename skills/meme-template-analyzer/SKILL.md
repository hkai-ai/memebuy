---
name: meme-template-analyzer
description: 用于分析 meme 图片、截图、图片 URL 或用户提供的 meme 创意，并产出可复用 meme 模板、提示词包、槽位绑定、高保真与自由创意生成提示词、稳定性测试集、文字笑点分析、meme 背景说明或批量 meme 模板库。
---

# Meme Template Analyzer

## 概览

将 meme 分析成可复用的模板产物和生成提示词包。保留用户的创意意图：除非用户要求或当前策略必须拒绝，不要静默净化、替换主体，或重写看起来受保护的元素。

## 中文输出约定

默认让所有面向用户和业务人员可读的输出使用简体中文。

只对稳定技术标识使用英文：

- 文件名、目录名、路径、JSON key、JSONPath、mode 名、enum 值、placeholder、命令名、模型/工具名、hash、URL，以及类似代码的标识符。
- meme 中检测到的源文字。完整保留原文；有用时再添加中文解释、翻译或本地化说明。
- 用户提供且必须保留原语言的替换文本。

以下字段和文件默认写中文：

- 所有自由文本 JSON value，例如摘要、限制、说明、警告、提示词、风险描述、case 目标、通过标准、示例和后处理步骤。
- `index.md` 和任何其他人类可读的 Markdown 产物。
- 聊天摘要和进度报告。
- 最终渲染的提示词文本，除非用户明确要求给某个下游图像模型输出英文 prompt。

当下游字段使用 `high_fidelity` 这类英文技术标签时，保持标签稳定，但相邻的 `prompt`、`notes`、`criteria` 和解释字符串使用中文。如果字段混合技术 ID 和自然语言，ID 保持不变，围绕它的自然语言写中文。

## Artifact-First 输出规则

默认把机器可读产物写入结果目录，而不是在聊天里倾倒 JSON。

目录约定：

1. 如果当前工作区可写，创建 `artifacts/meme-template-analyzer/<template_id-or-timestamp>/`。
2. 否则创建 `$CODEX_HOME/generated_artifacts/meme-template-analyzer/<template_id-or-timestamp>/`。
3. 使用稳定文件名：
   - `vlm-recognition-mock.json`
   - `normalized-input.json`
   - `meme-template.json`
   - `slot-bindings.json`
   - `prompt-templates.json`
   - `rendered-prompts.json`
   - `prompt-pack.json`
   - 用户要求测试集时写 `stability-testset.json`
   - `index.md` 作为简短的人类可读清单
   - 用户要求运行生成、测试真实生成结果、mock 用户侧输出或产出结果图时写 `output/`。该目录位于当前解析模板目录内部，而不是 artifact 根目录。

结束时告诉用户工作已完成，并列出保存的文件路径。除非用户明确要求内联 JSON、严格 schema 输出，或文件系统不可用，否则不要在聊天里粘贴完整 JSON。

如果用户明确要求内联 JSON，只返回合法 JSON。不要用 Markdown 代码块包裹 JSON。把不确定性、证据缺失和后处理需求写成数据字段，不要在 JSON 外额外解释。

当用户需要模板条目、prompt contract、批量输出、下游处理或严格 schema 时，读取 `references/json-contract.md` 获取完整输出约定。
关于 artifact 文件内容和 stability test set schema，读取 `references/json-contract.md` 和 `references/stability-testset-contract.md`。

## 模式与命令

从请求中推断 `mode`，或使用用户明确指定的 mode：

| Mode | 适用场景 |
| --- | --- |
| `analyze` | 描述源 meme，不生成可复用变体。 |
| `template` | 默认模式。提取可复用 meme 模板库条目。 |
| `variants` | 基于已分析模板生成 faithful 和 creative 变体规则。 |
| `prompt-contract` | 为图像生成系统产出 prompt-ready JSON 约束。 |
| `render-prompts` | 标准化用户输入、绑定变量，并在不需要参考图的情况下渲染 faithful/creative 文生图提示词。 |
| `batch` | 将多个 meme 分析为 `template_library` array。 |
| `compare` | 比较多个 meme，提取共享公式、差异和系列方向。 |

用户要求这些命令时使用对应别名：

| Command | Output |
| --- | --- |
| `render-prompt-pack` | 完整 pipeline artifact：用户上传 VLM recognition mock -> 用户输入标准化 -> 模板变量槽绑定 -> prompt template placeholder 替换 -> 最终 faithful 和 creative prompts。 |
| `stability-testset` | 用于检查模板能否稳定复现的 high-fidelity 与 free-creative 测试集。 |
| `template-library-entry` | 可复用模板 JSON 条目及变体规则。 |

## 工作流

1. 加载所有提供的 artifact：上传图片、本地图片路径、URL、截图或批量集合。如果 URL 或文化引用不可访问，在 `source_access.limitations` 中记录。
2. 在标准化前创建 `vlm-recognition-mock.json`。把它视为一次针对用户上传内容的 VLM 识别 mock 输出：识别主体、物体、场景、可见文字、构图、风格线索、幽默信号、不确定性和下游映射候选。该 mock 应包含视觉事实和置信度，不包含最终 prompt 决策。
3. 根据 VLM recognition mock 和用户请求，将 meme 分类为 `image_driven`、`text_driven` 或 `hybrid`。
4. 提取可见文字。保留原始文字、语言、大小写、位置、换行，以及可见时的大致字体处理。
5. 分析笑点机制：铺垫、预期、转折、包袱、情绪驱动、受众知识，以及图文组合为什么成立。
6. 在提取可替换主体前建立 meme 阅读模型：
   - `first_read`: 观众第一眼应感知到什么。
   - `second_read`: 观众再次观察、阅读文字或重新解释标签后发现什么。
   - `reading_order`: 观众按什么路径扫描画面区域、文字、表情、标签或隐藏细节。
   - `misdirection_or_reinterpretation`: 起初被误解的内容，以及包袱如何改变理解。
   - `salience_model`: 哪些元素必须明显、微妙、隐藏、背景化、延迟出现或产生视觉误导。
   - `role_mapping`: 每个人、物体、文本块、UI 元素或视觉 artifact 在笑点中代表什么。
   - `failure_modes`: 哪些改动会让 meme 失效。
   这对 image-driven 和 hybrid meme 是强制要求。对于纯文字 meme，用阅读顺序和修辞揭示表达同一模型。
7. 如果 meme 依赖语言、俚语、公共事件、平台语境或已知 meme 格式，添加 `text_analysis.background_context`。不要编造起源故事；证据弱时使用 `unknown` 和置信度。
8. 从 `vlm-recognition-mock.json` 提取设计特征：构图、裁切、主体角色、表情、姿势、镜头角度、颜色、纹理、文字位置、字体、视觉层级、artifact 和风格。风格必须可用于 prompt，不能只是模糊标签：描述艺术媒介、渲染方法、线条/形状语言、色彩和光照、纹理/材质、镜头/景深、后处理观感和负向风格漂移。
9. 将 meme 转成变量槽。将每个槽标记为 `locked`、`faithful_editable`、`creative_editable` 或 `fully_editable`。
10. 在创意变体前提取模板对齐规则：锁定的 meme 元属性、可编辑表达维度、主体形态逻辑、拟人化程度、文字存在性、视觉风格、构图关系、阅读顺序、显著性和失效模式。`creative_level` 只能开放可编辑维度，绝不能覆盖锁定的模板元属性。
11. 在渲染 prompt 前决定参考图需求。区分分析参考和生成参考：
   - 源 meme 图片在可用时始终是分析输入，但只有在需要保留脆弱构图、风格、字体或布局时，才应传给下游图像生成。
   - 当身份一致性重要时，例如具体宠物、人物、商品、物体、角色或品牌物，用户上传的主体图应作为生成参考图。纯文字描述不足以验证身份保留。
   - 用户上传主体图可能低清、压缩、模糊、裁切或光线差。只要主体可识别，仍把它作为首选用户主体参考；先运行或 mock 一次 VLM pass，提取身份线索和质量问题，并把图片参考和 VLM 身份摘要一起传给下游。
   - 不要只因为用户主体参考图不完美就拒绝它。应降低身份承诺：保留物种/类别、主色、脸部标记、体型、比例、特殊配饰和气质等稳健线索；证据弱时避免声称精确保留身份。
   - 当原 meme 参考图与替换主体竞争、导致源主体泄漏、复制文字/Logo/UI，或过拟合源图时，它对生成可能有害。此时优先使用文本锁定锚点，而不是传原图。
   - 只有任务是直接编辑源图时使用 `edit_target`。当一个或多个图像应指导身份、风格、构图或布局时使用 `image_reference`。只有不需要视觉身份或源布局的图像锚定保留时使用 `none`。
12. 通过阅读模型和 VLM recognition mock 标准化用户提供的替换内容。不要让强主体身份覆盖原始 meme 机制。在高保真生成中，请求的目标主体通常是可编辑槽；除非源主体身份本身是不可替换的笑点锚点且用户没有要求替换它，否则不要把源主体身份放进 `locked_features`。如果目标是可识别角色、商品、公众人物、宠物或物体，判断模板需要的是完整外观、轮廓线索、标签文字、姿势、表情、颜色、比例、运动、纹理，还是只需要语义角色。只绑定所需线索，并记录这些线索是否需要用户参考图。
13. 当用户提供目标内容、要求图像生成 prompt、需要无参考图生成，或要求 `render-prompt-pack` 时，构建完整 prompt pipeline：
   - `user_input_normalization`: 将原始用户输入和 VLM recognition mock 转成标准 JSON。
   - `slot_bindings`: 将标准化值和 VLM 派生候选绑定到 meme 模板变量槽。
   - `prompt_templates`: 定义共享 `base` 模板，以及带 `{{snake_case}}` placeholder 的 faithful 和 creative prompt template。
   - `rendered_prompts`: 替换每个 placeholder，输出最终 base、high-fidelity 和 free-creative prompts。
14. 同时产出两种变体范围：
   - `faithful_variant`: 修改请求的替换槽，尤其是用户提供的目标主体，同时保留构图、prompt style profile、视觉层级、幽默节奏、阅读模型、显著性模型和识别锚点。
   - `creative_variant`: 保留 meme 公式、阅读模型、显著性模型和风格家族，但根据运营可编辑的创意自由控制，允许更大范围地改动主体、动作、场景、隐喻、设定、文字、情绪角度和语境。
15. 用户要求 `stability-testset` 时，创建确定性测试 case，用于比较 faithful 和 creative prompt 的稳定性。包含正常 case、边界 case 和 negative controls。
16. 用户要求测试真实生成输出、mock 用户侧生成、运行 high-fidelity/free-creative 场景，或要求 "output/results/images" 时，先创建真实图片输出：
   - 尽可能使用可用的图像生成工具产出 raster 图片。
   - 将生成的 PNG/JPEG 保存或复制到 `<result_directory>/output/`。
   - 使用稳定文件名，例如 `high-fidelity-result.png`、`free-creative-result.png`；多次运行时使用编号变体。
   - JSON 报告、测试摘要和 scorecard 作为支持证据放在同一个 `output/` 目录，不作为主结果。
   - 不要用 SVG、vector-looking 占位图、Pillow 草图、图表或程序化 mock 绘图替代生成结果图。
   - 如果图像生成不可用或失败，明确说明未产出真实图片；不要静默用 JSON 或合成占位图替代。
17. 记录风险和约束说明，但默认不改变模板。除非用户要求安全替代方案或安全规则阻断请求，否则不要把主体替换为更安全的替代项。
18. 将 artifact 写入结果目录，并向用户报告路径。
19. 完成前检查业务可读 artifact 内容是否为中文。技术 key 和 ID 可以保留英文，但摘要、警告、prompt、示例、criteria 和 Markdown prose 默认不应是英文。

## 模板对齐与 Creative Levels

将 `creative_level` 视为槽位开放预算，而不是重新设计 meme 的许可。先提取模板特定的锁定元属性，再决定每个等级可开放哪些维度。

始终保留锁定模板元属性：

- 视觉风格和媒介，例如低清照片、截图、漫画、3D render 或插画
- 主体形态逻辑和拟人化程度，例如真实宠物、人、物体、UI 元素、吉祥物或完整拟人角色
- 构图关系、裁切压力、面板结构、镜头角度和前景/背景角色
- 文字存在性、文字位置、字体处理和修辞结构
- 阅读顺序、显著性模型、角色映射、笑点公式和失效模式
- 用户要求插入具体主体时的用户上传主体身份

通用 `creative_level` 解释：

| Level | 含义 |
| --- | --- |
| `1` | 只替换用户请求的主体或最小可行变量。几乎保留所有锚点。 |
| `2` | 开放小型局部变量，例如小道具、标签、颜色、配饰或措辞，同时保留结构。 |
| `3` | 开放模板内部表达变量，例如动作、姿势、反应或局部物体变化。 |
| `4` | 在原模板支持时开放更大的模板认可变量，例如场景家族、背景条件、关系映射或隐喻。 |
| `5` | 重组所有可编辑维度，同时保留每个锁定元属性和失效模式约束。 |

不要只因为用户请求高等级就引入外部语境。例如，如果模板没有办公室、员工身份、系统报错笑点或 caption，除非用户明确提供这些语境或模板自身变量槽包含它们，否则不要添加。

当模板无文字时，默认不要添加 caption。当模板有文字时，保留等价的文字结构和位置，再绑定用户提供或推断的文字槽。

## 参考图决策规则

只要输出可能发送给图像模型，就写一个 `reference_requirements` object。

依次询问：

1. 用户提供的替换主体是否需要视觉身份保留？如果需要，要求用户主体参考图，并绑定到主体槽。
2. 源 meme 图是否需要在构图、风格、布局、文字位置或姿势上提供超出文字可稳定表达的指导？如果需要，允许源 meme 作为图像参考。
3. 传入源 meme 图是否会与用户主体参考图冲突，或导致生成器复制源主体、文字、Logo、UI 或看起来受保护的元素？如果会，不要把它作为生成参考；把所需方面转成文本锁定锚点。
4. 请求是否是直接编辑上传/源图片？如果是，使用 `edit_target`；否则只在身份/风格/构图指导需要时使用 `image_reference`。
5. 用户主体参考图是否低质但可识别？如果是，保留它作为生成参考，添加 `user_subject_reference_quality`，并在 prompt contract 中包含 VLM 派生的身份摘要。
6. 如果不需要图像锚定的身份、源布局或风格保留，使用 `none`，并解释输出已经适合 text-to-image。

低质用户主体参考图需要记录：

- `quality_score`: `low`、`medium` 或 `high`
- `usable_for_identity`: 图片是否能支持任何身份保留
- `issues`: 低分辨率、压缩、运动模糊、光线差、局部裁切、遮挡、主体过小或角度异常
- `identity_cues_detected`: VLM 仍可识别的视觉线索
- `identity_confidence`: `low`、`medium` 或 `high`
- `generation_policy`: 通常为 `use_reference_plus_vlm_identity_summary`
- `fallback_if_too_poor`: 请求另一张图、降低身份置信度，或只做语义/类别替换

常见决策：

| 情况 | 下游参考决策 |
| --- | --- |
| 用户上传宠物/商品/人物并要插入 meme | 要求用户主体参考图用于生成 |
| 用户上传低清但可识别的宠物/商品/人物 | 要求用户主体参考图，添加 VLM 身份摘要，并降低身份置信度 |
| 用户上传不可用参考图且主体无法识别 | 请求更好的参考图，或标记为只能做语义/类别替换 |
| 用户只要求分析 meme | 不需要生成参考图决策 |
| 用户要求基于已知 meme 图创建 prompt pack | 源 meme 用于分析；只有布局/风格难以可靠描述时才传给生成 |
| 源 meme 与用户主体参考图冲突 | 优先用户主体身份；将源 meme 风格/布局编码为文本锁定锚点 |
| 用户要求直接编辑原图 | 使用 `edit_target` 并保留未变区域 |

## Prompt Pack Pipeline

对 `render-prompt-pack`、`render-prompts` 和 prompt-generation 请求使用此精确 pipeline：

1. `vlm-recognition-mock.json`: 存储对上传图片、截图、URL capture 或纯文字创意输入的 VLM recognition mock 结果。这是下游标准化的源观察层。
   - 当上传内容是用户主体参考图时，包含质量问题、身份线索和身份置信度。该 VLM pass 帮助生成器更稳定地使用低质图片；当身份重要时，它不替代传入用户主体参考图。
2. `normalized-input.json`: 存储原始用户请求、指向 `vlm-recognition-mock.json` 的链接，以及 `subject`、`object`、`setting`、`caption`、`style_intensity`、`constraints`、`negative_constraints` 等标准字段。
3. `meme-template.json`: 存储已分析 meme 模板、锁定元属性、可编辑维度、阅读模型、显著性模型、笑点公式、视觉锚点、文字公式，以及从 VLM recognition mock 派生的变量槽。
4. `slot-bindings.json`: 将每个标准化字段和 VLM 派生候选映射到 `variable_slots[*].slot_id` 和 `{{primary_subject}}` 这类 prompt placeholder。
5. `prompt-templates.json`: 存储一个共享 base template 和两个 variant template：
   - `base`: 共享的 meme 公式、阅读模型、显著性模型、prompt style profile 和不变量约束。
   - `faithful`: high-fidelity remix；替换请求的可编辑槽，同时保留识别锚点、布局、prompt style profile、幽默节奏、阅读顺序和显著性。
   - `creative`: free-creative remix；保留笑点公式、阅读模型、显著性模型和风格家族，同时允许运营认可的主体、动作、物体、场景、文字和隐喻变化。
6. `rendered-prompts.json`: 在 placeholder 替换后存储最终 base、faithful 和 creative prompts。不要留下未解析的 `{{placeholder}}` 文本。
7. `prompt-pack.json`: 存储供下游系统使用的完整组合 object，包括 VLM recognition mock 或其路径引用。
8. `index.md`: 用中文总结生成内容并列出 artifact 文件。

聊天中报告：

- result directory path
- VLM recognition mock path
- prompt pack path
- faithful prompt path 或 JSON path
- creative prompt path 或 JSON path
- 生成了 stability test set 时的路径

除非用户要求内联内容，否则不要粘贴完整 JSON 或完整 prompt。

聊天报告默认使用中文，并且只列出保存路径和简短验证摘要。

## 变量槽纪律

每个可复用模板必须识别：

- `slot_id`: 稳定 snake_case 名称。
- `role`: 槽位在笑点或设计中的作用。
- `current_value`: 源中出现的内容。
- `allowed_faithful_changes`: 保持原模板可识别的窄替换。
- `allowed_creative_changes`: 保持同一系列身份的更宽替换。
- `lock_level`: `locked`、`faithful_editable`、`creative_editable` 或 `fully_editable`。
- `downstream_hint`: 生成器或编辑器应如何应用该槽。

有用槽类目：`subject`、`object`、`caption`、`reaction`、`setting`、`gesture`、`expression`、`camera`、`crop`、`color`、`typography`、`layout`、`texture`、`platform_artifact`、`cultural_reference`、`punchline`、`audience_assumption`、`reading_order`、`salience`、`role_mapping`、`reveal`、`misdirection`。

## Prompt Style Profile

每个 image-driven 或 hybrid 模板都必须包含可用于 prompt 的 style profile。不要停在 "anime"、"photo"、"cartoon" 或 "screenshot" 这类宽泛标签。描述下游图像模型能执行的视觉配方：

- `art_medium`: photo、3D render、ink drawing、pixel art、collage、UI screenshot、macro shot、hand-drawn illustration 等。
- `rendering_method`: flat color、cel shading、painterly brushwork、halftone print、low-poly、photoreal lighting、vector-like edges、rough marker 等。
- `line_and_shape_language`: thick outline、no outline、soft rounded forms、angular silhouettes、distorted proportions、sticker-like cutout 等。
- `color_and_lighting`: 调色盘、对比度、饱和度、阴影硬度、环境光、屏幕辉光、闪光灯、日光、夜间照明。
- `texture_material_surface`: 纸张颗粒、压缩 artifact、亮面塑料、织物、金属、皮肤纹理、水彩晕染、海报印刷等。
- `camera_lens_and_depth`: 视角、焦距感、透视压缩、景深、运动模糊、裁切压力。
- `typography_style`: 类字体外观、大小写、描边、轮廓、投影、caption box、label sticker、UI text treatment。
- `style_prompt_fragments`: base、high-fidelity 和 free-creative prompts 可复用的短 prompt fragment。
- `negative_style_constraints`: 需要避免的风格漂移，例如 photorealism、3D gloss、watercolor、grunge、over-rendering、clean vector UI，或会破坏模板的 cinematic lighting。

High-fidelity prompts 应保留完整 `prompt_style_profile`。Free-creative prompts 只有在 `creative_freedom_controls` 明确允许该维度时，才可放松个别风格属性。

## Meme 阅读模型

不要把 meme 当成普通图片描述来分析。要建模受众如何阅读并重新解释这个 artifact。

每个可复用模板都应回答：

- `first_read`: 笑点出现前看起来正在发生什么。
- `second_read`: 哪个新细节、标签、隐藏元素、表情或矛盾改变了意义。
- `reading_order`: 注意力第一、第二、最后应去哪。
- `salience_model`: 每个关键元素应是主导、次要、隐藏、低对比、延迟、误导还是背景化。
- `role_mapping`: 视觉/文本元素在笑点中代表什么，而不只是字面描绘什么。
- `failure_modes`: 哪些常见编辑会破坏 meme，即使图片仍然精致。

如果用户要求替换主体，将替换绑定到阅读模型中的主体角色。不要自动渲染完整视觉身份。有些模板只需要标签、轮廓、颜色痕迹、姿势、表情、阴影、反射、比例关系或背景线索。

对于 high-fidelity prompts，像锁定构图和风格一样强力锁定阅读模型和显著性模型。对于 creative prompts，可以允许更多视觉变量，但必须保留阅读模型和笑点成立的原因。

## 替换与锁定规则

把 `locked_features` 当作不变量锚点，而不是源图中所有可见内容的倾倒列表。

High-fidelity remix:

- 用户请求的替换主体默认可编辑。
- 保留主体角色、显著性、姿势/表情要求、比例关系、阅读顺序和笑点功能。
- 除非精确源主体身份本身是 meme 重点且用户没有要求替换，否则不要锁定源主体身份。
- 将可替换的源主体身份细节放入 `editable_slots`、`slot_bindings` 和 `subject_replacement_policy`，而不是 `locked_features`。
- 锁定构图、裁切、布局、字体处理、style profile、识别锚点、阅读模型、显著性模型和失效模式。

Free-creative remix:

- 允许更广泛地改变主体、动作、场景、物体、隐喻、caption、情绪角度和设定。
- 保留 meme 公式、阅读模型、显著性模型、风格家族，以及任何标记为不可协商的锚点。
- 使用 `creative_freedom_controls`，让运营者能为 campaign 或模板库明确设置哪些维度开放、受限或锁定。

## Generation Pipeline

当 mode 为 `render-prompts`、用户给出要插入模板的目标内容，或下游流程是不带参考图的 text-to-image 时，使用 `generation_pipeline`。

- `user_input_normalization`: 将原始用户意图转成 `subject`、`task`、`caption`、`setting`、`style_intensity`、`constraints`、`negative_constraints` 等 canonical 字段。
- `slot_bindings`: 将标准化值或推断默认值映射到 `variable_slots`。使用 `{{primary_subject}}` 这类稳定 placeholder；prompt template 中的每个 placeholder 都必须有绑定。
- `prompt_templates`: 在替换前提供机器可渲染的 `base`、`faithful` 和 `creative` template。placeholder 使用双花括号和 snake_case。
- `rendered_prompts`: 替换后提供最终 prompt。不要留下未解析 placeholder；如果值缺失，使用模板默认值或推断值，并在 `user_input_normalization.inferred_fields` 记录决策。
- `reference_strategy`: 无参考图 text-to-image 使用 `none`；源图应指导风格/构图时使用 `image_reference`；直接编辑源图时使用 `edit_target`。
- `reference_requirements`: 记录下游生成是否需要用户主体参考图、源 meme 参考图、两者都需要或都不需要，并解释原因。

Faithful rendering 绑定请求的替换槽，并保留不变量锚点、阅读顺序、显著性和 prompt style profile。Creative rendering 绑定更宽的可编辑维度，同时保留公式、风格家族、识别锚点和阅读模型。

## Stability Test Set 命令

当用户要求测试 high-fidelity 和 free-creative 输出是否稳定、可复现或能一致 remix meme 时，使用 `stability-testset`。

创建 `stability-testset.json`，包含：

- `faithful_cases`: 3-8 个 case，只改变一两个可编辑槽，同时保留锁定锚点。
- `creative_cases`: 3-8 个 case，保留 meme 公式，同时改变动物/主体、物体/食物、场景、隐喻或情绪角度。
- `negative_controls`: 1-4 个 case，故意违反一个关键锚点，用于暴露模板何时不再可识别。
- `evaluation_rubric`: 针对识别锚点、槽位遵循、幽默公式、风格保真、文字准确性和安全/权利约束的评分标准。
- `repeatability_protocol`: 每个 case 运行多少次、比较什么、什么算稳定。
- `reference_test_matrix`: 当图像生成质量依赖用户主体图或源 meme 图时，必须比较的参考模式。

对 reference-sensitive 图像生成测试，除非用户源材料让某个模式不可能，否则包含这些参考模式：

- `text_only_baseline`: 不使用用户主体参考图，也不使用源 meme 参考图；只依赖 rendered prompt text。
- `user_subject_reference_only`: 使用上传或 mock 用户主体图作为生成参考；不传源 meme 图；把源 meme 风格/构图/布局编码为文本锁定锚点。
- `user_subject_plus_source_meme_reference`: 同时使用用户主体参考图和源 meme 参考图，测试源图是否改善布局/风格，或导致源主体泄漏、复制文字、Logo、UI 或 artifact。

每个 case 包含：

- `case_id`
- `variant_scope`: `faithful | creative | negative_control`
- `reference_mode`
- `reference_usage`: 对用户主体参考图和源 meme 参考图的显式布尔值与来源标签
- `raw_user_input`
- `expected_locked_features`
- `allowed_changes`
- `forbidden_drift`
- `expected_prompt_json_paths`
- `pass_criteria`

详细 schema 读取 `references/stability-testset-contract.md`。

写入或收到 `stability-testset.json` 后，用以下命令验证参考图可追踪性：

```powershell
python skills\meme-template-analyzer\scripts\validate_stability_testset.py <path-to-stability-testset.json>
```

使用该 validator 捕获缺失的 `reference_test_matrix`、缺失的 per-case `reference_usage`、缺失的必需 reference modes，以及 reference-mode flags 不一致。

## 图片输出测试运行

当用户要求“开始测试”“mock actual user generation”“show output”“give me results”“I want images”或类似生成结果语言时，使用真实 raster 图片输出。

对这些请求：

1. 创建或复用已分析模板目录。
2. 创建 `<result_directory>/output/`。
3. 当用户明确需要 high-fidelity 和 high-free/creative 场景时，至少生成一个 `high-fidelity-result.png` 和一个 `free-creative-result.png`。
4. 如果图像生成工具把文件保存到自己的 generated-images 目录，将结果图片复制到 `<result_directory>/output/`，并保留原文件。
5. 将 `mock-generation-results.json`、`high-fidelity-test-report.json`、`free-creative-test-report.json`、`summary.md` 等报告放在同一个 `output/` 文件夹下，仅作为辅助文件。
6. 在聊天回复中展示或链接图片文件。用户要求图片时，不要把 JSON 当作最终输出。
7. 声称运行完成前，验证每个输出图片存在，是非空 PNG/JPEG，且尺寸合理。

绝不要用生成的 JSON、评估 rubric、SVG、手写 vector drawing、Pillow sketch 或其他合成 placeholder 作为最终“结果图”。如果只能产出 prompt 或报告，明确说明该限制。

## 文字 Meme 处理

对于 text-driven 或 hybrid meme，包含：

- 字面 OCR/transcription 和不确定字符。
- 文字布局地图：区域、换行、强调和阅读顺序。
- 修辞模式：对比、误导、升级、反高潮、荒谬具体化、角色反转、caption-label mapping 或 bait-and-switch。
- 背景说明：相关时记录俚语、meme 格式、历史语境、平台惯例或引用事件。
- 带变量的可复用文字公式，而不是只给改写示例。
- 存在中文或多语言时：保留源语言，只在有用时添加翻译或本地化字段。

## Prompt Contract

用户要求 prompts 时，将 prompt 数据输出为 JSON 字段，而不是自由 prose：

- `faithful_prompt_contract`: constraints、可编辑替换槽、不变量锁定锚点、subject replacement policy、negative constraints、text rendering notes。
- `creative_prompt_contract`: series style、运营可控 creative freedoms、保留公式、可选方向。
- `generation_pipeline`: normalized user input、slot bindings、placeholder templates、rendered prompts，以及下游 prompt replacement 需要的 reference strategy。
- `postprocessing_required`: 当图像生成器可能需要手动文字排版、OCR 修正、合成、inpainting 或 policy review 时为 true。

## 常见错误

- 不要停在“这很好笑是因为……”。要把观察转成可复用变量和规则。
- 不要把最醒目的物体自动视为必须最大视觉强调。保留原模板让它明显、微妙、隐藏、误标、延迟、变形或背景化的方式。
- 不要让替换主体的默认外观覆盖 meme 机制。如果请求某个角色但模板只需要微弱轮廓、标签或语义角色，明确编码该约束。
- 用户要求高保真替换时，不要把源主体身份放进 `locked_features`。锁定角色和视觉关系；通过槽绑定新主体。
- 不要只用类型标签描述风格。添加具体媒介、渲染、线条、色彩、光照、纹理、镜头、字体和负向漂移约束。
- 不要把 high-fidelity 和 creative prompts 写成两个无关 prompt。它们应派生自同一个 base template；faithful 改更少槽，creative 改更多槽。
- 不要合并 high-fidelity 和 free creative 版本。它们必须可分别控制。
- 不要把 `creative_level: 5` 当作修改视觉媒介、主体形态逻辑、文字结构或源模板锁定构图锚点的许可。
- 当用户期望特定上传宠物、商品、人物或物体保持可识别时，不要依赖纯文字 prompt；要求用户参考图，并记录在 `reference_requirements`。
- 当低质用户上传图的主体仍可识别时，不要丢弃它。使用图片加 VLM 派生身份线索，并说明较低身份置信度，而不是假装输出能保留精确细节。
- 当源 meme 图会把模型拉回源主体或复制源 artifact 时，不要自动把它作为生成参考图。改用文本锁定锚点。
- 不要自动替换角色、品牌、公众人物、UI、Logo 或截图。记录风险和约束；除非被要求或被策略阻断，否则保留用户请求的目标。
- 不要编造 meme 起源或文化背景。使用置信度和 `unknown`。
- 预期下游处理时，不要在 JSON 周围输出 Markdown。
- 当用户要求生成图片结果时，不要把 JSON 报告、stability cases 或 mock 描述当作最终输出。
- 不要用程序化 placeholder PNG 覆盖真实生成图片。应将真实生成图复制到 `output/`。
