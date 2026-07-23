# 模板图与用户图权限

## 三类对象

- `templateSource`：固定模板资产图，`role: template_reference`，提供构图、排布、镜头、遮挡、文字位置和风格锚点。
- `userSubjectInput`：用户主体输入，可来自文本、上传图、素材图或默认值。
- `imageRefs[]`：当前会话可用图片引用；必须标明角色和 authority。

## Authority 规则

模板图：

- `composition_authority`：主体位置、画幅、镜头、遮挡、版式、文字区域和 `arrangement_pattern`。
- `style_authority`：媒介、线稿、色彩节奏和材质。
- `identity_authority`：通常为 `none`，固定角色模板除外。
- 存在模板图时，instruction 必须声明模板图在构图、镜头、姿态、风格、材质、光影及其他未开放呈现维度拥有最高权限，同时明确排除全部开放槽位对应维度。背景或色调未开放时由模板图控制，开放时由用户输入控制。下游图像模型会同时收到参考图，不要求最终提示词复述“以参考图为基准”等元指令。

用户输入：

- 上传图或素材图使用 `identity_authority`，保留身份、轮廓、颜色、服饰和可用表情线索。
- 文本输入使用 `semantic_authority`，只定义主体语义。
- 用户图默认 `composition_authority: none`，不得覆盖模板图构图。
- 未提供用户主体时使用槽位默认值，不伪造上传图。

## 构图保留

整体排布规则不能被误降级为单个元素坐标。规整行列、货架矩阵、贴纸墙、聊天气泡栅格、九宫格、文字区域和前景遮挡必须写入：

- `analysis.locked_composition_constraints`
- `templateSource.preserve`
- `backendHint.generationModes.reference_aware_prompt.mustPreserve`
- 真实生成 QA

`lockedConstraints` 指名沿用参考图的构图、媒介风格和空间关系等未开放维度，不复述具体对象和取值，也不得包含已开放的背景或色调维度。推荐使用“沿用参考图的画幅、裁切、留白、镜头景别与元素位置比例”等短句。模板的语义关系写入 `preserve`，例如“纸箱前沿必须遮挡盒内主体下半身”；没有语义锚点时留空。

## 图片槽

- `identity_reference`：保留用户主体身份。
- `edit_target`：直接编辑用户图或目标图。
- `style_reference`：提取风格、材质、色彩或媒介。
- `composition_reference`：提取构图、镜头和布局。

用户上传图默认原图直通生成，不创建 vision step。`extract` 放入 `metadata.inputSemantics`；只有后端已绑定视觉能力且业务明确需要“读图转文字”时才使用 vision preprocess。

## 复合主体槽

同一主体允许预设、自由文本和图片上传时使用 `inputSchema.type: subject`。前端把它渲染为一个控件，运行时按以下顺序解析：

1. 有上传图时选择 image mode，`{{subjectId}}` 注入 `image.promptValue`，原图作为 identity reference 直通网关。
2. 没有上传图时选择 text mode，依次使用自定义文本、预设值和 `text.defaultValue`。
3. `resolutionStrategy` 固定为 `image_over_text`；图片身份不得覆盖模板图的构图和风格权限。

这些权限和冲突处理写入后端 `promptEnhancement`，不暴露在前端 `promptTemplate`。
