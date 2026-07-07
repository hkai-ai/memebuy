# Stability Test Set Contract

当用户要求 `stability-testset`、stable remix tests、high-fidelity/free-creative test cases 或 reproducibility checks 时，使用本文件。

## 语言约定

默认将所有业务可读测试内容写成简体中文。JSON key、enum value、case ID、JSONPath value、mode 名和其他技术标识保持英文。

中文字段包括 `test_goal`、`raw_user_input`、`expected_locked_features`、`expected_editable_slots`、`expected_reading_model`、`expected_salience_model`、`expected_style_profile`、`expected_subject_replacement_policy`、`expected_creative_freedom_controls`、`allowed_changes`、`forbidden_drift`、`pass_criteria`、`compare_dimensions`、`stable_if`、`unstable_if`、`expected_benefit`、`risk_to_watch` 和 `test_purpose`。

如果源 meme 包含英文或其他语言，精确保留原始可见文字，并在有用时添加中文解释或本地化说明。

## 目的

创建持久化测试集，检查 meme 模板在重复渲染时是否不会丢失：

- 识别锚点
- 阅读模型和注意力顺序
- 显著性模型
- 幽默公式
- 变量槽纪律
- prompt style profile 保真度
- high-fidelity 与 free-creative 的区分
- 文字和布局约束
- 参考图使用效果，尤其是用户主体参考图或源 meme 参考图是否被传给生成

## 输出文件

将 `stability-testset.json` 写入结果目录。

## Schema

```json
{
  "schema_version": "1.1",
  "artifact_type": "meme_stability_testset",
  "source_template_id": "short_snake_case_id",
  "test_goal": "",
  "reference_test_matrix": [
    {
      "reference_mode": "text_only_baseline | user_subject_reference_only | user_subject_plus_source_meme_reference",
      "uses_user_subject_reference": false,
      "uses_source_meme_reference": false,
      "source_meme_usage": "none | textual_locked_anchors_only | image_reference",
      "reference_priority": "user_subject_first | source_meme_first | balanced | none",
      "test_purpose": ""
    }
  ],
  "faithful_cases": [],
  "creative_cases": [],
  "negative_controls": [],
  "evaluation_rubric": [],
  "repeatability_protocol": {
    "generations_per_case": 3,
    "reference_modes_per_case": [],
    "compare_dimensions": [],
    "stable_if": [],
    "unstable_if": []
  }
}
```

## Test Case Object

```json
{
  "case_id": "faithful_01",
  "variant_scope": "faithful",
  "reference_mode": "text_only_baseline | user_subject_reference_only | user_subject_plus_source_meme_reference",
  "reference_usage": {
    "uses_user_subject_reference": false,
    "user_subject_reference_source": "none | uploaded_user_image | mock_user_upload | generated_user_upload | artifact_path",
    "user_subject_reference_quality": "not_applicable | low | medium | high",
    "uses_source_meme_reference": false,
    "source_meme_reference_source": "none | uploaded_source_meme | artifact_path",
    "source_meme_usage": "none | textual_locked_anchors_only | image_reference",
    "reference_priority": "user_subject_first | source_meme_first | balanced | none",
    "expected_benefit": "",
    "risk_to_watch": [],
    "test_purpose": ""
  },
  "raw_user_input": "",
  "expected_locked_features": [],
  "expected_editable_slots": [],
  "expected_reading_model": [],
  "expected_salience_model": [],
  "expected_style_profile": [],
  "expected_co_variation_constraints": [],
  "expected_subject_replacement_policy": {},
  "expected_creative_freedom_controls": {},
  "allowed_changes": [],
  "forbidden_drift": [],
  "expected_prompt_json_paths": [
    "$.normalized_input",
    "$.slot_bindings",
    "$.prompt_templates.faithful",
    "$.rendered_prompts.faithful.prompt"
  ],
  "pass_criteria": []
}
```

## Case 设计

Reference mode cases:

- 当测试集用于判断下游图像生成质量时，包含 `reference_test_matrix`。
- 对身份敏感模板，在这些模式之间创建可比较 case：
  - `text_only_baseline`: 不使用用户主体图片，也不使用源 meme 图片；只使用 rendered prompt text。用它衡量 baseline drift。
  - `user_subject_reference_only`: 传入用户上传或 mock 用户上传的主体图；不传源 meme 图；将源 meme 风格、布局、构图和文字规则编码为文本锁定锚点。
  - `user_subject_plus_source_meme_reference`: 同时传入用户主体参考图和源 meme 参考图；用它测试源 meme 是否改善布局/风格，或导致源主体泄漏、复制文字、Logo、UI 或 artifact。
- 每个 test case 都必须声明 `reference_mode` 并填写 `reference_usage`；不要让 reference usage 隐式存在。
- 如果测试使用 mock 用户上传图片，设置 `user_subject_reference_source: "mock_user_upload"` 或提供 artifact path。不要描述成真实用户上传图片。
- 如果源 meme 不传给生成，设置 `uses_source_meme_reference: false` 和 `source_meme_usage: "textual_locked_anchors_only"`。
- 进行质量判断前，先在同一个 prompt case 内跨 reference modes 比较输出。

Faithful cases:

- 只改变请求的替换主体，或一两个可编辑槽。
- 保留镜头、裁切、构图、文字节奏、风格家族和识别锚点。
- 除非 case 明确测试允许的风格属性，否则保留 prompt style profile。
- 保留阅读模型、first-read/second-read 关系和显著性要求。
- 使用主体、物体、表情、caption 或场景的相近替代。
- 当 case 提供替换主体时，不要期望源主体身份仍被锁定；应期望源主体角色、显著性、姿势/表情/比例关系和笑点功能保持稳定。

Creative cases:

- 保留笑点公式和风格家族。
- 即使设定、隐喻或主体变化，也保留阅读模型和显著性模型。
- 保留 `expected_co_variation_constraints`。如果主体、场景或物体变化，依赖槽必须同步变化；例如宠物毛色变化时，点心颜色、明度、材质也要跟随。
- 允许对主体、物体、场景、隐喻和情绪角度做更大变化。
- 保留足够锚点，让输出仍属于同一 meme 系列。
- 遵守 `creative_freedom_controls`；标记为 `locked` 的维度不得变化，标记为 `limited` 的维度需要具体规则，标记为 `open` 的维度可以广泛变化。

Negative controls:

- 故意移除或改变一个必要锚点。
- 用它们检测模板何时不再可识别。
- 将它们标记为 negative controls；不要把它们当成推荐 prompt 展示。

## Evaluation Rubric

每个维度使用 0-2 分：

- `recognition_anchors`: 锁定的视觉或文字锚点仍可见。
- `reading_model`: first read、second read、reveal 和 attention order 仍匹配模板。
- `salience_model`: dominant、subtle、hidden、misleading 和 backgrounded 元素保持预期强调程度。
- `slot_adherence`: 请求变量出现，且 forbidden drift 不存在。
- `formula_preservation`: setup、turn 和 payoff 仍成立。
- `style_fidelity`: 渲染风格、构图和层级匹配预期范围。
- `faithful_creative_separation`: faithful 保持窄范围；creative 在不破坏系列的情况下探索。
- `replacement_policy`: faithful 通过可编辑槽替换请求主体，而不是锁定源主体身份。
- `reference_usage_traceability`: 每个结果都可追踪到使用了用户主体参考图、源 meme 参考图、二者、或都未使用。
- `reference_mode_effect`: reference mode 对比能说明身份保留、构图保真或源 artifact 泄漏是否发生变化。
- `creative_freedom_controls`: creative output 只变化运营者标记为 open 或 limited 的维度。
- `co_variation_adherence`: 跨槽共同变化规则成立；主体变化后，依赖槽在颜色、明度、材质、形状、位置、文字指代或动作方向等维度上同步变化。
- `text_accuracy`: 只有在请求时才出现精确文字，且拼写正确。
- `safety_and_rights`: 记录风险；除非策略要求，否则不静默替换。

如果大多数重复生成得分至少为 10/14，且没有关键锁定锚点缺失，则视为稳定。
