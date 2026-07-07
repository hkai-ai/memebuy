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
normalized-input.json
meme-template.json
slot-bindings.json
prompt-templates.json
rendered-prompts.json
prompt-pack.json
stability-testset.json
index.md
```

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
-> normalized-input.json
-> slot-bindings.json
-> prompt-templates.json
-> rendered-prompts.json
-> prompt-pack.json
```

最终提示词包必须包含一个共享基础提示词和两个变体提示词范围：

- `base`: 共享的 meme 公式、阅读模型、显著性模型和不变量约束。
- `faithful`: 高保真 remix，保留识别锚点、构图、风格、视觉层级、幽默节奏、阅读顺序和显著性。
- `creative`: 自由创意 remix，保留笑点公式、阅读模型、显著性模型和风格家族，同时允许更大范围的替换。

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

示例请求：

```text
给已生成的 prompt pack 创建一个 stability-testset，我要检查复现稳定性。
```

```text
为这个模板构建 faithful、creative 和 negative-control 测试案例。
```

当已有模板或提示词包，或用户询问某个 meme 格式是否能经受多次生成时，使用这个命令。

### template-library-entry

当用户想要一个可存储、可搜索、可复用的模板对象时，使用这个命令。

输出应包含：

- meme 分类：`image_driven`、`text_driven` 或 `hybrid`。
- 相关文字分析和背景上下文。
- 笑点公式和识别锚点。
- 视觉设计特征。
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

1. 分析源 meme，并识别锁定的识别锚点、阅读模型和显著性模型。
2. 将目标内容标准化到 `normalized-input.json`。
3. 在 `slot-bindings.json` 中把目标字段绑定到可编辑变量槽。
4. 创建 base、faithful 和 creative 提示词模板。
5. 渲染最终提示词，不能留下未解析的 `{{placeholder}}` 文本。
6. 保存组合后的 `prompt-pack.json`。

当源图应指导构图或风格时，使用 `reference_strategy: image_reference`。只有用户明确要求直接编辑源图时，才使用 `edit_target`。

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
2. 创建 3-8 个 faithful cases，只做窄范围变量变化。
3. 创建 3-8 个 creative cases，允许更大范围变化，但保留公式。
4. 创建 1-4 个 negative controls，故意破坏识别锚点。
5. 添加评分标准和重复性协议。
6. 保存 `stability-testset.json`。

这个测试关注输出是否仍可识别，而不是要求每次生成完全相同。

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
