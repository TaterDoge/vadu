import type {
  CallOptions,
  ModelInfo,
  PluginConfig,
  PluginRuntime,
  TranslateRequest,
} from "../../../../shared/plugin";
import { buildMessages } from "../prompt";
import { buildChatCompletionUrl, normalizeBaseUrl } from "../url";

/**
 * OpenAI /chat/completions 适配器。一次调用本体：
 * 流式按 SSE 帧逐 delta yield；非流式降级为单次 yield。
 */

type ChatDelta = { content?: string | null; finish_reason?: string | null };

type ChatChoice = {
  delta?: ChatDelta;
  message?: ChatDelta;
  finish_reason?: string | null;
};

type ChatResponse = {
  choices?: ChatChoice[];
  error?: { code?: string; message?: string };
};

type CodedError = Error & { code?: string; status?: number };

function coded(code: string, message: string, status?: number): CodedError {
  const error: CodedError = new Error(message);
  error.code = code;
  if (status !== undefined) {
    error.status = status;
  }
  return error;
}

/** 机器可读错误码白名单：短、无凭据、无原文；其余一律丢弃只留状态码 */
const ERROR_CODE_RE = /^[a-z0-9_.-]{1,64}$/i;
const DATA_PREFIX_SPACE_RE = /^ /;

function extractErrorCode(body: ChatResponse | undefined): string | undefined {
  const code = body?.error?.code;
  return typeof code === "string" && ERROR_CODE_RE.test(code)
    ? code
    : undefined;
}

function mapHttpError(status: number, code?: string): CodedError {
  if (status === 401 || status === 403) {
    return coded("AUTH_FAILED", "认证失败，请检查 API Key", status);
  }
  if (status === 429) {
    return coded("RATE_LIMITED", "请求过于频繁或配额超限", status);
  }
  if (status === 404) {
    return coded(
      "INVALID_CONFIG",
      "接口或模型不存在，请检查 baseURL 与模型名",
      status
    );
  }
  return coded(
    "INTERNAL",
    code ? `上游返回错误：${code}` : `上游返回状态 ${status}`,
    status
  );
}

/** SSE error 帧：只映射机器可读错误码，不携带上游原文 */
const QUOTA_RE = /quota|rate_limit|insufficient/i;
const AUTH_RE = /auth|api_key|invalid_key/i;
const MODEL_RE = /model|not_found/i;

function mapSseError(code: string | undefined): CodedError {
  if (code && QUOTA_RE.test(code)) {
    return coded("RATE_LIMITED", "请求过于频繁或配额超限");
  }
  if (code && AUTH_RE.test(code)) {
    return coded("AUTH_FAILED", "认证失败，请检查 API Key");
  }
  if (code && MODEL_RE.test(code)) {
    return coded("INVALID_CONFIG", "模型或接口不存在，请检查配置");
  }
  return coded("INTERNAL", code ? `上游流返回错误：${code}` : "上游流返回错误");
}

async function readErrorBody(res: Response): Promise<ChatResponse | undefined> {
  try {
    const text = await res.text();
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object"
      ? (parsed as ChatResponse)
      : undefined;
  } catch {
    return undefined;
  }
}

/** 上游 body 流统一转 AsyncIterable<Uint8Array> */
function bodyIterable(
  body: ReadableStream<Uint8Array> | null
): AsyncIterable<Uint8Array> {
  if (!body) {
    throw coded("INTERNAL", "上游未返回响应体");
  }
  return body as AsyncIterable<Uint8Array>;
}

type ParserCtx = {
  dataLines: string[];
  finished: boolean;
};

function feedLine(line: string, ctx: ParserCtx): string | null {
  if (ctx.finished) {
    return null;
  }
  if (line.startsWith("data:")) {
    ctx.dataLines.push(line.slice(5).replace(DATA_PREFIX_SPACE_RE, ""));
    return null;
  }
  if (line !== "") {
    return null;
  }
  if (ctx.dataLines.length === 0) {
    return null;
  }
  const data = ctx.dataLines.join("\n");
  ctx.dataLines = [];
  if (data === "[DONE]") {
    ctx.finished = true;
    return null;
  }
  let parsed: ChatResponse;
  try {
    parsed = JSON.parse(data) as ChatResponse;
  } catch (cause) {
    throw Object.assign(coded("NETWORK", "上游流数据不完整或无法解析"), {
      cause,
    });
  }
  if (parsed.error) {
    throw mapSseError(extractErrorCode(parsed));
  }
  const choice = parsed.choices?.[0];
  if (!choice) {
    return null;
  }
  if (choice.finish_reason) {
    ctx.finished = true;
  }
  const content = choice.delta?.content ?? choice.message?.content;
  return content && content.length > 0 ? content : null;
}

/** 找行尾：\n / \r\n / \r，返回 [行起点, 消费长度] */
function findLineEnd(
  buffer: string
): { lineEnd: number; consume: number } | null {
  for (let index = 0; index < buffer.length; index += 1) {
    const char = buffer[index];
    if (char === "\n") {
      return { consume: index + 1, lineEnd: index };
    }
    if (char === "\r") {
      if (index === buffer.length - 1) {
        return null;
      }
      return {
        consume: index + (buffer[index + 1] === "\n" ? 2 : 1),
        lineEnd: index,
      };
    }
  }
  return null;
}

/**
 * SSE 解析。处理跨 chunk 截断、CRLF、多行 data、[DONE]、
 * finish_reason、截断和 error 帧抛错。
 */
export async function* parseOpenAiSse(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal
): AsyncGenerator<string> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const ctx: ParserCtx = { dataLines: [], finished: false };
  let buffer = "";

  for await (const chunk of bodyIterable(body)) {
    if (signal.aborted) {
      throw coded("ABORTED", "已取消");
    }
    buffer += decoder.decode(chunk, { stream: true });
    for (;;) {
      const lineEnd = findLineEnd(buffer);
      if (!lineEnd) {
        break;
      }
      const line = buffer.slice(0, lineEnd.lineEnd);
      buffer = buffer.slice(lineEnd.consume);
      const content = feedLine(line, ctx);
      if (content !== null) {
        signal.throwIfAborted();
        yield content;
      }
      if (ctx.finished) {
        return;
      }
    }
  }

  if (signal.aborted) {
    throw coded("ABORTED", "已取消");
  }
  buffer += decoder.decode();
  if (buffer.endsWith("\r")) {
    buffer = buffer.slice(0, -1);
  }
  if (buffer.length > 0) {
    feedLine(buffer, ctx);
  }
  const trailing = feedLine("", ctx);
  if (trailing !== null) {
    yield trailing;
  }
  if (!ctx.finished) {
    throw coded("NETWORK", "上游流提前结束，请重试");
  }
}

export async function openAiListModels(args: {
  apiKey: string;
  config: PluginConfig;
  runtime: PluginRuntime;
}): Promise<ModelInfo[]> {
  const { apiKey, config, runtime } = args;
  const url = new URL(normalizeBaseUrl(String(config.baseURL ?? "")));
  url.pathname = `${url.pathname}/models`;
  const response = await runtime.fetch(url.toString(), {
    headers: { authorization: `Bearer ${apiKey}` },
    method: "GET",
  });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw mapHttpError(response.status, extractErrorCode(body));
  }
  let data: { data?: unknown };
  try {
    data = (await response.json()) as { data?: unknown };
  } catch (cause) {
    throw Object.assign(coded("INTERNAL", "上游返回了无法解析的响应"), {
      cause,
    });
  }
  if (!Array.isArray(data.data)) {
    throw coded("INVALID_CONFIG", "上游响应缺少模型列表");
  }
  const models: ModelInfo[] = [];
  for (const item of data.data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const { id, label } = item as { id?: unknown; label?: unknown };
    if (typeof id !== "string" || id === "") {
      continue;
    }
    models.push({
      id,
      label: typeof label === "string" && label !== "" ? label : id,
    });
    if (models.length >= 200) {
      break;
    }
  }
  return models;
}

export async function* openAiTranslate(args: {
  runtime: PluginRuntime;
  req: TranslateRequest;
  opts: CallOptions;
  apiKey: string;
}): AsyncGenerator<string> {
  const { runtime, req, opts, apiKey } = args;
  const url = buildChatCompletionUrl(String(req.config.baseURL ?? ""));
  const response = await runtime.fetch(url, {
    body: JSON.stringify({
      messages: buildMessages(req),
      model: String(req.config.model ?? ""),
      stream: true,
      temperature: 0.3,
    }),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
    signal: opts.signal,
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw mapHttpError(response.status, extractErrorCode(body));
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    yield* parseOpenAiSse(response.body, opts.signal);
    return;
  }

  // 非流式兼容：对方声明 stream 但仍直接返回完整 JSON
  let data: ChatResponse;
  try {
    data = (await response.json()) as ChatResponse;
  } catch (error) {
    throw Object.assign(coded("INTERNAL", "上游返回了无法解析的响应"), {
      cause: error,
    });
  }
  if (data.error) {
    throw mapSseError(extractErrorCode(data));
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.length > 0) {
    yield content;
  }
}
