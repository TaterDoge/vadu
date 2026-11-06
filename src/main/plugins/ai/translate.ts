/**
 * 一个插件覆盖三种协议：请求编码与流解析交给 AI SDK，插件只做
 * profile → provider 的装配、错误码归一，保证「换厂商不改代码」。
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type JSONValue, type LanguageModel, streamText } from "ai";

import type {
  CallOptions,
  PluginConfig,
  PluginRuntime,
  TranslateRequest,
} from "../../../shared/plugin";
import {
  coded,
  extractErrorCode,
  isRecord,
  mapHttpError,
  parseBody,
} from "./errors";
import { customRequestHeaders } from "./headers";
import { buildMessages } from "./prompt";
import type { Protocol } from "./protocol";
import { normalizeBaseUrl } from "./url";

const OPENAI_COMPATIBLE_NAME = "custom";
const DEFAULT_TEMPERATURE = 0.3;

/**
 * 受控 fetch 只接受字符串 URL：宿主侧白名单校验按 origin 判定，
 * SDK 也可能传 Request/URL，统一收窄成 string 再发。
 */
function guardedFetch(runtime: PluginRuntime): typeof fetch {
  return (input, init) => {
    if (typeof input === "string" || input instanceof URL) {
      return runtime.fetch(input.toString(), init);
    }
    const { url } = input;
    return runtime.fetch(url, init);
  };
}

function temperatureOf(config: PluginConfig): number {
  const raw = config.temperature;
  return typeof raw === "number" && Number.isFinite(raw)
    ? raw
    : DEFAULT_TEMPERATURE;
}

/** 与插件自己下发的字段同名时以插件为准（SDK 会把 providerOptions 展开在后面） */
const RESERVED_EXTRA_KEYS = new Set([
  "messages",
  "model",
  "stream",
  "temperature",
]);

function extraOf(config: PluginConfig): Record<string, JSONValue> | undefined {
  const { extra } = config;
  if (!isRecord(extra)) {
    return undefined;
  }
  // extra 已由 core 按 JSON 校验过落盘，仅做类型对齐
  const entries = Object.entries(extra).filter(
    ([key]) => !RESERVED_EXTRA_KEYS.has(key)
  );
  return entries.length > 0
    ? (Object.fromEntries(entries) as Record<string, JSONValue>)
    : undefined;
}

function buildModel(args: {
  apiKey: string;
  config: PluginConfig;
  protocol: Protocol;
  runtime: PluginRuntime;
}): LanguageModel {
  const { apiKey, config, protocol, runtime } = args;
  const baseURL = normalizeBaseUrl(String(config.baseURL ?? ""), protocol);
  const shared = {
    apiKey,
    baseURL,
    fetch: guardedFetch(runtime),
    headers: customRequestHeaders(config.headers),
  };
  const modelId = String(config.model ?? "");

  if (protocol === "anthropic") {
    return createAnthropic(shared)(modelId);
  }
  if (protocol === "gemini") {
    return createGoogleGenerativeAI(shared)(modelId);
  }
  return createOpenAICompatible({
    ...shared,
    name: OPENAI_COMPATIBLE_NAME,
  })(modelId);
}

/**
 * 上游失败 → 插件错误码。宿主受控 fetch 抛的错带 code，需原样透传，
 * 不能被当成上游失败改写。
 */
function toPluginError(error: unknown, signal: AbortSignal): Error {
  if (signal.aborted) {
    return coded("ABORTED", "已取消");
  }
  const code = (error as { code?: unknown } | undefined)?.code;
  if (code === "PERMISSION_DENIED" || code === "ABORTED") {
    return error as Error;
  }
  const status = (error as { statusCode?: unknown }).statusCode;
  if (typeof status === "number" && status >= 400) {
    return mapHttpError(
      status,
      extractErrorCode(
        parseBody((error as { responseBody?: unknown }).responseBody)
      )
    );
  }
  // SDK 对「声明 stream 却返回整包 JSON」与「流提前结束」都抛无状态码错误
  return coded("NETWORK", "上游流提前结束，请重试");
}

export async function* translate(args: {
  runtime: PluginRuntime;
  req: TranslateRequest;
  opts: CallOptions;
  apiKey: string;
  protocol: Protocol;
}): AsyncGenerator<string> {
  const { runtime, req, opts, apiKey, protocol } = args;
  const extra = protocol === "openai" ? extraOf(req.config) : undefined;
  const result = streamText({
    abortSignal: opts.signal,
    // system 提示词是常量，只有原文走 user 消息，因此允许 messages 里带 system
    allowSystemInMessages: true,
    // SDK 默认重试 2 次：流式重来会闪烁、部分厂商重复计费
    maxRetries: 0,
    messages: buildMessages(req),
    model: buildModel({ apiKey, config: req.config, protocol, runtime }),
    // SDK 默认把每个上游错误 console.error 一遍；错误由 fullStream 的 error 分片处理
    onError: () => undefined,
    ...(extra ? { providerOptions: { [OPENAI_COMPATIBLE_NAME]: extra } } : {}),
    temperature: temperatureOf(req.config),
  });

  // textStream 会把上游错误静默吞掉（空译文当成功），必须走 fullStream
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      yield part.text;
      continue;
    }
    if (part.type === "error") {
      throw toPluginError(part.error, opts.signal);
    }
  }
}
