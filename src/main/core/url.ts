/**
 * baseURL 归一化（core 侧）：仅 http/https；拒绝凭据与片段；去尾斜杠；
 * 剥离用户直接粘贴的 /chat/completions 后缀（文档：常见粘贴错误）。
 */

import { VaduError } from "../../shared/errors";

const SCHEME_RE = /^https?:\/\//i;
const TRAILING_SLASH_RE = /\/+$/;
const CHAT_COMPLETIONS_SUFFIX = "/chat/completions";

export class InvalidBaseUrlError extends VaduError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("INVALID_CONFIG", message, options);
  }
}

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length > 2000 || !SCHEME_RE.test(trimmed)) {
    throw new InvalidBaseUrlError("接口地址必须以 http:// 或 https:// 开头");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (error) {
    throw new InvalidBaseUrlError("接口地址不是合法 URL", { cause: error });
  }
  if (url.username || url.password) {
    throw new InvalidBaseUrlError("接口地址不能包含用户名或密码");
  }
  if (url.hash) {
    throw new InvalidBaseUrlError("接口地址不能包含片段（#）");
  }
  let pathname = url.pathname.replace(TRAILING_SLASH_RE, "");
  if (pathname.endsWith(CHAT_COMPLETIONS_SUFFIX)) {
    pathname = pathname.slice(0, -CHAT_COMPLETIONS_SUFFIX.length);
  }
  return `${url.origin}${pathname}${url.search}`;
}

export function buildChatCompletionUrl(base: string): string {
  const url = new URL(normalizeBaseUrl(base));
  url.pathname = `${url.pathname.replace(TRAILING_SLASH_RE, "")}${CHAT_COMPLETIONS_SUFFIX}`;
  return url.toString();
}

export function originOf(baseUrl: string): string {
  return new URL(baseUrl).origin;
}
