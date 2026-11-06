import type {
  ModelInfo,
  PluginConfig,
  PluginRuntime,
} from "../../../shared/plugin";
import { coded, extractErrorCode, mapHttpError, readErrorBody } from "./errors";
import { customRequestHeaders } from "./headers";
import { buildModelsUrl } from "./url";

/**
 * OpenAI 兼容 `GET /models`。anthropic / gemini 的模型端点形状不同，
 * 本切片不实现，UI 失败后回落到 manifest preset 的候选列表。
 */
export async function listOpenAiModels(args: {
  apiKey: string;
  config: PluginConfig;
  runtime: PluginRuntime;
}): Promise<ModelInfo[]> {
  const { apiKey, config, runtime } = args;
  const response = await runtime.fetch(
    buildModelsUrl(String(config.baseURL ?? "")),
    {
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...customRequestHeaders(config.headers),
      },
      method: "GET",
    }
  );
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw mapHttpError(response.status, extractErrorCode(body));
  }
  let data: { data?: unknown };
  try {
    data = (await response.json()) as { data?: unknown };
  } catch (cause) {
    throw Object.assign(coded("INTERNAL", "上游返回了无法解析的响应"), {
      cause,
    });
  }
  if (!Array.isArray(data.data)) {
    throw coded("INVALID_CONFIG", "上游响应缺少模型列表");
  }
  const models: ModelInfo[] = [];
  for (const item of data.data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const { id, label } = item as { id?: unknown; label?: unknown };
    if (typeof id !== "string" || id === "") {
      continue;
    }
    models.push({
      id,
      label: typeof label === "string" && label !== "" ? label : id,
    });
    if (models.length >= 200) {
      break;
    }
  }
  return models;
}
