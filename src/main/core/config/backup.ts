/**
 * 设置备份的纯逻辑：固定格式、严格导入校验、config secret 剔除与新 ID/密钥映射。
 * 不碰 electron / 具体厂商插件；插件能力通过 lookup 注入，方便单测。
 */

import { randomUUID } from "node:crypto";

import { VaduError } from "../../../shared/errors";
import { isSupportedAccelerator } from "../../../shared/hotkey";
import type {
  AppSettings,
  ConfigSchema,
  PluginStatus,
  Profile,
} from "../../../shared/ipc";
import { ACCENT_NAMES, STYLE_NAMES, THEME_NAMES } from "../../../shared/ipc";
import { InvalidBaseUrlError, normalizeBaseUrl, originOf } from "../url";
import { SCHEMA_VERSION } from "./settings";
import { validateConfigAgainstSchema } from "./validate";

export const BACKUP_FORMAT = "vadu-settings-backup";
/** v2 起同一份 JSON 才含密钥；v1 仍可导入但明确无密钥 */
export const BACKUP_FORMAT_VERSION = 2;
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
export const MAX_BACKUP_PROFILES = 200;

const MAX_PROFILE_ID = 128;
const MAX_PLUGIN_ID = 128;
const MAX_PROFILE_NAME = 100;
const MAX_PRESET = 100;
const MAX_ACCELERATOR = 64;
const MAX_GLOSSARY_ENTRIES = 500;
const MAX_GLOSSARY_TERM = 200;
const MAX_HISTORY_LIMIT = 1000;
const MAX_SECRETS_PER_PROFILE = 64;
const MAX_SECRET_NAME = 100;
const MAX_SECRET_VALUE = 4096;

const UNSAFE_SECRET_NAMES = new Set(["__proto__", "constructor", "prototype"]);

export type BackupSecretVersion = 1 | 2;
export type BackupSecrets = Record<string, Record<string, string>>;

export type BackupProfile = {
  /** 只用于把 defaultProfileId 映射到新 ID；导入时一定会换成新 UUID */
  id: string;
  pluginId: string;
  name: string;
  preset?: string;
  config: Record<string, unknown>;
  /** 与 config 分开的密钥桶；v2 每个 profile 都必须有，空桶也写 {} */
  secrets: Record<string, string>;
  enabled: boolean;
  createdAt: number;
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  schemaVersion: number;
  settings: AppSettings;
  profiles: BackupProfile[];
};

export type BackupPlugin = {
  status: PluginStatus;
  configSchema?: ConfigSchema;
};

export type PluginLookup = (pluginId: string) => BackupPlugin | undefined;

export type BackupImportPlan = {
  formatVersion: BackupSecretVersion;
  secretCount: number;
  /** key 是重映射后的新 profileId */
  secrets: BackupSecrets;
  settings: AppSettings;
  profiles: Profile[];
};

function invalid(message: string): VaduError {
  return new VaduError("INVALID_CONFIG", message);
}

function invalidWithCause(message: string, cause: unknown): VaduError {
  return new VaduError("INVALID_CONFIG", message, { cause });
}

/** 文件解析与校验合成一个边界函数：JSON 语法错和结构错都归 INVALID_CONFIG */
export function planBackupFromText(
  text: string,
  lookup: PluginLookup
): BackupImportPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw invalidWithCause("备份文件不是合法 JSON", error);
  }
  return planBackupImport(parsed, lookup);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function oneOf<T extends string>(
  values: readonly T[],
  value: unknown,
  field: string
): T {
  if (
    typeof value !== "string" ||
    !(values as readonly string[]).includes(value)
  ) {
    throw invalid(`${field} 取值不合法`);
  }
  return value as T;
}

function readString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.length > max || value.trim() === "") {
    throw invalid(`${field} 长度不合法`);
  }
  return value;
}

function readOptionalString(
  value: unknown,
  field: string,
  max: number
): string | undefined {
  return value === undefined ? undefined : readString(value, field, max);
}

function readAccelerator(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  const accelerator = readString(value, field, MAX_ACCELERATOR);
  if (!isSupportedAccelerator(accelerator)) {
    throw invalid(`${field} 不是合法的快捷键`);
  }
  return accelerator;
}

function readCreatedAt(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalid(`${field} 不合法`);
  }
  return value;
}

function requireFields(
  source: Record<string, unknown>,
  fields: readonly string[],
  prefix: string
): void {
  for (const key of fields) {
    if (!Object.hasOwn(source, key)) {
      throw invalid(`缺少字段：${prefix}${key}`);
    }
  }
}

function parseGlossary(value: unknown): AppSettings["glossary"] {
  if (!Array.isArray(value)) {
    throw invalid("glossary 必须是数组");
  }
  if (value.length > MAX_GLOSSARY_ENTRIES) {
    throw invalid("glossary 条数超限");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw invalid(`glossary[${index}] 形状不合法`);
    }
    return {
      from: readString(
        entry.from,
        `glossary[${index}].from`,
        MAX_GLOSSARY_TERM
      ),
      to: readString(entry.to, `glossary[${index}].to`, MAX_GLOSSARY_TERM),
    };
  });
}

/** 导入必须严格：缺字段、坏类型都整次失败，不能拿默认值盖过去 */
export function parseBackupSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) {
    throw invalid("settings 形状不合法");
  }
  requireFields(
    raw,
    [
      "accent",
      "glossary",
      "historyLimit",
      "hotkey",
      "inAppHotkeys",
      "showMainWindowOnStartup",
      "style",
      "theme",
    ],
    ""
  );
  // defaultProfileId 可省略：没有默认服务商也是合法设置
  const inApp = raw.inAppHotkeys;
  if (!isRecord(inApp)) {
    throw invalid("inAppHotkeys 形状不合法");
  }
  requireFields(inApp, ["openSettings", "togglePin"], "inAppHotkeys.");
  const { historyLimit, showMainWindowOnStartup } = raw;
  if (
    typeof historyLimit !== "number" ||
    !Number.isSafeInteger(historyLimit) ||
    historyLimit < 1 ||
    historyLimit > MAX_HISTORY_LIMIT
  ) {
    throw invalid("historyLimit 取值不合法");
  }
  if (typeof showMainWindowOnStartup !== "boolean") {
    throw invalid("showMainWindowOnStartup 必须是布尔值");
  }
  const settings: AppSettings = {
    accent: oneOf(ACCENT_NAMES, raw.accent, "accent"),
    glossary: parseGlossary(raw.glossary),
    historyLimit,
    hotkey: readAccelerator(raw.hotkey, "hotkey"),
    inAppHotkeys: {
      openSettings: readAccelerator(
        inApp.openSettings,
        "inAppHotkeys.openSettings"
      ),
      togglePin: readAccelerator(inApp.togglePin, "inAppHotkeys.togglePin"),
    },
    showMainWindowOnStartup,
    style: oneOf(STYLE_NAMES, raw.style, "style"),
    theme: oneOf(THEME_NAMES, raw.theme, "theme"),
  };
  const defaultProfileId = readOptionalString(
    raw.defaultProfileId,
    "defaultProfileId",
    MAX_PROFILE_ID
  );
  if (defaultProfileId !== undefined) {
    settings.defaultProfileId = defaultProfileId;
  }
  return settings;
}

function schemaOf(
  pluginId: string,
  lookup: PluginLookup,
  profileName: string
): ConfigSchema | undefined {
  const plugin = lookup(pluginId);
  if (plugin?.status !== "ready") {
    throw new VaduError(
      "PLUGIN_LOAD_FAILED",
      `服务商「${profileName}」依赖的插件未安装或未就绪`
    );
  }
  return plugin.configSchema;
}

/** 按插件 schema 清洗：secret 字段与未知字段都不会进备份 */
function sanitizeConfig(
  rawConfig: unknown,
  schema: ConfigSchema | undefined,
  profileName: string
): Record<string, unknown> {
  if (!isRecord(rawConfig)) {
    throw invalid(`服务商「${profileName}」的配置不是对象`);
  }
  const config = validateConfigAgainstSchema(rawConfig, schema);
  const baseUrl = config.baseURL;
  if (typeof baseUrl === "string" && baseUrl !== "") {
    try {
      config.baseURL = normalizeBaseUrl(baseUrl);
    } catch (cause) {
      throw new InvalidBaseUrlError(
        `服务商「${profileName}」的接口地址不合法`,
        { cause }
      );
    }
  }
  return config;
}

/**
 * 完整备份：config 里的 schema secret 字段仍剔除，密钥只从独立 secrets 桶写入。
 * secrets 快照只包含调用方点名 profile，不会带无关联旧桶。
 */
export function buildBackup(
  settings: AppSettings,
  profiles: Profile[],
  lookup: PluginLookup,
  secrets: BackupSecrets
): BackupFile {
  if (profiles.length > MAX_BACKUP_PROFILES) {
    throw invalid("服务商数量超过导出上限");
  }
  const exportedSettings = parseBackupSettings(settings);
  const seen = new Set<string>();
  const exportedProfiles = profiles.map((profile) => {
    const id = readString(profile.id, "profile.id", MAX_PROFILE_ID);
    if (seen.has(id)) {
      throw invalid(`服务商 ID 重复：${id}`);
    }
    seen.add(id);
    const pluginId = readString(
      profile.pluginId,
      "profile.pluginId",
      MAX_PLUGIN_ID
    );
    const preset = readOptionalString(
      profile.preset,
      "profile.preset",
      MAX_PRESET
    );
    const schema = schemaOf(pluginId, lookup, profile.name);
    return {
      config: sanitizeConfig(profile.config, schema, profile.name),
      createdAt: readCreatedAt(profile.createdAt, "profile.createdAt"),
      enabled: profile.enabled,
      id,
      name: readString(profile.name, "profile.name", MAX_PROFILE_NAME),
      pluginId,
      // 与导入共用同一严格校验：旧 secret 字段/超限值应让导出失败，而不是生成不可导入文件
      secrets: parseSecrets(secrets[profile.id] ?? {}, schema, profile.name),
      ...(preset === undefined ? {} : { preset }),
    } satisfies BackupProfile;
  });

  if (
    exportedSettings.defaultProfileId !== undefined &&
    !seen.has(exportedSettings.defaultProfileId)
  ) {
    throw invalid("默认服务商引用不存在");
  }

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    profiles: exportedProfiles,
    schemaVersion: SCHEMA_VERSION,
    settings: exportedSettings,
  };
}

function parseSecrets(
  raw: unknown,
  schema: ConfigSchema | undefined,
  profileName: string
): Record<string, string> {
  if (!isRecord(raw)) {
    throw invalid(`服务商「${profileName}」的 secrets 必须是对象`);
  }
  const entries = Object.entries(raw);
  if (entries.length > MAX_SECRETS_PER_PROFILE) {
    throw invalid(`服务商「${profileName}」的密钥数量超限`);
  }
  const secrets: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (
      name.length === 0 ||
      name.length > MAX_SECRET_NAME ||
      UNSAFE_SECRET_NAMES.has(name)
    ) {
      throw invalid(`服务商「${profileName}」的密钥名不合法`);
    }
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > MAX_SECRET_VALUE
    ) {
      throw invalid(`服务商「${profileName}」的密钥值不合法`);
    }
    const field = schema?.properties[name];
    if (
      !(schema && Object.hasOwn(schema.properties, name)) ||
      field?.type !== "secret"
    ) {
      throw invalid(`服务商「${profileName}」的密钥字段不合法`);
    }
    secrets[name] = value;
  }
  return secrets;
}

function parseBackupProfile(
  raw: unknown,
  lookup: PluginLookup,
  seen: Set<string>,
  requireSecrets: boolean
): BackupProfile {
  if (!isRecord(raw)) {
    throw invalid("profiles 项形状不合法");
  }
  const id = readString(raw.id, "profile.id", MAX_PROFILE_ID);
  if (seen.has(id)) {
    throw invalid(`服务商 ID 重复：${id}`);
  }
  seen.add(id);
  const pluginId = readString(raw.pluginId, "profile.pluginId", MAX_PLUGIN_ID);
  const name = readString(raw.name, "profile.name", MAX_PROFILE_NAME);
  if (typeof raw.enabled !== "boolean") {
    throw invalid(`服务商「${name}」的 enabled 必须是布尔值`);
  }
  const preset = readOptionalString(raw.preset, "profile.preset", MAX_PRESET);
  const schema = schemaOf(pluginId, lookup, name);
  return {
    config: sanitizeConfig(raw.config, schema, name),
    createdAt: readCreatedAt(raw.createdAt, `服务商「${name}」的 createdAt`),
    enabled: raw.enabled,
    id,
    name,
    pluginId,
    secrets: requireSecrets ? parseSecrets(raw.secrets, schema, name) : {},
    ...(preset === undefined ? {} : { preset }),
  };
}

/**
 * 全量替换计划：所有 profile 换新 UUID，默认服务商跟着重映射；
 * allowedOrigins 完全忽略，由校验后的 baseURL 重建。
 */
export function planBackupImport(
  raw: unknown,
  lookup: PluginLookup
): BackupImportPlan {
  if (!isRecord(raw)) {
    throw invalid("备份文件不是 JSON 对象");
  }
  if (raw.format !== BACKUP_FORMAT) {
    throw invalid("不是 vadu 设置备份文件");
  }
  if (raw.formatVersion !== 1 && raw.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw invalid(`不支持的备份格式版本：${String(raw.formatVersion)}`);
  }
  const formatVersion: BackupSecretVersion =
    raw.formatVersion === 1 ? 1 : BACKUP_FORMAT_VERSION;
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw invalid(`不支持的配置版本：${String(raw.schemaVersion)}`);
  }
  const settings = parseBackupSettings(raw.settings);
  if (!Array.isArray(raw.profiles)) {
    throw invalid("profiles 必须是数组");
  }
  if (raw.profiles.length > MAX_BACKUP_PROFILES) {
    throw invalid("服务商数量超过导入上限");
  }

  const seen = new Set<string>();
  const remapped = new Map<string, string>();
  const secrets: BackupSecrets = {};
  let secretCount = 0;
  const profiles = raw.profiles.map((entry) => {
    const profile = parseBackupProfile(
      entry,
      lookup,
      seen,
      formatVersion === 2
    );
    const id = randomUUID();
    remapped.set(profile.id, id);
    if (Object.keys(profile.secrets).length > 0) {
      secrets[id] = profile.secrets;
      secretCount += Object.keys(profile.secrets).length;
    }
    const baseUrl = profile.config.baseURL;
    return {
      allowedOrigins:
        typeof baseUrl === "string" && baseUrl !== ""
          ? [originOf(baseUrl)]
          : [],
      config: profile.config,
      createdAt: profile.createdAt,
      enabled: profile.enabled,
      id,
      name: profile.name,
      pluginId: profile.pluginId,
      ...(profile.preset === undefined ? {} : { preset: profile.preset }),
    } satisfies Profile;
  });

  if (settings.defaultProfileId !== undefined) {
    const mapped = remapped.get(settings.defaultProfileId);
    if (mapped === undefined) {
      throw invalid("默认服务商引用不存在");
    }
    settings.defaultProfileId = mapped;
  }

  return { formatVersion, profiles, secretCount, secrets, settings };
}
