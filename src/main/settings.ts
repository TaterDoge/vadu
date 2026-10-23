import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { app } from "electron";

/** 这是 AppSettings 的临时子集，M 后续 config 子系统落地后合并 */
type Settings = {
  hotkey: string;
};

const DEFAULT_SETTINGS: Settings = {
  hotkey: "CommandOrControl+Shift+T",
};

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

export function readSettings(): Settings {
  try {
    const parsed = JSON.parse(
      readFileSync(settingsPath(), "utf8")
    ) as Partial<Settings>;
    const hotkey =
      typeof parsed.hotkey === "string"
        ? parsed.hotkey
        : DEFAULT_SETTINGS.hotkey;
    return { hotkey };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: Settings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}
