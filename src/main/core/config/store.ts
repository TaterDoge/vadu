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
import type {
  AppSettings,
  AppearancePatch,
  AppearanceSettings,
  Profile,
} from "../../../shared/ipc";
import { assertConfigWritesAllowed } from "./serial";
import {
  DEFAULT_SETTINGS,
  appearanceOf,
  mergeConfig,
  mergeProfiles,
  pickLegacyAppearance,
  toSettings,
} from "./settings";

export function configFilePath(): string {
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

export function writeConfigRaw(payload: Record<string, unknown>): void {
  // 恢复成功后所有写入口（含直接 updateSettings / saveProfile）都必须停下
  assertConfigWritesAllowed();
  const target = configFilePath();
  // tmp 带 pid：即使锁失效被双开，两个实例也不会写同一个临时文件
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  renameSync(tmp, target);
}

function writeConfig(settings: AppSettings): void {
  writeConfigRaw(mergeConfig(parseConfig(configFilePath()), settings));
}

/** 当前磁盘配置原样（解析失败返回 null），供恢复快照与顶层字段合并 */
export function readConfigRaw(): Record<string, unknown> | null {
  return parseConfig(configFilePath());
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
  const path = configFilePath();
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
  assertConfigWritesAllowed();
  const next = { ...readSettings(), ...patch };
  writeConfig(next);
  return next;
}

export function readAppearance(): AppearanceSettings {
  return appearanceOf(readSettings());
}

export function updateAppearance(patch: AppearancePatch): AppearanceSettings {
  return appearanceOf(updateSettings(patch));
}

/** 旧 localStorage 外观只补写磁盘上缺的字段；写盘成功后才返回新值 */
export function migrateAppearance(legacy: AppearancePatch): AppearanceSettings {
  const raw = parseConfig(configFilePath());
  const persisted = raw?.settings;
  const patch = pickLegacyAppearance(
    persisted && typeof persisted === "object" && !Array.isArray(persisted)
      ? (persisted as Record<string, unknown>)
      : null,
    legacy
  );
  return Object.keys(patch).length === 0
    ? readAppearance()
    : appearanceOf(updateSettings(patch));
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
  const raw = parseConfig(configFilePath());
  const list = raw && Array.isArray(raw.profiles) ? raw.profiles : [];
  return list
    .map(toProfile)
    .filter((profile): profile is Profile => profile !== null);
}

export type BackupConfigSnapshot = {
  settings: AppSettings;
  profiles: Profile[];
};

/** 导出用只读快照：同一个文件只解析一次，损坏时抛错而不是改名留档 */
export function readBackupSnapshot(): BackupConfigSnapshot {
  const path = configFilePath();
  if (!existsSync(path)) {
    return { profiles: [], settings: { ...DEFAULT_SETTINGS } };
  }
  const raw = parseConfig(path);
  if (!raw) {
    throw new VaduError("INVALID_CONFIG", "配置文件损坏，无法导出备份");
  }
  if (raw.profiles !== undefined && !Array.isArray(raw.profiles)) {
    throw new VaduError("INVALID_CONFIG", "配置中的 profiles 不是数组");
  }
  const list = Array.isArray(raw.profiles) ? raw.profiles : [];
  const profiles: Profile[] = [];
  for (const entry of list) {
    const profile = toProfile(entry);
    if (!profile) {
      throw new VaduError(
        "INVALID_CONFIG",
        "配置中有损坏的服务商，无法导出完整备份"
      );
    }
    profiles.push(profile);
  }
  return { profiles, settings: toSettings(raw.settings) };
}

export function deleteProfile(id: string): void {
  assertConfigWritesAllowed();
  const raw = parseConfig(configFilePath());
  if (!raw && existsSync(configFilePath())) {
    throw new VaduError("INVALID_CONFIG", "配置文件损坏，请先恢复配置");
  }
  const profiles = readProfiles().filter((entry) => entry.id !== id);
  writeConfigRaw(mergeProfiles(raw, profiles));
}

/** 按给定 id 顺序重排；未列出的 profile 按原相对顺序追加在末尾，未知 id 忽略 */
export function reorderProfiles(orderedIds: string[]): Profile[] {
  assertConfigWritesAllowed();
  const raw = parseConfig(configFilePath());
  if (!raw && existsSync(configFilePath())) {
    throw new VaduError("INVALID_CONFIG", "配置文件损坏，请先恢复配置");
  }
  const profiles = readProfiles();
  const remaining = new Map(profiles.map((entry) => [entry.id, entry]));
  const ordered: Profile[] = [];
  for (const id of orderedIds) {
    const profile = remaining.get(id);
    if (!profile) {
      continue;
    }
    remaining.delete(id);
    ordered.push(profile);
  }
  const next = [
    ...ordered,
    ...profiles.filter((profile) => remaining.has(profile.id)),
  ];
  writeConfigRaw(mergeProfiles(raw, next));
  return next;
}

export function saveProfile(profile: Profile): Profile {
  assertConfigWritesAllowed();
  const raw = parseConfig(configFilePath());
  if (!raw && existsSync(configFilePath())) {
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
