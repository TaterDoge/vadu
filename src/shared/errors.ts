/**
 * 跨进程错误契约。码集合与语义见 docs/plugin-spec.md §7，新增码是破坏性变更。
 * 渲染层按 code 决定文案与是否显示重试，不解析 message。
 */

export type PluginErrorCode =
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "NETWORK"
  | "TIMEOUT"
  | "INVALID_CONFIG"
  | "UNSUPPORTED_LANGUAGE"
  | "PERMISSION_DENIED"
  | "PLUGIN_LOAD_FAILED"
  | "PLUGIN_CRASH"
  | "ABORTED"
  | "INTERNAL";

/** 与 docs/plugin-spec.md 一致：网络类可重试，认证、入参、取消类不可 */
const DEFAULT_RETRYABLE: Record<PluginErrorCode, boolean> = {
  ABORTED: false,
  AUTH_FAILED: false,
  INTERNAL: false,
  INVALID_CONFIG: false,
  NETWORK: true,
  PERMISSION_DENIED: false,
  PLUGIN_CRASH: false,
  PLUGIN_LOAD_FAILED: false,
  RATE_LIMITED: true,
  TIMEOUT: true,
  UNSUPPORTED_LANGUAGE: false,
};

export type SerializedError = {
  code: PluginErrorCode;
  message: string;
  pluginId?: string;
  retryable: boolean;
};

/** 需要错误码穿过 IPC 时抛它；普通 Error 一律降级成 INTERNAL */
export class VaduError extends Error {
  readonly code: PluginErrorCode;
  readonly pluginId?: string;
  readonly retryable: boolean;

  constructor(
    code: PluginErrorCode,
    message: string,
    options: { pluginId?: string; retryable?: boolean } = {}
  ) {
    super(message);
    this.name = "VaduError";
    this.code = code;
    this.pluginId = options.pluginId;
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE[code];
  }
}

export function toSerializedError(error: unknown): SerializedError {
  if (error instanceof VaduError) {
    return {
      code: error.code,
      message: error.message,
      pluginId: error.pluginId,
      retryable: error.retryable,
    };
  }
  return {
    code: "INTERNAL",
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
  };
}
