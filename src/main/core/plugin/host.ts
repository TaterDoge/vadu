/**
 * 一次翻译调用的宿主包装：构造 PluginRuntime、受控 fetch、超时、错误归一化。
 * 插件实例按调用创建：runtime.fetch 需要绑定本次 profile 已登记的 origin，
 * 主实例复用在并发调用间会串权限。
 */

import { VaduError } from "../../../shared/errors";
import type { Profile } from "../../../shared/ipc";
import type {
  CallOptions,
  ModelInfo,
  OcrPlugin,
  OcrRequest,
  OcrResult,
  PluginBase,
  PluginRuntime,
  TranslateRequest,
  TranslatorPlugin,
  TtsPlugin,
  TtsRequest,
  TtsResult,
} from "../../../shared/plugin";
import { getSecret, hasSecret } from "../config/secrets";
import { withDeadline } from "./deadline";

export const FIRST_BYTE_TIMEOUT_MS = 20_000;
export const TOTAL_TIMEOUT_MS = 120_000;
export const MODELS_TIMEOUT_MS = 30_000;
export const HEALTH_TIMEOUT_MS = 30_000;

const SECRET_PATTERNS: RegExp[] = [/sk-[A-Za-z0-9_-]+/g, /Bearer\s+\S+/g];

const SENSITIVE_KEY_RE = /auth|key|token|secret/i;

function sanitizeValue(key: string, value: string): string {
  const masked = SECRET_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, "***"),
    value
  );
  if (SENSITIVE_KEY_RE.test(key)) {
    return masked.length > 8
      ? `${masked.slice(0, 4)}****${masked.slice(-4)}`
      : "****";
  }
  return masked.length > 100
    ? `${masked.slice(0, 20)}…[${masked.length} chars]`
    : masked;
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = typeof value === "string" ? sanitizeValue(key, value) : value;
  }
  return out;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (error instanceof Object &&
      "code" in error &&
      (error as { code?: string }).code === "ABORTED")
  );
}

export function normalizePluginError(
  error: unknown,
  ctx: { callerAborted: boolean; timedOut: boolean }
): VaduError {
  // 用户取消优先：取消永远不算超时/错误
  if (ctx.callerAborted) {
    return new VaduError("ABORTED", "已取消");
  }
  if (ctx.timedOut) {
    return new VaduError("TIMEOUT", "上游长时间未响应，已超时");
  }
  if (isAbortError(error)) {
    return new VaduError("NETWORK", "上游连接意外中断，请重试");
  }
  const candidate = error instanceof Error ? error : new Error(String(error));
  const { code } = candidate as { code?: string };
  const knownCodes = new Set([
    "AUTH_FAILED",
    "RATE_LIMITED",
    "NETWORK",
    "TIMEOUT",
    "INVALID_CONFIG",
    "UNSUPPORTED_LANGUAGE",
    "PERMISSION_DENIED",
    "PLUGIN_LOAD_FAILED",
    "PLUGIN_CRASH",
    "ABORTED",
    "INTERNAL",
  ]);
  if (code && knownCodes.has(code)) {
    return new VaduError(
      code as never,
      sanitizeValue("message", candidate.message)
    );
  }
  if (candidate instanceof TypeError) {
    return new VaduError("NETWORK", "网络连接失败，请检查网络");
  }
  const { status } = candidate as { status?: number };
  if (status === 401 || status === 403) {
    return new VaduError("AUTH_FAILED", "认证失败，请检查 API Key");
  }
  if (status === 429) {
    return new VaduError("RATE_LIMITED", "请求过于频繁或配额超限");
  }
  return new VaduError("INTERNAL", sanitizeValue("message", candidate.message));
}

function makeRuntime(
  pluginId: string,
  profile: Profile,
  callSignal: AbortSignal,
  secretsOverride?: Record<string, string>
): PluginRuntime {
  return {
    fetch(input, init = {}): Promise<Response> {
      let url: URL;
      try {
        url = new URL(String(input));
      } catch (cause) {
        const error = Object.assign(new Error("插件请求 URL 不合法"), {
          cause,
          code: "PERMISSION_DENIED",
        });
        throw error;
      }
      if (!profile.allowedOrigins.includes(url.origin)) {
        const error = new Error(`未允许访问 ${url.origin}`) as Error & {
          code: string;
        };
        error.code = "PERMISSION_DENIED";
        throw error;
      }
      const allowedUrl = url.toString();
      // 宿主 signal 总是参与组合：插件传入的 signal 不能覆盖取消/超时
      const composed = init.signal
        ? AbortSignal.any([callSignal, init.signal])
        : callSignal;
      return fetch(allowedUrl, {
        ...init,
        redirect: "error",
        signal: composed,
      });
    },
    log: {
      debug: (message, meta = {}) =>
        console.debug(`[plugin:${pluginId}] ${message}`, sanitizeMeta(meta)),
      error: (message, meta = {}) =>
        console.error(`[plugin:${pluginId}] ${message}`, sanitizeMeta(meta)),
      info: (message, meta = {}) =>
        console.info(`[plugin:${pluginId}] ${message}`, sanitizeMeta(meta)),
      warn: (message, meta = {}) =>
        console.warn(`[plugin:${pluginId}] ${message}`, sanitizeMeta(meta)),
    },
    secrets: {
      // 本次调用的覆盖表（如草稿表单输入的未保存密钥）优先，其余回落已保存桶
      get: (name) =>
        secretsOverride && Object.hasOwn(secretsOverride, name)
          ? secretsOverride[name]
          : getSecret(profile.id, name),
      has: (name) =>
        secretsOverride && Object.hasOwn(secretsOverride, name)
          ? true
          : hasSecret(profile.id, name),
    },
  };
}

/** 一次性调用共享包装：创建实例 → deadline 竞速 → 错误归一化 → dispose 不阻塞 */
async function runPluginCall<TPlugin extends PluginBase, TResult>(args: {
  create: (runtime: PluginRuntime) => TPlugin;
  pluginId: string;
  profile: Profile;
  secrets?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs: number;
  deadlineMessage: string;
  run: (
    plugin: TPlugin,
    runtime: PluginRuntime,
    signal: AbortSignal
  ) => Promise<TResult>;
}): Promise<TResult> {
  const {
    create,
    pluginId,
    profile,
    secrets,
    signal: callerSignal,
    timeoutMs,
    deadlineMessage,
    run,
  } = args;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, deadline])
    : deadline;
  const runtime = makeRuntime(pluginId, profile, signal, secrets);
  const callerAborted = (): boolean => callerSignal?.aborted === true;
  let plugin: TPlugin;
  try {
    plugin = create(runtime);
  } catch (error) {
    throw normalizePluginError(error, {
      callerAborted: callerAborted(),
      timedOut: false,
    });
  }
  try {
    // 竞速截止：插件 Promise 长期挂起（不理会 signal）也必须 settle
    return await withDeadline(
      Promise.resolve().then(() => run(plugin, runtime, signal)),
      timeoutMs,
      deadlineMessage
    );
  } catch (error) {
    throw normalizePluginError(error, {
      callerAborted: callerAborted(),
      timedOut: !callerAborted() && deadline.aborted,
    });
  } finally {
    // 清理不阻塞返回：dispose 挂起或抛错均不影响本次请求完成
    Promise.resolve()
      .then(() => plugin.dispose?.())
      .catch(() => {
        console.error(`[plugin:${pluginId}] dispose 失败`);
      });
  }
}

export function hostListModels(args: {
  create: (runtime: PluginRuntime) => TranslatorPlugin;
  config: Record<string, unknown>;
  pluginId: string;
  profile: Profile;
  requestId: string;
  secrets?: Record<string, string>;
  timeoutMs?: number;
}): Promise<ModelInfo[]> {
  const {
    create,
    config,
    pluginId,
    profile,
    secrets,
    timeoutMs = MODELS_TIMEOUT_MS,
  } = args;
  return runPluginCall({
    create,
    deadlineMessage: "获取模型列表超时",
    pluginId,
    profile,
    run: (plugin, runtime) => {
      const listModels = plugin.listModels?.bind(plugin);
      if (typeof listModels !== "function") {
        throw new VaduError("INVALID_CONFIG", "该插件不支持获取模型列表");
      }
      return listModels(config, runtime);
    },
    secrets,
    timeoutMs,
  });
}

export function hostProbeTranslate(args: {
  create: (runtime: PluginRuntime) => TranslatorPlugin;
  pluginId: string;
  profile: Profile;
  req: TranslateRequest;
  requestId: string;
  secrets?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<{ hasOutput: boolean }> {
  const {
    create,
    pluginId,
    profile,
    req,
    requestId,
    secrets,
    signal,
    timeoutMs = HEALTH_TIMEOUT_MS,
  } = args;
  return runPluginCall({
    create,
    deadlineMessage: "健康检测超时",
    pluginId,
    profile,
    run: async (plugin, _runtime, callSignal) => {
      let hasOutput = false;
      // 不累积正文：健康检测只判定是否完整返回过非空内容
      for await (const delta of plugin.translate(req, {
        requestId,
        signal: callSignal,
      })) {
        if (delta.trim() !== "") {
          hasOutput = true;
        }
      }
      return { hasOutput };
    },
    secrets,
    signal,
    timeoutMs,
  });
}

export function hostSynthesize(args: {
  create: (runtime: PluginRuntime) => TtsPlugin;
  pluginId: string;
  profile: Profile;
  req: TtsRequest;
  secrets?: Record<string, string>;
}): Promise<TtsResult> {
  const { create, pluginId, profile, req, secrets } = args;
  return runPluginCall({
    create,
    deadlineMessage: "语音合成超时",
    pluginId,
    profile,
    run: (plugin, _runtime, signal) =>
      plugin.synthesize(req, { requestId: crypto.randomUUID(), signal }),
    secrets,
    timeoutMs: TOTAL_TIMEOUT_MS,
  });
}

export function hostRecognize(args: {
  create: (runtime: PluginRuntime) => OcrPlugin;
  pluginId: string;
  profile: Profile;
  req: OcrRequest;
  secrets?: Record<string, string>;
}): Promise<OcrResult> {
  const { create, pluginId, profile, req, secrets } = args;
  return runPluginCall({
    create,
    deadlineMessage: "识别超时",
    pluginId,
    profile,
    run: (plugin, _runtime, signal) =>
      plugin.recognize(req, { requestId: crypto.randomUUID(), signal }),
    secrets,
    timeoutMs: TOTAL_TIMEOUT_MS,
  });
}

export async function* hostTranslate(args: {
  create: (runtime: PluginRuntime) => TranslatorPlugin;
  pluginId: string;
  profile: Profile;
  req: TranslateRequest;
  opts: CallOptions;
}): AsyncIterable<string> {
  const { create, pluginId, profile, req, opts } = args;
  const deadline = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  const owner = new AbortController();
  const signal = AbortSignal.any([opts.signal, deadline, owner.signal]);

  let gotFirstOutput = false;
  // 首输出超时：20s 内未吐出第一个 delta 视为超时（用户可见的「卡住」）
  const firstOutputTimer = setTimeout(() => {
    if (!gotFirstOutput) {
      owner.abort();
    }
  }, FIRST_BYTE_TIMEOUT_MS);

  let plugin: TranslatorPlugin;
  try {
    plugin = create(makeRuntime(pluginId, profile, signal));
  } catch (error) {
    clearTimeout(firstOutputTimer);
    throw normalizePluginError(error, {
      callerAborted: opts.signal.aborted,
      timedOut: false,
    });
  }

  try {
    for await (const delta of plugin.translate(req, {
      requestId: opts.requestId,
      signal,
    })) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (!gotFirstOutput && delta.length > 0) {
        gotFirstOutput = true;
        clearTimeout(firstOutputTimer);
      }
      yield delta;
    }
  } catch (error) {
    throw normalizePluginError(error, {
      callerAborted: opts.signal.aborted,
      timedOut: !opts.signal.aborted && signal.aborted,
    });
  } finally {
    clearTimeout(firstOutputTimer);
    try {
      await plugin.dispose?.();
    } catch {
      console.error(`[plugin:${pluginId}] dispose 失败`);
    }
  }
}
