import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../../shared/errors";
import type { Profile } from "../../../shared/ipc";
import type { PluginRuntime, TranslatorPlugin } from "../../../shared/plugin";
import { withDeadline as realWithDeadline } from "./deadline";

// 取消 origin 确认弹窗后，runtime.fetch 的 origin gate 是唯一强制点，单独守住
const PROFILE: Profile = {
  allowedOrigins: ["https://api.example.com"],
  config: {},
  createdAt: 1,
  enabled: true,
  id: "p1",
  name: "t",
  pluginId: "vadu.ai",
};

function loadHost(
  fetchCalls: { init: RequestInit; url: URL }[],
  opts?: {
    getSecret?: (profileId: string, name: string) => string | undefined;
    realDeadline?: boolean;
  }
) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "host.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const imports: Record<string, unknown> = {
    "../../../shared/errors": { VaduError },
    "../config/secrets": {
      getSecret: opts?.getSecret ?? (() => undefined),
      hasSecret: (profileId: string, name: string) =>
        (opts?.getSecret?.(profileId, name) ?? undefined) !== undefined,
    },
    "./deadline": {
      withDeadline: opts?.realDeadline
        ? realWithDeadline
        : (work: Promise<unknown>) => work,
    },
  };
  const fetchStub = (input: string, init: RequestInit) => {
    fetchCalls.push({ init, url: new URL(input) });
    return Promise.resolve(
      new Response(JSON.stringify({ data: [{ id: "m" }] }), {
        headers: { "content-type": "application/json" },
        status: 200,
      })
    );
  };
  runInNewContext(outputText, {
    AbortController,
    AbortSignal,
    clearTimeout,
    console,
    Date,
    DOMException,
    exports,
    fetch: fetchStub,
    Promise,
    Response,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error(`Unexpected import: ${name}`);
      }
      return imports[name];
    },
    setTimeout,
    URL,
  });
  return exports as {
    hostListModels: (args: {
      config: Record<string, unknown>;
      create: (runtime: PluginRuntime) => TranslatorPlugin;
      pluginId: string;
      profile: Profile;
      requestId: string;
      secrets?: Record<string, string>;
      timeoutMs?: number;
    }) => Promise<unknown>;
    hostProbeTranslate: (args: {
      create: (runtime: PluginRuntime) => TranslatorPlugin;
      pluginId: string;
      profile: Profile;
      req: {
        config: Record<string, unknown>;
        source: string;
        target: string;
        text: string;
      };
      requestId: string;
      secrets?: Record<string, string>;
      signal?: AbortSignal;
      timeoutMs?: number;
    }) => Promise<{ hasOutput: boolean }>;
  };
}

function createFor(target: string) {
  return (runtime: PluginRuntime): TranslatorPlugin => ({
    listModels: (config: Record<string, unknown>) =>
      runtime
        .fetch(new URL(target, String(config.baseURL)).toString())
        .then(() => [{ id: "m" }]),
    translate: () =>
      (async function* empty() {
        yield* [];
      })(),
  });
}

test("secrets 覆盖表优先于已保存密钥桶，未覆盖的键回落", async () => {
  const calls: { init: RequestInit; url: URL }[] = [];
  const { hostListModels } = loadHost(calls, {
    getSecret: () => "saved-key",
  });
  const seen: Record<string, unknown> = {};
  const models = await hostListModels({
    config: { baseURL: "https://api.example.com/v1" },
    create: (runtime) => ({
      listModels: () => {
        seen.api = runtime.secrets.get("apiKey");
        seen.apiHas = runtime.secrets.has("apiKey");
        seen.org = runtime.secrets.get("org");
        seen.orgHas = runtime.secrets.has("org");
        return Promise.resolve([{ id: "m" }]);
      },
      translate: () =>
        (async function* empty() {
          yield* [];
        })(),
    }),
    pluginId: "vadu.ai",
    profile: PROFILE,
    requestId: "r3",
    secrets: { apiKey: "override-key" },
  });
  assert.deepEqual([...(models as { id: string }[])], [{ id: "m" }]);
  assert.deepEqual(seen, {
    api: "override-key",
    apiHas: true,
    org: "saved-key",
    orgHas: true,
  });
});

test("未登记的 origin 被拒，登记后强制 redirect:error", async () => {
  const calls: { init: RequestInit; url: URL }[] = [];
  const { hostListModels } = loadHost(calls);

  await assert.rejects(
    hostListModels({
      config: { baseURL: "https://evil.invalid/v1" },
      create: createFor("/models"),
      pluginId: "vadu.ai",
      profile: PROFILE,
      requestId: "r1",
    }),
    { code: "PERMISSION_DENIED" }
  );
  assert.equal(calls.length, 0, "未登记 origin 不应发出任何请求");

  const models = await hostListModels({
    config: { baseURL: "https://api.example.com/v1" },
    create: createFor("/models"),
    pluginId: "vadu.ai",
    profile: PROFILE,
    requestId: "r2",
  });
  assert.deepEqual([...(models as { id: string }[])], [{ id: "m" }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url.origin, "https://api.example.com");
  // 3xx 直接失败，避免重定向把密钥带出白名单
  assert.equal(calls[0]?.init.redirect, "error");
});

test("健康探针完整消费输出并只判定是否非空", async () => {
  const { hostProbeTranslate } = loadHost([]);
  let seenText = "";
  const result = await hostProbeTranslate({
    create: () => ({
      translate: (req) =>
        (async function* probe() {
          seenText = req.text;
          await Promise.resolve();
          yield " ";
          yield "译";
        })(),
    }),
    pluginId: "vadu.ai",
    profile: PROFILE,
    req: {
      config: {},
      source: "en",
      target: "zh-CN",
      text: "Hello",
    },
    requestId: "probe-1",
  });
  assert.equal(seenText, "Hello");
  assert.equal(result.hasOutput, true);
});

test("健康探针把纯空白输出判为空", async () => {
  const { hostProbeTranslate } = loadHost([]);
  const result = await hostProbeTranslate({
    create: () => ({
      translate: () =>
        (async function* blank() {
          await Promise.resolve();
          yield " \n ";
        })(),
    }),
    pluginId: "vadu.ai",
    profile: PROFILE,
    req: {
      config: {},
      source: "en",
      target: "zh-CN",
      text: "Hello",
    },
    requestId: "probe-blank",
  });
  assert.equal(result.hasOutput, false);
});

test("插件忽略 signal 时健康探针仍按 deadline settle 为 TIMEOUT", async () => {
  const { hostProbeTranslate } = loadHost([], { realDeadline: true });
  const startedAt = Date.now();
  await assert.rejects(
    hostProbeTranslate({
      create: () => ({
        translate: () =>
          (async function* hang() {
            await new Promise(() => undefined);
            yield "never";
          })(),
      }),
      pluginId: "vadu.ai",
      profile: PROFILE,
      req: {
        config: {},
        source: "en",
        target: "zh-CN",
        text: "Hello",
      },
      requestId: "probe-timeout",
      timeoutMs: 20,
    }),
    { code: "TIMEOUT" }
  );
  assert.ok(Date.now() - startedAt < 1000);
});

test("发起方 signal 取消健康探针归一化为 ABORTED", async () => {
  const { hostProbeTranslate } = loadHost([], { realDeadline: true });
  const controller = new AbortController();
  const pending = hostProbeTranslate({
    create: () => ({
      translate: (_req, { signal }) =>
        (async function* abortable() {
          await new Promise((_resolve, reject) => {
            if (signal.aborted) {
              reject(new DOMException("Aborted", "AbortError"));
              return;
            }
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true }
            );
          });
          yield "never";
        })(),
    }),
    pluginId: "vadu.ai",
    profile: PROFILE,
    req: {
      config: {},
      source: "en",
      target: "zh-CN",
      text: "Hello",
    },
    requestId: "probe-abort",
    signal: controller.signal,
    timeoutMs: 5000,
  });
  controller.abort();
  await assert.rejects(pending, { code: "ABORTED" });
});
