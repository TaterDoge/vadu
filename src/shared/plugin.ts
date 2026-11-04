/**
 * 插件公共契约。形态与语义以 docs/plugin-spec.md 为准，两侧只允许在这份定义。
 * apiVersion 主版本不匹配即拒绝加载，不做运行时适配。
 */

export const PLUGIN_API_VERSION = 2;

export type PluginConfig = Record<string, unknown>;

export type TranslateRequest = {
  config: PluginConfig;
  glossary?: { from: string; to: string }[];
  source: string;
  target: string;
  text: string;
  tone?: "default" | "formal" | "casual";
};

export type CallOptions = {
  requestId: string;
  signal: AbortSignal;
};

export type PluginRuntime = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  log: {
    debug: (message: string, meta?: Record<string, unknown>) => void;
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
  secrets: {
    get: (name: string) => string | undefined;
    has: (name: string) => boolean;
  };
};

export type ModelInfo = {
  id: string;
  label?: string;
};

export type TranslatorPlugin = {
  dispose?: () => void | Promise<void>;
  listModels?: (
    config: PluginConfig,
    runtime: PluginRuntime
  ) => Promise<ModelInfo[]>;
  translate: (
    req: TranslateRequest,
    opts: CallOptions
  ) => AsyncIterable<string>;
  validateConfig?: (
    config: PluginConfig,
    runtime: PluginRuntime
  ) => Promise<void>;
};
