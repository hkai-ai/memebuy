import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { finalizeGalleryBatch, isManagedRemoteUrl, loadOssConfig } from "./finalize_gallery_batch.mjs";

const CONFIG = {
  accessKeyId: "test-ak",
  accessKeySecret: "test-sk",
  bucket: "test-assets",
  endpoint: "oss-cn-shanghai.aliyuncs.com",
  domain: "assets.example.com",
  prefix: "dev/",
};

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "meme-finalizer-"));
  const input = path.join(root, "input");
  const output = path.join(root, "handoff", "batch-one");
  const templateDir = path.join(input, "template-one");
  await mkdir(templateDir, { recursive: true });
  await writeFile(path.join(templateDir, "cover.png"), "same-image");
  await writeFile(path.join(templateDir, "reference.webp"), "second-image");
  await writeFile(path.join(templateDir, "meme-template.json"), `${JSON.stringify({
    key: "template-one",
    title: "模板一",
    cover: "./cover.png",
    referenceImage: "./cover.png",
    promptTemplate: "测试提示词",
    inputSchema: [],
    preprocessSteps: [],
  }, null, 2)}\n`);
  return { root, input, output, templateDir };
}

async function mockValidate(file, mode, config) {
  const data = JSON.parse(await readFile(file, "utf8"));
  if (mode === "remote") {
    for (const field of ["cover", "referenceImage"]) {
      if (data[field]) assert.equal(isManagedRemoteUrl(data[field], config), true);
    }
  }
}

test("validates OSS configuration without exposing secrets", () => {
  assert.throws(() => loadOssConfig({}), /缺少 OSS 环境变量/);
  assert.throws(() => loadOssConfig({
    ALIYUN_OSS_ACCESS_KEY_ID: "ak",
    ALIYUN_OSS_ACCESS_KEY_SECRET: "sk",
    ALIYUN_OSS_ASSETS_BUCKET: "bucket",
    ALIYUN_OSS_ASSETS_ENDPOINT: "https://oss.example.com",
    ALIYUN_OSS_ASSETS_DOMAIN: "assets.example.com",
  }), /纯 hostname/);
});

test("uploads identical cover and reference image once and preserves source JSON", async () => {
  const value = await fixture();
  try {
    const sourceBefore = await readFile(path.join(value.templateDir, "meme-template.json"), "utf8");
    const uploads = [];
    const summary = await finalizeGalleryBatch({
      input: value.input,
      output: value.output,
      config: CONFIG,
      uploadObject: async (upload) => { uploads.push(upload); },
    });
    assert.equal(summary.templates, 1);
    assert.equal(summary.uploaded, 1);
    assert.equal(summary.reused, 1);
    assert.equal(uploads.length, 1);
    const finalData = JSON.parse(await readFile(path.join(value.output, "template-one.json"), "utf8"));
    assert.equal(finalData.cover, finalData.referenceImage);
    assert.equal(isManagedRemoteUrl(finalData.cover, CONFIG), true);
    assert.equal(await readFile(path.join(value.templateDir, "meme-template.json"), "utf8"), sourceBefore);

    const retryUploads = [];
    const retry = await finalizeGalleryBatch({
      input: value.input,
      output: value.output,
      config: CONFIG,
      validateFile: mockValidate,
      uploadObject: async (upload) => { retryUploads.push(upload); },
    });
    assert.equal(retryUploads.length, 0);
    assert.equal(retry.uploaded, 0);
    assert.equal(retry.reused, 2);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("explicit write-back mode atomically updates the source template", async () => {
  const value = await fixture();
  try {
    const templateFile = path.join(value.templateDir, "meme-template.json");
    const progressFile = path.join(value.root, "progress.json");
    const summary = await finalizeGalleryBatch({
      input: templateFile,
      output: value.output,
      progressFile,
      config: CONFIG,
      writeBack: true,
      validateFile: mockValidate,
      uploadObject: async () => undefined,
    });
    const source = JSON.parse(await readFile(templateFile, "utf8"));
    assert.equal(summary.writtenBack, 1);
    assert.equal(isManagedRemoteUrl(source.cover, CONFIG), true);
    assert.equal(source.referenceImage, source.cover);
    const progress = JSON.parse(await readFile(progressFile, "utf8"));
    assert.equal(progress.status, "completed"); assert.equal(progress.completedTemplates, 1); assert.equal(progress.uploaded, 1); assert.equal(progress.writtenBack, 1);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("persists successful uploads and reuses them after a partial failure", async () => {
  const value = await fixture();
  try {
    const templateFile = path.join(value.templateDir, "meme-template.json");
    const template = JSON.parse(await readFile(templateFile, "utf8"));
    template.referenceImage = "./reference.webp";
    await writeFile(templateFile, `${JSON.stringify(template, null, 2)}\n`);
    let attempts = 0;
    await assert.rejects(() => finalizeGalleryBatch({
      input: value.input,
      output: value.output,
      config: CONFIG,
      validateFile: mockValidate,
      uploadObject: async () => {
        attempts += 1;
        if (attempts === 2) throw new Error("simulated upload failure");
      },
    }), /simulated upload failure/);
    assert.equal(attempts, 2);

    const retryUploads = [];
    const summary = await finalizeGalleryBatch({
      input: value.input,
      output: value.output,
      config: CONFIG,
      validateFile: mockValidate,
      uploadObject: async (upload) => { retryUploads.push(upload); },
    });
    assert.equal(retryUploads.length, 1);
    assert.equal(summary.uploaded, 1);
    assert.equal(summary.reused, 1);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("rejects duplicate template keys before uploading", async () => {
  const value = await fixture();
  try {
    const duplicate = path.join(value.input, "duplicate");
    await mkdir(duplicate, { recursive: true });
    await writeFile(path.join(duplicate, "cover.png"), "another-image");
    await writeFile(path.join(duplicate, "meme-template.json"), `${JSON.stringify({
      key: "template-one",
      title: "重复模板",
      cover: "./cover.png",
      promptTemplate: "测试",
      inputSchema: [],
    }, null, 2)}\n`);
    let uploads = 0;
    await assert.rejects(() => finalizeGalleryBatch({
      input: value.input,
      output: value.output,
      config: CONFIG,
      validateFile: mockValidate,
      uploadObject: async () => { uploads += 1; },
    }), /key 重复/);
    assert.equal(uploads, 0);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});
