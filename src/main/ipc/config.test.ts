import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../shared/errors";
import { IPC, type Profile } from "../../shared/ipc";
import { validateConfigAgainstSchema } from "../core/config/validate";
import { normalizeBaseUrl, originOf } from "../core/url";

const SCHEMA = {
  properties: {
    apiKey: { required: true, title: "API Key", type: "secret" },
    baseURL: { required: true, title: "接口地址", type: "string" },
    model: { required: true, title: "模型", type: "string" },
  },
  required: ["baseURL", "model", "apiKey"],
  type: "object" as const,
};

test("config IPC 原生确认默认拒绝，忽略 renderer 授权，保存串行且不可换插件", async () => {
  const handlers = new Map<
    string,
    (raw: unknown, ctx: unknown) => Promise<Profile>
  >();
  const profiles: Profile[] = [];
  const dialogs: Record<string, unknown>[] = [];
  let response = 0;
  let sequence = 0;
  const parent = {};
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "config.ts"), "utf8");
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
      readProfiles: () => profiles,
      saveProfile: (profile: Profile) => {
        const index = profiles.findIndex((entry) => entry.id === profile.id);
        if (index < 0) {
          profiles.push(profile);
        } else {
          profiles[index] = profile;
        }
        return profile;
      },
    },
    "../core/config/validate": { validateConfigAgainstSchema },
    "../core/plugin/registry": {
      registry: {
        get: () => ({ descriptor: { configSchema: SCHEMA, status: "ready" } }),
      },
    },
    "../core/url": { normalizeBaseUrl, originOf },
    "./index": {
      handle: (
        channel: string,
        handler: (raw: unknown, ctx: unknown) => Promise<Profile>
      ) => handlers.set(channel, handler),
    },
    electron: {
      BrowserWindow: { fromWebContents: () => parent },
      dialog: {
        showMessageBox: (owner: unknown, options: Record<string, unknown>) => {
          assert.equal(owner, parent);
          dialogs.push(options);
          return Promise.resolve({ response });
        },
      },
    },
    "node:crypto": {
      randomUUID: () => {
        sequence += 1;
        return `host-${sequence}`;
      },
    },
  };
  runInNewContext(outputText, {
    Date,
    exports,
    Promise,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error("Unexpected import");
      }
      return imports[name];
    },
  });
  (exports.registerConfigIpc as () => void)();
  const save = handlers.get(IPC.config.saveProfile);
  assert.ok(save);
  const ctx = { sender: { isDestroyed: () => false } };
  const input = {
    allowedOrigins: ["https://untrusted.invalid"],
    config: {
      apiKey: "must-not-store",
      baseURL: "https://untrusted.invalid/v1",
      model: "fake",
    },
    id: "renderer-id",
    name: "test",
    pluginId: "vadu.ai",
  };
  await assert.rejects(save(input, ctx), { code: "PERMISSION_DENIED" });
  assert.equal(profiles.length, 0);
  assert.equal(dialogs[0]?.defaultId, 0);
  assert.equal(dialogs[0]?.cancelId, 0);
  assert.ok(String(dialogs[0]?.detail).includes("https://untrusted.invalid"));
  assert.ok(String(dialogs[0]?.detail).includes("API Key"));
  response = 1;
  const savedProfile = await save(input, ctx);
  assert.notEqual(savedProfile.id, "renderer-id");
  assert.equal(savedProfile.config.apiKey, undefined);
  await assert.rejects(
    save({ ...savedProfile, pluginId: "other.plugin" }, ctx),
    { code: "INVALID_CONFIG" }
  );
  const changed = {
    ...savedProfile,
    config: { baseURL: "https://next.invalid/v1", model: "fake" },
  };
  const before = dialogs.length;
  await Promise.all([save(changed, ctx), save(changed, ctx)]);
  assert.equal(dialogs.length, before + 1);
});
