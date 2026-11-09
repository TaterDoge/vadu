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
import {
  DEFAULT_SETTINGS,
  appearanceOf,
  mergeConfig,
  mergeProfiles,
  pickLegacyAppearance,
  toSettings,
} from "./settings";

/** 每个用例重新加载模块，避免单向写封锁泄漏到下一用例 */
function loadSerial() {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "serial.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (name === "../../../shared/errors") {
        return { VaduError };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports as {
    lockConfigWrites: () => void;
    serializeConfigWrite: <T>(operation: () => T | Promise<T>) => Promise<T>;
  };
}

test("恢复提交后封锁：真实队列里的旧保存被拒绝，不覆盖已恢复配置", async () => {
  const serial = loadSerial();
  const writes: string[] = [];

  await serial.serializeConfigWrite(() => {
    writes.push("restore");
    serial.lockConfigWrites();
  });

  await assert.rejects(
    serial.serializeConfigWrite(() => {
      writes.push("old-save");
    }),
    { code: "ABORTED" }
  );
  assert.deepEqual(writes, ["restore"]);
});

function loadStore(directory: string, serial: ReturnType<typeof loadSerial>) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "store.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    exports,
    process,
    require: (name: string) => {
      if (name === "electron") {
        return { app: { getPath: () => directory } };
      }
      if (name === "node:fs") {
        return { existsSync, readFileSync, renameSync, rmSync, writeFileSync };
      }
      if (name === "node:path") {
        return { join };
      }
      if (name === "../../../shared/errors") {
        return { VaduError };
      }
      if (name === "./serial") {
        return serial;
      }
      if (name === "./settings") {
        return {
          appearanceOf,
          DEFAULT_SETTINGS,
          mergeConfig,
          mergeProfiles,
          pickLegacyAppearance,
          toSettings,
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports as {
    updateSettings: (patch: { theme?: string }) => unknown;
  };
}

test("恢复后直接 updateSettings 被真实封锁，原 config 不变", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-store-real-lock-"));
  try {
    const original = JSON.stringify({
      profiles: [],
      schemaVersion: 1,
      settings: { theme: "light" },
    });
    writeFileSync(join(directory, "config.json"), original, "utf8");
    const serial = loadSerial();
    const store = loadStore(directory, serial);
    await serial.serializeConfigWrite(() => serial.lockConfigWrites());

    assert.throws(() => store.updateSettings({ theme: "dark" }), {
      code: "ABORTED",
    });
    assert.equal(
      readFileSync(join(directory, "config.json"), "utf8"),
      original
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("队列前一次失败不封锁，后续写入仍可执行", async () => {
  const serial = loadSerial();
  const writes: string[] = [];

  await assert.rejects(
    serial.serializeConfigWrite(() => {
      throw new Error("fake failure");
    }),
    { message: "fake failure" }
  );
  await serial.serializeConfigWrite(() => {
    writes.push("after-failure");
  });
  assert.deepEqual(writes, ["after-failure"]);
});
