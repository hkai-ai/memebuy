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

遇到以下情况立即失败：

- 任一模板 validator 不通过；
- 本地图片不存在或格式不支持；
- URL 不是指定 assets 域名下的 HTTPS URL；
- URL 不在当前环境的 `gallery/templates/` 前缀；
- 批次内模板 `key` 重复；
- 恢复记录的域名或环境前缀与当前配置不同。

上传失败时保留恢复记录和原始产物。修复网络或配置后重复执行同一命令，不要手工改写恢复记录。
