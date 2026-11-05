import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { ModelInfo } from "@shared/ipc";

import {
  filterModels,
  isModelRequestInvalid,
  mergeJsonFields,
  mergeSecretRetry,
  modelDisplayLabel,
  modelsConfigSignature,
} from "./provider-editor";

describe("mergeSecretRetry", () => {
  test("secret 保存失败时保留已输入密钥，其余以已保存为准", () => {
    const current = {
      name: "自定义 OpenAI",
      secrets: { apiKey: "typed-key" },
    };
    const saved = {
      name: "自定义 OpenAI",
      secrets: {},
    };
    assert.deepEqual(mergeSecretRetry(current, saved), {
      name: "自定义 OpenAI",
      secrets: { apiKey: "typed-key" },
    });
  });

  test("无待重试密钥时不注入空桶覆盖", () => {
    const current = { secrets: {} };
    const saved = { secrets: {} };
    assert.deepEqual(mergeSecretRetry(current, saved), { secrets: {} });
  });
});

describe("modelsConfigSignature", () => {
  test("排除 model 字段，避免下拉回填造成无限失效", () => {
    const a = modelsConfigSignature({
      baseURL: "https://x/v1",
      model: "gpt-4.1-mini",
    });
    const b = modelsConfigSignature({
      baseURL: "https://x/v1",
      model: "gpt-4o",
    });
    assert.equal(a, b);
  });

  test("键序无关，内容变化敏感", () => {
    const a = modelsConfigSignature({
      baseURL: "https://x/v1",
      temperature: 0.3,
    });
    const b = modelsConfigSignature({
      baseURL: "https://x/v1",
      temperature: 0.3,
    });
    assert.equal(a, b);
    const c = modelsConfigSignature({
      baseURL: "https://y/v1",
      temperature: 0.3,
    });
    assert.notEqual(a, c);
  });

  test("对象引用不变但内容相同签名一致", () => {
    const extra = { top_p: 0.9 };
    const a = modelsConfigSignature({ baseURL: "https://x/v1", extra });
    const b = modelsConfigSignature({
      baseURL: "https://x/v1",
      extra: { top_p: 0.9 },
    });
    assert.equal(a, b);
  });
});

describe("filterModels", () => {
  const models: ModelInfo[] = [
    { id: "auto/gpt-6-astra", label: "翻译优选" },
    { id: "auto/deepseek-v4.1-flash" },
  ];

  test("空查询返回全部", () => {
    assert.deepEqual(filterModels(models, "   "), models);
  });

  test("按 id 搜索不区分大小写", () => {
    const result = filterModels(models, "  DEEPSEEK  ");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "auto/deepseek-v4.1-flash");
  });

  test("按 label 搜索", () => {
    const result = filterModels(models, "翻译");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "auto/gpt-6-astra");
  });

  test("无匹配返回空数组", () => {
    assert.deepEqual(filterModels(models, "nope"), []);
  });
});

describe("mergeJsonFields", () => {
  const schema = {
    properties: {
      baseURL: { title: "Base URL", type: "string" as const },
      extra: { title: "提供商选项", type: "json" as const },
      headers: { title: "请求头", type: "json" as const },
    },
    type: "object" as const,
  };

  test("可解析的 json 字段并入配置，基础字段保留", () => {
    const config = mergeJsonFields(
      {
        config: { baseURL: "https://x/v1" },
        jsonText: { extra: '{"top_p":0.9}', headers: '{"X-Trace":"1"}' },
      },
      schema
    );
    assert.deepEqual(config, {
      baseURL: "https://x/v1",
      extra: { top_p: 0.9 },
      headers: { "X-Trace": "1" },
    });
  });

  test("空文本或非法 JSON 按未填处理，不影响其他字段", () => {
    const config = mergeJsonFields(
      {
        config: { baseURL: "https://x/v1" },
        jsonText: { extra: "", headers: "{bad" },
      },
      schema
    );
    assert.deepEqual(config, { baseURL: "https://x/v1" });
  });

  test("无 schema 时原样返回 config", () => {
    assert.deepEqual(
      mergeJsonFields({ config: { baseURL: "https://x/v1" }, jsonText: {} }),
      { baseURL: "https://x/v1" }
    );
  });
});

describe("modelDisplayLabel", () => {
  test("label 省略时回退 id", () => {
    assert.equal(modelDisplayLabel({ id: "gpt-4o" }), "gpt-4o");
    assert.equal(
      modelDisplayLabel({ id: "gpt-4o", label: "GPT-4o" }),
      "GPT-4o"
    );
  });
});

describe("isModelRequestInvalid", () => {
  const ctx = { pluginId: "p", profileId: "pr", seq: 3, sig: "s1" };
  const makeRefs = (
    over: Partial<{
      pluginId: string;
      profileId: string;
      seq: number;
      sig: string;
    }> = {}
  ) => ({
    pluginIdRef: { current: over.pluginId ?? "p" },
    profileIdRef: { current: over.profileId ?? "pr" },
    seqRef: { current: over.seq ?? 3 },
    sigRef: { current: over.sig ?? "s1" },
  });

  test("上下文未变不判定失效", () => {
    assert.equal(isModelRequestInvalid(ctx, makeRefs()), false);
  });

  test("序号/服务商/配置任一变化即失效", () => {
    assert.equal(isModelRequestInvalid(ctx, makeRefs({ seq: 4 })), true);
    assert.equal(
      isModelRequestInvalid(ctx, makeRefs({ profileId: "other" })),
      true
    );
    assert.equal(
      isModelRequestInvalid(ctx, makeRefs({ pluginId: "other" })),
      true
    );
    assert.equal(isModelRequestInvalid(ctx, makeRefs({ sig: "s2" })), true);
  });
});
