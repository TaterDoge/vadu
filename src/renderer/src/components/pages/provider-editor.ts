/**
 * 保存后回填的纯逻辑：secret 保存失败时，必须保留用户已输入的密钥与
 * 未保存的修改（dirty），否则重试会丢失密钥提交。
 */

import type { ConfigSchema, ModelInfo } from "@shared/ipc";

export type FilterState = "all" | "enabled" | "disabled";

export type SecretRetryEditor = {
  secrets: Record<string, string>;
};

export function mergeSecretRetry<T extends SecretRetryEditor>(
  current: T,
  saved: T
): T {
  return { ...saved, secrets: current.secrets };
}

/**
 * 新增草稿必须让列表可见：清空搜索、切回「全部」过滤。
 */
export function ensureDraftVisible() {
  return { filter: "all" as const, query: "" };
}

/** 草稿名兜底：名称为空仍显示「自定义 OpenAI」 */
export function draftLabel(name: string): string {
  return name === "" ? "自定义 OpenAI" : name;
}

/**
 * 模型列表请求签名：除 model（由下拉结果驱动的字段）外的配置确定性序列化。
 * 用于在 baseURL 等影响 listModels 的字段变化时作废进行中的请求。
 */
export function modelsConfigSignature(config: Record<string, unknown>): string {
  const keys = Object.keys(config)
    .filter((key) => key !== "model")
    .sort();
  return JSON.stringify(keys.map((key) => [key, config[key]]));
}

/** 模型列表展示名：label 可省略，回退 id */
export function modelDisplayLabel(info: {
  id: string;
  label?: string;
}): string {
  return info.label ?? info.id;
}

/** 模型浮层搜索：按 id 或 label 不区分大小写过滤，空查询返回全部 */
export function filterModels(models: ModelInfo[], query: string): ModelInfo[] {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return models;
  }
  return models.filter(
    (entry) =>
      entry.id.toLowerCase().includes(q) ||
      (entry.label ?? "").toLowerCase().includes(q)
  );
}

/**
 * 即时请求（如模型列表）用的配置：把已填的 json 字段解析后并入 config。
 * 解析失败按未填处理——列表仍应可用，保存时的严格校验由 buildConfigPayload 负责。
 */
export function mergeJsonFields(
  editor: { config: Record<string, unknown>; jsonText: Record<string, string> },
  schema?: ConfigSchema
): Record<string, unknown> {
  const config: Record<string, unknown> = { ...editor.config };
  for (const [key, field] of Object.entries(schema?.properties ?? {})) {
    if (field.type !== "json") {
      continue;
    }
    const text = editor.jsonText[key] ?? "";
    if (text.trim() === "") {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined) {
      config[key] = parsed;
    }
  }
  return config;
}

/** 按 schema 判定模型列表前置校验所需的必填 secret 字段集合 */
export function requiredSecretNames(
  schema: ConfigSchema | undefined
): string[] {
  const requiredKeys = new Set(schema?.required ?? []);
  return Object.entries(schema?.properties ?? {})
    .filter(
      ([key, field]) =>
        field.type === "secret" &&
        (field.required === true || requiredKeys.has(key))
    )
    .map(([key]) => key);
}

export type ModelRequestCtx = {
  pluginId: string;
  profileId: string;
  seq: number;
  sig: string;
};

export type ModelRequestRefs = {
  pluginIdRef: { current: string };
  profileIdRef: { current: string };
  seqRef: { current: number };
  sigRef: { current: string };
};

/** 响应到达时请求上下文已过期（切换服务商/配置变化/更新请求）即丢弃 */
export function isModelRequestInvalid(
  ctx: ModelRequestCtx,
  refs: ModelRequestRefs
): boolean {
  return (
    ctx.seq !== refs.seqRef.current ||
    ctx.profileId !== refs.profileIdRef.current ||
    ctx.pluginId !== refs.pluginIdRef.current ||
    ctx.sig !== refs.sigRef.current
  );
}
