import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { app } from "electron";

import type { AppSettings } from "../../../shared/ipc";
import { DEFAULT_SETTINGS, mergeConfig, toSettings } from "./settings";

function configPath(): string {
  return join(app.getPath("userData"), "config.json");
}

// M1 之前只存过 hotkey 的旧文件，读一次就转成 config.json，之后删掉避免双源
function legacyPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

/** null = 文件存在但内容不可用（损坏 / 非对象），由调用方决定留档还是忽略 */
function parseConfig(path: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function writeConfig(settings: AppSettings): void {
  const target = configPath();
  // tmp 带 pid：即使锁失效被双开，两个实例也不会写同一个临时文件
  const tmp = `${target}.${process.pid}.tmp`;
  const payload = mergeConfig(parseConfig(target), settings);
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  renameSync(tmp, target);
}

function readLegacy(): AppSettings | null {
  const path = legacyPath();
  if (!existsSync(path)) {
    return null;
  }
  const raw = parseConfig(path);
  return raw ? toSettings({ hotkey: raw.hotkey }) : null;
}

export function readSettings(): AppSettings {
  const path = configPath();
  if (!existsSync(path)) {
    const migrated = readLegacy();
    if (migrated) {
      writeConfig(migrated);
      rmSync(legacyPath(), { force: true });
      return migrated;
    }
    return { ...DEFAULT_SETTINGS };
  }
  const raw = parseConfig(path);
  if (!raw) {
    // 留档而不是直接覆盖，否则下一次保存会永久吃掉用户配置
    renameSync(path, `${path}.corrupt`);
    return { ...DEFAULT_SETTINGS };
  }
  return toSettings(raw.settings);
}

/** 读→合并→原子写。调用方只提交要改的字段，整对象提交会冲掉别处刚写的设置 */
export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(), ...patch };
  writeConfig(next);
  return next;
}
