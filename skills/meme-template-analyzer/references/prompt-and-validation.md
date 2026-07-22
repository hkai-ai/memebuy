# Prompt 编译与验证

## 三层提示词

最终模板明确区分：

- `promptTemplate`：前端可见的基础提示词模板。用户可以编辑整段提示词，或只通过 `inputSchema` 替换槽位。
- `promptEnhancement`：仅后端可见的二次编辑策略，包含 LLM stage、内部 instruction、参考图字段、锁定约束和输出协议。
- `resolvedPrompt`：运行时先渲染 `promptTemplate`，再由 `promptEnhancement` 改写得到；只发送给图片网关，不写入模板 JSON。

`preprocessSteps` 仍用于独立的读图或文本预处理，不承担基础提示词渲染后的二次编辑。

## Prompt 语法

使用后端受限兜底链：

```text
{{ inputId | "字面量默认" }}
{{ selectId.payloadKey | "默认值" }}
{{ stepId.field | "默认值" }}
```

这不是完整 LiquidJS。不要输出控制标签、循环或任意 filter。term 只能是已定义 input/step id 或点路径；fallback 只能是 JSON 双引号字符串。

同一属性只能有一个动态来源。存在 `text_color` 时，静态 prompt 不得再写死“蓝字”“红字”。文案槽长度写入对应 `inputSchema` 的 `minLength/maxLength`，不得烘进 `promptTemplate`。

`promptTemplate` 不得出现“文案长度要求”“使用模板固定参考图”“必须遵守”或 preserve 清单。它们属于后端策略。

`promptTemplate` 必须是一段完整、连贯、可独立理解的成图描述。把 placeholder 放进自然语法中的主体、动作、空间关系、道具、背景或风格位置，例如：

```text
一位{{ person | "古装发髻女子" }}坐在电脑桌前，面向{{ device | "黑色笔记本电脑" }}，双手托着{{ prop | "粉色莲花" }}；背景和整体复古网点印刷插画质感沿用参考图。
```

禁止使用“沿用原画面，通过以下开放项生成同构画面：A；B；C”“以模板参考图为基准，仅修改以下开放项”或连续 placeholder 清单。这些参考图权限和编辑边界属于 `promptEnhancement`。

## 编译映射

- `【主体：白猫】` -> `{{ subject | "白猫" }}`。
- `text/prompt` -> 后端 `prompt`。
- `select + allowCustom: true` -> `prompt + suggestions[]`。
- `select + allowCustom: false` -> `select + {value,label}[]`。
- `image_upload` -> `image`。
- `subject` -> `subject`；一个前端控件内支持预设、自由文本和上传图，固定使用 `image_over_text`。
- `image_select` 作为运行时图片参考 -> v1 拒绝转换。
- `templateSource.path` -> `cover` 和 `referenceImage`。
- taxonomy/template source/槽位语义 -> `metadata`。
- `templateSource.lockedConstraints/preserve` -> `promptEnhancement`，不再拼到 `promptTemplate`。
- `preprocessSteps` 默认 `[]`，顶层 `stageKey` 默认省略并使用 `gallery.template_image`。

硬约束必须写进 `promptEnhancement`，并在 `metadata.templateSource` 保留结构副本。

`promptEnhancement` 仍会进入生成链路，因此只包含面向成图的自然语言约束。机制分类、组件图、槽位 ID 和分析枚举留在 `image-edit-analysis.json`。最终指令必须明确“只输出最终成图”，并禁止显示模板标题、槽位框、组件标签、组件 ID、虚线连线、图例、操作说明和界面元素。

同款模式只把“是什么”做成开放槽位：主体、道具、配饰、文字和嵌套内容。背景环境、构图、姿态、镜头、整体配色、光影、风格、媒介和材质由参考图锁定。对象自身的内容属性仍可开放，例如领结颜色。

`lockedConstraints` 只指名沿用参考图的视觉维度，每条建议不超过 40 字，不写“图像依据”或具体画面取值。`preserve` 只写模板成立所需的语义锚点，例如“盒内主体必须被盒沿遮挡”；没有语义锚点时使用空数组，不得复制 `lockedConstraints`。禁止写 `character_styling_1`、`reaction_portrait_1` 等内部枚举。

每个开放槽位必须自然出现在 `promptTemplate`。转换器不会再为漏用槽位追加“标签：placeholder”清单。当前运行时以 `prompt` 和 `subject` 的 label 构建开放槽位清单，同款模板使用这两种类型承载可替换内容。

## 脚本

编译：

```bash
python skills/meme-template-analyzer/scripts/convert_image_edit_to_meme_template.py <dir>/image-edit-template.json
```

验证：

```bash
python skills/meme-template-analyzer/scripts/validate_gallery_template.py <dir>/meme-template.json
```

槽位智能验证：

```bash
python skills/meme-template-analyzer/scripts/validate_slot_intelligence.py <dir>
```

前端体验与运行时兼容验证：

```bash
python skills/meme-template-analyzer/scripts/validate_frontend_experience.py <dir>/meme-template.json
```

它会拒绝内部编排文案、已有 fallback 仍必填、跨语义候选项、缺少显示文案的 `subject`、错误默认比例和未声明的多图主体能力。针对旧站点检查时使用 `--runtime-profile legacy-single-image`，出现失败代表需先升级站点运行时。

批量时一次传入全部模板目录，validator 还会检查槽位签名和模板机制多样性，防止整批复用机械通用槽。

validator 检查：

- 顶层和判别联合字段、类型、长度与数值范围。
- input/step id 唯一命名空间。
- placeholder 括号、fallback、字符串转义和 term 格式。
- prompt 与 preprocess step 的引用存在性和顺序。
- select payload 字段。
- `metadata.tags`、`metadata.inputSemantics` 和 template source 对齐。
- `description` 不超过 20 个字符，且不使用 analysis summary 兜底。
- `promptTemplate` 不含后端约束，`promptEnhancement` 字段完整。
- `subject` 的 text/image 两种来源、`promptValue` 和 `image_over_text` 策略合法。
- 本地 `cover`、`referenceImage` 文件存在性。
- 用户可见名称、描述和提示词不包含内部编排语言。
- `promptTemplate` 是完整自然语言成图描述，不是后处理指令或槽位清单。
- 候选交互包含至少 3 个去重、同类且符合模板情景的真实选项；没有足够候选时不显示候选交互。
- 生成指令不包含组件图或枚举 ID，并明确禁止输出编辑标注。
- 已有默认值的槽位可直接生成，自由编辑不会被隐藏必填项卡住。
- `metadata.presentation` 与 `metadata.runtimeRequirements` 能驱动正确比例、固定参考图和多主体图片传递。

只有 `PASS` 才能交付或上传 OSS。
