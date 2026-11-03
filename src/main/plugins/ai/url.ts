/**
 * 插件内侧 url 工具：只做拼接与防御性归一化，不承担校验。
 * 合法性校验在 core 保存 profile 时已做，插件这里只是兜底。
 */

const TRAILING_SLASH_RE = /\/+$/;
const CHAT_COMPLETIONS_SUFFIX = "/chat/completions";

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim());
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
