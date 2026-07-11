# Prompt 编译与验证

## 可执行字段

最终 `meme-template.json` 的可执行字段只有 `promptTemplate`、`inputSchema` 和 `preprocessSteps`。完整约束读取 `gallery-authoring-contract.md` 和严格 schema。

## Prompt 语法

使用后端受限兜底链：

```text
{{ inputId | "字面量默认" }}
{{ selectId.payloadKey | "默认值" }}
{{ stepId.field | "默认值" }}
```

这不是完整 LiquidJS。不要输出控制标签、循环或任意 filter。term 只能是已定义 input/step id 或点路径；fallback 只能是 JSON 双引号字符串。

同一属性只能有一个动态来源。存在 `text_color` 时，静态 prompt 不得再写死“蓝字”“红字”。文案槽在草稿 `validation.maxLength` 写长度上限，转换器会把要求烘进 prompt。

## 编译映射

- `【主体：白猫】` -> `{{ subject | "白猫" }}`。
- `text/prompt` -> 后端 `prompt`。
- `select + allowCustom: true` -> `prompt + suggestions[]`。
- `select + allowCustom: false` -> `select + {value,label}[]`。
- `image_upload` -> `image`。
- `image_select` 作为运行时图片参考 -> v1 拒绝转换。
- `templateSource.path` -> `cover` 和 `referenceImage`。
- taxonomy/template source/槽位语义 -> `metadata`。
- `preprocessSteps` 默认 `[]`，顶层 `stageKey` 默认省略并使用 `gallery.template_image`。

硬约束必须同时烘进 prompt 并保留 metadata 结构副本。

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
- 本地 `cover`、`referenceImage` 文件存在性。

只有 `PASS` 才能交付或上传 OSS。
