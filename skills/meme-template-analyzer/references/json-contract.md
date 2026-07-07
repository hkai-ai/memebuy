# JSON Contract

在 `template`、`variants`、`prompt-contract`、`render-prompts`、`batch` 和 `compare` 模式中使用本 contract。返回 JSON 时优先保证机器可读，其次保证人类可读。

默认 skill 行为会把这些 object 写入紧凑主产物，而不是把每个中间 object 都拆成独立文件。只有用户明确要求 JSON，或文件系统不可用时，才输出内联 JSON。

## 语言约定

所有业务可读内容默认必须使用简体中文。

保持技术标识不变：

- JSON key、schema 名、文件名、路径、JSONPath、placeholder、mode 名、enum 值、label、ID、hash、URL 和类似代码的值。
- meme 中可见的源文字；逐字保留，并在有帮助时添加中文解释或翻译字段。
- 用户提供且必须保留原语言的字符串。

以下内容使用中文：

- JSON 中的每个 prose string value，包括摘要、限制、说明、prompt、警告、示例、通过标准、后处理步骤、风险描述和解释字段。
- `index.md` 中的所有 Markdown prose。
- `rendered_prompts` 和 `prompt-pack.json` 中渲染后的 prompt text，除非用户明确要求给下游模型使用英文 prompt。

不要用英文示例 prose 填充输出 artifact。如果某个 value 是推断出来的，用中文解释推断依据并包含置信度。

## Artifact 目录结构

默认只写最少必要文件：

```json
{
  "result_directory": "artifacts/meme-template-analyzer/<template_id-or-timestamp>/",
  "files": {
    "meme_template": "meme-template.json",
    "prompt_pack": "prompt-pack.json",
    "stability_testset": "stability-testset.json",
    "manifest": "index.md"
  }
}
```

按 mode 选择主产物：

- `analyze`、`template`、`variants`、`batch`、`compare` 默认写 `meme-template.json` 和 `index.md`。
- `prompt-contract`、`render-prompts`、`render-prompt-pack` 默认写 `prompt-pack.json` 和 `index.md`。
- `stability-testset` 额外写 `stability-testset.json`。
- 用户要求真实图片结果时额外创建 `output/`。

只有用户要求完整 pipeline、debug、严格分步产物、下游系统按分文件读取，或需要排查中间步骤时，才额外写：

```json
{
  "expanded_pipeline_files": {
    "vlm_recognition_mock": "vlm-recognition-mock.json",
    "normalized_input": "normalized-input.json",
    "slot_bindings": "slot-bindings.json",
    "prompt_templates": "prompt-templates.json",
    "rendered_prompts": "rendered-prompts.json"
  }
}
```

## 顶层结构

```json
{
  "schema_version": "1.0",
  "mode": "template",
  "postprocessing_required": true,
  "source_access": {
    "inputs": [],
    "limitations": [],
    "analysis_confidence": 0.0
  },
  "vlm_recognition": {},
  "meme_template": {},
  "generation_pipeline": null,
  "faithful_variant": {},
  "creative_variant": {},
  "postprocessing": {}
}
```

对于 `batch`，用 `template_library` 替换 `meme_template`。对于 `compare`，包含 `comparison`。

## VLM Recognition Mock Object

用于 `prompt-pack.json.vlm_recognition`，或在展开 pipeline 时用于 `vlm-recognition-mock.json`。它表示在标准化和 prompt 渲染前，对用户上传内容进行一次 VLM pass 后的 mock 结构化输出。

```json
{
  "schema_version": "1.0",
  "artifact_type": "vlm_recognition_mock",
  "created_at": "ISO-8601 timestamp",
  "source_upload": {
    "type": "local_image | uploaded_image | image_url | screenshot | text_idea",
    "path": "",
    "url": "",
    "mime_type": "",
    "width": 0,
    "height": 0,
    "sha256": ""
  },
  "vlm_provider": {
    "type": "mock",
    "model": "human_observed_or_agent_visual_inspection",
    "notes": "说明这是 mock 识别结果，不是线上 VLM API 返回。"
  },
  "recognized_content": {
    "subjects": [],
    "objects": [],
    "scene": "",
    "visible_text": [],
    "composition": "",
    "style_and_rendering": "",
    "color_and_lighting": [],
    "camera_and_crop": "",
    "humor_signals": []
  },
  "reading_candidates": {
    "first_read": "",
    "second_read": "",
    "attention_order": [],
    "possible_misdirection": "",
    "role_mapping_candidates": []
  },
  "uncertainties": [
    {
      "field": "",
      "issue": "",
      "confidence": 0.0
    }
  ],
  "downstream_mapping": {
    "candidate_meme_type": "image_driven | text_driven | hybrid",
    "candidate_template_id": "short_snake_case_id",
    "candidate_variable_slots": [],
    "locked_anchor_candidates": [],
    "editable_candidate_slots": []
  }
}
```

该 object 中业务可读 value 默认必须是中文。技术 ID 和 enum value 保持英文。

## Template Object

```json
{
  "template_id": "short_snake_case_id",
  "title": "",
  "meme_type": "image_driven | text_driven | hybrid",
  "one_sentence_summary": "",
  "core_joke_formula": {
    "setup": "",
    "turn": "",
    "payoff": "",
    "emotional_engine": "",
    "audience_assumption": "",
    "reuse_formula": ""
  },
  "reading_model": {
    "first_read": "",
    "second_read": "",
    "reading_order": [],
    "misdirection_or_reinterpretation": "",
    "role_mapping": [],
    "failure_modes": []
  },
  "salience_model": {
    "primary_attention": [],
    "secondary_attention": [],
    "hidden_or_delayed_elements": [],
    "must_remain_subtle": [],
    "must_remain_obvious": [],
    "forbidden_emphasis": []
  },
  "template_alignment": {
    "locked_meta_properties": [
      {
        "property": "visual_style | subject_form_logic | humanization_degree | composition | text_structure | reading_order | salience | joke_formula | user_subject_identity",
        "rule": "",
        "evidence": "",
        "failure_if_changed": ""
      }
    ],
    "editable_dimensions": [
      {
        "dimension": "subject | action | scene | object | prop | clothing | background | metaphor | caption | emotion | style_detail | camera | typography",
        "min_creative_level": 1,
        "max_scope": "",
        "must_align_to": "",
        "forbidden_drift": []
      }
    ],
    "creative_level_policy": {
      "level_1": "",
      "level_2": "",
      "level_3": "",
      "level_4": "",
      "level_5": "",
      "global_limits": []
    }
  },
  "visual_analysis": {
    "composition": "",
    "subjects": [],
    "scene": "",
    "camera_and_crop": "",
    "color_palette": [],
    "texture_and_rendering": "",
    "style_family": "",
    "prompt_style_profile": {
      "art_medium": "",
      "rendering_method": "",
      "line_and_shape_language": "",
      "color_and_lighting": "",
      "texture_material_surface": "",
      "camera_lens_and_depth": "",
      "composition_rhythm": "",
      "typography_style": "",
      "postprocessing_look": "",
      "style_prompt_fragments": {
        "base": [],
        "faithful": [],
        "creative": []
      },
      "negative_style_constraints": []
    },
    "visual_hierarchy": "",
    "recognition_anchors": []
  },
  "text_analysis": {
    "has_text": false,
    "detected_text": [],
    "language": [],
    "layout": [],
    "rhetorical_pattern": "",
    "background_context": {
      "needed": false,
      "notes": "",
      "confidence": 0.0
    },
    "text_formula": "",
    "localization_notes": []
  },
  "variable_slots": [],
  "series_potential": {
    "can_expand": true,
    "best_use_cases": [],
    "weak_use_cases": [],
    "template_family": ""
  }
}
```

## Variable Slot Object

```json
{
  "slot_id": "subject_primary",
  "category": "subject",
  "role": "",
  "current_value": "",
  "lock_level": "locked | faithful_editable | creative_editable | fully_editable",
  "faithful_change_rule": "",
  "creative_change_rule": "",
  "min_creative_level": 1,
  "examples": {
    "faithful": [],
    "creative": []
  },
  "downstream_hint": "",
  "salience_requirement": "dominant | secondary | subtle | hidden | delayed | misleading | backgrounded | not_applicable",
  "identity_binding": {
    "bind_full_appearance": false,
    "bind_silhouette": false,
    "bind_label": false,
    "bind_color": false,
    "bind_pose": false,
    "bind_expression": false,
    "bind_semantic_role": false,
    "notes": ""
  },
  "subject_replacement_policy": {
    "default_for_faithful": "replace_when_user_provides_target | preserve_source_when_no_target | preserve_source_identity",
    "default_for_creative": "operator_controlled | free_replace | preserve_role_only",
    "replaceable_aspects": [],
    "preserved_aspects": [],
    "operator_notes": ""
  }
}
```

`min_creative_level` 记录该槽位第一次可被修改的等级。`lock_level: "locked"` 的槽位在任何 creative level 都不得开放。

`subject_replacement_policy` 对 `category: "subject"` 的槽位是必需的，对其他槽位可选。在 high-fidelity prompt pack 中，用户提供的替换主体通常应绑定到可编辑主体槽；除非保留精确源主体身份对笑点必不可少且用户没有要求替换，否则源主体身份不应出现在 `faithful_variant.locked_features` 中。

## Faithful Variant Object

```json
{
  "goal": "在替换请求的可编辑槽位时保留可识别性。",
  "locked_features": [],
  "locked_reading_model": [],
  "locked_salience_model": [],
  "locked_style_profile": [],
  "editable_slots": [],
  "subject_replacement_policy": {
    "requested_subject_is_editable": true,
    "lock_source_subject_identity": false,
    "preserve_subject_role": true,
    "preserve_pose_expression_or_scale_when_needed": true,
    "notes": ""
  },
  "max_change_budget": {
    "description": "在失去高保真识别度前，最多允许改变多少个维度。",
    "recommended_changed_slots": 1,
    "must_not_change": []
  },
  "generation_constraints": {
    "positive": [],
    "negative": [],
    "text_rendering": [],
    "layout_preservation": []
  },
  "example_variants": []
}
```

`locked_features` 必须列出布局、裁切、文字位置、阅读顺序线索、角色关系和风格特征等不变量锚点。当用户提供替换主体时，不要把源主体身份列为 locked。将该主体放入 `editable_slots`，并在 `subject_replacement_policy` 中描述保留的角色。

## Creative Variant Object

```json
{
  "goal": "在扩展 meme 系列时保留公式和风格家族。",
  "preserved_principles": [],
  "preserved_reading_model": [],
  "preserved_salience_model": [],
  "preserved_style_profile": [],
  "editable_dimensions": [],
  "creative_freedom_controls": {
    "operator_editable_dimensions": [
      {
        "dimension": "subject | action | scene | object | metaphor | caption | emotion | style_detail | camera | typography",
        "freedom": "open | limited | locked",
        "rule": ""
      }
    ],
    "requires_operator_approval": [],
    "must_preserve": []
  },
  "series_style_rules": [],
  "generation_constraints": {
    "positive": [],
    "negative": [],
    "text_rendering": [],
    "style_preservation": []
  },
  "example_variants": []
}
```

`creative_freedom_controls` 让运营者决定模板库或 campaign 中哪些维度开放。Free-creative output 不应自动重写每个维度；它应遵循这些控制，同时保留公式、阅读模型、显著性模型和风格家族。

## Prompt Contract Object

当 `mode` 为 `prompt-contract`，或用户要求 image-generation-ready output 时使用。

```json
{
  "faithful_prompt_contract": {
    "prompt": "",
    "locked_elements": [],
    "editable_elements": [],
    "subject_replacement_policy": {},
    "prompt_style_profile": {},
    "negative_prompt": [],
    "text_instructions": [],
    "postprocessing_notes": []
  },
  "creative_prompt_contract": {
    "prompt": "",
    "style_rules": [],
    "creative_freedom_controls": {},
    "formula_rules": [],
    "negative_prompt": [],
    "text_instructions": [],
    "postprocessing_notes": []
  }
}
```

## Generation Pipeline Object

当 `mode` 为 `render-prompts`、用户提供要插入 meme 模板的目标内容，或下游生成应在无参考图情况下运行时使用。

```json
{
  "source_template_id": "short_snake_case_id",
  "reference_strategy": "none | image_reference | edit_target",
  "reference_requirements": {
    "needs_user_subject_reference": false,
    "user_subject_reference_role": "none | identity_reference | style_reference | edit_target",
    "user_subject_reference_quality": {
      "quality_score": "unknown | low | medium | high",
      "usable_for_identity": false,
      "issues": [],
      "identity_cues_detected": [],
      "identity_confidence": "unknown | low | medium | high",
      "vlm_identity_summary": "",
      "generation_policy": "none | use_reference_only | use_reference_plus_vlm_identity_summary | semantic_replacement_only",
      "fallback_if_too_poor": "none | ask_for_better_reference | lower_identity_confidence | semantic_replacement_only"
    },
    "needs_source_meme_reference": false,
    "source_meme_reference_role": "none | composition_reference | style_reference | layout_reference | typography_reference | edit_target",
    "reference_priority": "user_subject_first | source_meme_first | balanced | none",
    "use_source_meme_as_generation_reference": false,
    "source_meme_reference_risk": [],
    "identity_preservation_targets": [],
    "template_alignment_targets": [],
    "decision_notes": []
  },
  "vlm_recognition_ref": "vlm-recognition-mock.json",
  "user_input_normalization": {
    "raw_user_input": "",
    "normalized_fields": {
      "subject": "",
      "task": "",
      "caption": "",
      "setting": "",
      "style_intensity": "faithful | creative | both",
      "constraints": [],
      "negative_constraints": []
    },
    "inferred_fields": [
      {
        "field": "",
        "value": "",
        "reason": "",
        "confidence": 0.0
      }
    ],
    "missing_fields": []
  },
  "slot_bindings": [
    {
      "slot_id": "subject_primary",
      "placeholder": "{{primary_subject}}",
      "value": "",
      "source": "user_input | inferred | template_default",
      "applies_to": "faithful | creative | both",
      "confidence": 0.0,
      "binding_mode": "full_appearance | silhouette_cues | label_only | color_trace | pose_only | expression_only | semantic_role | texture_or_artifact",
      "salience_requirement": "dominant | secondary | subtle | hidden | delayed | misleading | backgrounded | not_applicable"
    }
  ],
  "prompt_templates": {
    "base": "",
    "faithful": "",
    "creative": ""
  },
  "rendered_prompts": {
    "base": "",
    "faithful": "",
    "creative": ""
  },
  "downstream_generation_notes": {
    "text_to_image_ready": true,
    "needs_reference_image": false,
    "needs_user_subject_reference_image": false,
    "needs_source_meme_reference_image": false,
    "uses_vlm_identity_summary": false,
    "identity_preservation_confidence": "not_applicable | low | medium | high",
    "manual_steps": []
  }
}
```

Placeholder 规则：

- 只使用 `{{snake_case}}` placeholder。
- 写入 `rendered_prompts` 前，通过 `slot_bindings` 解析每个 placeholder。
- 不要在 `rendered_prompts` 中留下未解析 placeholder。
- 如果用户遗漏内容，使用推断值或模板默认值，并在 `user_input_normalization.inferred_fields` 记录该决策。
- 当输出面向无源图 text-to-image generation 时，使用 `reference_strategy: "none"`。
- 当特定上传主体必须保持可识别时，设置 `needs_user_subject_reference: true`。不要声称纯文本 prompt 已验证身份保留。
- 当用户主体参考图低质但可识别时，保持 `needs_user_subject_reference: true`，填充 `user_subject_reference_quality`，设置 `generation_policy: "use_reference_plus_vlm_identity_summary"`，并降低 `identity_preservation_confidence`，不要丢弃图片。
- 如果无法从上传图识别用户主体，设置 `usable_for_identity: false`，并选择 `fallback_if_too_poor: "ask_for_better_reference"` 或 `generation_policy: "semantic_replacement_only"`。
- 当原 meme 图会与用户主体参考图竞争、泄漏源主体身份，或鼓励复制源文字、Logo、UI 或看起来受保护的 artifact 时，设置 `use_source_meme_as_generation_reference: false`。

## Prompt Pack Object

用于 `prompt-pack.json`。这是默认的紧凑主产物，内嵌从用户输入 -> normalized JSON -> slot binding -> prompt template replacement -> 最终 faithful 和 creative prompts 的完整 pipeline。除非用户要求 debug 或分步读取，不要把这些中间对象默认拆成多个 JSON 文件。

```json
{
  "schema_version": "1.2",
  "artifact_type": "meme_prompt_pack",
  "created_at": "ISO-8601 timestamp",
  "source_access": {},
  "vlm_recognition": {},
  "normalized_input": {},
  "meme_template": {},
  "reference_requirements": {},
  "slot_bindings": [],
  "prompt_templates": {
    "base": "",
    "faithful": "",
    "creative": ""
  },
  "rendered_prompts": {
    "base": {
      "label": "base_template",
      "prompt": "",
      "prompt_style_profile": {},
      "locked_reading_model": [],
      "locked_salience_model": [],
      "failure_modes": []
    },
    "faithful": {
      "label": "high_fidelity",
      "prompt": "",
      "negative_prompt": [],
      "locked_features": [],
      "locked_reading_model": [],
      "locked_salience_model": [],
      "locked_style_profile": [],
      "subject_replacement_policy": {},
      "editable_slots": []
    },
    "creative": {
      "label": "free_creative",
      "prompt": "",
      "negative_prompt": [],
      "preserved_formula": [],
      "preserved_reading_model": [],
      "preserved_salience_model": [],
      "preserved_style_profile": [],
      "creative_freedom_controls": {},
      "editable_dimensions": []
    }
  },
  "postprocessing": {}
}
```

`faithful.prompt` 和 `creative.prompt` 字段必须包含最终中文文本，且不包含未解析的 `{{placeholder}}` 字符串，除非用户明确要求英文 prompt。

## Postprocessing Object

```json
{
  "required": true,
  "steps": [
    {
      "step": "manual_text_compositing",
      "reason": "",
      "applies_to": "faithful | creative | both"
    }
  ],
  "json_paths_for_downstream": [
    "$.generation_pipeline.user_input_normalization.normalized_fields",
    "$.generation_pipeline.slot_bindings",
    "$.generation_pipeline.prompt_templates",
    "$.generation_pipeline.rendered_prompts"
  ]
}
```

## Compare Mode

```json
{
  "comparison": {
    "shared_formula": "",
    "shared_style_rules": [],
    "shared_variable_slots": [],
    "differences": [],
    "series_strategy": {
      "faithful_series": "",
      "creative_series": ""
    }
  }
}
```
