import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../shared/errors";
import { IPC, type Profile } from "../../shared/ipc";

type HostCall = {
  config: Record<string, unknown>;
  pluginId: string;
  profile: Profile;
  requestId: string;
  secrets?: Record<string, string>;
};

function loadPluginsIpc(savedProfiles: Profile[]) {
  const handlers = new Map<
    string,
    (raw: unknown, ctx: unknown) => Promise<unknown>
  >();
  const hostCalls: HostCall[] = [];
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
    "../core/plugin/host": {
      hostListModels: (args: HostCall) => {
        hostCalls.push(args);
        return Promise.resolve([{ id: "m" }]);
      },
    },
    "../core/plugin/registry": {
      registry: {
        get: () => ({
          create: () => null,
          descriptor: {
            capabilities: { models: true },
            status: "ready",
          },
        }),
      },
    },
    "./index": {
      handle: (
        channel: string,
        fn: (raw: unknown, ctx: unknown) => Promise<unknown>
      ) => handlers.set(channel, fn),
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
  const handler = handlers.get(IPC.plugins.listModels) as (
    raw: unknown,
    ctx: unknown
  ) => Promise<unknown>;
  assert.ok(handler);
  return { handler, hostCalls };
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
