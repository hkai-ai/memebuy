# OSS 最终 JSON 交付

本流程只负责把已通过审核和结构校验的本地模板封装为纯 JSON 批次。数据库导入、`topicId`、
`status`、`sortOrder` 和 upsert 均由后端项目处理。

## 触发边界

只有用户明确要求“上传 OSS”“最终 JSON”“交给后端批量导入”或同等含义时才执行上传。
普通图片分析、模板打样和本地批量生成停在本地路径版 `meme-template.json`，不得产生 OSS 写入。

## 固定流程

1. 每个模板先通过 Gallery validator；语义待确认的模板继续保留 `metadata.needsReview`。
2. 调用仓库脚本递归查找 `meme-template.json`。
3. 将本地 `cover`、`referenceImage` 上传到 assets 公读桶；相同文件只上传一次。
4. 已经是当前 assets 域名、环境前缀和 `gallery/templates/` 路径下的 HTTPS URL 时复用。
5. 将回填后的模板写入独立 handoff 目录，再以 remote 模式验证。
6. 只交付 handoff 目录；恢复记录位于目录外，不进入后端批量导入。
7. SDK 上传返回成功后执行对象 `HEAD`；只有真实对象存在才视为原图上传成功。

执行命令：

```bash
pnpm gallery:finalize <input-dir> --output artifacts/meme-template-analyzer/handoff/<batch-id>
```

所需环境变量：

- `ALIYUN_OSS_ACCESS_KEY_ID`
- `ALIYUN_OSS_ACCESS_KEY_SECRET`
- `ALIYUN_OSS_ASSETS_BUCKET`
- `ALIYUN_OSS_ASSETS_ENDPOINT`
- `ALIYUN_OSS_ASSETS_DOMAIN`
- `ALIYUN_OSS_KEY_PREFIX`（可空）

不得读取、打印、复制或写入 AK/SK。脚本只报告非敏感的数量、路径和结果。

## 输出与恢复

输出目录只包含 `<template-key>.json`。原始 `meme-template.json` 不覆盖，图片格式不转换。
恢复记录默认写到输出目录同级的 `.<batch-id>.upload-state.json`；每张图片上传成功后立即原子写入，
重试按 SHA-256 复用 URL，避免部分失败产生重复对象。

## 最终交付清单

OSS 收尾成功后，必须把以下内容报告给用户：

| 交付项 | 用途 | 是否交给后端导入 |
| --- | --- | --- |
| `handoff/<batch-id>/` | 最终批次目录，内部只含 OSS URL 版纯 JSON | 是，提交整个目录或其中全部 JSON |
| `handoff/<batch-id>/<template-key>.json` | 单模板 `GalleryTemplateImport`，文件名按模板 `key` 命名 | 是 |
| `<batch>/batch-manifest.json` | Agent 批次追踪、校验和 OSS 状态清单 | 否 |
| `<batch>/<template>/meme-template.json` | 本地路径版单模板校验产物 | 否 |
| `.<batch-id>.upload-state.json` | 上传失败恢复状态，位于 handoff 目录外 | 否 |
| `image-edit-template.json`、`image-edit-analysis.json`、`index.md` | 草稿、分析和说明 | 否 |

最终回复不能只给 `batch-manifest.json`。必须同时列出 handoff 目录和实际可导入 JSON；如果批次只有一个模板，也要说明它仍然是一个单项批次。报告模板数量、最终 JSON 数量、上传/复用数量、PUT/HEAD 与 remote validator 结果、是否 `--write-back`，以及 `metadata.needsReview` 是否会让后端按 DRAFT 处理。

遇到以下情况立即失败：

- 任一模板 validator 不通过；
- 本地图片不存在或格式不支持；
- URL 不是指定 assets 域名下的 HTTPS URL；
- URL 不在当前环境的 `gallery/templates/` 前缀；
- 批次内模板 `key` 重复；
- 恢复记录的域名或环境前缀与当前配置不同。

上传失败时保留恢复记录和原始产物。修复网络或配置后重复执行同一命令，不要手工改写恢复记录。

## 管理台二次检查与辅助重传

管理台的“二次检查”只读取 `meme-template.json` 并对受控 URL 执行 OSS `HEAD`，不得产生写入。
只有运营明确点击“重新上传原图”时，才允许上传 `cover`、`referenceImage` 指向的 source image。
PUT 与 HEAD 均成功且 remote validator 通过后，使用临时文件和原子 rename 回写原
`meme-template.json`；只合并图片 URL，不覆盖并发产生的标签修改。普通 handoff 仍不得覆盖源模板。

Agent 或确定性脚本需要显式回写时使用：

```bash
node --env-file=.env skills/meme-template-analyzer/scripts/finalize_gallery_batch.mjs \
  <input> --output <handoff-dir> --progress-file <progress.json> --write-back
```

`--write-back` 只用于已获用户确认的管理台辅助流程。未传该参数时，行为保持为输出独立 handoff。
`--progress-file` 可选；Agent 批量任务使用它原子写入结构化上传进度，管理台只读取并通过 SSE 展示，
不接管 OSS 上传。
