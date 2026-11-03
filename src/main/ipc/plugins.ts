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

async function listModels(raw: unknown): Promise<ModelInfo[]> {
  if (!isRecord(raw)) {
    throw new VaduError("INVALID_CONFIG", "模型列表请求形状不合法");
  }
  const { pluginId, profileId, config } = raw as Record<string, unknown>;
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
  const plugin = registry.get(pluginId);
  if (plugin?.descriptor.status !== "ready") {
    throw new VaduError("PLUGIN_LOAD_FAILED", "插件未就绪");
  }
  if (!plugin.descriptor.capabilities.models) {
    throw new VaduError("INVALID_CONFIG", "该插件不支持获取模型列表");
  }
  const profile = readProfiles().find(
    (entry) => entry.id === profileId && entry.pluginId === pluginId
  );
  if (!profile) {
    throw new VaduError("INVALID_CONFIG", "profile 不存在或不属于该插件");
  }
  // 密钥只从已保存的 profile 桶读取，origin 由受控 fetch 白名单把关
  const models = await hostListModels({
    config,
    create: plugin.create,
    pluginId,
    profile,
    requestId: randomUUID(),
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
