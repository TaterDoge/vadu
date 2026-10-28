/**
 * 配置形状的唯一出处：把磁盘上不可信的 JSON 洗成运行时形状。
 * 纯函数、不碰 electron，便于单测（配置可能被手改或来自旧版本）。
 */

import {
  type AppSettings,
  DEFAULT_HOTKEYS,
  type InAppHotkeyState,
} from "../../../shared/ipc";

export const SCHEMA_VERSION = 1;

const THEMES: AppSettings["theme"][] = ["system", "light", "dark"];

export const DEFAULT_SETTINGS: AppSettings = {
  glossary: [],
  historyLimit: 50,
  hotkey: DEFAULT_HOTKEYS.global,
  inAppHotkeys: DEFAULT_HOTKEYS.inApp,
  showMainWindowOnStartup: false,
  theme: "system",
};

/**
 * null = 用户显式解绑；空串是解绑的历史写法（旧版本 `accelerator ?? ""`），
 * 必须同样读成解绑，否则升级后会把用户关掉的全局热键装回去。
 */
function normalizeAccelerator(
  value: unknown,
  fallback: string | null
): string | null {
  if (value === null || value === "") {
    return null;
  }
  return typeof value === "string" ? value : fallback;
}

function pickInApp(
  source: Partial<InAppHotkeyState> | undefined,
  key: keyof InAppHotkeyState
): string | null {
  return normalizeAccelerator(
    source?.[key],
    DEFAULT_SETTINGS.inAppHotkeys[key]
  );
}

function pickTheme(value: unknown): AppSettings["theme"] {
  return THEMES.includes(value as AppSettings["theme"])
    ? (value as AppSettings["theme"])
    : DEFAULT_SETTINGS.theme;
}

function pickHistoryLimit(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_SETTINGS.historyLimit;
}

function pickGlossary(value: unknown): AppSettings["glossary"] {
  return Array.isArray(value)
    ? (value as AppSettings["glossary"])
    : DEFAULT_SETTINGS.glossary;
}

export function toSettings(value: unknown): AppSettings {
  const partial = (
    value && typeof value === "object" ? value : {}
  ) as Partial<AppSettings>;
  const inApp = partial.inAppHotkeys;
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    glossary: pickGlossary(partial.glossary),
    // 旧配置没有该字段；形状不对直接回默认，别让坏值混进运行时
    historyLimit: pickHistoryLimit(partial.historyLimit),
    hotkey: normalizeAccelerator(partial.hotkey, DEFAULT_SETTINGS.hotkey),
    inAppHotkeys: {
      openSettings: pickInApp(inApp, "openSettings"),
      togglePin: pickInApp(inApp, "togglePin"),
    },
    // 同上：旧配置缺字段时按默认走静默启动，坏值也不混进运行时
    showMainWindowOnStartup:
      typeof partial.showMainWindowOnStartup === "boolean"
        ? partial.showMainWindowOnStartup
        : DEFAULT_SETTINGS.showMainWindowOnStartup,
    theme: pickTheme(partial.theme),
  };
}

/**
 * 保留 settings 的兄弟字段：M2 起同一文件还要装 profiles，
 * 整文件覆盖会把它们抹掉，且下次保存时已无法恢复。
 */
export function mergeConfig(
  existing: Record<string, unknown> | null,
  settings: AppSettings
): Record<string, unknown> {
  return { ...(existing ?? {}), schemaVersion: SCHEMA_VERSION, settings };
}
