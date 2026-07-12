# 模板图「直传 OSS」能力开发规范

给「产模板的那边」开发**自助上传图片到 OSS、拿 URL 塞进模板 JSON**的能力用。
最终交付物是**纯 JSON 批次**（`cover` / `referenceImage` 已是可访问 URL），本仓库这边用
`pnpm gallery:import` 直通导入，不再处理图片文件。

> 与另一条链路的区别：`import.ts` 的默认流程是「JSON 里放本地路径 → 导入脚本用
> `uploadAndCreateAsset` 传 OSS」。本规范是**把上传前移到那边**，导入器走 URL 直通分支
> （`import.ts:114`：`cover` 以 `http(s)://` 开头即原样保留、不重传）。二者可共存。

---

## 0. 边界：这条路放弃了什么（先确认再开发）

直传绕开后端 `uploadAndCreateAsset`，因此**不会登记 `OssAsset` 表**。后果：

- 无 MD5 去重（同图重复传 = 多个对象成孤儿）→ 模板图低频、近乎写一次，可接受，日后 reconcile 一并清（§9）。
- 后台「上传替换」`replaceAssetByUrl` 不认这些对象、孤儿清理扫不到。

这与仓库既有的 `static` 桶「模板图等运维侧维护」模式一致（`src/lib/oss/config.ts:5`），
对 PGC 模板图可接受。若日后要把资产管理补回来，见 §9 的 reconcile 后手。

---

## 1. OSS 目标参数（实测值，按环境取）

| 项                       | dev / uat                            | 说明                                                                    |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| Bucket                   | `memebuy-assets`                     | **公读桶**，必须传这个，别传 sensitive（签名桶，直传 URL 会失效）       |
| Region / Endpoint        | `oss-cn-shanghai.aliyuncs.com`       | 上传接入点                                                              |
| 访问域名（写进 JSON 用） | `assets.memebuy.cn`                  | **URL 的 host 必须正好等于它**，别用 `xxx.oss-cn-shanghai.aliyuncs.com` |
| Key 环境前缀             | dev=`dev/`、uat=`uat/`、prod=`` (空) | 见 §3                                                                   |

> 生产的 bucket/domain 可能不同，以生产 env 的 `ALIYUN_OSS_ASSETS_*` 为准，开发时做成可配置项，别硬编码。
> 访问域名的权威来源是后端 `env.ALIYUN_OSS_ASSETS_DOMAIN`；host 对不上，渲染侧不识别、CDN 优化不生效。

---

## 2. 只传公读桶、只放访问域名 URL（两条硬约束）

1. **传 `assets`（公读），不传 `sensitive`（签名）。** 传对了还有红利：命中前端自定义
   image loader，自动附 `x-oss-process` 走 CDN 缩放出图（`src/lib/oss/image-loader.ts`、
   `image-process.ts`）。
2. **JSON 里的 URL 必须是 `https://assets.memebuy.cn/<objectKey>`**，不是 OSS 原始
   endpoint。渲染侧 `next.config.ts` 虽 `hostname:"**"` 不拦域名，但只有匹配访问域名的
   URL 才被识别为「我方公读桶」享受 CDN 优化（`parseKeyFromUrl` 按 `host === domain` 精确匹配）。

---

## 3. 对象命名 & ID 处理（核心）

**先厘清一个常见误解：图片文件名跟模板之间不需要任何「关联 id」。** 文件名是**不透明**的，
模板与图的唯一联系就是 JSON `cover` / `referenceImage` 字段里那条 URL 字符串。所以文件名用
随机 uuid 即可，无需内容哈希、无需从文件名反推模板。下面几种 id/键各自独立：

### 3.1 OSS 对象 key（文件在桶里的路径名）—— 你要生成的

对齐后端 `generateKey`（`src/lib/oss/keys.ts:36`）的结构：`{envPrefix}{feature}/{uuid}.{ext}`

- `envPrefix`：按环境取 `dev/` `uat/` ``（§1）。归一化规则同后端：去首尾`/`后非空补一个`/`。
- `feature`：**固定 `gallery/templates`**（与脚本走 `uploadAndCreateAsset` 时一致，保证桶里两条链路的对象混在同一目录、可统一 grep）。
- `uuid`：**随机 uuid v4**（同后端 `randomUUID()`），不要用原始文件名（避免中文/编码/重名坑）。
- `ext`：`webp` / `png` / `jpg` / `jpeg` / `gif` / `avif`，**推荐统一 `webp`**（体积小、CDN 友好）。

  例：`dev/gallery/templates/3f9a1c2e-...-b7d4.webp`
  对应 URL：`https://assets.memebuy.cn/dev/gallery/templates/3f9a1c2e-...-b7d4.webp`

### 3.2 `OssAsset.id` / assetId —— 不用管

直传不建 `OssAsset` 表的行，**JSON 里只放 URL，不放任何 assetId**。导入器把 URL 字符串直接写进
`coverUrl` / `templateImageUrl` 列，不需要 asset id。

> 幂等提示（可不做）：uuid 命名下，同一张图重传会生成新对象、旧对象成孤儿。模板图低频、
> 近乎写一次，几个孤儿对象无所谓，日后 reconcile / 孤儿扫描一并清（§9）。若确实要「重传即覆盖」
> 的强幂等，可把 uuid 换成文件内容的 MD5 当 basename —— 但对本场景是过度设计，默认不用。

### 3.3 模板业务键 `key`（模板自己的稳定 id）—— 这才是「模板的 id」

- 字段：模板 JSON 顶层 `key`，写进 `GalleryTemplate.key`。
- 规则：`^[a-z][a-z0-9-]{1,59}$`（小写字母开头，仅小写字母/数字/`-`，长度 2–60）。
  实测来源 `scripts/gallery-template-import/shared.ts:24` + `schema.prisma` `VarChar(60)`。
- 唯一性：**`@@unique([topicId, key])`**（`schema.prisma:4023`）——`key` 只在**同一专题内**唯一，
  不是全局唯一。`topicId` 不由你产出，导入时用 `--topic <topicKey>` 手动指定。
- 这是 upsert 键：同 `(topicId, key)` 再导入 = 更新，不是新建。所以 `key` 要**稳定**，别每次换。

### 3.4 模板内输入槽 id（`inputSchema[].id` / `preprocessSteps[].id`）

与 OSS 无关，是 promptTemplate 占位 `{{ id.field }}` 的引用目标。归 JSON 契约（`README.md` / `schema.json`）管，
本规范不覆盖；只提醒：图片输入槽的 id 是**用户上传图**的槽位，`referenceImage` 是**模板自带固定参考图**，两回事。

---

## 4. 回填到 JSON 的字段

| 你上传的图     | JSON 字段        | 落库列             | 含义                                            |
| -------------- | ---------------- | ------------------ | ----------------------------------------------- |
| 封面图         | `cover`          | `coverUrl`         | 列表/卡片封面                                   |
| 模板固定参考图 | `referenceImage` | `templateImageUrl` | 生成时的默认参考图（≠ 用户上传的 image 输入槽） |

两个字段都填 §2 的完整 URL。不需要、也不要产出 `topicId` / `status` / `sortOrder` / 任何 assetId。

---

## 5. 上传流程（伪代码）

```
for each image file:
  buf = readBytes(file)                        # 建议先转 webp
  ext = "webp"                                 # 统一 webp
  key = normalize(envPrefix) + "gallery/templates/" + uuidv4() + "." + ext
  oss.putObject(bucket="memebuy-assets", key=key, body=buf,
                headers={ "Content-Type": "image/webp" })
  url = "https://" + ASSETS_DOMAIN + "/" + key
  # 把 url 写进该模板 JSON 的 cover / referenceImage
```

- 用官方 SDK（Node `ali-oss` / Python `oss2` / `ossutil`）均可，本规范只约束 bucket / key / URL 形态。
- 凭证从 §6 的 env 变量读，**绝不硬编码进代码或 JSON**。

### 5.1 仓库实现与参考样例（Node + `ali-oss`）

仓库内权威实现是 `skills/meme-template-analyzer/scripts/finalize_gallery_batch.mjs`，它不会覆盖
本地路径版模板，并提供校验、SHA-256 复用、部分失败恢复和纯 JSON handoff 输出。下面的原地写回
脚本只保留作 SDK 调用参考；日常批量流程应使用 `pnpm gallery:finalize`。

从 env 读凭证，扫一个目录里的模板 JSON，把 `cover` / `referenceImage` 的**本地路径**传 OSS、
回填成 URL，原地写回 JSON。已是 `http(s)://` 的原样跳过（可重复跑，幂等到"已回填的不再动"）。

```js
// upload-template-images.mjs
// 用法： node upload-template-images.mjs <dir-or-file...>
// 依赖： npm i ali-oss     （可选 sharp 转 webp）
// 环境： 见 §6，从 .env 注入，例如 node --env-file=.env upload-template-images.mjs ./batch
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import OSS from "ali-oss";

const {
  ALIYUN_OSS_ACCESS_KEY_ID: AK,
  ALIYUN_OSS_ACCESS_KEY_SECRET: SK,
  ALIYUN_OSS_ASSETS_BUCKET: BUCKET,
  ALIYUN_OSS_ASSETS_ENDPOINT: ENDPOINT, // oss-cn-shanghai.aliyuncs.com
  ALIYUN_OSS_ASSETS_DOMAIN: DOMAIN, // assets.memebuy.cn
  ALIYUN_OSS_KEY_PREFIX: PREFIX_RAW = "",
} = process.env;

for (const [k, v] of Object.entries({ AK, SK, BUCKET, ENDPOINT, DOMAIN }))
  if (!v) throw new Error(`缺少 env：${k}`);

// 前缀归一化，与后端 getEnvPrefix 一致：去首尾 / 后非空补一个 /
const PREFIX = PREFIX_RAW.replace(/^\/+|\/+$/g, "");
const envPrefix = PREFIX ? `${PREFIX}/` : "";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const client = new OSS({
  accessKeyId: AK,
  accessKeySecret: SK,
  bucket: BUCKET,
  endpoint: `https://${ENDPOINT}`,
  secure: true,
});

// 传一张本地图 → 返回访问域名 URL。key = {env}gallery/templates/{uuid}.{ext}
async function uploadImage(absPath) {
  const ext = extname(absPath).toLowerCase();
  const contentType = MIME[ext];
  if (!contentType) throw new Error(`不支持的图片类型：${absPath}`);
  const key = `${envPrefix}gallery/templates/${randomUUID()}${ext}`;
  await client.put(key, readFileSync(absPath), {
    headers: { "Content-Type": contentType },
  });
  return `https://${DOMAIN}/${key}`; // 注意用访问域名，不是 OSS endpoint
}

// 回填单个 JSON：cover / referenceImage 是本地相对路径 → 传 OSS → 换成 URL，写回
async function processFile(file) {
  const tpl = JSON.parse(readFileSync(file, "utf8"));
  const baseDir = dirname(file);
  let changed = false;
  for (const field of ["cover", "referenceImage"]) {
    const val = tpl[field];
    if (!val || /^https?:\/\//i.test(val)) continue; // 空 / 已是 URL → 跳过
    const url = await uploadImage(resolve(baseDir, val));
    tpl[field] = url;
    changed = true;
    console.log(`✅ ${tpl.key ?? file} .${field} → ${url}`);
  }
  if (changed) writeFileSync(file, JSON.stringify(tpl, null, 2) + "\n", "utf8");
}

function collectJson(target) {
  const st = statSync(target);
  if (st.isFile()) return extname(target) === ".json" ? [target] : [];
  return readdirSync(target).flatMap((n) => collectJson(join(target, n)));
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error("用法：node upload-template-images.mjs <dir-or-file...>");
  process.exit(2);
}
for (const f of targets.flatMap(collectJson)) await processFile(f);
console.log("完成。");
```

- 想统一转 webp：在 `uploadImage` 里用 `sharp(readFileSync(absPath)).webp().toBuffer()`，
  同时把 `ext` / `contentType` 固定成 `.webp` / `image/webp`。
- 当前仓库使用 `pnpm gallery:finalize <input> --output <handoff-dir>` 完成校验、上传和 URL 回填；
  跑完后把 handoff 纯 JSON 目录交给后端项目执行 `gallery:validate` → `gallery:import`（§8）。

---

## 6. 凭证：直接复用 env 的 OSS AK/SK（不新建 RAM 子账号）

那台机器直接用后端同一套 env 凭证，不额外开 RAM 子账号。需要的变量（值以生产 env 为准）：

| env                                                         | 用途                                       |
| ----------------------------------------------------------- | ------------------------------------------ |
| `ALIYUN_OSS_ACCESS_KEY_ID` / `ALIYUN_OSS_ACCESS_KEY_SECRET` | 上传凭证（AK/SK）                          |
| `ALIYUN_OSS_ASSETS_BUCKET`                                  | 目标公读桶（`memebuy-assets`）             |
| `ALIYUN_OSS_ASSETS_ENDPOINT`                                | 接入点（`oss-cn-shanghai.aliyuncs.com`）   |
| `ALIYUN_OSS_ASSETS_DOMAIN`                                  | 拼 URL 用的访问域名（`assets.memebuy.cn`） |
| `ALIYUN_OSS_KEY_PREFIX`                                     | 环境前缀（`dev/` / `uat/` / 空）           |

**取舍（已确认可接受，仅限可信机器）**：这是后端主 AK/SK，对**所有桶（含 sensitive 签名桶）全权**，
不是 assets 桶限定。所以「只往 assets 桶、只往 `gallery/templates/` 前缀写」变成**代码自觉**，
不再有 IAM 边界兜底。密钥务必只从环境变量读、**绝不硬编码进代码或 JSON**、不进版本库。
若哪天这台机器不再完全可信、需要收权限，回退到 RAM 子账号（仅 `*/gallery/templates/*` 前缀可写）即可。

> 既然已有全套 env，另一条更干净的路：那边不裸传，改跑一段调后端 `uploadAndCreateAsset` 的脚本
> （读同样这些 env）——连 OssAsset 登记 + MD5 去重都白捡回来，§0 的取舍直接消失。代价是该脚本要
> esbuild 打包绕 `server-only`（同 queue-worker）。图省事就裸传，要干净走这条。

---

## 7. 交给这边前的自检清单

- [ ] 每张图的 URL host 正好是 `assets.memebuy.cn`（不是 oss endpoint）。
- [ ] key 落在 `{env}gallery/templates/` 下、basename 是随机 uuid。
- [ ] 图片是公读（浏览器无凭证能直接打开 URL）。
- [ ] 每个模板 JSON 能过校验闸：`pnpm gallery:validate <dir>`（拦 U+FFFD 乱码、JSON 截断、
      promptTemplate 引用了不存在的输入槽）。
- [ ] `key` 符合 `^[a-z][a-z0-9-]{1,59}$` 且同一专题内不重复。

---

## 8. 与导入器的衔接（这边执行，供你了解全链路）

```
pnpm gallery:validate  <dir>                       # 无副作用，先过闸
pnpm gallery:import:build                           # esbuild 打包（绕 server-only）
pnpm gallery:import    <dir> --topic <topicKey>     # URL 直通导入，status 默认 PUBLISHED
```

`status` 默认 `PUBLISHED`；除非模板 `metadata.needsReview`（字符串）或
`metadata.taxonomy.needs_review`（数组）非空，才被强降 `DRAFT`（`shared.ts:needsReview`）。

---

## 9. 可选后手：补登 OssAsset（不改你的流程）

若日后想让这批直传图也享受去重 / 后台替换 / 孤儿清理，这边可写一个 reconcile 脚本：
扫 `GalleryTemplate.coverUrl` / `templateImageUrl` 里 `assets.memebuy.cn` 的 URL →
`parseKeyFromUrl` 反解 key → `headObject` 取 size/md5 → upsert `OssAsset` 行。
纯补登，不动你的上传逻辑。需要时再做。

---

## 附：确认记录（与代码核对）

- 公读桶 / 域名 / endpoint / 前缀实测值：`.env*` 的 `ALIYUN_OSS_ASSETS_*`、`ALIYUN_OSS_KEY_PREFIX=dev/`。
- 对象 key 结构 `{envPrefix}{feature}/{uuid}.{ext}`：`src/lib/oss/keys.ts:36`；前缀归一化 `config-server.ts:42`。
- URL 直通导入分支：`scripts/gallery-template-import/import.ts:114`。
- URL host 精确匹配才识别为我方桶：`src/lib/oss/keys.ts:65` `parseKeyFromUrl`。
- 渲染侧不拦域名但只优化白名单 host：`next.config.ts:32`、`src/lib/oss/image-process.ts:32`。
- 模板 `key` 规则与唯一约束：`shared.ts:24` + `schema.prisma:3995,4023`（`@@unique([topicId, key])`）。
- 直传不建 OssAsset、与 static「运维侧维护」同构：`src/lib/oss/config.ts:5`、`upload.ts`（未被直传路径调用）。
