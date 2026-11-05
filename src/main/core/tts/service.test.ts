import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../../shared/errors";
import type { TtsParams, TtsPayload } from "../../../shared/ipc";
import { validateManifest } from "../plugin/manifest";

function loadService(imports: Record<string, unknown>): {
  synthesize: (params: TtsParams) => Promise<TtsPayload>;
} {
  const exports: Record<string, unknown> = {};
  const { outputText } = ts.transpileModule(
    readFileSync(join(import.meta.dirname, "service.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  );
  runInNewContext(outputText, {
    console,
    Date,
    exports,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error("Unexpected import");
      }
      return imports[name];
    },
  });
  return exports as { synthesize: (params: TtsParams) => Promise<TtsPayload> };
}

function ttsPluginMock(): unknown {
  return {
    create: () => ({
      synthesize: async () => ({
        audio: new Uint8Array(0),
        mimeType: "audio/mpeg",
      }),
    }),
    descriptor: {},
    manifest: {},
  };
}

function baseImports(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    "../../../shared/errors": { VaduError },
    "../config/store": { readProfiles: () => [] },
    "../plugin/host": {
      hostSynthesize: () => {
        throw new Error("不应到达宿主");
      },
    },
    "../plugin/registry": {
      registry: {
        getTts: () => undefined,
        isReady: () => false,
        list: () => [],
      },
    },
    ...overrides,
  };
}

test("无可用语音 profile 报 INVALID_CONFIG", async () => {
  const service = loadService(baseImports());
  await assert.rejects(service.synthesize({ text: "hello" }), {
    code: "INVALID_CONFIG",
  });
});

test("profileId 指向非 tts profile 报 INVALID_CONFIG", async () => {
  const profile = { config: {}, enabled: true, id: "p", pluginId: "vadu.ai" };
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [profile] },
    })
  );
  await assert.rejects(service.synthesize({ profileId: "p", text: "hello" }), {
    code: "INVALID_CONFIG",
  });
});

test("语音 profile 停用报 INVALID_CONFIG", async () => {
  const profile = {
    config: {},
    enabled: false,
    id: "p",
    pluginId: "vadu.tts",
  };
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [profile] },
      "../plugin/registry": {
        registry: {
          getTts: () => ttsPluginMock(),
          isReady: () => true,
          list: () => [{ id: "vadu.tts", kind: "tts" }],
        },
      },
    })
  );
  await assert.rejects(service.synthesize({ profileId: "p", text: "hello" }), {
    code: "INVALID_CONFIG",
    message: "该服务商已停用",
  });
});

test("插件返回空音频报 INTERNAL", async () => {
  const profile = {
    config: {},
    enabled: true,
    id: "p",
    pluginId: "vadu.tts",
  };
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [profile] },
      "../plugin/host": {
        hostSynthesize: async () => ({
          audio: new Uint8Array(0),
          mimeType: "audio/mpeg",
        }),
      },
      "../plugin/registry": {
        registry: {
          getTts: () => ttsPluginMock(),
          isReady: () => true,
          list: () => [{ id: "vadu.tts", kind: "tts" }],
        },
      },
    })
  );
  await assert.rejects(service.synthesize({ text: "hello" }), {
    code: "INTERNAL",
  });
});

test("默认按存储顺序取第一个启用的 tts profile 并把请求传给宿主", async () => {
  const first = {
    config: { voice: "alloy" },
    enabled: true,
    id: "p1",
    pluginId: "vadu.tts",
  };
  const second = { config: {}, enabled: true, id: "p2", pluginId: "vadu.tts" };
  const payload = { audio: new Uint8Array([1, 2, 3]), mimeType: "audio/mpeg" };
  let seen: { pluginId: string; profile: unknown; req: unknown } | undefined;
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [first, second] },
      "../plugin/host": {
        hostSynthesize: (args: {
          pluginId: string;
          profile: unknown;
          req: unknown;
        }) => {
          seen = args;
          return payload;
        },
      },
      "../plugin/registry": {
        registry: {
          getTts: () => ttsPluginMock(),
          isReady: () => true,
          list: () => [{ id: "vadu.tts", kind: "tts" }],
        },
      },
    })
  );
  const result = await service.synthesize({ text: "hello" });
  assert.equal(result, payload);
  assert.ok(seen);
  assert.equal(seen.profile, first);
  assert.equal((seen.req as { text: string }).text, "hello");
});

test("内置 tts manifest 通过 validateManifest", () => {
  const validated = validateManifest(
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../../plugins/tts/manifest.json"),
        "utf8"
      )
    )
  );
  assert.ok(validated.ok);
  assert.equal(validated.manifest.kind, "tts");
  assert.equal(validated.manifest.id, "vadu.tts");
});
