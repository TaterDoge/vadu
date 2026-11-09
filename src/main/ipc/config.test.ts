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

test("config IPC 自动登记 origin，忽略 renderer 授权，保存串行且不可换插件", async () => {
  const handlers = new Map<
    string,
    (raw: unknown, ctx: unknown) => Promise<unknown>
  >();
  const profiles: Profile[] = [];
  const clearedSecrets: string[] = [];
  let sequence = 0;
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "config.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  let chain: Promise<unknown> = Promise.resolve();
  const imports: Record<string, unknown> = {
    "../../../shared/errors": { VaduError },
    "../../shared/errors": { VaduError },
    "../../shared/ipc": {
      ACCENT_NAMES: ["neutral", "blue", "emerald", "amber", "rose", "violet"],
      IPC,
      STYLE_NAMES: ["nova", "lyra"],
      THEME_NAMES: ["system", "light", "dark"],
    },
    "../core/config/secrets": {
      clearProfileSecrets: (profileId: string) => {
        clearedSecrets.push(profileId);
        return Promise.resolve();
      },
    },
    "../core/config/serial": {
      serializeConfigWrite: (operation: () => Promise<unknown>) => {
        const run = chain.catch(() => undefined).then(operation);
        chain = run;
        return run;
      },
    },
    "../core/config/store": {
      deleteProfile: (id: string) => {
        const index = profiles.findIndex((entry) => entry.id === id);
        if (index >= 0) {
          profiles.splice(index, 1);
        }
      },
      migrateAppearance: () => ({
        accent: "neutral",
        style: "nova",
        theme: "system",
      }),
      readAppearance: () => ({
        accent: "neutral",
        style: "nova",
        theme: "system",
      }),
      readProfiles: () => profiles,
      reorderProfiles: (orderedIds: string[]) => {
        const next = [
          ...orderedIds.flatMap((id) =>
            profiles.filter((entry) => entry.id === id)
          ),
          ...profiles.filter((entry) => !orderedIds.includes(entry.id)),
        ];
        profiles.splice(0, profiles.length, ...next);
        return [...profiles];
      },
      saveProfile: (profile: Profile) => {
        const index = profiles.findIndex((entry) => entry.id === profile.id);
        if (index < 0) {
          profiles.push(profile);
        } else {
          profiles[index] = profile;
        }
        return profile;
      },
      updateAppearance: (patch: Record<string, unknown>) => ({
        accent: "neutral",
        style: "nova",
        theme: "system",
        ...patch,
      }),
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
        handler: (raw: unknown, ctx: unknown) => Promise<unknown>
      ) => handlers.set(channel, handler),
    },
    electron: { BrowserWindow: { getAllWindows: () => [] } },
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
        throw new Error(`Unexpected import: ${name}`);
      }
      return imports[name];
    },
  });
  (exports.registerConfigIpc as () => void)();
  const save = handlers.get(IPC.config.saveProfile) as (
    raw: unknown,
    ctx: unknown
  ) => Promise<Profile>;
  const remove = handlers.get(IPC.config.deleteProfile) as (
    raw: unknown,
    ctx: unknown
  ) => Promise<null>;
  const reorder = handlers.get(IPC.config.reorderProfiles) as (
    raw: unknown,
    ctx: unknown
  ) => Promise<Profile[]>;
  assert.ok(save);
  assert.ok(remove);
  const ctx = { sender: { isDestroyed: () => false } };
  const input = {
    allowedOrigins: ["https://renderer.invalid"],
    config: {
      apiKey: "must-not-store",
      baseURL: "https://untrusted.invalid/v1",
      model: "fake",
    },
    id: "renderer-id",
    name: "test",
    pluginId: "vadu.ai",
  };

  const savedProfile = await save(input, ctx);
  assert.notEqual(savedProfile.id, "renderer-id");
  assert.equal(savedProfile.config.apiKey, undefined);
  // 只登记实际要访问的 origin，renderer 传入的其余值不参与
  assert.deepEqual(
    [...savedProfile.allowedOrigins],
    ["https://untrusted.invalid"]
  );

  // 同 origin 换路径不重复登记
  const sameOrigin = {
    ...savedProfile,
    config: { baseURL: "https://untrusted.invalid/v2", model: "fake" },
  };
  const resaved = await save(sameOrigin, ctx);
  assert.deepEqual([...resaved.allowedOrigins], ["https://untrusted.invalid"]);

  // 新 origin 追加，不覆盖旧的
  const nextOrigin = {
    ...savedProfile,
    config: { baseURL: "https://next.invalid/v1", model: "fake" },
  };
  const moved = await save(nextOrigin, ctx);
  assert.deepEqual(
    [...moved.allowedOrigins],
    ["https://untrusted.invalid", "https://next.invalid"]
  );

  await assert.rejects(
    save({ ...savedProfile, pluginId: "other.plugin" }, ctx),
    {
      code: "INVALID_CONFIG",
    }
  );

  // 并发两条新 profile：串行队列保证两条都落盘
  const [first, second] = await Promise.all([
    save({ ...input, id: "", name: "a" }, ctx),
    save({ ...input, id: "", name: "b" }, ctx),
  ]);
  assert.deepEqual(
    [...profiles.map((profile) => profile.id)],
    [savedProfile.id, first.id, second.id]
  );
  assert.deepEqual(
    profiles.filter((profile) => profile.name !== "test").length,
    2,
    "并发保存不应丢 profile"
  );

  // 删除必须同时掉 profile 与其密钥，否则密钥桶会残留成孤儿
  await remove({ profileId: first.id }, ctx);
  assert.deepEqual(
    profiles.map((profile) => profile.id),
    [savedProfile.id, second.id]
  );
  assert.deepEqual(clearedSecrets, [first.id]);
  await assert.rejects(remove({ profileId: 1 }, ctx), {
    code: "INVALID_CONFIG",
  });

  // 拖拽排序按传入 id 顺序落盘，未知 id 忽略
  assert.deepEqual(
    (
      await reorder(
        { orderedIds: [second.id, "missing", savedProfile.id] },
        ctx
      )
    ).map((profile) => profile.id),
    [second.id, savedProfile.id]
  );
  assert.deepEqual(
    profiles.map((profile) => profile.id),
    [second.id, savedProfile.id]
  );
  await assert.rejects(reorder({ orderedIds: "nope" }, ctx), {
    code: "INVALID_CONFIG",
  });
});
