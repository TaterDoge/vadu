import { randomUUID } from "node:crypto";

import { VaduError } from "../../shared/errors";
import type { Profile } from "../../shared/ipc";
import { IPC } from "../../shared/ipc";
import { readProfiles, saveProfile } from "../core/config/store";
import { validateConfigAgainstSchema } from "../core/config/validate";
import { registry } from "../core/plugin/registry";
import { normalizeBaseUrl, originOf } from "../core/url";
import { handle } from "./index";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

let saveQueue: Promise<unknown> = Promise.resolve();

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
    const operation = saveQueue
      .catch(() => undefined)
      .then(() => {
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
    saveQueue = operation;
    return operation;
  });
}
