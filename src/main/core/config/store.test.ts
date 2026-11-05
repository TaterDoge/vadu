import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../../shared/errors";
import { DEFAULT_HOTKEYS } from "../../../shared/ipc";

function loadStore(directory: string) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "store.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    Buffer,
    console,
    exports,
    process,
    require: (name: string) => {
      if (name === "electron") {
        return { app: { getPath: () => directory } };
      }
      if (name === "node:fs") {
        return { existsSync, readFileSync, renameSync, writeFileSync };
      }
      if (name === "node:path") {
        return { join };
      }
      if (name === "../../../shared/errors") {
        return { VaduError };
      }
      if (name === "../../../shared/ipc") {
        return { DEFAULT_HOTKEYS };
      }
      if (name === "./settings") {
        return {
          DEFAULT_SETTINGS: {},
          mergeConfig: () => ({}),
          mergeProfiles: (
            existing: Record<string, unknown> | null,
            profiles: unknown[]
          ) => ({ ...(existing ?? {}), profiles, schemaVersion: 1 }),
          SCHEMA_VERSION: 1,
          toSettings: () => ({}),
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports as {
    readProfiles: () => Array<{ id: string; enabled: boolean }>;
    reorderProfiles: (orderedIds: string[]) => Array<{ id: string }>;
    saveProfile: (profile: {
      id: string;
      pluginId: string;
      enabled: boolean;
      [key: string]: unknown;
    }) => { id: string; enabled: boolean };
  };
}

test("旧 profile 无 enabled 字段默认启用，显式 false 保留", () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-store-test-"));
  try {
    writeFileSync(
      join(directory, "config.json"),
      JSON.stringify({
        profiles: [
          {
            allowedOrigins: [],
            config: { model: "m" },
            createdAt: 1,
            id: "legacy",
            name: "旧",
            pluginId: "vadu.ai",
          },
          {
            allowedOrigins: [],
            config: { model: "m" },
            createdAt: 2,
            enabled: false,
            id: "off",
            name: "停用",
            pluginId: "vadu.ai",
          },
        ],
        schemaVersion: 1,
        settings: {},
      })
    );
    const store = loadStore(directory);
    const profiles = store.readProfiles();
    assert.equal(profiles.length, 2);
    assert.equal(profiles[0]?.enabled, true);
    assert.equal(profiles[1]?.enabled, false);
    const saved = store.saveProfile({
      allowedOrigins: [],
      config: { model: "m" },
      createdAt: 2,
      enabled: true,
      id: "off",
      name: "停用",
      pluginId: "vadu.ai",
    });
    assert.equal(saved.enabled, true);
    assert.ok(existsSync(join(directory, "config.json")));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("reorderProfiles 按传入 id 顺序写回，未列出的保持原相对顺序", () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-store-reorder-"));
  try {
    writeFileSync(
      join(directory, "config.json"),
      JSON.stringify({
        profiles: ["a", "b", "c"].map((id) => ({
          allowedOrigins: [],
          config: {},
          createdAt: 1,
          id,
          name: id,
          pluginId: "vadu.ai",
        })),
        schemaVersion: 1,
        settings: {},
      })
    );
    const store = loadStore(directory);
    // 跨 vm 上下文的数组原型不同，先摊开成当前上下文的数组再比
    assert.deepEqual(
      [...store.reorderProfiles(["c", "a"]).map((profile) => profile.id)],
      ["c", "a", "b"]
    );
    assert.deepEqual(
      [...store.readProfiles().map((profile) => profile.id)],
      ["c", "a", "b"]
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
