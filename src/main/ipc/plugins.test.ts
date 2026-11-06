import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../shared/errors";
import { type ConfigSchema, IPC, type Profile } from "../../shared/ipc";
import { validateConfigAgainstSchema } from "../core/config/validate";
import { TaskRegistry } from "../core/translate/tasks";

type HostCall = {
  config: Record<string, unknown>;
  pluginId: string;
  profile: Profile;
  requestId: string;
  secrets?: Record<string, string>;
};

type HealthHostCall = {
  pluginId: string;
  profile: Profile;
  requestId: string;
  req: {
    config: Record<string, unknown>;
    source: string;
    target: string;
    text: string;
  };
  secrets?: Record<string, string>;
  signal?: AbortSignal;
};

type LoadOptions = {
  configSchema?: ConfigSchema;
  health?: (args: HealthHostCall) => Promise<{ hasOutput: boolean }>;
  healthResult?: { hasOutput: boolean };
};

const MODEL_SCHEMA: ConfigSchema = {
  properties: {
    baseURL: { title: "接口地址", type: "string" },
    model: { title: "模型", type: "string" },
  },
  type: "object",
};

function makeSender(id: number): EventEmitter & {
  id: number;
  isDestroyed: () => boolean;
  send: () => void;
} {
  return Object.assign(new EventEmitter(), {
    id,
    isDestroyed: () => false,
    send: () => undefined,
  });
}

function loadPluginsIpc(savedProfiles: Profile[], options: LoadOptions = {}) {
  const handlers = new Map<
    string,
    (raw: unknown, ctx: unknown) => Promise<unknown>
  >();
  const listeners = new Map<
    string,
    (event: { sender: { id: number } }, payload: unknown) => void
  >();
  const hostCalls: HostCall[] = [];
  const healthCalls: HealthHostCall[] = [];
  const registries: TaskRegistry[] = [];
  class TrackedTaskRegistry extends TaskRegistry {
    constructor() {
      super();
      registries.push(this);
    }
  }
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "plugins.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const imports: Record<string, unknown> = {
    "../../../shared/errors": { VaduError },
    "../../shared/errors": { VaduError },
    "../../shared/ipc": { IPC },
    "../core/config/store": {
      readProfiles: () => savedProfiles,
    },
    "../core/config/validate": { validateConfigAgainstSchema },
    "../core/plugin/host": {
      hostListModels: (args: HostCall) => {
        hostCalls.push(args);
        return Promise.resolve([{ id: "m" }]);
      },
      hostProbeTranslate: (args: HealthHostCall) => {
        healthCalls.push(args);
        return options.health
          ? options.health(args)
          : Promise.resolve(options.healthResult ?? { hasOutput: true });
      },
    },
    "../core/plugin/registry": {
      registry: {
        getTranslator: () => ({
          create: () => null,
          descriptor: {
            capabilities: { models: true },
            configSchema: options.configSchema,
            status: "ready",
          },
        }),
      },
    },
    "../core/translate/tasks": { TaskRegistry: TrackedTaskRegistry },
    "./index": {
      handle: (
        channel: string,
        fn: (raw: unknown, ctx: unknown) => Promise<unknown>
      ) => handlers.set(channel, fn),
    },
    electron: {
      ipcMain: {
        on: (
          channel: string,
          callback: (
            event: { sender: { id: number } },
            payload: unknown
          ) => void
        ) => listeners.set(channel, callback),
      },
    },
    "node:crypto": {
      randomUUID: () => "uuid-test",
    },
  };
  runInNewContext(outputText, {
    Date,
    Error,
    exports,
    JSON,
    Object,
    Promise,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error(`Unexpected import: ${name}`);
      }
      return imports[name];
    },
    TypeError,
    URL,
  });
  (exports.registerPluginsIpc as () => void)();
  const listModelsHandler = handlers.get(IPC.plugins.listModels) as (
    raw: unknown,
    ctx: unknown
  ) => Promise<unknown>;
  const healthHandler = handlers.get(IPC.plugins.healthCheck) as (
    raw: unknown,
    ctx: unknown
  ) => Promise<{ elapsedMs: number }>;
  const cancelHealth = listeners.get(IPC.plugins.cancelHealthCheck);
  assert.ok(listModelsHandler);
  assert.ok(healthHandler);
  assert.ok(cancelHealth);
  return {
    cancelHealth,
    handler: listModelsHandler,
    healthCalls,
    healthHandler,
    hostCalls,
    registries,
  };
}

const ctx = { sender: { isDestroyed: () => false } };

test("草稿 profileId 可用：临时 profile 由本次 config 派生 origin，secrets 透传", async () => {
  const { handler, hostCalls } = loadPluginsIpc([]);
  const models = await handler(
    {
      config: { baseURL: "https://draft.invalid/v1" },
      pluginId: "vadu.ai",
      profileId: "__new__",
      secrets: { apiKey: "sk-test" },
    },
    ctx
  );
  assert.equal((models as { id: string }[])[0]?.id, "m");
  assert.equal(hostCalls.length, 1);
  const hit = hostCalls[0] as HostCall;
  assert.equal(hit.profile.id, "__new__");
  assert.equal(hit.profile.pluginId, "vadu.ai");
  assert.equal(hit.profile.name, "");
  assert.equal(hit.profile.enabled, true);
  assert.equal(hit.profile.createdAt, 0);
  assert.deepEqual([...hit.profile.allowedOrigins], ["https://draft.invalid"]);
  assert.equal(hit.profile.config.baseURL, "https://draft.invalid/v1");
  assert.equal(hit.secrets?.apiKey, "sk-test");
});

test("已保存 profile 命中时使用保存的 allowedOrigins，secrets 仍透传", async () => {
  const saved: Profile = {
    allowedOrigins: ["https://saved.invalid"],
    config: { baseURL: "https://saved.invalid/v1" },
    createdAt: 1,
    enabled: true,
    id: "p1",
    name: "saved",
    pluginId: "vadu.ai",
  };
  const { handler, hostCalls } = loadPluginsIpc([saved]);
  await handler(
    {
      config: { baseURL: "https://evil.invalid/v1" },
      pluginId: "vadu.ai",
      profileId: "p1",
      secrets: { apiKey: "sk-new" },
    },
    ctx
  );
  assert.equal(hostCalls.length, 1);
  const hit = hostCalls[0] as HostCall;
  // 草稿 origin 不覆盖已保存白名单：仍用保存值
  assert.equal(hit.profile.id, "p1");
  assert.deepEqual(hit.profile.allowedOrigins, ["https://saved.invalid"]);
  assert.equal(hit.secrets?.apiKey, "sk-new");
});

test("草稿无 baseURL 报 INVALID_CONFIG，不发请求", async () => {
  const { handler, hostCalls } = loadPluginsIpc([]);
  await assert.rejects(
    handler({ config: {}, pluginId: "vadu.ai", profileId: "__new__" }, ctx),
    { code: "INVALID_CONFIG", message: "请先填写正确的接口地址" }
  );
  await assert.rejects(
    handler(
      {
        config: { baseURL: "not a url" },
        pluginId: "vadu.ai",
        profileId: "__new__",
      },
      ctx
    ),
    { code: "INVALID_CONFIG", message: "请先填写正确的接口地址" }
  );
  assert.equal(hostCalls.length, 0);
});

test("secrets 形状校验：非对象/非字符串值/超限均报 INVALID_CONFIG", async () => {
  const { handler, hostCalls } = loadPluginsIpc([]);
  const base = {
    config: { baseURL: "https://x.invalid/v1" },
    pluginId: "vadu.ai",
    profileId: "__new__",
  };
  await assert.rejects(handler({ ...base, secrets: "nope" }, ctx), {
    code: "INVALID_CONFIG",
  });
  await assert.rejects(handler({ ...base, secrets: { apiKey: 123 } }, ctx), {
    code: "INVALID_CONFIG",
    message: "密钥值必须为字符串",
  });
  const tooMany = Object.fromEntries(
    Array.from({ length: 17 }, (_, i) => [`k${i}`, "v"])
  );
  await assert.rejects(handler({ ...base, secrets: tooMany }, ctx), {
    code: "INVALID_CONFIG",
    message: "密钥字段过多",
  });
  await assert.rejects(
    handler({ ...base, secrets: { apiKey: "x".repeat(8193) } }, ctx),
    { code: "INVALID_CONFIG", message: "密钥值过长" }
  );
  assert.equal(hostCalls.length, 0);
});

const healthBase = {
  config: { baseURL: "https://health.invalid/v1", model: "m1" },
  pluginId: "vadu.ai",
  profileId: "",
};

test("健康检测用固定短文本与当前模型真实调用翻译，只返回耗时", async () => {
  const { healthCalls, healthHandler, registries } = loadPluginsIpc([], {
    configSchema: MODEL_SCHEMA,
  });
  const result = await healthHandler(
    {
      ...healthBase,
      config: { ...healthBase.config, apiKey: "sk-should-not-pass" },
      requestId: "h1",
      secrets: { apiKey: "sk-test" },
    },
    { sender: makeSender(1) }
  );
  assert.equal(typeof result.elapsedMs, "number");
  assert.equal(healthCalls.length, 1);
  const hit = healthCalls[0] as HealthHostCall;
  assert.equal(hit.req.text, "Hello");
  assert.equal(hit.req.source, "en");
  assert.equal(hit.req.target, "zh-CN");
  assert.deepEqual(hit.req.config, {
    baseURL: "https://health.invalid/v1",
    model: "m1",
  });
  assert.equal(hit.secrets?.apiKey, "sk-test");
  assert.notEqual(hit.profile.id, "");
  assert.ok(hit.profile.id.startsWith("__health__"));
  assert.deepEqual([...hit.profile.allowedOrigins], ["https://health.invalid"]);
  assert.equal(registries.at(-1)?.size(), 0);
});

test("已保存 profile 沿用落盘 origin；其他插件 profile 拒绝且不复用密钥", async () => {
  const saved: Profile = {
    allowedOrigins: ["https://saved.invalid"],
    config: { baseURL: "https://saved.invalid/v1", model: "saved-model" },
    createdAt: 1,
    enabled: true,
    id: "p1",
    name: "saved",
    pluginId: "vadu.ai",
  };
  const other: Profile = {
    ...saved,
    id: "p2",
    name: "other",
    pluginId: "vadu.other",
  };
  const { healthCalls, healthHandler } = loadPluginsIpc([saved, other], {
    configSchema: MODEL_SCHEMA,
  });
  await healthHandler(
    {
      ...healthBase,
      config: { baseURL: "https://evil.invalid/v1", model: "m1" },
      profileId: "p1",
      requestId: "h2",
    },
    { sender: makeSender(1) }
  );
  assert.deepEqual(healthCalls[0]?.profile.allowedOrigins, [
    "https://saved.invalid",
  ]);
  await assert.rejects(
    healthHandler(
      { ...healthBase, profileId: "p2", requestId: "h3" },
      { sender: makeSender(1) }
    ),
    { code: "INVALID_CONFIG", message: "该 profile 属于其他插件" }
  );
  assert.equal(healthCalls.length, 1);
});

test("空输出与插件错误都不能算成功", async () => {
  const empty = loadPluginsIpc([], {
    configSchema: MODEL_SCHEMA,
    healthResult: { hasOutput: false },
  });
  await assert.rejects(
    empty.healthHandler(
      { ...healthBase, requestId: "h5" },
      { sender: makeSender(1) }
    ),
    { code: "INTERNAL", message: "模型返回空结果" }
  );
  const failed = loadPluginsIpc([], {
    configSchema: MODEL_SCHEMA,
    health: () =>
      Promise.reject(new VaduError("AUTH_FAILED", "认证失败，请检查 API Key")),
  });
  await assert.rejects(
    failed.healthHandler(
      { ...healthBase, requestId: "h6" },
      { sender: makeSender(1) }
    ),
    { code: "AUTH_FAILED", message: "认证失败，请检查 API Key" }
  );
});

test("模型/配置/密钥非法时不发健康请求", async () => {
  const { healthCalls, healthHandler } = loadPluginsIpc([], {
    configSchema: MODEL_SCHEMA,
  });
  const sender = makeSender(1);
  await assert.rejects(
    healthHandler(
      {
        config: { baseURL: "https://x.invalid/v1" },
        pluginId: "vadu.ai",
        profileId: "",
        requestId: "h7",
      },
      { sender }
    ),
    { code: "INVALID_CONFIG", message: "请先填写模型" }
  );
  await assert.rejects(
    healthHandler(
      {
        ...healthBase,
        config: { baseURL: "https://x.invalid/v1", model: 123 },
        requestId: "h8",
      },
      { sender }
    ),
    { code: "INVALID_CONFIG", message: "model 必须是字符串" }
  );
  await assert.rejects(
    healthHandler(
      {
        ...healthBase,
        requestId: "h9",
        secrets: { apiKey: 123 },
      },
      { sender }
    ),
    { code: "INVALID_CONFIG", message: "密钥值必须为字符串" }
  );
  await assert.rejects(
    healthHandler(
      {
        ...healthBase,
        config: { baseURL: "not a url", model: "m" },
        requestId: "h10",
      },
      { sender }
    ),
    { code: "INVALID_CONFIG", message: "请先填写正确的接口地址" }
  );
  assert.equal(healthCalls.length, 0);
});

test("健康检测取消只对发起窗口生效，结束后清理任务", async () => {
  let aborted = false;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const { cancelHealth, healthHandler, registries } = loadPluginsIpc([], {
    configSchema: MODEL_SCHEMA,
    health: ({ signal }) => {
      markStarted();
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new VaduError("ABORTED", "已取消"));
          },
          { once: true }
        );
      });
    },
  });
  const owner = makeSender(1);
  const pending = healthHandler(
    { ...healthBase, requestId: "h11" },
    { sender: owner }
  );
  await started;
  cancelHealth({ sender: { id: 2 } }, { requestId: "h11" });
  assert.equal(aborted, false);
  assert.equal(registries.at(-1)?.size(), 1);
  cancelHealth({ sender: { id: 1 } }, { requestId: "h11" });
  await assert.rejects(pending, { code: "ABORTED" });
  assert.equal(aborted, true);
  assert.equal(registries.at(-1)?.size(), 0);
});

test("发起窗口销毁会中止健康检测并清理任务", async () => {
  let aborted = false;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const { healthHandler, registries } = loadPluginsIpc([], {
    configSchema: MODEL_SCHEMA,
    health: ({ signal }) => {
      markStarted();
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new VaduError("ABORTED", "已取消"));
          },
          { once: true }
        );
      });
    },
  });
  const owner = makeSender(1);
  const pending = healthHandler(
    { ...healthBase, requestId: "h12" },
    { sender: owner }
  );
  await started;
  owner.emit("destroyed");
  await assert.rejects(pending, { code: "ABORTED" });
  assert.equal(aborted, true);
  assert.equal(registries.at(-1)?.size(), 0);
});
