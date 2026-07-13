# Meme 业务管理台

面向业务和运营人员的本地批量管理平台。前端使用 React + Vite，本地 API 使用 TypeScript + Fastify；任务通过本机 `codex exec --json` 调用仓库内 `meme-template-analyzer` skill。

## 使用

在仓库根目录安装依赖：

```powershell
pnpm install
```

启动本地管理台：

```powershell
pnpm dev
```

浏览器访问 `http://127.0.0.1:15173`。API 只监听 `127.0.0.1:14174`。

运营人员可在顶部“标签词库”维护需要复用的视觉创作 tags。内置词条按“版式·形态、画风·笔触、工艺·材质、实拍、观察池”分组；组名只用于整理，不会作为 tag 写入模板。词库保存在 `.meme-admin/tag-catalog.json`；创建分析任务时会把当时版本快照到批次目录的 `tag-catalog.snapshot.json`，供仓库内 skill 确定性读取。

第一次使用或不确定各字段怎么填时，按 [`docs/业务管理台运营配置模板.md`](../../docs/业务管理台运营配置模板.md) 操作。文档包含标签划分、分组参数、参考图角色、OSS 开关、审核清单和可直接复制给 Agent 的任务模板。

构建并运行生产版本：

```powershell
pnpm build
pnpm start
```

生产版本访问 `http://127.0.0.1:14174`。

## 本地数据

- 管理台任务与设置：`.meme-admin/`，已被 Git 忽略。
- 运营标签词库：`.meme-admin/tag-catalog.json`，已被 Git 忽略。
- 批次与生成结果：`artifacts/meme-template-analyzer/batches/<batch-id>/`，已被 Git 忽略。
- 管理台继续输出 `batch-workspace.json`、`batch-manifest.json` 和每组的 `group-config.json`，可与静态整理台和 skill 批量流程互通。

管理台不会移动或删除源图片。整理操作只会把图片复制到分组的 `input/` 目录。

## 任务安全边界

- 不接受用户输入的 shell 命令。
- 固定使用 `codex exec --json -s workspace-write -a never`。
- Prompt 明确要求读取仓库内 `skills/meme-template-analyzer/SKILL.md`，不使用同名全局副本。
- 只允许通过 API 读取批次素材目录和 `artifacts/meme-template-analyzer` 内的结果。
- 结果审核页会二次检查 `cover/referenceImage` 对应的 OSS 对象；人工确认后可批量辅助重传 source image，
  并在 PUT、HEAD 与 remote validator 均成功后原子更新 `meme-template.json`。
- 分组可显式勾选“Agent 完成后上传 source image 到 OSS”；默认关闭，未勾选时 Agent 不得产生 OSS 写入。
- Agent 上传脚本将结构化状态写入结果目录的 `.oss-progress.json`；后台只读取该文件并通过现有 SSE
  展示上传数量、复用数量和当前阶段。
- 标签二次编辑只替换人工补充标签，保留 AI 标签与外部标签来源。
- 一期仅支持本机单人使用，不应暴露到局域网或公网。
