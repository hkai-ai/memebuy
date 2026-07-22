# JSON Contract

本文件用于 `image-edit-template`、debug、真实生成结果和 compare 场景。默认主产物是 `image-edit-template.json` 和编译后的 `meme-template.json`。

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
    "manifest": "index.md"
  }
}
```

按目的选择主产物：

- `image-edit-template` 默认写 `meme-template.json`、`image-edit-template.json` 和 `index.md`；`meme-template.json` 严格符合 GalleryTemplateImport，`image-edit-template.json` 是 Agent 编辑草稿。
- `image-edit-template` 需要保留完整分析链路时，默认额外写 `image-edit-analysis.json`，不要把完整 `analysis` 塞进主文件。
- `template`、`template-library-entry` 默认写 `meme-template.json` 和 `index.md`。
- `batch` 默认写 `meme-template.json`、`batch-manifest.json` 和 `index.md`。

## Image Edit Template Object

`image-edit-template.json` 是后端 API/editConfig 草稿 schema。正式产品链路中，前端不直接读取本地 artifact；后端录入模板后，把等价的编辑配置作为 API 响应返回给前端，前端再渲染可编辑提示词、槽位控件、候选项和图片输入。后端根据最终编辑状态拼接图像编辑指令。

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
  "templateSource": {},
  "userSubjectInput": {},
  "templateText": "这是一只【主体：狗】在吃【食物：哈密瓜】",
  "editablePrompt": "这是一只狗在吃哈密瓜",
  "allowFullRewrite": true,
  "slots": [],
  "imageRefs": [],
  "backendHint": {},
  "analysisRef": "image-edit-analysis.json"
}
```

字段规则：

- `templateText`: 使用 `【槽位：默认值】` 标记变量，供前端显示槽位边界。
- `templateSource`: 模板资产图，不等同于用户上传图；默认 `role: "template_reference"`，用于封装源梗图的结构、构图、排布、风格和保留约束。
- `userSubjectInput`: 用户主体输入的统一抽象；可以是文字、用户上传图片、素材选择或默认主体。
- `editablePrompt`: 当前整段提示词。用户可以整段删除、重写或只改槽位。
- `allowFullRewrite`: 必须为 `true`，除非用户明确要求锁定整段 prompt。
- `slots[]`: 前端表单控件定义；文本和图片槽统一放在这里。
- `mockUserInput`: 可选。只在 demo、产品验收或用户明确要求 mock 时生成；普通前端运行模板和后台入库不需要它。
- `imageRefs[]`: 当前可用图片引用，包括源图、用户上传、用户选择、mock 上传。
- `backendHint`: 后端拼接建议，不绑定具体图像模型 API。
- `analysisRef`: 可选分析 sidecar 路径。默认用它指向 `image-edit-analysis.json`。
- `analysis`: 仅 debug、单文件归档或用户明确要求时内嵌；包括 `meme_formula`、`slot_minimization_review`、`co_variation_constraints`、`fusion_model`。

## Runtime vs Analysis Split

默认 `image-edit-template.json` 是后端可下发的编辑配置草稿，不是完整分析档案，也不是生产前端直接读取的文件。主文件应保留后端入库/API 响应和前端渲染真正需要的字段：

- API/editConfig：`templateText`、`editablePrompt`、`allowFullRewrite`、`slots[]`。
- 后端：`templateSource`、`userSubjectInput`、`imageRefs`、`backendHint`。
- 追踪：`sourceAccess`、`analysisRef`。

完整分析、自检和 QA 依据写入同目录 `image-edit-analysis.json`：

```json
{
  "schemaVersion": "1.0",
  "artifactType": "image_edit_analysis",
  "createdAt": "ISO-8601 timestamp",
  "sourceTemplate": "image-edit-template.json",
  "templateId": "short_snake_case_id",
  "title": "",
  "analysis": {}
}
```

分析 sidecar 的 `analysis` 在 `meme_formula` 前必须包含文化参照发现链路：

```json
{
  "visual_observations": [],
  "distinctive_feature_bundle": [],
  "content_function": "meme_template | reaction_image | cute_pet | aesthetic_image | ordinary_photo | original_visual_joke | unknown",
  "reference_discovery": {
    "reference_status": "confirmed | probable | suspected | none | unknown",
    "reference_type": "artwork | film | television | game | anime | celebrity | advertisement | internet_meme | regional_culture | none | unknown",
    "primary_reference": "",
    "evidence": [],
    "counter_evidence": [],
    "none_evidence": [],
    "human_review_required": false,
    "review_reasons": []
  },
  "interpretation_hypotheses": [],
  "formula_reflection_review": {
    "distinctive_bundle_explained": true,
    "alternative_hypotheses_compared": true,
    "generic_description_risk": "low",
    "reference_anchors_identified": [],
    "unknown_as_none_risk": "low",
    "passed": true,
    "review_reasons": []
  },
  "confidence": {
    "visual_observation": 0.0,
    "reference_identification": 0.0,
    "context_understanding": 0.0,
    "meme_formula": 0.0,
    "slot_design": 0.0
  }
}
```

槽位设计还必须包含组件绑定链路：

```json
{
  "component_graph": {
    "components": [
      {
        "id": "headline",
        "type": "text",
        "parentId": "canvas",
        "visibleEvidence": ["画面顶部存在大号 MEOW 字样"],
        "editableProperties": ["text", "color"],
        "lockedProperties": ["top_zone", "display_typography"]
      }
    ],
    "relationships": []
  },
  "edit_intent_candidates": [
    {
      "id": "edit-headline-text",
      "componentId": "headline",
      "property": "text",
      "operation": "replace_text",
      "userEditLikelihood": 0.96,
      "visualSalience": 0.98,
      "templateIntegrityRisk": "low",
      "frontendControl": "prompt",
      "decision": "expose",
      "slotId": "headline",
      "reason": "主标题是高显著且自然可编辑的海报组件"
    }
  ],
  "slot_intelligence_review": {
    "mechanismClass": "poster_layout",
    "selectedSlotIds": ["headline"],
    "genericSlotReuseRisk": "low",
    "componentCoveragePassed": true,
    "textSlotAuditPassed": true,
    "compositeInputAuditPassed": true,
    "passed": true,
    "reviewReasons": []
  }
}
```

`selectedSlotIds` 必须与 `image-edit-template.json.slots[].id` 完全一致。每个开放槽位必须存在一个 `decision: expose` 候选，并绑定有效 `componentId` 和具体 `property`。未开放的显著组件属性也要有候选及原因。

`interpretation_hypotheses` 至少覆盖 `external_reference`、`intrinsic_visual_joke`、`standalone_image` 三类。完整规则见 `references/cultural-reference-discovery.md`。转换器只把精简 `referenceContext` 和审核原因写入 Gallery metadata，不把完整推理链入库。

清洗历史过长产物时，使用仓库脚本：

```bash
python skills/meme-template-analyzer/scripts/clean_image_edit_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json
```

默认输出 `image-edit-template.clean.json` 和 `image-edit-analysis.json`，不覆盖原文件。只需要模拟后端 API 返回给前端的字段时可加 `--profile frontend` 输出 `image-edit-template.frontend.json`。

清洗脚本默认删除 `mockUserInput`。如需 demo 或验收预览，加 `--keep-mock-user-input`。

从历史编辑配置草稿补生成入库主文件时，使用：

```bash
python skills/meme-template-analyzer/scripts/convert_image_edit_to_meme_template.py artifacts/meme-template-analyzer/<id>/image-edit-template.json
```

转换脚本输出 GalleryTemplateImport 固定字段：

- 展示/资产：`key`、`title`、`description`、`cover`、`referenceImage`
- 生成配置：`imageSize`、`imageN`
- 前端可编辑字段：`promptTemplate`、`inputSchema`
- 后端策略字段：`promptEnhancement`、`preprocessSteps`
- 运行时字段：`resolvedPrompt`，只交给图片网关，不写入模板 JSON
- 扩展存储：`metadata`

顶层 Schema 设置 `additionalProperties: false`，不要输出 `version`、`taxonomy`、`assets`、
`editConfig`、`ingestion` 或 `exampleWorks`。完整规则见
`references/gallery-authoring-contract.md`；转换后运行：

```bash
python skills/meme-template-analyzer/scripts/validate_gallery_template.py artifacts/meme-template-analyzer/<id>/meme-template.json
```

## Template Source Object

`templateSource` 描述模板自带源图。它不是用户每次上传的图，而是模板资产。只要模板封装了源梗图，就应写入该对象。

```json
{
  "id": "source_meme_image",
  "role": "template_reference",
  "path": "",
  "authority": {
    "composition_authority": "high | medium | low | none",
    "style_authority": "high | medium | low | none",
    "identity_authority": "high | medium | low | none"
  },
  "preserve": [
    "vertical_crop",
    "center_subject_position",
    "foreground_occlusion",
    "arrangement_pattern"
  ],
  "locked_composition_constraints": [
    {
      "id": "arrangement_pattern",
      "label": "排布方式",
      "value": "规整行列墙面",
      "description": "周围重复物按近似行列、货架或墙面矩阵排布，而不是随机堆叠。"
    }
  ],
  "doNotUseFor": ["user_identity"]
}
```

规则：

- `template_reference` 的 `composition_authority` 默认高于用户上传图。
- `arrangement_pattern`、文字位置、镜头裁切、前景遮挡、中心主体位置如果是梗成立关键，必须写入 `preserve` 或 `locked_composition_constraints`。
- 不要把“规整排布”误写成“每个元素的精确位置”。前者是模板结构，后者通常不是前端槽位。

## User Subject Input Object

`userSubjectInput` 统一描述用户想替换或生成的主体。用户可能上传图，也可能只输入文本。

```json
{
  "slotId": "target_subject",
  "acceptedInputKinds": ["text", "image_upload", "image_select"],
  "currentKind": "text | image_upload | image_select | default",
  "textValue": "",
  "imageRefId": "",
  "authority": {
    "semantic_authority": "high | medium | low | none",
    "identity_authority": "high | medium | low | none",
    "composition_authority": "none"
  },
  "fallback": "使用模板默认主体"
}
```

规则：

- 用户上传图片或选择素材时，通常只提供 `identity_authority`，不要覆盖 `templateSource` 的构图权限。
- 用户只输入“一条狗”“某个角色名”时，使用 `semantic_authority`，并在 reference-aware prompt 中说明主体来自文字描述。
- 用户不提供主体时，使用默认主体或槽位默认值，不要伪造 mock 上传图。

## Frontend Slot Object

```json
{
  "id": "subject",
  "label": "主体",
  "inputKind": "text | prompt | select | image_upload | image_select | subject",
  "slotRole": "semantic_replacement | prompt_fragment | visual_variable | identity_reference | edit_target | style_reference | composition_reference",
  "required": true,
  "defaultValue": "狗",
  "currentValue": "狗",
  "placeholder": "输入新的主体",
  "suggestions": [
    "小猪",
    "猫",
    "柯基犬"
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
  "ui": {}
}
```

`inputKind` 语义：

- `text`: 短文本替换，如主体、食物、动作。
- `prompt`: 长提示词片段，如补充要求、氛围、负向约束。
- `select`: 候选项选择，通常仍设置 `allowCustom: true`。
- `image_upload`: 用户上传图片。
- `image_select`: 用户从素材库、示例图或历史上传中选择图片。
- `subject`: 同一主体的复合输入，允许预设、自由文本和图片上传；图片按 `image_over_text` 覆盖文本身份。

`slotRole` 语义：

- `semantic_replacement`: 替换模板句中的语义变量。
- `prompt_fragment`: 作为额外 prompt 片段拼接。
- `identity_reference`: 保留图片中主体身份。
- `edit_target`: 直接编辑目标图片。
- `style_reference`: 提取风格、色彩、材质或媒介。
- `composition_reference`: 提取构图、镜头、布局或文字位置。

显性视觉变量仍需进入槽位候选审计。对象自身的颜色或文字内容可使用 `slotRole: "visual_variable"`；背景内容、背景颜色、整体配色或色调通过组件独立性、编辑概率和模板完整性审计后也可进入 `inputSchema`。画幅、构图、姿态、镜头、风格、光影、媒介和材质由参考图锁定。

`suggestions` 默认使用 `string[]`。不要在普通前端运行模板里写重复的 `{ "value": "小猪", "label": "小猪" }`，也不要默认写 `reason`。只有候选值和展示名不同、需要后台解释或 debug 时，才使用对象：

```json
{
  "suggestions": [
    {"value": "corgi", "label": "柯基犬", "reason": "后台审核解释，可选"}
  ]
}
```

`ui` 是可选字段。普通前端编辑器可以按数组顺序、`inputKind`、`slotRole` 和 `templateText` 渲染，不需要默认写 `group`、`order`、`helperText`。只有后台配置页、强绑定布局或需要运营提示时才写 `ui`。

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
  "generationModes": {
    "reference_aware_prompt": {
      "default": true,
      "templateSourcePolicy": {
        "role": "template_reference",
        "authority": ["composition_authority", "style_authority"],
        "mustPreserve": ["arrangement_pattern", "center_subject_position", "foreground_occlusion"]
      },
      "userInputPolicy": {
        "text": "按文字语义生成或替换主体。",
        "image_upload": "只提取身份线索，不覆盖模板构图。",
        "image_select": "按素材身份线索替换主体。",
        "default": "使用模板默认主体。"
      },
      "promptSkeleton": "Use template image as composition reference; preserve {locked_composition_constraints}. Use user subject input as {authority}; edit {editable_slots}."
    },
    "prompt_mode": {
      "alias": "text_only_prompt",
      "promptMustInclude": ["arrangement_pattern", "camera_crop", "foreground_occlusion", "style_notes"],
      "promptMustAvoid": ["random pile", "scattered heap", "using user image as layout reference"]
    }
  },
  "imageReferencePolicy": [
    "identity_reference 用于保留用户上传主体身份。",
    "edit_target 用于直接编辑目标图。",
    "style_reference 和 composition_reference 只作为辅助参考。"
  ],
  "notes": []
}
```

复合主体槽沿用同一组图片字段，并增加 `imagePromptValue`。转换后生成 Gallery v2 `subject`，其中 `text` 保存默认值、预设和自由编辑能力，`image` 保存上传能力；图片模式下 `{{subjectId}}` 使用中性 `promptValue`，不得继续写死默认主体。

## Prompt 三层对象

- `promptTemplate`：前端可见、可自由编辑的基础提示词模板，只包含创作意图。
- `promptEnhancement`：仅后端可见，保存 LLM 二次编辑 instruction、参考图字段、锁定约束、preserve 项和 `{format: json, promptField: finalPrompt}` 输出协议。
- `resolvedPrompt`：运行时结果，不归档、不回显，只交给图片网关。

`backendHint` 不绑定 OpenAI、Cloudflare、ComfyUI 或其他图像 API。后端把 `editablePrompt + slots + imageRefs` 转成实际请求时，全文编辑结果必须先覆盖基础提示词中的旧内容值，再进入 `promptEnhancement`。开放内容由用户决定，呈现维度由参考图决定。

`generationModes.reference_aware_prompt` 是有模板资产图时的默认编译路径。它把同一份用户输入转换成带参考图约束的提示词：模板资产图负责构图和保留项，用户输入负责主体语义或身份。`generationModes.prompt_mode` / `text_only_prompt` 是无参考图或自由变体的降级路径，必须把模板结构完整文字化。

`promptEnhancement` 的详细边界见 `prompt-enhancement-v2.md`：`lockedConstraints` 只指名参考图负责且未开放的视觉维度，`preserve` 只保存语义锚点；背景或色调可以有条件开放，姿态、镜头、构图、风格、光影、媒介和材质保持锁定。

## 分析对象

这些对象用于 `image-edit-analysis.json` 或 debug 输出，不默认暴露为前端必填字段。只有单文件归档或用户明确要求时，才放入 `image-edit-template.json.analysis`。

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
  "locked_composition_constraints": [],
  "variable_slots": []
}
```

`slot_reflection_review` 是槽位反思逻辑，用来防止漏掉用户自然会编辑的候选，也防止把所有画面元素都暴露成表单。`candidate_scan` 必须覆盖语义、文案、显性视觉变量、构图、图片引用和约束六类；`missing_obvious_slots` 理想情况下为空；`coverage_requirements` 驱动真实生成测试时只改变开放内容属性，不把背景环境或整体风格当作同款变量。

反思时增加语义合并：表达同一用户意图、通常需要同步修改或可由其他槽推导的维度不应全部成为必填槽。默认保留 2-4 个核心业务槽位，辅助颜色和图片参考可选。

颜色候选必须按视觉层识别：`canvas_background` 是画布底层，`frame_border` 是沿画布或容器边缘的外框，`subject_outline` 是贴合主体轮廓的描边，`content_panel` 是局部前景容器。同款模式记录这些层的联动和锁定关系；只有颜色属于开放对象自身的内容属性时才建立槽位。

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
        "arrangement_pattern": "pass | fail | partial | not_applicable",
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
