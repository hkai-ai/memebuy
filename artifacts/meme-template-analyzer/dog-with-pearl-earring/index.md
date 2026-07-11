# 戴珍珠耳环的狗

这是一个以“Dog With a Pearl Earring”为核心的单图模板产物。已识别为对约翰内斯·维米尔《戴珍珠耳环的少女》的名画戏仿：保留回眸近景、白色头巾、单颗珍珠耳环与柔和侧光，只开放动物主体和可选主体参考图。

主产物：

- `image-edit-template.json`：前端编辑草稿
- `image-edit-analysis.json`：视觉、文化参照、公式与槽位审计
- `meme-template.json`：GalleryTemplateImport 入库文件
- `source.png`：用户提供的模板资产
- `backend-integration.md`：前后端、LLM 编排和图像生成服务的接口对齐文档
- `generate-request.example.json`：前端调用生成 API 的请求样例
- `llm-compose.example.json`：后端调用 LLM 编排层的输入样例
- `llm-compose-response.example.json`：LLM 编排层的期望输出样例

验证命令：

```powershell
python skills/meme-template-analyzer/scripts/validate_semantic_analysis.py artifacts/meme-template-analyzer/dog-with-pearl-earring/image-edit-analysis.json
python skills/meme-template-analyzer/scripts/convert_image_edit_to_meme_template.py artifacts/meme-template-analyzer/dog-with-pearl-earring/image-edit-template.json
python skills/meme-template-analyzer/scripts/validate_gallery_template.py artifacts/meme-template-analyzer/dog-with-pearl-earring/meme-template.json
```
