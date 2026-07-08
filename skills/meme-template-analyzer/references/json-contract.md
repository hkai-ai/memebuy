# JSON Contract

本文件用于 `image-edit-template`、debug、legacy prompt pack 和 compare 场景。新默认主产物是 `image-edit-template.json`；`prompt-pack.json` 只用于 legacy/debug。

## 语言约定

所有业务可读内容默认使用简体中文。JSON key、schema 名、文件名、路径、JSONPath、placeholder、mode 名、enum 值、label、ID、hash、URL 和类似代码的值保持原文。meme 中可见的源文字逐字保留，可另加中文解释。

## Artifact 目录结构

默认只写最少必要文件：

```json
{
  "result_directory": "artifacts/meme-template-analyzer/<template_id-or-timestamp>/",
  "files": {
    "image_edit_template": "image-edit-template.json",
    "meme_template": "meme-template.json",
    "batch_manifest": "batch-manifest.json",
    "prompt_pack": "prompt-pack.json",
    "stability_testset": "stability-testset.json",
    "manifest": "index.md"
  }
}
```

按目的选择主产物：

- `image-edit-template` 默认写 `image-edit-template.json` 和 `index.md`。
- `template`、`template-library-entry` 默认写 `meme-template.json` 和 `index.md`。
- `batch` 默认写 `meme-template.json`、`batch-manifest.json` 和 `index.md`。
- legacy `render-prompt-pack`、debug prompt pipeline 才写 `prompt-pack.json`。
- legacy `stability-testset` 才写 `stability-testset.json`。

## Image Edit Template Object

`image-edit-template.json` 是面向前端的默认 schema。它让前端渲染可编辑提示词、槽位控件、候选项和图片输入；后端只根据最终编辑状态拼接图像编辑指令。

```json
{
  "schemaVersion": "1.0",
  "artifactType": "image_edit_template",
  "createdAt": "ISO-8601 timestamp",
  "sourceAccess": {
    "inputs": [],
    "limitations": [],
    "analysisConfidence": 0.0
  },
  "templateId": "short_snake_case_id",
  "title": "",
  "summary": "",
  "templateText": "这是一只【主体：狗】在吃【食物：哈密瓜】",
  "editablePrompt": "这是一只狗在吃哈密瓜",
  "allowFullRewrite": true,
  "slots": [],
  "mockUserInput": {},
  "imageRefs": [],
  "backendHint": {},
  "analysis": {}
}
```

字段规则：

- `templateText`: 使用 `【槽位：默认值】` 标记变量，供前端显示槽位边界。
- `editablePrompt`: 当前整段提示词。用户可以整段删除、重写或只改槽位。
- `allowFullRewrite`: 必须为 `true`，除非用户明确要求锁定整段 prompt。
- `slots[]`: 前端表单控件定义；文本和图片槽统一放在这里。
- `mockUserInput`: 基于槽位生成的示例用户填写结果，不再按 hifi/free 分支生成。
- `imageRefs[]`: 当前可用图片引用，包括源图、用户上传、用户选择、mock 上传。
- `backendHint`: 后端拼接建议，不绑定具体图像模型 API。
- `analysis`: 可选内嵌分析，包括 `meme_formula`、`slot_minimization_review`、`co_variation_constraints`、`fusion_model`。

## Frontend Slot Object

```json
{
  "id": "subject",
  "label": "主体",
  "inputKind": "text | prompt | select | image_upload | image_select",
  "slotRole": "semantic_replacement | prompt_fragment | visual_variable | identity_reference | edit_target | style_reference | composition_reference",
  "required": true,
  "defaultValue": "狗",
  "currentValue": "狗",
  "placeholder": "输入新的主体",
  "suggestions": [
    {
      "value": "小猪",
      "label": "小猪",
      "reason": "与原句结构兼容，适合替换主体。"
    }
  ],
  "allowCustom": true,
  "bindsToTemplateText": true,
  "templateToken": "【主体：狗】",
  "extract": "",
  "maxCount": 1,
  "private": false,
  "sourceOptions": [],
  "validation": {
    "minLength": 0,
    "maxLength": 40,
    "allowedMimeTypes": []
  },
  "ui": {
    "group": "main",
    "order": 1,
    "helperText": ""
  }
}
```

`inputKind` 语义：

- `text`: 短文本替换，如主体、食物、动作。
- `prompt`: 长提示词片段，如补充要求、氛围、负向约束。
- `select`: 候选项选择，通常仍设置 `allowCustom: true`。
- `image_upload`: 用户上传图片。
- `image_select`: 用户从素材库、示例图或历史上传中选择图片。

`slotRole` 语义：

- `semantic_replacement`: 替换模板句中的语义变量。
- `prompt_fragment`: 作为额外 prompt 片段拼接。
- `identity_reference`: 保留图片中主体身份。
- `edit_target`: 直接编辑目标图片。
- `style_reference`: 提取风格、色彩、材质或媒介。
- `composition_reference`: 提取构图、镜头、布局或文字位置。

显性视觉变量槽位可使用 `slotRole: "visual_variable"` 标记，尤其是颜色、背景、主体色、文字色、画幅、主体数量、文字位置等前端用户一眼会感知的属性。此类槽位可以同时保留具体语义，例如在 `ui.helperText` 或 `validation` 中说明它是背景色、主色调还是文字色。

图片槽位必须填写 `extract`、`maxCount`、`private`、`sourceOptions`。例如：

```json
{
  "id": "subject_reference",
  "label": "主体参考图",
  "inputKind": "image_upload",
  "slotRole": "identity_reference",
  "required": false,
  "extract": "提取主体类别、颜色、轮廓、表情和可稳定复现的身份线索。",
  "maxCount": 1,
  "private": true,
  "sourceOptions": ["upload", "recent_upload", "asset_library"],
  "allowCustom": false
}
```

## Mock User Input Object

```json
{
  "purpose": "front_end_preview",
  "slotValues": {
    "subject": "小猪",
    "food": "西瓜"
  },
  "imageSelections": [
    {
      "slotId": "subject_reference",
      "source": "mock_user_upload | selected_asset | none",
      "refId": "reference_image_1",
      "notes": "示例参考图，仅用于前端预览。"
    }
  ],
  "renderedTemplateText": "这是一只【主体：小猪】在吃【食物：西瓜】",
  "renderedPromptPreview": "这是一只小猪在吃西瓜"
}
```

规则：

- mock 只用于前端预览和产品验收，不是假装真实用户上传。
- 文本值应来自 `suggestions` 或与源模板同类的替换。
- 图片值必须声明来源：`mock_user_upload`、`selected_asset` 或 `none`。
- `renderedPromptPreview` 不允许留下未解析的 `【槽位：默认值】` 或 `{{placeholder}}`。

## Backend Hint Object

```json
{
  "strategy": "compose_edit_instruction",
  "inputSummary": "后端读取 editablePrompt、slots 当前值和 imageRefs，拼接成图像编辑模型的指令。",
  "exampleInstruction": "参考图1，将小狗改为小猪，让小猪在吃西瓜。",
  "imageReferencePolicy": [
    "identity_reference 用于保留用户上传主体身份。",
    "edit_target 用于直接编辑目标图。",
    "style_reference 和 composition_reference 只作为辅助参考。"
  ],
  "notes": []
}
```

`backendHint` 不绑定 OpenAI、Cloudflare、ComfyUI 或其他图像 API。后端可以自由把 `editablePrompt + slots + imageRefs` 转成实际请求。

## 分析对象

这些对象用于 `image-edit-template.json.analysis`、debug 输出或 legacy prompt pack 内嵌结构，不默认暴露为前端必填字段。

### Template Object

```json
{
  "template_id": "short_snake_case_id",
  "title": "",
  "meme_type": "image_driven | text_driven | hybrid",
  "one_sentence_summary": "",
  "meme_formula": {
    "abstract_formula": "【主体】因为像【对象】而处在【关系】中",
    "core_variables": [
      {
        "id": "subject",
        "role_in_formula": "",
        "source_value": ""
      }
    ],
    "default_rendering_details": [],
    "why_this_is_the_joke": ""
  },
  "reading_model": {
    "first_read": "",
    "second_read": "",
    "reading_order": [],
    "misdirection_or_reinterpretation": "",
    "role_mapping": [],
    "failure_modes": []
  },
  "co_variation_constraints": [],
  "fusion_model": {},
  "slot_minimization_review": {
    "kept_as_core_slots": [],
    "demoted_to_constraints_or_rendering": [],
    "reasoning": "",
    "business_slot_count": 0
  },
  "slot_reflection_review": {
    "candidate_scan": {
      "semantic": [],
      "text": [],
      "visual_variables": [],
      "composition": [],
      "image_references": [],
      "constraints": []
    },
    "exposed_slots": [],
    "locked_or_demoted_candidates": [
      {
        "candidate": "",
        "decision": "locked_invariant | constraint_only | style_note | too_minor | backend_only",
        "reason": ""
      }
    ],
    "missing_obvious_slots": [],
    "coverage_requirements": []
  },
  "variable_slots": []
}
```

`slot_reflection_review` 是槽位反思逻辑，用来防止漏掉用户自然会编辑的候选，也防止把所有画面元素都暴露成表单。`candidate_scan` 必须覆盖语义、文案、显性视觉变量、构图、图片引用和约束六类；`missing_obvious_slots` 理想情况下为空；`coverage_requirements` 可驱动真实生成测试，例如要求至少改变一个颜色或背景槽。

### Fusion Model Object

```json
{
  "has_fused_subject": false,
  "fusion_type": "none | adjacent_reference | body_object_fusion | semantic_role_fusion | scene_fusion",
  "fused_slots": [
    {
      "slot_id": "subject_animal",
      "role": "被融合的主体槽",
      "current_value": "",
      "fusion_role": "source | dependent | shared_structure"
    }
  ],
  "fusion_dimensions": ["color", "brightness", "material", "shape", "silhouette", "cross_section", "texture", "position", "semantic_role", "action"],
  "replacement_sensitivity": "low | medium | high",
  "subject_replaceability": "independent | constrained | low | not_recommended",
  "requires_remap_if_subject_changes": false,
  "remap_targets_if_changed": [],
  "why_it_matters": "",
  "qa_check": ""
}
```

`fused_slots` 不能只列主体；依赖食物、物件、文字或场景槽也要列出。

### Co-variation Constraint Object

```json
{
  "constraint_id": "pet_food_color_match",
  "type": "co_variation | visual_rhyme | semantic_binding | spatial_binding | text_binding | action_binding",
  "source_slot": "subject_pet",
  "dependent_slot": "food_steamer_detail",
  "dimensions": ["color", "brightness", "material", "shape"],
  "sync_rule": "点心颜色、明度和材质必须跟随宠物毛色，使宠物能被误读为同类点心。",
  "failure_if_unsynced": "只替换宠物但不调整点心颜色时，宠物不再像点心，第二读失败。",
  "qa_check": "生成图中主体和依赖槽在指定维度上足够相近。"
}
```

常见 `dimensions` 包括 `color`、`brightness`、`material`、`shape`、`scale`、`position`、`direction`、`label`、`text_reference`、`semantic_role` 和 `motion`。

### Variable Slot Object

```json
{
  "slot_id": "subject_primary",
  "category": "subject",
  "business_exposure": "core | constraint_only | debug_only",
  "formula_variable_ref": "subject",
  "role": "",
  "current_value": "",
  "lock_level": "locked | editable | reference_only",
  "examples": [],
  "downstream_hint": "",
  "identity_binding": {
    "bind_full_appearance": false,
    "bind_silhouette": false,
    "bind_label": false,
    "bind_color": false,
    "bind_pose": false,
    "bind_expression": false,
    "bind_semantic_role": false,
    "notes": ""
  }
}
```

`business_exposure` 区分该槽是否应该进入前端 `slots[]` 或后台 `prompt.slots[]`。只有 `core` 默认进入业务表单；`constraint_only` 和 `debug_only` 只用于约束、QA 或 debug。

## Prompt Pack Object 是 legacy/debug 结构

`Prompt Pack Object 是 legacy/debug 结构`。只有显式请求 `render-prompt-pack`、旧 prompt pipeline、调试中间产物或旧稳定性测试时使用。新图片编辑模板不要默认创建 `prompt-pack.json`。

```json
{
  "schema_version": "legacy-1.2",
  "artifact_type": "meme_prompt_pack",
  "created_at": "ISO-8601 timestamp",
  "source_access": {},
  "vlm_recognition": {},
  "normalized_input": {},
  "meme_template": {},
  "co_variation_constraints": [],
  "fusion_model": {},
  "reference_requirements": {},
  "slot_bindings": [],
  "prompt_templates": {
    "base": "",
    "legacy_variant_a": "",
    "legacy_variant_b": ""
  },
  "rendered_prompts": {
    "base": {
      "label": "base_template",
      "prompt": ""
    }
  },
  "postprocessing": {}
}
```

## Image Generation Results Object

`Image Generation Results Object` 用于真实生成测试，默认写入 `output/generation-results.json`。它记录实际生成图片、完整 prompt、槽位值和 QA 结果。

真实生成测试默认生成 3 张明显不同于原图的结果图。每张至少替换一个核心槽位，并且三张之间不能只是同一 prompt 的随机变体。

```json
{
  "schemaVersion": "1.0",
  "artifactType": "image_generation_results",
  "createdAt": "ISO-8601 timestamp",
  "sourceTemplate": "../image-edit-template.json",
  "generationMode": "built_in_image_gen | cli_fallback | external",
  "results": [
    {
      "caseId": "variant_01_black_dog_cn_caption",
      "file": "result-01-black-dog-jia-you-ba.png",
      "variantIntent": "替换主体和文案，测试中文短文案是否可读。",
      "prompt": "完整生成提示词，必须记录最终发送给图像生成工具的文本。",
      "mustDifferFromSource": [
        "主体不能仍是黑猫",
        "文案不能仍是 GOOD LUCK"
      ],
      "slotValues": {
        "subject": "黑狗",
        "expression": "不情愿营业",
        "caption": "加油吧"
      },
      "qa": {
        "subject": "pass | fail",
        "expression": "pass | fail",
        "background": "pass | fail",
        "text": "pass | fail",
        "style": "pass | fail",
        "watermarkAvoidance": "pass | fail",
        "differsFromSource": "pass | fail",
        "color_or_background_changed": "pass | fail | not_applicable"
      },
      "notes": ""
    }
  ],
  "overall": {
    "templateHeld": true,
    "usableForFrontendDemo": true,
    "mainObservation": "",
    "risks": []
  }
}
```

规则：

- 每个 result 必须有完整 `prompt`；不要只记录 promptSummary。
- `mustDifferFromSource` 写清楚本 case 必须和源图不同的点。
- QA 必须包含 `differsFromSource`，避免把复刻源图误判为通过。
- `summary.md` 应列出每张图片、对应 prompt 摘要、差异点和失败风险。

## Compare Mode

```json
{
  "comparison": {
    "shared_formula": "",
    "shared_style_rules": [],
    "shared_variable_slots": [],
    "differences": [],
    "series_strategy": {
      "front_end_slots": "",
      "backend_composition": ""
    }
  }
}
```
