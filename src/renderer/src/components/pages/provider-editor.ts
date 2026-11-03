/**
 * 保存后回填的纯逻辑：secret 保存失败时，必须保留用户已输入的密钥与
 * 未保存的修改（dirty），否则重试会丢失密钥提交。
 */

import type { ConfigSchema } from "@shared/ipc";

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
