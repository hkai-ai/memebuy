# 批量、整理与审核

## 批量入库

先预审有效图片、格式、尺寸、目录层级、重复文件、缩略图、生成结果和非源图。平铺目录可能包含多个模板簇时，先输出预审并请求确认分类策略。

规则：

- 每张源图独立工作目录。
- 一个模板一个 `meme-template.json`，不要生成顶层 `templates[]` 入库文件。
- 批量另写 `batch-manifest.json`，不把 source hash 和追踪状态塞进入库 JSON。
- taxonomy 未完成人审时写非空 `metadata.needsReview`，导入状态为 `DRAFT`；否则默认 `PUBLISHED`。
- 每个模板单独通过 validator 后才上传。
- 只有用户明确要求最终 JSON/后端交付时才进入 OSS 收尾；普通批量分析不上传。
- 最终交付按 `oss-handoff.md` 输出独立 handoff 目录，不覆盖本地路径版模板。

## 批量语义预审

每张图片先写 `referenceStatus` 和 `semanticReviewStatus`，再决定是否进入模板编译：

- `auto_ready`：`confirmed/probable` 且公式审计通过。
- `standalone_ready`：`none` 且 `content_function` 明确，可按萌宠、反应图或普通图片处理。
- `needs_research`：`unknown/suspected`，允许联网时检索，否则进入人审。
- `needs_human_review`：候选接近、圈层文化、地域语境或公式审计未通过。
- `skip_template`：视觉事实不稳定，或用户没有要求把普通图片模板化。

`unknown/suspected`、`formula_reflection_review.passed: false` 或 `generic_description_risk: high` 必须写入 `metadata.needsReview` 并保持 `DRAFT`。Gallery validator `PASS` 只表示入库结构合法，不代表语义审核完成。

## Batch Review Workbench

用户要求“批量整理台”“素材分组”“批量生成管理”或“查看任务状态”时，优先使用仓库内 `apps/meme-admin` 本地业务管理台。它支持：

- 扫描素材目录，建立批次并按组管理图片。
- 配置分类、标签、模板机制、参考角色和生成模式。
- 在“标签词库”维护需要人工复用的普通 tags；每次任务写 `tag-catalog.snapshot.json`，分析按 `tagging-and-taxonomy.md` 保留来源。
- 把图片复制到分组目录，不移动或删除源文件。
- 按分组调用 `codex exec --json`，展示队列、阶段、日志、validator、取消和失败重试。
- 查看 JSON、Markdown、生成图并打开结果目录。

管理台继续写回：

- 根目录 `batch-workspace.json`
- 根目录 `batch-manifest.json`
- 每组目录 `group-config.json`

管理台通过 `pnpm dev` 启动，只监听 localhost。它必须显式调用仓库内 skill，不能默认使用同名全局副本，也不能开放任意 shell 命令、生产部署或外部入库。

只需离线整理、不希望启动 Node 服务时，继续使用 `assets/batch-workbench.html`。它是 Chrome/Edge 静态工具，通过 File System Access API 选择素材目录并写回同样的兼容 JSON。用户可配置 `status`、`referenceConfig`、`referenceDependencyLevel`、`testModeRecommendation`、tags 和 notes；复制到分组目录需要用户点击。

后续分析必须优先读取用户确认的 `referenceConfig`，不要重新猜测图片用途。

## Template Review Page

用户要求审核页、运营预览或 review page 时，在模板结果目录写 `review.html`。页面必须可直接双击打开，不依赖服务或外部 CDN。

单模板展示封面、理解摘要、槽位、`templateText`、`editablePrompt`、`backendHint`、相关文件和 Raw JSON。批量页展示批次摘要、模板列表、key、标题、tags、needsReview 和待确认项。提供复制核对卡/批量摘要按钮。

批量完成后可询问是否需要审核页，但不要默认生成或打开。
