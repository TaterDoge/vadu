import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../shared/errors";
import { IPC } from "../../shared/ipc";

test("secrets IPC 只接受插件 schema 声明的 secret 字段", async () => {
  const handlers = new Map<string, (raw: unknown) => Promise<unknown>>();
  const secretsCalls: { name: string; profileId: string; value?: string }[] =
    [];
  const profiles = [
    {
      allowedOrigins: [],
      config: {},
      createdAt: 1,
      enabled: true,
      id: "p",
      name: "测试",
      pluginId: "vadu.ai",
    },
  ];
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "secrets.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const imports: Record<string, unknown> = {
    "../../shared/errors": { VaduError },
    "../../shared/ipc": { IPC },
    "../core/config/secrets": {
      clearSecret: (profileId: string, name: string) => {
        secretsCalls.push({ name, profileId });
      },
      hasSecret: (profileId: string, name: string) => {
        secretsCalls.push({ name, profileId });
        return profileId === "p" && name === "apiKey";
      },
      secretStorageState: () => ({ available: true, plaintext: false }),
      setSecret: (profileId: string, name: string, value: string) => {
        secretsCalls.push({ name, profileId, value });
      },
    },
    "../core/config/store": { readProfiles: () => profiles },
    "../core/plugin/registry": {
      registry: {
        get: () => ({
          descriptor: {
            configSchema: {
              properties: {
                apiKey: { required: true, title: "API Key", type: "secret" },
                org: { title: "Org", type: "string" },
              },
              type: "object",
            },
          },
        }),
      },
    },
    "./index": {
      handle: (channel: string, handler: (raw: unknown) => Promise<unknown>) =>
        handlers.set(channel, handler),
    },
  };
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error(`Unexpected import: ${name}`);
      }
      return imports[name];
    },
  });
  (exports.registerSecretsIpc as () => void)();

  const has = handlers.get(IPC.secrets.has);
  const set = handlers.get(IPC.secrets.set);
  assert.ok(has);
  assert.ok(set);

  // 非 secret 字段拒绝（同步抛也转为拒绝路径）
  await assert.rejects(
    () => Promise.resolve().then(() => has({ name: "org", profileId: "p" })),
    { code: "INVALID_CONFIG" }
  );
  await assert.rejects(
    () =>
      Promise.resolve().then(() =>
        set({ name: "org", profileId: "p", value: "x" })
      ),
    { code: "INVALID_CONFIG" }
  );
  assert.equal(secretsCalls.length, 0);

  // secret 字段放行，且不暴露值
  assert.equal(await has({ name: "apiKey", profileId: "p" }), true);
  await set({ name: "apiKey", profileId: "p", value: "sk-1" });
  assert.deepEqual(secretsCalls, [
    { name: "apiKey", profileId: "p" },
    { name: "apiKey", profileId: "p", value: "sk-1" },
  ]);
});
