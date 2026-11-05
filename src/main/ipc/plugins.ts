import { randomUUID } from "node:crypto";

import { VaduError } from "../../shared/errors";
import type { ModelInfo, PluginDescriptor } from "../../shared/ipc";
import { IPC } from "../../shared/ipc";
import { readProfiles } from "../core/config/store";
import { hostListModels } from "../core/plugin/host";
import { registry } from "../core/plugin/registry";
import { handle } from "./index";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_SECRETS = 16;
const MAX_SECRET_LENGTH = 8192;

/** 本次模型列表请求的未保存密钥：只校验形状，绝不并入 config / 落盘 / 打日志 */
function validateSecrets(raw: unknown): Record<string, string> | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    throw new VaduError("INVALID_CONFIG", "模型列表请求形状不合法");
  }
  const entries = Object.entries(raw);
  if (entries.length > MAX_SECRETS) {
    throw new VaduError("INVALID_CONFIG", "密钥字段过多");
  }
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      throw new VaduError("INVALID_CONFIG", "密钥值必须为字符串");
    }
    if (value.length > MAX_SECRET_LENGTH) {
      throw new VaduError("INVALID_CONFIG", "密钥值过长");
    }
    out[key] = value;
  }
  return out;
}

/** 草稿 profile 的临时 origin：baseURL 缺失或非法不放行，由本次 config 派生 */
function tryOrigin(baseURL: string): string | null {
  try {
    return new URL(baseURL).origin;
  } catch {
    return null;
  }
}

function draftOrigin(config: Record<string, unknown>): string {
  const { baseURL } = config;
  if (typeof baseURL !== "string" || baseURL.trim() === "") {
    throw new VaduError("INVALID_CONFIG", "请先填写正确的接口地址");
  }
  const origin = tryOrigin(baseURL);
  if (origin === null) {
    throw new VaduError("INVALID_CONFIG", "请先填写正确的接口地址");
  }
  return origin;
}

async function listModels(raw: unknown): Promise<ModelInfo[]> {
  if (!isRecord(raw)) {
    throw new VaduError("INVALID_CONFIG", "模型列表请求形状不合法");
  }
  const { pluginId, profileId, config, secrets } = raw as Record<
    string,
    unknown
  >;
  if (
    typeof pluginId !== "string" ||
    typeof profileId !== "string" ||
    !isRecord(config)
  ) {
    throw new VaduError("INVALID_CONFIG", "模型列表请求形状不合法");
  }
  if (Object.keys(config).length > 64) {
    throw new VaduError("INVALID_CONFIG", "配置字段过多");
  }
  const secretsOverride = validateSecrets(secrets);
  const plugin = registry.getTranslator(pluginId);
  if (plugin?.descriptor.status !== "ready") {
    throw new VaduError("PLUGIN_LOAD_FAILED", "插件未就绪");
  }
  if (!plugin.descriptor.capabilities.models) {
    throw new VaduError("INVALID_CONFIG", "该插件不支持获取模型列表");
  }
  const saved = readProfiles().find(
    (entry) => entry.id === profileId && entry.pluginId === pluginId
  );
  // 草稿 profile 只在内存构造：origin 由本次 config.baseURL 派生，不登记白名单、不落盘
  const profile =
    saved ??
    ({
      allowedOrigins: [draftOrigin(config)],
      config,
      createdAt: 0,
      enabled: true,
      id: profileId,
      name: "",
      pluginId,
    } satisfies {
      allowedOrigins: string[];
      config: Record<string, unknown>;
      createdAt: number;
      enabled: boolean;
      id: string;
      name: string;
      pluginId: string;
    });
  const models = await hostListModels({
    config,
    create: plugin.create,
    pluginId,
    profile,
    requestId: randomUUID(),
    secrets: secretsOverride,
  });
  const seen = new Set<string>();
  const unique: ModelInfo[] = [];
  for (const model of models) {
    if (!seen.has(model.id)) {
      seen.add(model.id);
      unique.push(model);
    }
    if (unique.length >= 500) {
      break;
    }
  }
  return unique;
}

export function registerPluginsIpc(): void {
  handle<null, PluginDescriptor[]>(IPC.plugins.list, () =>
    Promise.resolve(registry.list())
  );

  handle<unknown, ModelInfo[]>(IPC.plugins.listModels, listModels);
}
