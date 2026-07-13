# Memebuy Codex Skills

这个仓库用于维护可复用的 Codex Skills。仓库按多 Skill 结构组织，每个 Skill 独立放在 `skills/<skill-name>/` 目录中。

## 目录

- [当前 Skills](#当前-skills)
- [安装](#安装)
  - [自动同步 Git hook](#自动同步-git-hook)
- [meme-template-analyzer 使用场景](#meme-template-analyzer-使用场景)
- [本地业务管理台](#本地业务管理台)
- [支持输入](#支持输入)
- [常用调用方式](#常用调用方式)
  - [生成前端图片编辑模板](#1-生成前端图片编辑模板)
  - [生成可替换槽位](#2-生成可替换槽位)
  - [Mock 用户输入](#3-mock-用户输入)
  - [批量建立后台模板库](#4-批量建立后台模板库)
- [输出格式](#输出格式)
- [维护和更新](#维护和更新)

## 当前 Skills

- `skills/meme-template-analyzer`
  - 用于分析梗图、截图、本地图片、网络图片或用户输入的梗图创意。
  - 默认输出前端可用的 `image-edit-template.json`。
  - 支持生成 `templateText`、`editablePrompt`、`allowFullRewrite`、文本/图片槽位、候选替换项、`mockUserInput` 和 `backendHint`。
  - 支持用户只改槽位，也支持用户整段删除、重写提示词。
  - 支持用户上传图或选择图作为 `identity_reference`、`edit_target`、`style_reference` 或 `composition_reference`。
  - 支持后台批量入库、审核页和真实生成测试。

## 安装

先克隆仓库：

```powershell
git clone https://github.com/techidsk/memebuy.git C:\Code\memebuy
```

把需要的 Skill 同步到本地 Codex skills 目录：

```powershell
scripts\sync-skill.ps1 -SkillName meme-template-analyzer
```

检查仓库副本和全局运行副本是否一致：

```powershell
scripts\check-skill-sync.ps1 -SkillName meme-template-analyzer
```

安装后可以在 Codex 中通过 `$meme-template-analyzer` 调用。

### 自动同步 Git hook

为了避免修改仓库内 Skill 后忘记同步到全局运行副本，可以启用本仓库的 Git hook：

```powershell
scripts\install-git-hooks.ps1 -Verify
```

启用后，每次 `git commit` 前会自动执行：

```powershell
scripts\sync-skill.ps1 -SkillName meme-template-analyzer
scripts\check-skill-sync.ps1 -SkillName meme-template-analyzer
```

如果同步或校验失败，commit 会被阻止。

## meme-template-analyzer 使用场景

适合这些任务：

- 分析一张梗图并生成前端图片编辑模板。
- 从纯文字梗图创意生成可编辑模板。
- 提取用户可改的文本槽位，例如主体、食物、动作、文案或场景。
- 提取用户可上传或选择的图片槽位。
- 为文本槽生成 3-8 个候选替换项。
- 按需生成 `mockUserInput`，方便前端预览。
- 把 Agent 草稿编译成严格 GalleryTemplateImport JSON。
- 批量分析文件夹；用户明确要求最终交付时上传 OSS，并生成一个模板一个纯 JSON。

## 本地业务管理台

仓库提供 `apps/meme-admin`，方便业务人员在浏览器中管理批次、素材分组、标签分类、任务状态和生成结果。管理台会直接调用本机 `codex exec --json`，并强制使用仓库内的 `meme-template-analyzer` 工作版本。

Agent 自动启动、探活、日志和停止流程统一以根目录 `AGENTS.md` 的“本地业务管理台启动”章节为准。

运营字段的填写方法和可复制模板见 [`docs/业务管理台运营配置模板.md`](docs/业务管理台运营配置模板.md)。

```powershell
pnpm install
pnpm dev
```

打开 `http://127.0.0.1:15173`。本地 API 使用 `127.0.0.1:14174`；两者都只监听 localhost，不用于 Cloudflare 或公网部署。无需运行服务时，仍可继续使用 `skills/meme-template-analyzer/assets/batch-workbench.html` 静态整理台。

## 支持输入

可以给 Codex 提供：

- 上传图片
- 本地图片路径
- 网络图片 URL
- 截图
- 多张图片批量分析
- 纯文字梗图创意
- 已有编辑模板 JSON 加新的用户目标内容

## 常用调用方式

### 1. 生成前端图片编辑模板

```text
使用 $meme-template-analyzer 分析这张图，输出前端可用的 image-edit-template.json。
```

输出会包含：

- `templateText`
- `editablePrompt`
- `allowFullRewrite`
- `slots[]`
- `suggestions`
- 可选 `mockUserInput`
- `backendHint`

同目录 `meme-template.json` 会编译为后端固定字段：`promptTemplate`、`inputSchema`、
`preprocessSteps` 和 `metadata`。前端通过后端 API 获取运行配置，不直接读取 artifact。

### 2. 生成可替换槽位

```text
使用 $meme-template-analyzer 识别这张图，生成用户可编辑槽位和候选替换项。
```

槽位支持：

- `text`
- `prompt`
- `select`
- `image_upload`
- `image_select`

图片槽位角色支持：

- `identity_reference`
- `edit_target`
- `style_reference`
- `composition_reference`

### 3. Mock 用户输入

```text
使用 $meme-template-analyzer 基于这个模板生成 mock 用户输入，方便前端预览。
```

mock 应包含 `slotValues`、`imageSelections`、`renderedTemplateText` 和 `renderedPromptPreview`。

### 4. 批量建立后台模板库

```text
使用 $meme-template-analyzer 批量分析这个文件夹里的梗图，输出 meme-template.json 和 batch-manifest.json。
```

批量流程包含批量预审、自动聚类、metadata taxonomy、source hash 和可选审核页。每个
`meme-template.json` 先过 Schema 校验。普通流程保留本地图片路径；用户明确要求最终交付时，
运行 `pnpm gallery:finalize <input> --output <handoff-dir>` 上传 OSS 并回填 URL。handoff 目录整体
交给后端项目按 `key` upsert；数据库追踪信息不进入 GalleryTemplate JSON。

#### OSS 环境变量与运行方式

上传脚本从 `process.env` 读取 OSS 配置。可在仓库根目录创建不会被 Git 跟踪的 `.env`：

```dotenv
ALIYUN_OSS_ACCESS_KEY_ID=<access-key-id>
ALIYUN_OSS_ACCESS_KEY_SECRET=<access-key-secret>
ALIYUN_OSS_ASSETS_BUCKET=memebuy-assets
ALIYUN_OSS_ASSETS_ENDPOINT=oss-cn-shanghai.aliyuncs.com
ALIYUN_OSS_ASSETS_DOMAIN=assets.memebuy.cn
ALIYUN_OSS_KEY_PREFIX=dev/
```

`ALIYUN_OSS_KEY_PREFIX` 可留空；开发、测试环境建议分别使用 `dev/`、`uat/`，生产环境按实际
约定填写。Endpoint 和 Domain 只填写 hostname，不要包含 `https://` 或路径。

`pnpm gallery:finalize` 不会自动加载 `.env`。使用 `.env` 时由 Node 显式加载：

```powershell
node --env-file=.env skills/meme-template-analyzer/scripts/finalize_gallery_batch.mjs `
  <input-dir> --output <handoff-dir>
```

如果环境变量已注入当前 PowerShell 会话，则直接运行：

```powershell
pnpm gallery:finalize <input-dir> --output <handoff-dir>
```

不要把 AK/SK 写入模板 JSON、脚本或其他会被 Git 跟踪的文件，也不要在日志中打印密钥。

管理台“结果审核”会对 `meme-template.json` 中的 source image URL 做 OSS `HEAD` 二次检查。
若仍是本地路径或对象缺失，可手动批量执行“重新上传原图”；上传和远程校验成功后会原子更新
`cover`、`referenceImage`，不会覆盖标签等其他字段。

## 输出格式

默认 artifact-first，不在聊天里粘贴完整 JSON。

常见结果目录：

```text
artifacts/meme-template-analyzer/<template_id-or-timestamp>/
```

常见文件：

```text
image-edit-template.json
index.md
meme-template.json
batch-manifest.json
review.html
output/
```

`output/` 只在用户明确要求真实生成测试时创建。

## 维护和更新

修改 Skill 后先校验：

```powershell
$env:PYTHONUTF8='1'
python C:\Users\<username>\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Code\memebuy\skills\meme-template-analyzer
```

运行内容合同测试：

```powershell
python skills\meme-template-analyzer\scripts\test_skill_content_contract.py
```

新增 Skill 时继续使用这个结构：

```text
skills/
  skill-name/
    SKILL.md
    references/
    agents/
```

不要把整个本地 `.codex` 目录提交到仓库，只提交需要分享的 Skill 子目录和必要文档。
