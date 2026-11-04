/**
 * 用户自定义请求头清洗。名称/值不合规则或命中保留名、敏感名的一律丢弃，
 * 保证插件发出的头不会覆盖认证头或夹带换行注入。
 */

const HEADER_TOKEN_RE = /^[!#$%&'*+.^_\-`|~0-9A-Za-z]+$/;
const PRINTABLE_ASCII_RE = /^[\x20-\x7E]*$/;
const SENSITIVE_NAME_RE = /auth|api[-_]?key|token|secret|cookie/i;

const RESERVED_HEADERS = new Set([
  "accept-encoding",
  "api-key",
  "authorization",
  "connection",
  "content-length",
  "content-type",
  "cookie",
  "host",
  "origin",
  "referer",
  "set-cookie",
  "transfer-encoding",
  "user-agent",
  "x-api-key",
]);

const MAX_HEADERS = 10;
const MAX_NAME_LENGTH = 128;
const MAX_VALUE_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function customRequestHeaders(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) {
    return {};
  }
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (Object.keys(headers).length >= MAX_HEADERS) {
      break;
    }
    if (typeof value !== "string" || value === "") {
      continue;
    }
    if (name.length > MAX_NAME_LENGTH || !HEADER_TOKEN_RE.test(name)) {
      continue;
    }
    const lowerName = name.toLowerCase();
    // 下划线变体一并按保留名拒绝：部分代理会把 `_` 归一成 `-` 后再转发
    const normalizedName = lowerName.replaceAll("_", "-");
    if (
      RESERVED_HEADERS.has(lowerName) ||
      RESERVED_HEADERS.has(normalizedName) ||
      SENSITIVE_NAME_RE.test(lowerName)
    ) {
      continue;
    }
    if (value.length > MAX_VALUE_LENGTH || !PRINTABLE_ASCII_RE.test(value)) {
      continue;
    }
    headers[name] = value;
  }
  return headers;
}
