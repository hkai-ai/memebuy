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

构建并运行生产版本：

```powershell
pnpm build
pnpm start
```

生产版本访问 `http://127.0.0.1:14174`。

## 本地数据

- 管理台任务与设置：`.meme-admin/`，已被 Git 忽略。
- 批次与生成结果：`artifacts/meme-template-analyzer/batches/<batch-id>/`，已被 Git 忽略。
- 管理台继续输出 `batch-workspace.json`、`batch-manifest.json` 和每组的 `group-config.json`，可与静态整理台和 skill 批量流程互通。

管理台不会移动或删除源图片。整理操作只会把图片复制到分组的 `input/` 目录。

## 任务安全边界

- 不接受用户输入的 shell 命令。
- 固定使用 `codex exec --json -s workspace-write -a never`。
- Prompt 明确要求读取仓库内 `skills/meme-template-analyzer/SKILL.md`，不使用同名全局副本。
- 只允许通过 API 读取批次素材目录和 `artifacts/meme-template-analyzer` 内的结果。
- 一期仅支持本机单人使用，不应暴露到局域网或公网。
