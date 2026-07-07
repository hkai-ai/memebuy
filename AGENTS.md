# AGENTS.md

本文件用于指导 AI Coding Agent 在本项目中工作。

## 基本规则

* 默认使用中文回答。
* 默认使用中文编写面向用户或协作者的内容，包括文档、教程、说明、注释性文字、SEO 文案、页面文案和 skill 相关文档。
* 代码标识符、命令、配置字段、schema 字段、文件名、API 名称和第三方专有术语按原文保留；只有在有明确本地化价值时才翻译。
* 优先使用 TypeScript。
* 优先使用 `pnpm`。
* 先理解项目结构，再进行修改。
* 保持现有代码风格，避免过度设计。
* 修改完成后说明修改内容、涉及文件和验证情况。

## Cloudflare

项目默认优先考虑 Cloudflare 部署。

约定：

* 普通本地开发使用 `pnpm dev`
* Cloudflare 相关命令使用 `:cf` 后缀

例如：

```json
{
  "scripts": {
    "dev": "...",
    "dev:cf": "wrangler dev",
    "deploy:cf": "wrangler deploy"
  }
}
```

规则：

* 可以修改 `wrangler.toml`，但需说明影响。
* 不要提交 Cloudflare Token、API Key 等敏感信息。
* 未经用户明确确认，不要执行生产部署。

## 前端开发

涉及页面或 UI 时：

* 优先复用现有组件和样式体系。
* 考虑移动端适配。
* 避免硬编码设计参数。
* 新页面需具备基础 SEO（title、description、语义化结构）。

## 测试与运行

默认不要主动启动任何长期运行进程。

包括但不限于：

* `pnpm dev`
* `wrangler dev`
* `next dev`
* `vite`
* Playwright
* 其他本地服务

只有在用户明确要求运行、测试、调试或验证时才启动。

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
