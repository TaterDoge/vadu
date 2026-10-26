import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { app } from "electron";

import type { AppSettings, InAppHotkeyState } from "../../../shared/ipc";

type ConfigFile = { schemaVersion: 1; settings: AppSettings };

const SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: AppSettings = {
  glossary: [],
  historyLimit: 50,
  hotkey: "CommandOrControl+Shift+T",
  inAppHotkeys: {
    openSettings: "CommandOrControl+,",
    togglePin: "CommandOrControl+P",
  },
  showMainWindowOnStartup: false,
  theme: "system",
};

function configPath(): string {
  return join(app.getPath("userData"), "config.json");
}

// M1 之前只存过 hotkey 的旧文件，读一次就转成 config.json，之后删掉避免双源
function legacyPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

function pickInApp(
  source: Partial<InAppHotkeyState> | undefined,
  key: keyof InAppHotkeyState
): string | null {
  const value = source?.[key];
  return typeof value === "string" || value === null
    ? value
    : DEFAULT_SETTINGS.inAppHotkeys[key];
}

function toSettings(value: unknown): AppSettings {
  const partial = (value ?? {}) as Partial<AppSettings>;
  const inApp = partial.inAppHotkeys;
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    hotkey:
      typeof partial.hotkey === "string"
        ? partial.hotkey
        : DEFAULT_SETTINGS.hotkey,
    // 旧配置没有该字段；形状不对直接回默认，别让坏值混进运行时
    inAppHotkeys: {
      openSettings: pickInApp(inApp, "openSettings"),
      togglePin: pickInApp(inApp, "togglePin"),
    },
    // 同上：旧配置缺字段时按默认走静默启动，坏值也不混进运行时
    showMainWindowOnStartup:
      typeof partial.showMainWindowOnStartup === "boolean"
        ? partial.showMainWindowOnStartup
        : DEFAULT_SETTINGS.showMainWindowOnStartup,
  };
}

function writeAtomic(settings: AppSettings): void {
  const target = configPath();
  const tmp = `${target}.tmp`;
  const payload: ConfigFile = { schemaVersion: SCHEMA_VERSION, settings };
  // 原子写：中途崩溃不会留下半截 config.json 被下次启动当成真实配置
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  renameSync(tmp, target);
}

function readLegacy(): AppSettings | null {
  const path = legacyPath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      hotkey?: unknown;
    };
    return toSettings({ hotkey: parsed.hotkey });
  } catch {
    return null;
  }
}

export function readSettings(): AppSettings {
  const path = configPath();
  if (!existsSync(path)) {
    const migrated = readLegacy();
    if (migrated) {
      writeAtomic(migrated);
      rmSync(legacyPath(), { force: true });
      return migrated;
    }
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const parsed = JSON.parse(
      readFileSync(path, "utf8")
    ) as Partial<ConfigFile>;
    return toSettings(parsed.settings);
  } catch {
    // 留档而不是直接覆盖，否则下一次保存会永久吃掉用户配置
    renameSync(path, `${path}.corrupt`);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  writeAtomic(settings);
}
