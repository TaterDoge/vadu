/**
 * 插件内侧 url 工具：只做拼接与防御性归一化，不承担校验。
 * 合法性校验在 core 保存 profile 时已做，插件这里只是兜底。
 */

const TRAILING_SLASH_RE = /\/+$/;
const CHAT_COMPLETIONS_SUFFIX = "/chat/completions";

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

function normalizeBaseUrl(input: string): string {
  const url = parseBase(input);
  let pathname = url.pathname.replace(TRAILING_SLASH_RE, "");
  if (pathname.endsWith(CHAT_COMPLETIONS_SUFFIX)) {
    pathname = pathname.slice(0, -CHAT_COMPLETIONS_SUFFIX.length);
  }
  return `${url.origin}${pathname}${url.search}`;
}

export function buildChatCompletionUrl(base: string): string {
  const url = parseBase(normalizeBaseUrl(base));
  url.pathname = `${url.pathname.replace(TRAILING_SLASH_RE, "")}${CHAT_COMPLETIONS_SUFFIX}`;
  return url.toString();
}

export function buildModelsUrl(base: string): string {
  const url = parseBase(normalizeBaseUrl(base));
  url.pathname = `${url.pathname.replace(TRAILING_SLASH_RE, "")}/models`;
  return url.toString();
}
