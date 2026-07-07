# Meme Template Analyzer

将 meme 图片、截图、图片 URL 或 meme 创意分析成可持久化的模板产物和生成提示词包。

## 语言约定

面向用户的说明、教程和示例默认使用中文。命令名、mode 名、JSON key、schema 字段、文件名、路径和第三方专有术语按原文保留。

artifact 中所有业务人员会阅读的内容也默认使用简体中文，包括摘要、笑点机制、阅读模型、显著性模型、风险说明、postprocessing 步骤、示例变体、测试 case、评分标准、`index.md` 和最终渲染提示词。只有以下内容保留原文或英文：稳定技术标识、路径、文件名、JSON key、enum、placeholder、hash、URL、可见源文字，以及用户明确要求保留原语言的文本。

## 主要输出

默认情况下，本 skill 会把结果保存到产物目录，而不是在聊天中粘贴完整 JSON。

优先使用工作区路径：

```text
artifacts/meme-template-analyzer/<template_id-or-timestamp>/
```

当工作区不可用时，使用回退路径：

```text
$CODEX_HOME/generated_artifacts/meme-template-analyzer/<template_id-or-timestamp>/
```

预期文件：

```text
vlm-recognition-mock.json
normalized-input.json
meme-template.json
slot-bindings.json
prompt-templates.json
rendered-prompts.json
prompt-pack.json
stability-testset.json
index.md
output/
```

当用户要求“开始测试”“mock 用户实际生成效果”“输出结果”“我要图片”或类似真实生成结果时，`output/` 必须位于对应解析目录内部，例如：

```text
artifacts/meme-template-analyzer/<template_id-or-timestamp>/output/
```

此时 `output/` 的主产物必须是 PNG/JPEG 图片，例如：

```text
high-fidelity-result.png
free-creative-result.png
```

JSON 报告、评分表和 `summary.md` 只能作为辅助文件。不要用 JSON、SVG、Pillow 手绘图、程序化占位图或图表来冒充用户要看的生成结果。如果图像生成工具把图片先保存到自己的 generated-images 目录，应复制真实生成图到 `output/`，并保留原始生成文件。

## 命令

命令是稳定的用户侧入口。模式是 agent 根据自然语言请求推断出的内部处理分支。

当用户需要一套完整、可复用、文件名稳定的产物流时，优先使用命令。当请求偏探索、局部分析或同时组合多个目标时，让 agent 推断模式。

快速选择：

| 用户想要 | 使用方式 |
| --- | --- |
| 从 meme 或 meme 创意生成可用于图像生成的提示词 | `render-prompt-pack` |
| 生成可复用的 meme 模板库条目 | `template-library-entry` |
| 为 faithful / creative 生成做可重复性测试 | `stability-testset` |
| 只快速解释或阅读一个 meme | 不显式指定命令；推断 `analyze` |
| 将多个 meme 分析成一个模板库 | 不显式指定命令；推断 `batch` |
| 比较多个 meme 的共性和差异 | 不显式指定命令；推断 `compare` |

### render-prompt-pack

当用户想从 meme 模板获得可用于图像生成的提示词时，使用这个命令。

流程：

```text
用户输入
-> vlm-recognition-mock.json
-> normalized-input.json
-> slot-bindings.json
-> prompt-templates.json
-> rendered-prompts.json
-> prompt-pack.json
```

最终提示词包必须包含一个共享基础提示词和两个变体提示词范围：

- `base`: 共享的 meme 公式、阅读模型、显著性模型和不变量约束。
- `faithful`: 高保真 remix，替换用户指定的主体或核心变量，同时保留识别锚点、构图、可渲染的画面风格 profile、视觉层级、幽默节奏、阅读顺序和显著性。
- `creative`: 自由创意 remix，保留笑点公式、阅读模型、显著性模型和风格家族，并按运营可编辑的 `creative_freedom_controls` 放开主体、动作、场景、文字、情绪等维度。

示例请求：

```text
对这张图使用 meme-template-analyzer render-prompt-pack，把主体换成一个疲惫的 SaaS 创始人。
```

```text
把这个 meme 创意做成提示词包：一个小机器人骄傲地展示坏掉的电子表格。
```

当输出会被图像生成器、批量渲染器或其他自动化步骤消费时，使用这个命令。聊天回复应只列出保存路径，除非用户明确要求内联提示词。

### stability-testset

当用户想测试一个 meme 模板是否能稳定复现时，使用这个命令。

测试集应包含：

- `faithful_cases`: 小范围改动，仍应保持原模板可识别。
- `creative_cases`: 更大范围改动，但仍应属于同一 meme 系列。
- `negative_controls`: 故意破坏关键锚点，用来判断模板何时失效。
- `evaluation_rubric`: 用于评估可重复性和保真度的评分维度。
- `repeatability_protocol`: 每个 case 运行多少次，以及什么结果算稳定。
- `reference_test_matrix`: 记录本次测试会比较哪些参考图使用方式。

当测试涉及用户上传主体图或源 meme 图时，必须显式比较或说明这些模式：

- `text_only_baseline`: 不传用户主体参考图，也不传源 meme 图，只用文字 prompt。
- `user_subject_reference_only`: 传用户上传图或 mock 用户上传图作为主体参考图；源 meme 图不传，只转成文本锁定锚点。
- `user_subject_plus_source_meme_reference`: 同时传用户主体参考图和源 meme 图，用来观察构图/风格是否更稳，以及是否出现源主体泄漏、复制文字/Logo/UI 或 artifact。

每个 case 都要写 `reference_usage`，明确说明是否使用了用户参考图、是否使用了源模板图、使用的是 mock 还是真实上传，以及测试目的。

示例请求：

```text
给已生成的 prompt pack 创建一个 stability-testset，我要检查复现稳定性。
```

```text
为这个模板构建 faithful、creative 和 negative-control 测试案例。
```

当已有模板或提示词包，或用户询问某个 meme 格式是否能经受多次生成时，使用这个命令。

生成或收到 `stability-testset.json` 后，可以运行校验脚本检查参考图使用记录是否完整：

```powershell
python skills\meme-template-analyzer\scripts\validate_stability_testset.py <path-to-stability-testset.json>
```

该脚本会检查 `reference_test_matrix`、每个 case 的 `reference_usage`、三类 reference mode 是否齐全，以及 reference mode 与布尔字段是否一致。

### template-library-entry

当用户想要一个可存储、可搜索、可复用的模板对象时，使用这个命令。

输出应包含：

- meme 分类：`image_driven`、`text_driven` 或 `hybrid`。
- 相关文字分析和背景上下文。
- 笑点公式和识别锚点。
- 视觉设计特征。
- 可渲染的画面风格 profile：媒介、渲染手法、线条/形状、色彩/光照、材质纹理、镜头/景深、字体风格、后期观感和负向风格漂移。
- 带 lock level 的变量槽。
- faithful 和 creative 变体规则。
- 风险和约束说明。

示例请求：

```text
从这张截图创建一个 template-library-entry。
```

```text
分析这三个 meme，并为每个 meme 保存可复用模板条目。
```

当模板本身就是目标产物，而不只是为了生成提示词时，使用这个命令。

## 使用教程

### 教程 1：快速分析 meme

当用户只想理解一个 meme 时，使用这条路径。

请求形态：

```text
分析这个 meme，说明它的笑点机制、可见文字和视觉结构。
```

预期行为：

1. 加载用户提供的图片、URL、截图或文字创意。
2. 将 meme 分类为 image-driven、text-driven 或 hybrid。
3. 提取可见文字，并保留不确定的 OCR 细节。
4. 解释铺垫、转折、笑点、受众知识、设计特征、阅读模型和显著性模型。
5. 如果产物有用，保存 `meme-template.json` 和 `index.md`。

除非用户要求变体或图像生成输出，否则不要强制生成提示词。

### 教程 2：从源 meme 到提示词包

当用户提供源 meme 和目标替换内容时，使用这条路径。

请求形态：

```text
对这个 meme 使用 render-prompt-pack。把主角替换成一个压力很大的产品经理，并保留笑点结构。
```

预期行为：

1. 先生成 `vlm-recognition-mock.json`，记录用户上传内容经过 VLM 识别后的模拟结构化结果。
2. 分析源 meme，并识别锁定的识别锚点、阅读模型、显著性模型和画面风格 profile。
3. 将目标内容和 VLM mock 结果标准化到 `normalized-input.json`。
4. 在 `slot-bindings.json` 中把目标字段和 VLM 候选槽位绑定到可编辑变量槽。
5. 创建 base、faithful 和 creative 提示词模板。
6. 渲染最终提示词，不能留下未解析的 `{{placeholder}}` 文本。
7. 保存组合后的 `prompt-pack.json`。

当源图应指导构图或风格时，使用 `reference_strategy: image_reference`。只有用户明确要求直接编辑源图时，才使用 `edit_target`。

### 教程 2A：判断生成时需要哪些参考图

当用户上传替换主体，例如宠物、商品、人物或具体物件，并希望生成结果保持它的身份一致性时，不能只靠文字描述。应在 `generation_pipeline.reference_requirements` 中明确记录参考图需求。

通用规则：

1. 源 meme 图始终可以作为分析输入，用来提取模板元属性、构图、阅读顺序和变量槽。
2. 用户上传主体图在需要身份保持时，应作为下游生成参考图；只写“白色博美”“红色杯子”无法证明身份一致。
3. 用户上传主体图可能低清、压缩、模糊、裁切不完整或光线差。只要主体仍可识别，就继续作为下游生成参考图，同时把 VLM 识别出的身份线索写入提示词和 `reference_requirements`。
4. 源 meme 图不一定要作为生成参考图。它可能让模型回到源主体、复制源文字/Logo/UI，或和用户主体参考图冲突。
5. 当源图只需要提供构图、风格或文字位置时，优先把这些内容转成文本锁定锚点；只有文本难以稳定表达时才把源 meme 图作为 `image_reference`。
6. 只有用户明确要求直接改原图时，才使用 `edit_target`。

示例：

```json
{
  "reference_strategy": "image_reference",
  "reference_requirements": {
    "needs_user_subject_reference": true,
    "user_subject_reference_role": "identity_reference",
    "user_subject_reference_quality": {
      "quality_score": "low",
      "usable_for_identity": true,
      "issues": ["low_resolution", "compression_artifacts"],
      "identity_cues_detected": [
        "白色绒毛",
        "圆脸",
        "三角耳朵",
        "小型犬体型",
        "偏淡定的表情"
      ],
      "identity_confidence": "medium",
      "vlm_identity_summary": "低清图中仍可识别为白色小型犬，圆脸、三角耳朵和淡定表情是主要身份线索。",
      "generation_policy": "use_reference_plus_vlm_identity_summary",
      "fallback_if_too_poor": "lower_identity_confidence"
    },
    "needs_source_meme_reference": false,
    "source_meme_reference_role": "none",
    "reference_priority": "user_subject_first",
    "use_source_meme_as_generation_reference": false,
    "source_meme_reference_risk": [
      "源 meme 图可能把生成结果拉回源主体",
      "源图中的文字或水印可能被复制"
    ],
    "identity_preservation_targets": [
      "保留用户上传宠物的毛色、脸型、耳朵、体型和主要花纹"
    ],
    "template_alignment_targets": [
      "保留源 meme 的构图关系、低清照片风格和笑点阅读顺序"
    ],
    "decision_notes": [
      "使用用户宠物图作为身份参考；源 meme 仅作为分析来源，不直接传给生成模型。"
    ]
  }
}
```

### 教程 2A-1：低清用户参考图的处理

很多真实用户上传的宠物、商品或人物图并不清晰，但这不等于不能用于生成。处理逻辑应分三层：

1. 先用 VLM 识别上传图，记录主体类别、可见身份线索、质量问题和置信度。
2. 如果主体可识别，仍将原图作为 `user subject reference` 传给下游生成，同时把 VLM 摘要写进 prompt，帮助模型抓住稳健特征。
3. 如果主体不可识别，再降级为“语义替换”或请求更好的参考图。

可接受的低清问题包括：分辨率低、压缩痕迹、轻微运动模糊、光线差、局部裁切、主体角度不标准。此时不要承诺像素级一致，只保留稳健身份线索，例如宠物的物种、毛色/羽色、脸部标记、体型、比例、主要配饰和气质。

如果主体太小、严重遮挡、糊成色块、只露背影或 VLM 无法判断主体类别，应设置：

```json
{
  "usable_for_identity": false,
  "identity_confidence": "low",
  "generation_policy": "semantic_replacement_only",
  "fallback_if_too_poor": "ask_for_better_reference"
}
```

### 教程 2B：使用 creative_level 时先锁定模板元属性

`creative_level` 是变量开放强度，不是改写模板的许可。每个 meme 都要先从源模板中提取 `template_alignment.locked_meta_properties`，再决定哪些 `editable_dimensions` 可以在哪个等级开放。

通用层面必须对齐：

- 视觉媒介和风格，例如低清照片、截图、漫画、3D 或插画。
- 主体形态逻辑和拟人化程度，例如真实宠物、普通人、物件、UI 元素、吉祥物或人形动物。
- 构图关系、裁切压力、前景/背景角色和面板结构。
- 文字有无、文字位置、字体处理和修辞结构。
- 笑点公式、阅读顺序、显著性模型、角色映射和失效条件。
- 用户上传主体的身份一致性。

等级语义：

| 等级 | 含义 |
| --- | --- |
| `1` | 只替换用户指定主体或最小变量，最大限度保留原模板。 |
| `2` | 开放小道具、颜色、配饰、标签或局部文字等小变量。 |
| `3` | 开放模板内部的动作、姿态、反应、局部物件或表达变化。 |
| `4` | 在模板允许时开放场景族、背景条件、关系映射或隐喻变化。 |
| `5` | 重组所有可编辑维度，但仍不能突破锁定元属性。 |

例如宠物末日梗图的 `level 5` 可以更换休闲场景和背景灾难，但不能把复古低清照片改成 3D 插画，不能把真实宠物改成完整人形角色，也不能自动加入办公室、系统报错或职业身份叙事，除非用户明确提供这些语境。

### 教程 3：从纯文字 meme 创意到提示词

当没有源图片时，使用这条路径。

请求形态：

```text
创建一个无参考图 prompt pack，主题是实习生向困惑的中世纪国王解释 Kubernetes。
```

预期行为：

1. 将请求视为纯文字 meme 创意。
2. 推断可复用笑点公式，但把不确定的文化上下文标记为推断。
3. 根据请求前提创建视觉锚点。
4. 构建 faithful 和 creative 提示词范围。
5. 使用 `reference_strategy: none`。
6. 对源图中不存在、由 agent 假设的内容，在推断字段和置信度中说明。

这条路径适合从一个前提出发生成新的 meme 系列，而不是 remix 已有图片。

### 教程 4：从多个 meme 构建模板库

当用户提供多个图片、URL 或 meme 创意时，使用这条路径。

请求形态：

```text
把这一批 meme 分析成模板库，并归类相似的笑点公式。
```

预期行为：

1. 分别处理每个来源。
2. 为每个 meme 创建一个模板条目。
3. 保留每个来源独立的 OCR、限制和置信度说明。
4. 只有证据充分时，才归类共享公式。
5. 将模板库输出保存到产物目录。

独立条目使用推断的 `batch` 模式。用户要求共享公式、差异或系列方向时，使用推断的 `compare` 模式。

### 教程 5：添加稳定性测试

当提示词包或模板需要检查可重复性时，使用这条路径。

请求形态：

```text
为这个 prompt pack 添加 stability-testset，包含 faithful cases、creative cases 和 negative controls。
```

预期行为：

1. 复用已有模板和变量槽规则。
2. 创建 3-8 个 faithful cases，替换目标主体或少量可编辑变量，但不把源主体身份误当成锁定项。
3. 创建 3-8 个 creative cases，允许更大范围变化，但必须遵守 `creative_freedom_controls` 并保留公式。
4. 创建 1-4 个 negative controls，故意破坏识别锚点。
5. 添加 `reference_test_matrix`，至少区分纯文字 baseline、只用用户主体参考图、用户主体图加源模板图这三类测试路径。
6. 每个 case 写入 `reference_usage`，明确记录实际参考图使用方式和风险观察点。
7. 添加评分标准和重复性协议。
8. 保存 `stability-testset.json`。

这个测试关注输出是否仍可识别，而不是要求每次生成完全相同。

生成测试集后运行：

```powershell
python skills\meme-template-analyzer\scripts\validate_stability_testset.py <path-to-stability-testset.json>
```

校验通过后，再进入真实生成或人工评估。

### 真实图片输出测试

当用户说“开始测试”“mock 一下用户实际生成效果”“高保真和高自由两个场景”“我要图片”“输出结果图片”等，测试不应停留在 schema、JSON 或文字描述。

预期行为：

1. 复用当前解析目录。
2. 创建或使用该目录下的 `output/`。
3. 真实生成图片结果：至少包含 `high-fidelity-result.png` 和 `free-creative-result.png`。
4. 如果图片生成工具输出在外部 generated-images 目录，把真实生成 PNG/JPEG 复制进 `output/`，不要删除原始生成图。
5. 将 `mock-generation-results.json`、`high-fidelity-test-report.json`、`free-creative-test-report.json` 和 `summary.md` 作为辅助报告放进同一个 `output/`。
6. 回复用户时优先展示或链接图片文件，然后再简述测试报告。

禁止行为：

- 不要把 JSON 当成最终 output。
- 不要用 SVG、Pillow 手绘图、程序化 vector 占位图或图表冒充生成结果。
- 不要先生成了真实图片，又用本地程序图覆盖真实图片。
- 如果无法生成图片，应明确说明无法生成，不要静默降级成文本报告。

## 模式指南

agent 可以从请求中推断一个或多个模式：

| 模式 | 最适合 | 典型输出 |
| --- | --- | --- |
| `analyze` | 理解一个 meme | 分析字段、OCR、上下文说明 |
| `template` | 可复用模板库条目 | `meme-template.json` |
| `variants` | faithful 和 creative remix 规则 | 模板内的变体范围 |
| `prompt-contract` | 下游提示词约束 | prompt contract JSON 字段 |
| `render-prompts` | 未显式指定命令时生成最终提示词 | rendered prompt 字段和 prompt pack 文件 |
| `batch` | 多个独立 meme | template library array |
| `compare` | 多个相关 meme | 共享公式和差异 |

可重复的完整工作流优先使用显式命令。自然语言请求未要求命名命令时，优先使用推断模式。

## 实用模式

### 组合命令

有些请求天然会产生多组产物：

```text
先创建 template-library-entry，再为一个远程工作倦怠主题版本渲染 prompt pack。
```

预期输出：

- 可复用模板字段。
- prompt pack 文件。
- 带路径的简洁聊天摘要。

### 请求内联输出

默认是 artifact-first。如果用户想要内联内容，必须直接说明：

```text
不要保存文件，直接内联返回 prompt-pack JSON。
```

当用户要求内联 JSON 时，只返回合法 JSON，不要包在 Markdown 代码块中。

### 处理缺失或弱证据

出现以下情况时，使用 `unknown`、置信度字段和 `source_access.limitations`：

- URL 无法访问。
- meme 来源不确定。
- OCR 有歧义。
- 文化上下文是推断的。
- 用户只提供了局部创意。

不要编造来源、公共事件上下文或平台历史。

### 保留用户意图

默认记录风险和约束，不主动替换用户请求的主体。只有当前安全策略要求，或用户要求更安全替代方案时，才替换或拒绝。

## 聊天回复规则

生成产物后，回复应简洁说明已完成，并列出保存路径。

除非用户明确要求内联 JSON、内联提示词或严格 schema 输出，否则不要在聊天中粘贴完整 JSON 或完整提示词。

如果用户要求图片结果，聊天回复应优先展示或链接 `output/` 中的 PNG/JPEG。JSON 路径只作为补充说明。

## 版本与运行时同步

本仓库副本是开发源文件：

```text
skills/meme-template-analyzer/
```

全局运行副本用于 Codex 自动发现 skill：

```text
$env:USERPROFILE\.codex\skills\meme-template-analyzer
```

版本元数据位于：

```text
skill-manifest.json
```

修改此 skill 时：

1. 先更新仓库副本。
2. 当行为、schema、命令或用户可见输出发生变化时，更新 `skill-manifest.json`。
3. 如果需要当前 Codex 会话使用新行为，将仓库副本同步到全局运行副本：

```powershell
scripts\sync-skill.ps1 -SkillName meme-template-analyzer
```

4. 验证仓库副本和全局副本是否一致：

```powershell
scripts\check-skill-sync.ps1 -SkillName meme-template-analyzer
```

同步检查会比较两个 `skill-manifest.json` 版本，以及 `tracked_files` 中所有文件的 SHA-256 hash。

## 参考文件

- `SKILL.md`: 主要运行说明。
- `skill-manifest.json`: 版本和 tracked-file 元数据。
- `references/json-contract.md`: artifact 和 prompt pack schema。
- `references/stability-testset-contract.md`: stability test set schema。
