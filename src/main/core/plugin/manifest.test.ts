import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validateManifest } from "./manifest";

const BASE = {
  apiVersion: 2,
  id: "vadu.ai",
  kind: "translator",
  main: "index.js",
  name: "AI 翻译",
  permissions: ["net:*"],
  version: "0.1.0",
};

describe("validateManifest", () => {
  test("合法 manifest 通过", () => {
    const result = validateManifest(BASE);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.manifest.id, "vadu.ai");
      assert.equal(result.manifest.capabilities.streaming, false);
    }
  });

  test("apiVersion 不匹配拒绝", () => {
    const result = validateManifest({ ...BASE, apiVersion: 1 });
    assert.equal(result.ok, false);
  });

  test("id 非法字符拒绝", () => {
    assert.equal(validateManifest({ ...BASE, id: "Vadu.AI!" }).ok, false);
    assert.equal(validateManifest({ ...BASE, id: "vadu ai" }).ok, false);
  });

  test("main 后缀必须是 js/mjs", () => {
    assert.equal(validateManifest({ ...BASE, main: "index.ts" }).ok, false);
    assert.equal(validateManifest({ ...BASE, main: "index.mjs" }).ok, true);
  });

  test("三种 kind 均通过", () => {
    for (const kind of ["translator", "ocr", "tts"]) {
      const result = validateManifest({ ...BASE, kind });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.manifest.kind, kind);
      }
    }
  });

  test("非法 kind 拒绝", () => {
    assert.equal(validateManifest({ ...BASE, kind: "asr" }).ok, false);
    assert.equal(validateManifest({ ...BASE, kind: 42 }).ok, false);
    assert.equal(validateManifest({ ...BASE, kind: undefined }).ok, false);
  });

  test("permissions 必须是 net: 前缀", () => {
    assert.equal(
      validateManifest({ ...BASE, permissions: ["https://api.openai.com"] }).ok,
      false
    );
  });

  test("presets 形状错误拒绝", () => {
    assert.equal(
      validateManifest({
        ...BASE,
        presets: [{ id: "openai", label: "OpenAI" }],
      }).ok,
      false
    );
  });

  test("未知 capabilities 默认 false", () => {
    const result = validateManifest({
      ...BASE,
      capabilities: { streaming: true },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.manifest.capabilities.streaming, true);
      assert.equal(result.manifest.capabilities.models, false);
    }
  });
});
