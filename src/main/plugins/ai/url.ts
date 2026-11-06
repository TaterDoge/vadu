/**
 * 插件内侧 url 工具：只做拼接与防御性归一化，不承担校验。
 * 合法性校验在 core 保存 profile 时已做，插件这里只是兜底。
 */

import type { Protocol } from "./protocol";

const TRAILING_SLASH_RE = /\/+$/;

/** 用户常直接粘贴完整端点地址，按协议剥掉已存在的路径后缀 */
const ENDPOINT_SUFFIX: Record<Protocol, string> = {
  anthropic: "/messages",
  gemini: "/models",
  openai: "/chat/completions",
};

function parseBase(input: string): URL {
  try {
    return new URL(input.trim());
  } catch (cause) {
    throw Object.assign(new Error("接口地址不是合法 URL"), {
      cause,
      code: "INVALID_CONFIG",
    });
  }
}

export function normalizeBaseUrl(input: string, protocol: Protocol): string {
  const url = parseBase(input);
  let pathname = url.pathname.replace(TRAILING_SLASH_RE, "");
  const suffix = ENDPOINT_SUFFIX[protocol];
  if (pathname.endsWith(suffix)) {
    pathname = pathname.slice(0, -suffix.length);
  }
  return `${url.origin}${pathname}${url.search}`;
}

export function buildModelsUrl(base: string): string {
  const url = parseBase(normalizeBaseUrl(base, "openai"));
  url.pathname = `${url.pathname.replace(TRAILING_SLASH_RE, "")}/models`;
  return url.toString();
}
