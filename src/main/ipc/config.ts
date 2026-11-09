import { randomUUID } from "node:crypto";

import { BrowserWindow } from "electron";

import { VaduError } from "../../shared/errors";
import type {
  AccentName,
  AppearancePatch,
  AppearanceSettings,
  Profile,
  StyleName,
  Theme,
} from "../../shared/ipc";
import { ACCENT_NAMES, IPC, STYLE_NAMES, THEME_NAMES } from "../../shared/ipc";
import { clearProfileSecrets } from "../core/config/secrets";
import { serializeConfigWrite } from "../core/config/serial";
import {
  migrateAppearance as migrateStoredAppearance,
  readAppearance,
  readProfiles,
  deleteProfile as removeProfile,
  reorderProfiles,
  saveProfile,
  updateAppearance,
} from "../core/config/store";
import { validateConfigAgainstSchema } from "../core/config/validate";
import { registry } from "../core/plugin/registry";
import { normalizeBaseUrl, originOf } from "../core/url";
import { handle } from "./index";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(
  values: readonly T[],
  value: unknown,
  field: string
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== "string" ||
    !(values as readonly string[]).includes(value)
  ) {
    throw new VaduError("INVALID_CONFIG", `${field} 取值不合法`);
  }
  return value as T;
}

function validateAppearancePatch(raw: unknown): AppearancePatch {
  if (!isRecord(raw)) {
    throw new VaduError("INVALID_CONFIG", "外观设置形状不合法");
  }
  const patch: AppearancePatch = {};
  const theme = oneOf<Theme>(THEME_NAMES, raw.theme, "theme");
  const style = oneOf<StyleName>(STYLE_NAMES, raw.style, "style");
  const accent = oneOf<AccentName>(ACCENT_NAMES, raw.accent, "accent");
  if (theme !== undefined) {
    patch.theme = theme;
  }
  if (style !== undefined) {
    patch.style = style;
  }
  if (accent !== undefined) {
    patch.accent = accent;
  }
  return patch;
}

function broadcastAppearance(appearance: AppearanceSettings): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.config.appearanceChanged, appearance);
    }
  }
}

function validateProfile(raw: unknown): Profile {
  if (!isRecord(raw)) {
    throw new VaduError("INVALID_CONFIG", "profile 形状不合法");
  }
  const entry = raw as Partial<Profile>;
  if (typeof entry.pluginId !== "string" || typeof entry.name !== "string") {
    throw new VaduError("INVALID_CONFIG", "profile 缺少 pluginId 或 name");
  }
  if (entry.name.length === 0 || entry.name.length > 100) {
    throw new VaduError("INVALID_CONFIG", "profile 名长度非法");
  }
  const plugin = registry.get(entry.pluginId);
  if (plugin?.descriptor.status !== "ready") {
    throw new VaduError("PLUGIN_LOAD_FAILED", "插件未就绪");
  }

  // 按插件 configSchema 清洗未知字段、类型、enum、min/max、required
  const config = validateConfigAgainstSchema(
    entry.config,
    plugin.descriptor.configSchema
  );
  const baseUrl = typeof config.baseURL === "string" ? config.baseURL : "";
  if (baseUrl !== "") {
    config.baseURL = normalizeBaseUrl(baseUrl);
  }
  const existing = readProfiles().find(
    (profile) => profile.id === entry.id && profile.pluginId === entry.pluginId
  );
  const collision = readProfiles().find((profile) => profile.id === entry.id);
  if (collision && !existing) {
    throw new VaduError("INVALID_CONFIG", "profile 不可更改所属插件");
  }
  return {
    allowedOrigins: existing?.allowedOrigins ?? [],
    config,
    createdAt: existing?.createdAt ?? Date.now(),
    enabled:
      typeof entry.enabled === "boolean"
        ? entry.enabled
        : (existing?.enabled ?? true),
    id: existing?.id ?? randomUUID(),
    name: entry.name,
    pluginId: entry.pluginId,
    preset: typeof entry.preset === "string" ? entry.preset : undefined,
  };
}

export function registerConfigIpc(): void {
  handle<{ pluginId?: string }, Profile[]>(
    IPC.config.listProfiles,
    ({ pluginId }) =>
      Promise.resolve(
        typeof pluginId === "string"
          ? readProfiles().filter((profile) => profile.pluginId === pluginId)
          : readProfiles()
      )
  );

  handle<unknown, Profile>(IPC.config.saveProfile, (raw, { sender }) => {
    const operation = serializeConfigWrite(() => {
      if (sender.isDestroyed()) {
        throw new VaduError("ABORTED", "窗口已关闭");
      }
      const profile = validateProfile(raw);
      const baseUrl =
        typeof profile.config.baseURL === "string"
          ? profile.config.baseURL
          : "";
      const origin = baseUrl === "" ? "" : originOf(baseUrl);
      // 白名单只作受控 fetch 的运行时边界：保存时自动登记用户填写的地址，不再逐个弹窗确认
      if (origin !== "" && !profile.allowedOrigins.includes(origin)) {
        profile.allowedOrigins = [...profile.allowedOrigins, origin];
      }
      return saveProfile(profile);
    });
    return operation;
  });

  handle<null, AppearanceSettings>(IPC.config.getAppearance, () =>
    Promise.resolve(readAppearance())
  );

  handle<unknown, AppearanceSettings>(IPC.config.setAppearance, (raw) => {
    const patch = validateAppearancePatch(raw);
    const operation = serializeConfigWrite(() => {
      const appearance = updateAppearance(patch);
      broadcastAppearance(appearance);
      return appearance;
    });
    return operation;
  });

  handle<unknown, AppearanceSettings>(IPC.config.migrateAppearance, (raw) => {
    const patch = validateAppearancePatch(raw);
    const operation = serializeConfigWrite(() => {
      const appearance = migrateStoredAppearance(patch);
      broadcastAppearance(appearance);
      return appearance;
    });
    return operation;
  });

  handle<{ orderedIds?: string[] }, Profile[]>(
    IPC.config.reorderProfiles,
    (raw, { sender }) => {
      const operation = serializeConfigWrite(() => {
        if (sender.isDestroyed()) {
          throw new VaduError("ABORTED", "窗口已关闭");
        }
        const orderedIds = isRecord(raw) ? raw.orderedIds : undefined;
        if (!Array.isArray(orderedIds)) {
          throw new VaduError("INVALID_CONFIG", "orderedIds 非法");
        }
        // 非字符串项按未知 id 忽略，reorderProfiles 只认配置里存在的 id
        return reorderProfiles(
          orderedIds.filter((id): id is string => typeof id === "string")
        );
      });
      return operation;
    }
  );

  handle<{ profileId?: string }, null>(
    IPC.config.deleteProfile,
    (raw, { sender }) => {
      const operation = serializeConfigWrite(async () => {
        if (sender.isDestroyed()) {
          throw new VaduError("ABORTED", "窗口已关闭");
        }
        if (!isRecord(raw) || typeof raw.profileId !== "string") {
          throw new VaduError("INVALID_CONFIG", "profileId 非法");
        }
        removeProfile(raw.profileId);
        await clearProfileSecrets(raw.profileId);
        return null;
      });
      return operation;
    }
  );
}
