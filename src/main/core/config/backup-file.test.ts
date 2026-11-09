import assert from "node:assert/strict";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../../shared/errors";
import type { BackupImportPlan } from "./backup";

const SCHEMA_VERSION = 1;

/** 在独立 VM 里注入 Electron 与 store，文件系统落到临时目录 */
function loadBackupFile(
  directory: string,
  failWrite: { value: boolean },
  failSecrets: { value: boolean } = { value: false }
) {
  const configPath = join(directory, "config.json");
  const secretsPath = join(directory, "secrets.bin");
  const raw = { value: null as Record<string, unknown> | null };
  const writes: Record<string, unknown>[] = [];
  const secretMerges: Record<string, Record<string, string>>[] = [];
  const events: string[] = [];
  const exports: Record<string, unknown> = {};
  const source = readFileSync(
    join(import.meta.dirname, "backup-file.ts"),
    "utf8"
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    Buffer,
    Error,
    exports,
    process,
    require: (name: string) => {
      if (name === "electron") {
        return { app: { getPath: () => directory } };
      }
      if (name === "node:fs") {
        return {
          existsSync,
          readFileSync,
          realpathSync,
          renameSync,
          rmSync,
          statSync,
          writeFileSync,
        };
      }
      if (name === "node:path") {
        return { basename, dirname, join, resolve };
      }
      if (name === "../../../shared/errors") {
        return { VaduError };
      }
      if (name === "./backup") {
        return { MAX_BACKUP_BYTES: 1024 };
      }
      if (name === "./secrets") {
        return {
          mergeSecrets: (buckets: Record<string, Record<string, string>>) => {
            secretMerges.push(buckets);
            events.push("secrets");
            if (failSecrets.value) {
              throw new Error("fake secrets failure");
            }
            return Promise.resolve();
          },
          secretsFilePath: () => secretsPath,
        };
      }
      if (name === "./settings") {
        return { SCHEMA_VERSION };
      }
      if (name === "./store") {
        return {
          configFilePath: () => configPath,
          readConfigRaw: () => raw.value,
          writeConfigRaw: (payload: Record<string, unknown>) => {
            events.push("config");
            if (failWrite.value) {
              throw new Error("fake write failure");
            }
            writes.push(payload);
            writeFileSync(configPath, JSON.stringify(payload, null, 2), "utf8");
            raw.value = payload;
          },
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    configPath,
    events,
    exports: exports as {
      assertExportTargetSafe: (path: string) => void;
      commitBackupImport: (plan: BackupImportPlan) => Promise<void>;
      readBackupText: (path: string) => string;
      restoreSnapshotFilePath: () => string;
      writeBackupText: (path: string, text: string) => void;
    },
    raw,
    secretMerges,
    secretsPath,
    writes,
  };
}

function plan(): BackupImportPlan {
  return {
    formatVersion: 2,
    profiles: [
      {
        allowedOrigins: ["https://example.test"],
        config: { baseURL: "https://example.test/v1", model: "m" },
        createdAt: 1,
        enabled: true,
        id: "new-id",
        name: "新服务商",
        pluginId: "vadu.ai",
      },
    ],
    secretCount: 1,
    secrets: { "new-id": { apiKey: "{{SECRET_gn2w0uvp}}" } },
    settings: {
      accent: "neutral",
      glossary: [],
      historyLimit: 50,
      hotkey: "CommandOrControl+Shift+T",
      inAppHotkeys: { openSettings: null, togglePin: null },
      showMainWindowOnStartup: false,
      style: "nova",
      theme: "dark",
    },
  };
}

test("恢复先写单份快照，再原子替换并保留未知顶层字段", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-backup-file-"));
  try {
    const original = {
      extra: "keep",
      future: { a: 1 },
      profiles: [{ id: "old" }],
      schemaVersion: 1,
      settings: { theme: "light" },
    };
    const originalText = JSON.stringify(original, null, 2);
    writeFileSync(join(directory, "config.json"), originalText, "utf8");
    const harness = loadBackupFile(directory, { value: false });
    harness.raw.value = original;

    await harness.exports.commitBackupImport(plan());

    assert.equal(
      readFileSync(harness.exports.restoreSnapshotFilePath(), "utf8"),
      originalText
    );
    assert.deepEqual(harness.secretMerges, [
      { "new-id": { apiKey: "{{SECRET_gn2w0uvp}}" } },
    ]);
    assert.deepEqual(harness.events, ["secrets", "config"]);
    assert.equal(harness.writes.length, 1);
    const written = harness.writes[0] as Record<string, unknown>;
    assert.equal(written.extra, "keep");
    assert.deepEqual(written.future, { a: 1 });
    assert.equal(written.schemaVersion, SCHEMA_VERSION);
    assert.equal((written.profiles as { id: string }[])[0]?.id, "new-id");
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("快照写入失败时不提交，原 config 保持不变", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-backup-snapshot-fail-"));
  try {
    const harness = loadBackupFile(directory, { value: false });
    const originalText = JSON.stringify({ keep: true });
    writeFileSync(harness.configPath, originalText, "utf8");
    harness.raw.value = { keep: true };
    // 快照目标被目录占住，writeFileSync 必然失败
    mkdirSync(harness.exports.restoreSnapshotFilePath());

    await assert.rejects(harness.exports.commitBackupImport(plan()), {
      code: "INTERNAL",
    });
    assert.equal(harness.writes.length, 0);
    assert.equal(readFileSync(harness.configPath, "utf8"), originalText);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("密钥写失败时不改 config，快照已留档", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-backup-secrets-fail-"));
  try {
    const harness = loadBackupFile(
      directory,
      { value: false },
      { value: true }
    );
    const originalText = JSON.stringify({ keep: true });
    writeFileSync(harness.configPath, originalText, "utf8");
    harness.raw.value = { keep: true };

    await assert.rejects(harness.exports.commitBackupImport(plan()), {
      code: "INTERNAL",
    });
    assert.equal(harness.writes.length, 0);
    assert.equal(readFileSync(harness.configPath, "utf8"), originalText);
    assert.equal(
      readFileSync(harness.exports.restoreSnapshotFilePath(), "utf8"),
      originalText
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("最终配置写失败时保留原 config，快照已留档", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-backup-write-fail-"));
  try {
    const harness = loadBackupFile(directory, { value: true });
    const originalText = JSON.stringify({ keep: true });
    writeFileSync(harness.configPath, originalText, "utf8");
    harness.raw.value = { keep: true };

    await assert.rejects(harness.exports.commitBackupImport(plan()), {
      code: "INTERNAL",
    });
    assert.equal(harness.writes.length, 0);
    assert.equal(readFileSync(harness.configPath, "utf8"), originalText);
    assert.equal(
      readFileSync(harness.exports.restoreSnapshotFilePath(), "utf8"),
      originalText
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("导出目标不能是运行中的 config/secrets/快照，符号链接与硬链接别名也拦住", () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-backup-protect-"));
  try {
    const harness = loadBackupFile(directory, { value: false });
    writeFileSync(harness.configPath, "{}", "utf8");
    writeFileSync(harness.secretsPath, "{}", "utf8");
    const alias = join(directory, "alias.json");
    const hardLink = join(directory, "hard-link.json");
    symlinkSync(harness.configPath, alias);
    linkSync(harness.configPath, hardLink);

    for (const target of [
      harness.configPath,
      harness.secretsPath,
      harness.exports.restoreSnapshotFilePath(),
      alias,
      hardLink,
    ]) {
      assert.throws(() => harness.exports.assertExportTargetSafe(target), {
        code: "INVALID_CONFIG",
      });
    }
    assert.doesNotThrow(() =>
      harness.exports.assertExportTargetSafe(join(directory, "backup.json"))
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("备份文件超过上限直接拒绝读取，导出也不生成不可导入的超限文件", () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-backup-size-"));
  try {
    const harness = loadBackupFile(directory, { value: false });
    const path = join(directory, "big.json");
    writeFileSync(path, "x".repeat(1025), "utf8");
    assert.throws(() => harness.exports.readBackupText(path), {
      code: "INVALID_CONFIG",
    });

    const exported = join(directory, "export.json");
    assert.throws(
      () => harness.exports.writeBackupText(exported, "x".repeat(1025)),
      { code: "INVALID_CONFIG" }
    );
    assert.equal(existsSync(exported), false);
    assert.equal(existsSync(harness.configPath), false);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("导出备份临时文件以 0600 创建，rename 后目标继承权限", {
  skip: process.platform === "win32",
}, () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-backup-mode-"));
  try {
    const harness = loadBackupFile(directory, { value: false });
    const target = join(directory, "backup.json");
    harness.exports.writeBackupText(target, "{}");
    assert.equal((statSync(target).mode % 0o1000).toString(8), "600");
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
