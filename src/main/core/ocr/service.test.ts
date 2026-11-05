import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../../shared/errors";
import type { OcrParams, OcrResult } from "../../../shared/ipc";
import { validateManifest } from "../plugin/manifest";

const IMAGE = new Uint8Array([1, 2, 3]);

function loadService(imports: Record<string, unknown>): {
  recognize: (params: OcrParams) => Promise<OcrResult>;
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
  return exports as {
    recognize: (params: OcrParams) => Promise<OcrResult>;
  };
}

function ocrPluginMock(): unknown {
  return {
    create: () => ({
      recognize: async () => ({ text: "识别结果" }),
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
      hostRecognize: () => {
        throw new Error("不应到达宿主");
      },
    },
    "../plugin/registry": {
      registry: {
        getOcr: () => undefined,
        isReady: () => false,
        list: () => [],
      },
    },
    ...overrides,
  };
}

test("无可用 ocr profile 报 INVALID_CONFIG", async () => {
  const service = loadService(baseImports());
  await assert.rejects(
    service.recognize({ image: IMAGE, mimeType: "image/png" }),
    { code: "INVALID_CONFIG" }
  );
});

test("profileId 指向非 ocr profile 报 INVALID_CONFIG", async () => {
  const profile = { config: {}, enabled: true, id: "p", pluginId: "vadu.ai" };
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [profile] },
    })
  );
  await assert.rejects(
    service.recognize({
      image: IMAGE,
      mimeType: "image/png",
      profileId: "p",
    }),
    { code: "INVALID_CONFIG" }
  );
});

test("ocr profile 停用报 INVALID_CONFIG", async () => {
  const profile = {
    config: {},
    enabled: false,
    id: "p",
    pluginId: "vadu.ocr",
  };
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [profile] },
      "../plugin/registry": {
        registry: {
          getOcr: () => ocrPluginMock(),
          isReady: () => true,
          list: () => [{ id: "vadu.ocr", kind: "ocr" }],
        },
      },
    })
  );
  await assert.rejects(
    service.recognize({
      image: IMAGE,
      mimeType: "image/png",
      profileId: "p",
    }),
    { code: "INVALID_CONFIG", message: "该服务商已停用" }
  );
});

test("空图报 INVALID_CONFIG", async () => {
  const profile = {
    config: {},
    enabled: true,
    id: "p",
    pluginId: "vadu.ocr",
  };
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [profile] },
      "../plugin/registry": {
        registry: {
          getOcr: () => ocrPluginMock(),
          isReady: () => true,
          list: () => [{ id: "vadu.ocr", kind: "ocr" }],
        },
      },
    })
  );
  await assert.rejects(
    service.recognize({
      image: new Uint8Array(0),
      mimeType: "image/png",
    }),
    { code: "INVALID_CONFIG" }
  );
});

test("超 10MB 报 INVALID_CONFIG", async () => {
  const profile = {
    config: {},
    enabled: true,
    id: "p",
    pluginId: "vadu.ocr",
  };
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [profile] },
      "../plugin/registry": {
        registry: {
          getOcr: () => ocrPluginMock(),
          isReady: () => true,
          list: () => [{ id: "vadu.ocr", kind: "ocr" }],
        },
      },
    })
  );
  await assert.rejects(
    service.recognize({
      image: new Uint8Array(10 * 1024 * 1024 + 1),
      mimeType: "image/png",
    }),
    { code: "INVALID_CONFIG", message: "图片超过 10MB 上限" }
  );
});

test("默认按存储顺序取第一个启用的 ocr profile 并把请求传给宿主", async () => {
  const first = {
    config: { model: "gpt-4o-mini" },
    enabled: true,
    id: "p1",
    pluginId: "vadu.ocr",
  };
  const second = {
    config: {},
    enabled: true,
    id: "p2",
    pluginId: "vadu.ocr",
  };
  const payload = { text: "识别结果" };
  let seen: { pluginId: string; profile: unknown; req: unknown } | undefined;
  const service = loadService(
    baseImports({
      "../config/store": { readProfiles: () => [first, second] },
      "../plugin/host": {
        hostRecognize: (args: {
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
          getOcr: () => ocrPluginMock(),
          isReady: () => true,
          list: () => [{ id: "vadu.ocr", kind: "ocr" }],
        },
      },
    })
  );
  const result = await service.recognize({
    image: IMAGE,
    language: "zh",
    mimeType: "image/png",
  });
  assert.equal(result, payload);
  assert.ok(seen);
  assert.equal(seen.profile, first);
  const req = seen.req as {
    config: unknown;
    image: { data: Uint8Array; mimeType: string };
    language?: string;
  };
  assert.equal(req.config, first.config);
  assert.deepEqual(Array.from(req.image.data), Array.from(IMAGE));
  assert.equal(req.image.mimeType, "image/png");
  assert.equal(req.language, "zh");
});

test("内置 ocr manifest 通过 validateManifest", () => {
  const validated = validateManifest(
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../../plugins/ocr/manifest.json"),
        "utf8"
      )
    )
  );
  assert.ok(validated.ok);
  assert.equal(validated.manifest.kind, "ocr");
  assert.equal(validated.manifest.id, "vadu.ocr");
});
