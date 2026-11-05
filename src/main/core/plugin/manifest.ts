/**
 * manifest 校验（手写，不引运行时校验库）。apiVersion 主版本不匹配即拒绝。
 * 纯函数，便于单测；错误信息直接展示给用户。
 */

import type { ConfigSchema, PluginPreset } from "../../../shared/ipc";
import { PLUGIN_API_VERSION, type PluginKind } from "../../../shared/plugin";

export type PluginManifest = {
  apiVersion: number;
  id: string;
  name: string;
  version: string;
  kind: PluginKind;
  main: string;
  description?: string;
  author?: string;
  capabilities: {
    streaming: boolean;
    models: boolean;
    glossary: boolean;
    batch: boolean;
  };
  permissions: string[];
  config?: ConfigSchema;
  presets: PluginPreset[];
};

export type ManifestResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; error: string };

const ID_RE = /^[a-z0-9._-]+$/;
const MAIN_RE = /\.(js|mjs)$/;
const NET_PERM_RE = /^net:/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickCapabilities(value: unknown): PluginManifest["capabilities"] {
  const capabilities = isRecord(value) ? value : {};
  return {
    batch: capabilities.batch === true,
    glossary: capabilities.glossary === true,
    models: capabilities.models === true,
    streaming: capabilities.streaming === true,
  };
}

function pickPermissions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const permissions = value.filter(
    (entry): entry is string => typeof entry === "string"
  );
  if (
    permissions.length !== value.length ||
    !permissions.every((p) => NET_PERM_RE.test(p))
  ) {
    return undefined;
  }
  return permissions;
}

function pickPresets(value: unknown): PluginPreset[] | undefined {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const presets = value.filter(
    (entry): entry is PluginPreset =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.label === "string" &&
      isRecord(entry.config)
  );
  if (presets.length !== value.length) {
    return undefined;
  }
  return presets;
}

function pickConfig(value: unknown): ConfigSchema | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    !isRecord(value) ||
    value.type !== "object" ||
    !isRecord(value.properties)
  ) {
    return undefined;
  }
  const properties: Record<string, unknown> = Object.fromEntries(
    Object.entries(value.properties).filter(
      ([, field]) => isRecord(field) && typeof field.type === "string"
    )
  );
  return {
    properties: properties as ConfigSchema["properties"],
    required: Array.isArray(value.required)
      ? (value.required as string[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      : undefined,
    type: "object",
  };
}

export function validateManifest(raw: unknown): ManifestResult {
  if (!isRecord(raw)) {
    return { error: "manifest 必须是 JSON 对象", ok: false };
  }
  if (raw.apiVersion !== PLUGIN_API_VERSION) {
    return {
      error: `apiVersion ${String(raw.apiVersion)} 与宿主 ${PLUGIN_API_VERSION} 不匹配`,
      ok: false,
    };
  }
  if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) {
    return { error: "id 必须是小写反向域名（[a-z0-9._-]）", ok: false };
  }
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    return { error: "name 缺失", ok: false };
  }
  if (typeof raw.version !== "string" || raw.version.length === 0) {
    return { error: "version 缺失", ok: false };
  }
  if (raw.kind !== "translator" && raw.kind !== "ocr" && raw.kind !== "tts") {
    return { error: "kind 必须是 translator / ocr / tts 之一", ok: false };
  }
  if (typeof raw.main !== "string" || !MAIN_RE.test(raw.main)) {
    return { error: "main 必须是 .js 或 .mjs 相对路径", ok: false };
  }
  const permissions = pickPermissions(raw.permissions);
  if (permissions === undefined) {
    return {
      error: "permissions 必须是字符串数组，且每个以 net: 开头",
      ok: false,
    };
  }
  const presets = pickPresets(raw.presets);
  if (presets === undefined) {
    return { error: "presets 形状不合法", ok: false };
  }
  const config = pickConfig(raw.config);
  if (config === undefined && raw.config !== undefined) {
    return { error: "config schema 不合法", ok: false };
  }
  return {
    manifest: {
      apiVersion: PLUGIN_API_VERSION,
      author: typeof raw.author === "string" ? raw.author : undefined,
      capabilities: pickCapabilities(raw.capabilities),
      config,
      description:
        typeof raw.description === "string" ? raw.description : undefined,
      id: raw.id,
      kind: raw.kind,
      main: raw.main,
      name: raw.name,
      permissions,
      presets,
      version: raw.version,
    },
    ok: true,
  };
}
