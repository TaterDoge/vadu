import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../shared/errors";
import { type AppSettings, IPC } from "../../shared/ipc";
import type { BackupFile, BackupImportPlan } from "../core/config/backup";

type HarnessOptions = {
  importConfirm: number;
  failCommit?: boolean;
  openCanceled?: boolean;
  planError?: Error;
  planVersion?: 1 | 2;
  saveCanceled?: boolean;
  secretCount?: number;
  cannotPersist?: boolean;
};

function loadBackupIpc(options: HarnessOptions) {
  const handlers = new Map<
    string,
    (arg: unknown, ctx: unknown) => Promise<unknown>
  >();
  const events: string[] = [];
  const messageBoxes: string[] = [];
  const writtenTexts: string[] = [];
  const exports: Record<string, unknown> = {};
  const settings: AppSettings = {
    accent: "neutral",
    glossary: [],
    historyLimit: 50,
    hotkey: null,
    inAppHotkeys: { openSettings: null, togglePin: null },
    showMainWindowOnStartup: false,
    style: "nova",
    theme: "system",
  };
  const plan: BackupImportPlan = {
    formatVersion: options.planVersion ?? 2,
    profiles: [
      {
        allowedOrigins: [],
        config: { baseURL: "https://example.test/v1", model: "m" },
        createdAt: 1,
        enabled: true,
        id: "new-id",
        name: "新服务商",
        pluginId: "vadu.ai",
      },
    ],
    secretCount: options.secretCount ?? 1,
    secrets: { "new-id": { apiKey: "imported-key" } },
    settings: { ...settings },
  };
  const backup: BackupFile = {
    format: "vadu-settings-backup",
    formatVersion: 2,
    profiles: [
      {
        config: { baseURL: "https://example.test/v1", model: "m" },
        createdAt: 1,
        enabled: true,
        id: "p1",
        name: "导出服务商",
        pluginId: "vadu.ai",
        secrets: { apiKey: "exported-key" },
      },
    ],
    schemaVersion: 1,
    settings: { ...settings },
  };
  const imports: Record<string, unknown> = {
    "../../shared/errors": { VaduError },
    "../../shared/ipc": { IPC },
    "../core/config/backup": {
      buildBackup: () => {
        events.push("build");
        return backup;
      },
      planBackupFromText: () => {
        events.push("plan");
        if (options.planError) {
          throw options.planError;
        }
        return plan;
      },
    },
    "../core/config/backup-file": {
      commitBackupImport: () => {
        events.push("commit");
        if (options.failCommit) {
          return Promise.reject(
            new VaduError("INTERNAL", "fake commit failure")
          );
        }
        return Promise.resolve();
      },
      readBackupText: () => {
        events.push("read");
        return "{}";
      },
      writeBackupText: (_path: string, text: string) => {
        writtenTexts.push(text);
        events.push(`write:${text.includes("vadu-settings-backup")}`);
      },
    },
    "../core/config/secrets": {
      canPersistSecrets: () => !options.cannotPersist,
      snapshotSecrets: (ids: string[]) => {
        events.push(`snapshot:${ids.join(",")}`);
        return Promise.resolve({ p1: { apiKey: "exported-key" } });
      },
    },
    "../core/config/serial": {
      lockConfigWrites: () => events.push("lock"),
      serializeConfigWrite: (operation: () => Promise<unknown>) => {
        events.push("serialize:start");
        return Promise.resolve()
          .then(operation)
          .finally(() => events.push("serialize:end"));
      },
    },
    "../core/config/store": {
      readBackupSnapshot: () => {
        events.push("read-config");
        return {
          profiles: [
            {
              allowedOrigins: [],
              config: { baseURL: "https://example.test/v1", model: "m" },
              createdAt: 1,
              enabled: true,
              id: "p1",
              name: "导出服务商",
              pluginId: "vadu.ai",
            },
          ],
          settings,
        };
      },
    },
    "../core/plugin/registry": {
      registry: { get: () => ({ descriptor: { status: "ready" } }) },
    },
    "../core/translate/tasks": {
      taskRegistry: { abortAll: () => events.push("abort") },
    },
    "./index": {
      handle: (
        channel: string,
        handler: (arg: unknown, ctx: unknown) => Promise<unknown>
      ) => handlers.set(channel, handler),
    },
    "./plugins": {
      abortHealthChecks: () => events.push("abort-health"),
    },
    electron: {
      app: {
        getPath: () => "/tmp/vadu-backup-ipc",
        quit: () => events.push("quit"),
        relaunch: () => events.push("relaunch"),
      },
      dialog: {
        showMessageBox: (dialogOptions: {
          detail?: string;
          message: string;
        }) => {
          messageBoxes.push(
            `${dialogOptions.message}\n${dialogOptions.detail ?? ""}`
          );
          events.push("confirm");
          return Promise.resolve({ response: options.importConfirm });
        },
        showOpenDialog: () =>
          Promise.resolve(
            options.openCanceled
              ? { canceled: true, filePaths: [] }
              : { canceled: false, filePaths: ["/tmp/backup.json"] }
          ),
        showSaveDialog: () => {
          events.push("save-dialog");
          return Promise.resolve(
            options.saveCanceled
              ? { canceled: true }
              : { canceled: false, filePath: "/tmp/export.json" }
          );
        },
      },
    },
    "node:path": { join },
  };
  const source = readFileSync(join(import.meta.dirname, "backup.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    exports,
    Promise,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error(`Unexpected import: ${name}`);
      }
      return imports[name];
    },
    setImmediate: (fn: () => void) => {
      events.push("schedule-restart");
      fn();
    },
  });
  (exports.registerBackupIpc as () => void)();
  return {
    events,
    exportHandler: handlers.get(IPC.config.exportBackup) as () => Promise<{
      canceled: boolean;
      profileCount?: number;
      secretCount?: number;
    }>,
    importHandler: handlers.get(IPC.config.importBackup) as (
      arg: unknown,
      ctx: unknown
    ) => Promise<{
      canceled: boolean;
      legacy?: boolean;
      profileCount?: number;
      restarting?: true;
      secretCount?: number;
    }>,
    messageBoxes,
    writtenTexts,
  };
}

const ctx = { sender: { isDestroyed: () => false } };

test("导入取消打开/确认对话框：零提交、零重启", async () => {
  const canceled = loadBackupIpc({
    importConfirm: 1,
    openCanceled: true,
  });
  const openResult = await canceled.importHandler(null, ctx);
  assert.equal(openResult.canceled, true);
  assert.equal(canceled.events.includes("confirm"), false);
  assert.equal(canceled.events.includes("commit"), false);

  const confirm = loadBackupIpc({ importConfirm: 0 });
  const confirmResult = await confirm.importHandler(null, ctx);
  assert.equal(confirmResult.canceled, true);
  assert.equal(confirm.events.includes("commit"), false);
  assert.equal(confirm.events.includes("relaunch"), false);
});

test("导入校验失败在确认之前结束，零提交", async () => {
  const harness = loadBackupIpc({
    importConfirm: 1,
    planError: new VaduError("PLUGIN_LOAD_FAILED", "插件未就绪"),
  });
  await assert.rejects(harness.importHandler(null, ctx), {
    code: "PLUGIN_LOAD_FAILED",
  });
  assert.equal(harness.events.includes("confirm"), false);
  assert.equal(harness.events.includes("commit"), false);
});

test("v2 导入确认写明密钥，提交顺序：密钥→config→lock→restart", async () => {
  const harness = loadBackupIpc({ importConfirm: 1 });
  const result = await harness.importHandler(null, ctx);
  assert.equal(result.canceled, false);
  assert.equal(result.profileCount, 1);
  assert.equal(result.secretCount, 1);
  assert.equal(result.legacy, false);
  assert.equal(result.restarting, true);
  assert.equal(harness.messageBoxes.length, 1);
  assert.equal(harness.messageBoxes[0]?.includes("用这份 JSON 备份"), true);
  assert.equal(harness.messageBoxes.join("\n").includes("密钥"), true);
  assert.deepEqual(harness.events, [
    "read",
    "plan",
    "confirm",
    "serialize:start",
    "abort",
    "abort-health",
    "commit",
    "lock",
    "serialize:end",
    "relaunch",
    "schedule-restart",
    "quit",
  ]);
});

test("v1 导入明确提示旧备份不含密钥", async () => {
  const harness = loadBackupIpc({
    importConfirm: 1,
    planVersion: 1,
    secretCount: 0,
  });
  const result = await harness.importHandler(null, ctx);
  assert.equal(result.legacy, true);
  assert.equal(result.secretCount, 0);
  assert.equal(
    harness.messageBoxes.join("\n").includes("旧版备份，不包含密钥"),
    true
  );
});

test("系统不能持久化密钥时，含密钥的导入在确认前拒绝", async () => {
  const harness = loadBackupIpc({
    cannotPersist: true,
    importConfirm: 1,
  });
  await assert.rejects(harness.importHandler(null, ctx), {
    code: "INTERNAL",
  });
  assert.equal(harness.events.includes("confirm"), false);
  assert.equal(harness.events.includes("commit"), false);
});

test("提交失败：不封锁、不重启，错误向上抛", async () => {
  const harness = loadBackupIpc({
    failCommit: true,
    importConfirm: 1,
  });
  await assert.rejects(harness.importHandler(null, ctx), {
    code: "INTERNAL",
  });
  assert.equal(harness.events.includes("commit"), true);
  assert.equal(harness.events.includes("lock"), false);
  assert.equal(harness.events.includes("relaunch"), false);
});

test("队列执行时窗口已销毁：零提交、零封锁、零重启", async () => {
  const harness = loadBackupIpc({ importConfirm: 1 });
  await assert.rejects(
    harness.importHandler(null, { sender: { isDestroyed: () => true } }),
    { code: "ABORTED" }
  );
  assert.equal(harness.events.includes("commit"), false);
  assert.equal(harness.events.includes("lock"), false);
  assert.equal(harness.events.includes("relaunch"), false);
});

test("导出不再弹原生确认；保存取消零读写；成功只传计数", async () => {
  const saveCanceled = loadBackupIpc({
    importConfirm: 1,
    saveCanceled: true,
  });
  const saveCanceledResult = await saveCanceled.exportHandler();
  assert.equal(saveCanceledResult.canceled, true);
  assert.equal(saveCanceled.messageBoxes.length, 0);
  assert.deepEqual(saveCanceled.events, ["save-dialog"]);

  const saved = loadBackupIpc({ importConfirm: 1 });
  const savedResult = await saved.exportHandler();
  assert.equal(savedResult.canceled, false);
  assert.equal(savedResult.profileCount, 1);
  assert.equal(savedResult.secretCount, 1);
  assert.equal(JSON.stringify(savedResult).includes("exported-key"), false);
  assert.equal(saved.messageBoxes.length, 0);
  assert.equal(saved.writtenTexts.length, 1);
  assert.equal(saved.writtenTexts[0]?.includes("exported-key"), true);
  assert.deepEqual(saved.events, [
    "save-dialog",
    "serialize:start",
    "read-config",
    "snapshot:p1",
    "build",
    "serialize:end",
    "write:true",
  ]);
});
