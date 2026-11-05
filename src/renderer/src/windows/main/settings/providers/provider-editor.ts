import type {
  ConfigField,
  ConfigSchema,
  ModelInfo,
  PluginDescriptor,
  Profile,
} from "@shared/ipc";

export type FilterState = "all" | "enabled" | "disabled";

export type SecretRetryEditor = {
  secrets: Record<string, string>;
};

/**
 * 保存后回填的纯逻辑：secret 保存失败时，必须保留用户已输入的密钥与
 * 未保存的修改（dirty），否则重试会丢失密钥提交。
 */
export function mergeSecretRetry<T extends SecretRetryEditor>(
  current: T,
  saved: T
): T {
  return { ...saved, secrets: current.secrets };
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

type DefaultValue = string | number | boolean | Record<string, unknown>;

export type EditorState = {
  name: string;
  pluginId: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  jsonText: Record<string, string>;
};

export const EMPTY_EDITOR: EditorState = {
  config: {},
  jsonText: {},
  name: "",
  pluginId: "",
  secrets: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultFor(field: ConfigField): DefaultValue | undefined {
  switch (field.type) {
    case "string":
      return typeof field.default === "string" ? field.default : "";
    case "number":
      return typeof field.default === "number" ? field.default : undefined;
    case "boolean":
      return typeof field.default === "boolean" ? field.default : undefined;
    case "json":
      return isRecord(field.default) ? field.default : undefined;
    default:
      return undefined;
  }
}

function jsonDefault(field: ConfigField): string {
  const fallback =
    field.type === "json" && isRecord(field.default) ? field.default : null;
  return fallback ? JSON.stringify(fallback, null, 2) : "";
}

export function editorFromProfile(
  profile: Profile | null,
  plugin: PluginDescriptor | null
): EditorState {
  const schema = plugin?.configSchema;
  const config: Record<string, unknown> = {};
  const jsonText: Record<string, string> = {};
  for (const [key, field] of Object.entries(schema?.properties ?? {})) {
    if (field.type === "secret") {
      continue;
    }
    if (field.type === "json") {
      const saved = profile?.config[key];
      jsonText[key] = isRecord(saved)
        ? JSON.stringify(saved, null, 2)
        : jsonDefault(field);
      continue;
    }
    const saved = profile?.config[key];
    if (saved === undefined) {
      const fallback = defaultFor(field);
      if (fallback !== undefined) {
        config[key] = fallback;
      }
    } else {
      config[key] = saved;
    }
  }
  return {
    config,
    jsonText,
    name: profile?.name ?? "",
    pluginId: plugin?.id ?? "",
    secrets: {},
  };
}

export function secretFieldNames(schema: ConfigSchema | undefined): string[] {
  return Object.entries(schema?.properties ?? {})
    .filter(([, field]) => field.type === "secret")
    .map(([key]) => key);
}

export function isDirty(editor: EditorState, baseline: EditorState): boolean {
  if (editor.name !== baseline.name) {
    return true;
  }
  const keys = new Set([
    ...Object.keys(baseline.config),
    ...Object.keys(editor.config),
    ...Object.keys(baseline.jsonText),
    ...Object.keys(editor.jsonText),
  ]);
  for (const key of keys) {
    if (editor.config[key] !== baseline.config[key]) {
      return true;
    }
    if (editor.jsonText[key] !== baseline.jsonText[key]) {
      return true;
    }
  }
  return Object.values(editor.secrets).some((value) => value !== "");
}

export function buildConfigPayload(
  editor: EditorState,
  schema: ConfigSchema | undefined
): { config: Record<string, unknown>; error?: string } {
  const config: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema?.properties ?? {})) {
    if (field.type === "secret") {
      continue;
    }
    if (field.type === "json") {
      const text = editor.jsonText[key] ?? "";
      if (text.trim() === "") {
        continue;
      }
      try {
        config[key] = JSON.parse(text) as unknown;
      } catch {
        return { config, error: `${field.title ?? key} 不是合法 JSON` };
      }
      continue;
    }
    const value = editor.config[key];
    if (
      value === undefined ||
      (typeof value === "number" && Number.isNaN(value))
    ) {
      continue;
    }
    config[key] = value;
  }
  return { config };
}

export function buildSavePayload(
  editor: EditorState,
  existing: Profile | null,
  config: Record<string, unknown>
): Profile {
  return {
    allowedOrigins: [],
    config,
    createdAt: existing?.createdAt ?? Date.now(),
    enabled: existing?.enabled ?? true,
    id: existing?.id ?? "",
    name: editor.name.trim(),
    pluginId: editor.pluginId,
  };
}
