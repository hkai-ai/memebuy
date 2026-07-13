# AGENTS.md

## 本地业务管理台启动

仓库内 `apps/meme-admin` 是本地业务后台。前端使用 Vite，API 使用 Fastify；开发模式统一从仓库根目录启动：

```powershell
pnpm dev
```

地址约定：

* 管理页面：`http://127.0.0.1:15173`
* 本地 API：`http://127.0.0.1:14174`
* API 探活：`http://127.0.0.1:14174/api/health`

Agent 行为约束：

* 默认不要主动启动管理台。只有用户明确要求启动、运行、测试、调试或验证页面时才启动。
* 启动前先检查 `14174` 和 `15173` 端口，避免重复启动已有实例。
* 需要继续执行其他工作时，把管理台作为隐藏后台进程启动，不要让长期运行的 `pnpm dev` 阻塞当前终端。
* 后台启动前创建 `.meme-admin/`；标准输出和错误日志写入该目录，不要提交到 Git。
* 启动后先调用 `/api/health`，确认 API 返回成功，再报告页面地址或进行浏览器验证。
* 停止时终止启动进程及其子进程，避免遗留 Vite、tsx 或 concurrently 进程。
* 管理台只监听 localhost，不要暴露到局域网、公网或 Cloudflare；未经用户明确确认，不执行生产部署。

Windows PowerShell 后台启动示例：

```powershell
New-Item -ItemType Directory -Force .meme-admin | Out-Null
$process = Start-Process -FilePath "pnpm.cmd" `
  -ArgumentList "dev" `
  -WorkingDirectory (Get-Location) `
  -WindowStyle Hidden `
  -RedirectStandardOutput ".meme-admin/dev.stdout.log" `
  -RedirectStandardError ".meme-admin/dev.stderr.log" `
  -PassThru
$process.Id
```

探活示例：

```powershell
Invoke-RestMethod http://127.0.0.1:14174/api/health
```

停止示例，其中 `<PID>` 使用启动命令返回的进程号：

```powershell
taskkill.exe /PID <PID> /T /F
```

如果只需构建并运行已构建版本：

```powershell
pnpm build
pnpm start
```

该模式由 Fastify 提供已构建页面，访问 `http://127.0.0.1:14174`。不要把 `pnpm start` 与 `pnpm dev` 同时启动。

本地数据位置：

* `.meme-admin/`：管理台设置、标签词库、任务记录与本地日志，已被 Git 忽略。
* `artifacts/meme-template-analyzer/`：批次、分析结果与 handoff 产物，已被 Git 忽略。

更完整的启动说明见 `apps/meme-admin/README.md`；运营字段、标签和分组填写规则见 `docs/业务管理台运营配置模板.md`。Agent 代为操作管理台前应先读取这份配置模板。

## Git 与提交

本项目按普通 Git 仓库处理。提交前使用 `git status --short` 和 `git remote -v` 确认当前仓库与远端，不要因为全局 `.codex` skill 目录不是 Git 仓库而误判当前项目不能提交。

生成产物目录，例如 `artifacts/`，默认不要随文档或 skill 更新一起提交，除非用户明确要求提交这些产物。

除非用户明确要求，否则不要主动执行 git commit、创建 Tag 或推送代码。

如用户要求提交代码，优先遵循 Conventional Commits 规范：

```text
<type>: <subject>
```

常用类型：

* `feat`: 新功能
* `fix`: 修复问题
* `refactor`: 重构
* `perf`: 性能优化
* `docs`: 文档修改
* `style`: 代码格式调整（不影响逻辑）
* `test`: 测试相关
* `build`: 构建系统或依赖变更
* `ci`: CI/CD 配置变更
* `chore`: 杂项维护
* `revert`: 回滚提交

示例：

```text
feat: add cloudflare r2 image upload support
fix: resolve mobile navigation overflow issue
docs: update deployment instructions
refactor: simplify api error handling
```

规则：

* Commit Message 使用英文。
* 保持简洁明确，首行建议不超过 72 个字符。
* 一次提交应聚焦单一主题，避免混入无关修改。
* 大范围重构应与功能修改分开提交。
* 不要在 Commit Message 中包含密钥、Token、密码或敏感信息。
* 未经用户明确要求，不要自动创建多个提交。

## Skill 开发与调用逻辑

本项目内的 `skills/` 目录是 skill 的版本管理源文件。Codex 运行时实际可自动触发的 skill 通常来自全局安装目录，例如：

```text
C:\Users\<user>\.codex\skills\<skill-name>
```

因此，仓库内 skill 和全局 skill 的职责不同：

* `skills/<skill-name>/`：项目内源文件，必须提交到 Git。
* `C:\Users\<user>\.codex\skills\<skill-name>\`：运行时副本，用于让当前 Codex 会话自动发现和调用。

行为约束：

* 研发或测试本项目维护的 skill 时，必须优先使用仓库内 `skills/<skill-name>/` 作为当前工作版本。
* 研发仓库内 skill 时，禁止默认调用同名全局 skill。必须显式读取并使用仓库内 `skills/<skill-name>/SKILL.md` 及其 `references/` 文件。
* 如果需要当前 Codex 会话立即使用新 skill 行为，再把仓库内副本同步到全局 `.codex/skills/<skill-name>/`。
* 如果先误改了全局 skill，必须同步回仓库内 `skills/<skill-name>/` 后再提交。
* 提交时只提交仓库内 `skills/<skill-name>/` 的变更，不提交全局 `.codex` 目录。
* 只有在验证安装效果、全局运行副本，或用户明确要求测试全局 skill 时，才使用全局 `.codex/skills/<skill-name>`。
* 使用某个 skill 前，如果仓库内存在同名 `skills/<skill-name>/`，应检查仓库副本和全局副本是否可能不一致，并在影响结果时说明当前使用的是哪一份。
* 如果用户要求“修改 skill”“更新 skill”“提交 skill”，默认指仓库内 `skills/<skill-name>/`，除非用户明确说要改全局安装副本。
* 修改 skill 后至少运行一次 skill 结构验证；例如可用 `quick_validate.py` 验证 `skills/<skill-name>`。
* 如果需要证明当前约束生效，回复中应说明本次读取/修改的是仓库内路径还是全局路径，并列出验证命令。
* 每个仓库内 skill 必须维护 `skill-manifest.json`，其中记录 `name`、`version`、`updated_at` 和 `tracked_files`。
* 修改 skill 的行为、schema、命令、输出文件或用户可见规则时，必须同步更新 `skill-manifest.json` 的版本号和说明。
* 需要让全局运行副本生效时，使用 `scripts\sync-skill.ps1 -SkillName <skill-name>` 从仓库副本同步到全局副本。
* 提交前如涉及 skill 修改，运行 `scripts\check-skill-sync.ps1 -SkillName <skill-name>` 检查仓库副本和全局运行副本的版本号与文件 hash。
* 如果同步校验失败，不要声称当前运行副本已对齐；应说明不一致文件或版本，并先修复同步问题。
* skill 的 README、使用教程、面向用户的说明和示例说明默认使用中文；保留命令名、mode 名、JSON key、schema 字段和路径等技术标识原文。
* 处理 skill 任务时，过程说明和最终汇总默认使用中文，并明确说明读取/修改的是仓库内副本还是全局运行副本。
