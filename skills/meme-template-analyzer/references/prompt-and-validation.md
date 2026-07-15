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

## 脚本

编译：

```bash
python skills/meme-template-analyzer/scripts/convert_image_edit_to_meme_template.py <dir>/image-edit-template.json
```

验证：

```bash
python skills/meme-template-analyzer/scripts/validate_gallery_template.py <dir>/meme-template.json
```

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

只有 `PASS` 才能交付或上传 OSS。
