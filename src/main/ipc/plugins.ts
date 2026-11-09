import { randomUUID } from "node:crypto";

import { ipcMain } from "electron";

import { VaduError } from "../../shared/errors";
import type {
  ModelHealthCheckParams,
  ModelHealthCheckResult,
  ModelInfo,
  PluginDescriptor,
  Profile,
} from "../../shared/ipc";
import { IPC } from "../../shared/ipc";
import { readProfiles } from "../core/config/store";
import { validateConfigAgainstSchema } from "../core/config/validate";
import { hostListModels, hostProbeTranslate } from "../core/plugin/host";
import { registry } from "../core/plugin/registry";
import { TaskRegistry } from "../core/translate/tasks";
import { handle } from "./index";

const MAX_SECRETS = 16;
const MAX_SECRET_LENGTH = 8192;
const MAX_REQUEST_ID = 64;
const MAX_PLUGIN_ID = 128;
const MAX_PROFILE_ID = 128;

const HEALTH_TEXT = "Hello";
const HEALTH_SOURCE = "en";
const HEALTH_TARGET = "zh-CN";

const healthTaskRegistry = new TaskRegistry();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function validateHealthParams(raw: unknown): ModelHealthCheckParams {
  if (!isRecord(raw)) {
    throw new VaduError("INVALID_CONFIG", "健康检测请求形状不合法");
  }
  const { requestId, pluginId, profileId, config } = raw;
  if (
    typeof requestId !== "string" ||
    requestId.length === 0 ||
    requestId.length > MAX_REQUEST_ID
  ) {
    throw new VaduError("INVALID_CONFIG", "requestId 非法");
  }
  if (
    typeof pluginId !== "string" ||
    pluginId.length === 0 ||
    pluginId.length > MAX_PLUGIN_ID
  ) {
    throw new VaduError("INVALID_CONFIG", "pluginId 非法");
  }
  if (typeof profileId !== "string" || profileId.length > MAX_PROFILE_ID) {
    throw new VaduError("INVALID_CONFIG", "profileId 非法");
  }
  if (!isRecord(config) || Object.keys(config).length > 64) {
    throw new VaduError("INVALID_CONFIG", "配置形状不合法");
  }
  return {
    config,
    pluginId,
    profileId,
    requestId,
    secrets: validateSecrets(raw.secrets),
  };
}

/** 已保存 profile 沿用落盘白名单；草稿用合成 id，绝不回落到任何已落盘密钥桶 */
function healthProfile(
  pluginId: string,
  profileId: string,
  requestId: string,
  config: Record<string, unknown>
): Profile {
  const profiles = readProfiles();
  const saved = profiles.find(
    (entry) => entry.id === profileId && entry.pluginId === pluginId
  );
  if (profiles.some((entry) => entry.id === profileId) && !saved) {
    throw new VaduError("INVALID_CONFIG", "该 profile 属于其他插件");
  }
  if (saved) {
    return { ...saved, config };
  }
  return {
    allowedOrigins: [draftOrigin(config)],
    config,
    createdAt: 0,
    enabled: true,
    id: `__health__${requestId}`,
    name: "",
    pluginId,
  };
}

async function healthCheck(
  raw: unknown,
  ctx: { sender: Electron.WebContents }
): Promise<ModelHealthCheckResult> {
  const params = validateHealthParams(raw);
  if (ctx.sender.isDestroyed()) {
    throw new VaduError("ABORTED", "窗口已关闭");
  }
  const plugin = registry.getTranslator(params.pluginId);
  if (plugin?.descriptor.status !== "ready") {
    throw new VaduError("PLUGIN_LOAD_FAILED", "插件未就绪");
  }
  const config = validateConfigAgainstSchema(
    params.config,
    plugin.descriptor.configSchema
  );
  const { model } = config;
  if (typeof model !== "string" || model.trim() === "") {
    throw new VaduError("INVALID_CONFIG", "请先填写模型");
  }
  const profile = healthProfile(
    params.pluginId,
    params.profileId,
    params.requestId,
    config
  );
  const task = healthTaskRegistry.register(params.requestId, ctx.sender);
  if (!task) {
    throw new VaduError("INVALID_CONFIG", "requestId 重复");
  }
  const onDestroyed = (): void => {
    healthTaskRegistry.disposeBySender(ctx.sender.id);
  };
  ctx.sender.once("destroyed", onDestroyed);
  task.cleanup = () => {
    ctx.sender.removeListener("destroyed", onDestroyed);
  };
  const startedAt = Date.now();
  try {
    const { hasOutput } = await hostProbeTranslate({
      create: plugin.create,
      pluginId: params.pluginId,
      profile,
      req: {
        config,
        source: HEALTH_SOURCE,
        target: HEALTH_TARGET,
        text: HEALTH_TEXT,
      },
      requestId: params.requestId,
      secrets: params.secrets,
      signal: task.controller.signal,
    });
    if (task.suppressed) {
      throw new VaduError("ABORTED", "已取消");
    }
    if (!hasOutput) {
      throw new VaduError("INTERNAL", "模型返回空结果");
    }
    return { elapsedMs: Date.now() - startedAt };
  } finally {
    task.cleanup?.();
    healthTaskRegistry.remove(params.requestId);
  }
}

/** 恢复配置前中止健康检测：它们持有旧 profile 快照，不应继续跑完 */
export function abortHealthChecks(): void {
  healthTaskRegistry.abortAll();
}

export function registerPluginsIpc(): void {
  handle<null, PluginDescriptor[]>(IPC.plugins.list, () =>
    Promise.resolve(registry.list())
  );

  handle<unknown, ModelInfo[]>(IPC.plugins.listModels, listModels);

  handle<unknown, ModelHealthCheckResult>(IPC.plugins.healthCheck, healthCheck);

  // 取消是「发了就不管」：只允许发起窗口终止自己的任务
  ipcMain.on(IPC.plugins.cancelHealthCheck, (event, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.requestId !== "string") {
      return;
    }
    const { requestId } = payload;
    if (requestId.length > 0 && requestId.length <= MAX_REQUEST_ID) {
      healthTaskRegistry.cancel(requestId, event.sender.id);
    }
  });
}
