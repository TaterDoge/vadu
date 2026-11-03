/**
 * 按插件 configSchema 清洗并校验 profile 配置。纯函数、不碰 electron，
 * 便于单测；ipc/ 层只负责组装 Profile 与 origin 授权。
 * 规则对齐 docs/plugin-spec.md §3：secret 不入 config、未知字段忽略、
 * 类型/enum/min/max/required 违规即拒绝。
 */

import { VaduError } from "../../../shared/errors";
import type { ConfigField, ConfigSchema } from "../../../shared/ipc";

const MAX_STRING_LENGTH = 2000;

type ValidatedValue = string | number | boolean | Record<string, unknown>;

function invalid(message: string): VaduError {
  return new VaduError("INVALID_CONFIG", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(
  key: string,
  field: Extract<ConfigField, { type: "string" }>,
  claimed: unknown
): string | undefined {
  let value: string;
  if (claimed === undefined || claimed === null) {
    value = typeof field.default === "string" ? field.default : "";
  } else {
    if (typeof claimed !== "string") {
      throw invalid(`${key} 必须是字符串`);
    }
    value = claimed.trim();
  }
  if (value.length > MAX_STRING_LENGTH) {
    throw invalid(`${key} 长度超限`);
  }
  if (field.enum && value !== "" && !field.enum.includes(value)) {
    throw invalid(`${key} 取值不在允许范围`);
  }
  // 无默认值的空串不落盘，必填缺失由 required 判定
  return value === "" && field.default === undefined ? undefined : value;
}

function pickNumber(
  key: string,
  field: Extract<ConfigField, { type: "number" }>,
  claimed: unknown
): number | undefined {
  let value: number;
  if (claimed === undefined || claimed === null) {
    if (typeof field.default !== "number") {
      return undefined;
    }
    value = field.default;
  } else {
    if (typeof claimed !== "number" || !Number.isFinite(claimed)) {
      throw invalid(`${key} 必须是数字`);
    }
    value = claimed;
  }
  if (field.minimum !== undefined && value < field.minimum) {
    throw invalid(`${key} 不能小于 ${field.minimum}`);
  }
  if (field.maximum !== undefined && value > field.maximum) {
    throw invalid(`${key} 不能大于 ${field.maximum}`);
  }
  return value;
}

function pickBoolean(
  key: string,
  field: Extract<ConfigField, { type: "boolean" }>,
  claimed: unknown
): boolean | undefined {
  if (claimed === undefined || claimed === null) {
    return typeof field.default === "boolean" ? field.default : undefined;
  }
  if (typeof claimed !== "boolean") {
    throw invalid(`${key} 必须是布尔值`);
  }
  return claimed;
}

function pickJson(
  key: string,
  field: Extract<ConfigField, { type: "json" }>,
  claimed: unknown
): Record<string, unknown> | undefined {
  if (claimed === undefined || claimed === null) {
    return field.default;
  }
  if (!isRecord(claimed)) {
    throw invalid(`${key} 必须是 JSON 对象`);
  }
  return claimed;
}

function pickValue(
  field: ConfigField,
  key: string,
  claimed: unknown
): ValidatedValue | undefined {
  switch (field.type) {
    case "string":
      return pickString(key, field, claimed);
    case "number":
      return pickNumber(key, field, claimed);
    case "boolean":
      return pickBoolean(key, field, claimed);
    case "json":
      return pickJson(key, field, claimed);
    default:
      return undefined;
  }
}

export function validateConfigAgainstSchema(
  raw: unknown,
  schema: ConfigSchema | undefined
): Record<string, unknown> {
  if (!schema) {
    return {};
  }
  const input = isRecord(raw) ? raw : {};
  const out: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema.properties)) {
    // secret 值永不写入 profile.config，存在 secrets.bin 里
    if (field.type === "secret") {
      continue;
    }
    const value = pickValue(field, key, input[key]);
    if (value !== undefined) {
      out[key] = value;
    }
  }

  for (const key of schema.required ?? []) {
    const field = schema.properties[key];
    // secret 的必填由「是否已保存密钥」判定，不在 config 校验范围
    if (!field || field.type === "secret") {
      continue;
    }
    const present = out[key];
    if (
      present === undefined ||
      present === "" ||
      (typeof present === "number" && Number.isNaN(present))
    ) {
      throw invalid(`缺少必填项：${field.title ?? key}`);
    }
  }

  return out;
}
