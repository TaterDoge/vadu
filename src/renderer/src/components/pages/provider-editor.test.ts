import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  draftLabel,
  ensureDraftVisible,
  isModelRequestInvalid,
  mergeSecretRetry,
  modelDisplayLabel,
  modelsConfigSignature,
  requiredSecretNames,
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

describe("ensureDraftVisible", () => {
  test("新增草稿清空搜索并切回全部过滤", () => {
    assert.deepEqual(ensureDraftVisible(), { filter: "all", query: "" });
  });
});

describe("draftLabel", () => {
  test("空名仍显示「自定义 OpenAI」", () => {
    assert.equal(draftLabel(""), "自定义 OpenAI");
    assert.equal(draftLabel("我的服务商"), "我的服务商");
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

describe("modelDisplayLabel", () => {
  test("label 省略时回退 id", () => {
    assert.equal(modelDisplayLabel({ id: "gpt-4o" }), "gpt-4o");
    assert.equal(
      modelDisplayLabel({ id: "gpt-4o", label: "GPT-4o" }),
      "GPT-4o"
    );
  });
});

describe("requiredSecretNames", () => {
  const schema = {
    properties: {
      apiKey: { required: true, title: "API Key", type: "secret" as const },
      apiSecret: { title: "Secret", type: "secret" as const },
      org: { title: "Org ID", type: "string" as const },
    },
    required: ["apiKey"],
    type: "object" as const,
  };

  test("只列必填 secret，支持多字段与 required 数组", () => {
    assert.deepEqual(requiredSecretNames(schema), ["apiKey"]);
    const both = {
      ...schema,
      properties: {
        ...schema.properties,
        apiSecret: {
          required: true,
          title: "Secret",
          type: "secret" as const,
        },
      },
    };
    assert.deepEqual(requiredSecretNames(both), ["apiKey", "apiSecret"]);
  });

  test("无 secret 或无 schema 均返回空（不受门控）", () => {
    assert.deepEqual(requiredSecretNames(undefined), []);
    assert.deepEqual(
      requiredSecretNames({
        properties: { org: { title: "Org", type: "string" as const } },
        type: "object" as const,
      }),
      []
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
