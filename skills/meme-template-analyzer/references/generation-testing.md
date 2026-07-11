# 真实生成测试

仅在用户明确要求输出图片、测试效果或运行 `analyze-and-generate-test` 时使用。

## 流程

1. 先完成普通单图分析、草稿、转换和校验。
2. 有模板资产图时默认使用 reference-aware prompt；用户主体图只提供身份权限。
3. 默认生成 3 张真实 PNG/JPEG/WebP：
   - 第 1 张覆盖用户主需求或 mock 输入。
   - 第 2 张改变至少一个显性视觉变量，如背景、主色、文字色或主体色。
   - 第 3 张改变另一个核心槽位，如主体、动作、道具、文案或场景。
4. 每张必须替换至少一个核心槽位，三张不能只是随机种子变化。
5. 保存到同目录 `output/`，写 `generation-results.json` 和 `summary.md`。

## 每张结果

至少记录：

- `caseId`
- `file`
- `variantIntent`
- 完整 `prompt`
- `mustDifferFromSource`
- `slotValues`
- `qa`
- `notes`

QA 检查主体、文案、风格、构图、`arrangement_pattern`、文字区域、遮挡、画幅、边框/背景变化、水印和与源图差异。存在颜色槽时至少一张改变颜色或背景；改变背景时明确 frame border 和 subject outline 的变化策略。

结果必须是真实图片，不能用 SVG、程序化占位图、JSON 或 mock 描述代替。生成后检查文件存在、非空、格式合理并人工查看。
