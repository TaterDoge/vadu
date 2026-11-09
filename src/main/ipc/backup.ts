/**
 * 备份/恢复通道：只编排原生保存/打开/导入确认对话框、校验计划与错误包装。
 * 导出的明文风险确认在渲染层设置页完成，主进程只在确认后弹保存框。
 * 完整备份的密钥快照/合并与文件 IO 在 core/config；恢复提交与已有 profile 保存共用写队列。
 */

import { join } from "node:path";

import { app, dialog } from "electron";

import { VaduError } from "../../shared/errors";
import type { BackupExportResult, BackupImportResult } from "../../shared/ipc";
import { IPC } from "../../shared/ipc";
import {
  type PluginLookup,
  buildBackup,
  planBackupFromText,
} from "../core/config/backup";
import {
  commitBackupImport,
  readBackupText,
  writeBackupText,
} from "../core/config/backup-file";
import { canPersistSecrets, snapshotSecrets } from "../core/config/secrets";
import { lockConfigWrites, serializeConfigWrite } from "../core/config/serial";
import { readBackupSnapshot } from "../core/config/store";
import { registry } from "../core/plugin/registry";
import { taskRegistry } from "../core/translate/tasks";
import { handle } from "./index";
import { abortHealthChecks } from "./plugins";

const BACKUP_FILE_NAME = "vadu-settings-backup.json";

/** 只暴露插件是否就绪与 configSchema，备份 core 不认识任何具体厂商 */
const lookupPlugin: PluginLookup = (pluginId) => {
  const plugin = registry.get(pluginId);
  if (!plugin) {
    return;
  }
  return {
    configSchema: plugin.descriptor.configSchema,
    status: plugin.descriptor.status,
  };
};

function backupDialogOptions() {
  return {
    defaultPath: join(app.getPath("documents"), BACKUP_FILE_NAME),
    filters: [{ extensions: ["json"], name: "JSON" }],
  };
}

/** 先回响应再重启：渲染层要能显示「即将重启」，不能静默消失 */
function scheduleRestart(): void {
  app.relaunch();
  setImmediate(() => {
    app.quit();
  });
}

export function registerBackupIpc(): void {
  handle<null, BackupExportResult>(IPC.config.exportBackup, async () => {
    const picked = await dialog.showSaveDialog(backupDialogOptions());
    if (picked.canceled || !picked.filePath) {
      return { canceled: true };
    }

    const backup = await serializeConfigWrite(async () => {
      const snapshot = readBackupSnapshot();
      const secrets = await snapshotSecrets(
        snapshot.profiles.map((profile) => profile.id)
      );
      return buildBackup(
        snapshot.settings,
        snapshot.profiles,
        lookupPlugin,
        secrets
      );
    });
    writeBackupText(picked.filePath, `${JSON.stringify(backup, null, 2)}\n`);
    return {
      canceled: false,
      profileCount: backup.profiles.length,
      secretCount: backup.profiles.reduce(
        (count, profile) => count + Object.keys(profile.secrets).length,
        0
      ),
    };
  });

  handle<null, BackupImportResult>(
    IPC.config.importBackup,
    async (_arg, { sender }) => {
      const picked = await dialog.showOpenDialog({
        filters: [{ extensions: ["json"], name: "JSON" }],
        properties: ["openFile"],
      });
      if (picked.canceled || !picked.filePaths[0]) {
        return { canceled: true };
      }

      // 先完整校验再确认：坏文件不会走到「恢复并重启」按钮
      const plan = planBackupFromText(
        readBackupText(picked.filePaths[0]),
        lookupPlugin
      );
      if (plan.secretCount > 0 && !canPersistSecrets()) {
        throw new VaduError("INTERNAL", "系统无法安全持久化密钥，已取消恢复");
      }
      const legacy = plan.formatVersion === 1;
      const secretLine = legacy
        ? "这是旧版备份，不包含密钥；恢复后旧服务商需要重新填写 API Key。"
        : `备份包含 ${plan.secretCount} 个密钥（文件为明文）；这些密钥会写入本机加密密钥库并绑定到新服务商 ID。`;
      const confirmed = await dialog.showMessageBox({
        buttons: ["取消", "恢复并重启"],
        cancelId: 0,
        defaultId: 0,
        detail: [
          `将整体替换为备份中的 ${plan.profiles.length} 个服务商与全部设置。`,
          "",
          secretLine,
          "· 正在进行的翻译与健康检测会立即终止",
          "· 当前服务商和设置被覆盖，未知的其它本机字段保留",
          "· 每个服务商都会换新 ID，旧密钥桶保留但不再关联",
          "· 恢复前会保留一份 config.before-restore.json 快照",
          "· 恢复成功后应用立即重启",
        ].join("\n"),
        message: "用这份 JSON 备份替换当前配置？",
        noLink: true,
        title: "从备份恢复设置",
        type: "warning",
      });
      if (confirmed.response !== 1) {
        return { canceled: true };
      }

      await serializeConfigWrite(async () => {
        if (sender.isDestroyed()) {
          throw new VaduError("ABORTED", "窗口已关闭");
        }
        taskRegistry.abortAll();
        abortHealthChecks();
        await commitBackupImport(plan);
        // 与 commit 同一个同步队列回调：提交失败抛错时不会走到这里，旧写继续被拒绝
        lockConfigWrites();
      });
      scheduleRestart();
      return {
        canceled: false,
        legacy,
        profileCount: plan.profiles.length,
        restarting: true,
        secretCount: plan.secretCount,
      };
    }
  );
}
