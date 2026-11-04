import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { app } from "electron";

import { VaduError } from "../../../shared/errors";
import type { AppSettings, Profile } from "../../../shared/ipc";
import {
  DEFAULT_SETTINGS,
  mergeConfig,
  mergeProfiles,
  toSettings,
} from "./settings";

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
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function writeConfigRaw(payload: Record<string, unknown>): void {
  const target = configPath();
  // tmp 带 pid：即使锁失效被双开，两个实例也不会写同一个临时文件
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  renameSync(tmp, target);
}

function writeConfig(settings: AppSettings): void {
  writeConfigRaw(mergeConfig(parseConfig(configPath()), settings));
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

function toProfile(value: unknown): Profile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const entry = value as Partial<Profile>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.pluginId !== "string" ||
    typeof entry.name !== "string" ||
    !entry.config ||
    typeof entry.config !== "object" ||
    Array.isArray(entry.config)
  ) {
    return null;
  }
  return {
    allowedOrigins: Array.isArray(entry.allowedOrigins)
      ? entry.allowedOrigins.filter(
          (origin): origin is string => typeof origin === "string"
        )
      : [],
    config: entry.config as Record<string, unknown>,
    createdAt:
      typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
    enabled: typeof entry.enabled === "boolean" ? entry.enabled : true,
    id: entry.id,
    name: entry.name,
    pluginId: entry.pluginId,
    preset: typeof entry.preset === "string" ? entry.preset : undefined,
  };
}

/** profiles 与未知顶层字段不动，只替换/追加 profiles 数组 */
export function readProfiles(): Profile[] {
  const raw = parseConfig(configPath());
  const list = raw && Array.isArray(raw.profiles) ? raw.profiles : [];
  return list
    .map(toProfile)
    .filter((profile): profile is Profile => profile !== null);
}

export function deleteProfile(id: string): void {
  const raw = parseConfig(configPath());
  if (!raw && existsSync(configPath())) {
    throw new VaduError("INVALID_CONFIG", "配置文件损坏，请先恢复配置");
  }
  const profiles = readProfiles().filter((entry) => entry.id !== id);
  writeConfigRaw(mergeProfiles(raw, profiles));
}

export function saveProfile(profile: Profile): Profile {
  const raw = parseConfig(configPath());
  if (!raw && existsSync(configPath())) {
    throw new VaduError("INVALID_CONFIG", "配置文件损坏，请先恢复配置");
  }
  const profiles = readProfiles();
  const index = profiles.findIndex((entry) => entry.id === profile.id);
  if (index >= 0) {
    if (profiles[index]?.pluginId !== profile.pluginId) {
      throw new VaduError("INVALID_CONFIG", "profile 不可更改所属插件");
    }
    profiles[index] = profile;
  } else {
    profiles.push(profile);
  }
  writeConfigRaw(mergeProfiles(raw, profiles));
  return profile;
}
