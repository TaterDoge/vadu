/**
 * 备份文件 IO：读写走主进程，导入提交前先落一份恢复前快照。
 * 解析与校验在 backup.ts；这里只管路径、大小、原子写与快照顺序。
 */

import {
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { app } from "electron";

import { VaduError } from "../../../shared/errors";
import { type BackupImportPlan, MAX_BACKUP_BYTES } from "./backup";
import { mergeSecrets, secretsFilePath } from "./secrets";
import { SCHEMA_VERSION } from "./settings";
import { configFilePath, readConfigRaw, writeConfigRaw } from "./store";

/** 消息放第一位：本仓库的 useErrorCause 规则只在第二个参数里找 cause */
class BackupFileError extends VaduError {
  constructor(
    message: string,
    options: { code: "INVALID_CONFIG" | "INTERNAL"; cause?: unknown }
  ) {
    super(options.code, message, { cause: options.cause });
  }
}

type FileIdentity = {
  resolved: string;
  dev?: number;
  ino?: number;
};

function normalizePath(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** 已存在时解析符号链接与 inode；不存在时解析父目录，覆盖「运行中文件被软链」的情况 */
function identify(path: string): FileIdentity {
  try {
    const stat = statSync(path);
    return {
      dev: stat.dev,
      ino: stat.ino,
      resolved: normalizePath(realpathSync(path)),
    };
  } catch {
    try {
      return {
        resolved: normalizePath(
          join(realpathSync(dirname(path)), basename(path))
        ),
      };
    } catch {
      return { resolved: normalizePath(path) };
    }
  }
}

function sameFile(left: FileIdentity, right: FileIdentity): boolean {
  if (left.resolved === right.resolved) {
    return true;
  }
  return (
    left.ino !== undefined &&
    left.ino !== 0 &&
    left.dev !== undefined &&
    left.ino === right.ino &&
    left.dev === right.dev
  );
}

export function restoreSnapshotFilePath(): string {
  return join(app.getPath("userData"), "config.before-restore.json");
}

/** 导出目标不得是运行中的配置、密钥或恢复快照（含符号链接/硬链接别名） */
export function assertExportTargetSafe(target: string): void {
  const identity = identify(target);
  const protectedPaths = [
    configFilePath(),
    secretsFilePath(),
    restoreSnapshotFilePath(),
  ];
  if (protectedPaths.some((path) => sameFile(identity, identify(path)))) {
    throw new BackupFileError("不能覆盖应用正在使用的配置、密钥或恢复快照", {
      code: "INVALID_CONFIG",
    });
  }
}

export function readBackupText(path: string): string {
  let size: number;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) {
      throw new Error("not a file");
    }
    ({ size } = stat);
  } catch (error) {
    throw new BackupFileError("无法读取备份文件", {
      cause: error,
      code: "INVALID_CONFIG",
    });
  }
  if (size > MAX_BACKUP_BYTES) {
    throw new BackupFileError("备份文件超过 8 MiB 上限", {
      code: "INVALID_CONFIG",
    });
  }
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw new BackupFileError("无法读取备份文件", {
      cause: error,
      code: "INVALID_CONFIG",
    });
  }
}

export function writeBackupText(path: string, text: string): void {
  assertExportTargetSafe(path);
  if (Buffer.byteLength(text, "utf8") > MAX_BACKUP_BYTES) {
    throw new BackupFileError("备份内容超过 8 MiB 上限，请精简服务商配置", {
      code: "INVALID_CONFIG",
    });
  }
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    // 备份含明文密钥：新建临时文件即收紧到仅当前用户可读写，rename 继承该权限
    writeFileSync(tmp, text, { encoding: "utf8", mode: 0o600 });
    renameSync(tmp, path);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw new BackupFileError("导出失败，未写入备份文件", {
      cause: error,
      code: "INTERNAL",
    });
  }
}

/**
 * 单份快照覆盖写：恢复前把当前 config.json 原样留档（含未知顶层字段与损坏内容）。
 * 快照失败直接抛错，后续替换一步都不执行。
 */
export async function commitBackupImport(
  plan: BackupImportPlan
): Promise<void> {
  const configPath = configFilePath();
  let original = "{}";
  if (existsSync(configPath)) {
    try {
      original = readFileSync(configPath, "utf8");
    } catch (error) {
      throw new BackupFileError("读取当前配置失败，已取消恢复", {
        cause: error,
        code: "INTERNAL",
      });
    }
  }
  const snapshot = restoreSnapshotFilePath();
  const snapshotTmp = `${snapshot}.${process.pid}.tmp`;
  try {
    writeFileSync(snapshotTmp, original, "utf8");
    renameSync(snapshotTmp, snapshot);
  } catch (error) {
    rmSync(snapshotTmp, { force: true });
    throw new BackupFileError("恢复前快照写入失败，已取消恢复", {
      cause: error,
      code: "INTERNAL",
    });
  }

  // 新 UUID 的密钥先落本机密钥库；失败则不碰 config，旧 profile/key 仍完整
  try {
    await mergeSecrets(plan.secrets);
  } catch (error) {
    throw new BackupFileError("密钥写入失败，已取消恢复", {
      cause: error,
      code: "INTERNAL",
    });
  }

  const existing = readConfigRaw();
  try {
    writeConfigRaw({
      ...(existing ?? {}),
      profiles: plan.profiles,
      schemaVersion: SCHEMA_VERSION,
      settings: plan.settings,
    });
  } catch (error) {
    throw new BackupFileError("配置写入失败，原配置未改动", {
      cause: error,
      code: "INTERNAL",
    });
  }
}
