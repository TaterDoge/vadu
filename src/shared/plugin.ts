/**
 * 插件公共契约。形态与语义以 docs/plugin-spec.md 为准，两侧只允许在这份定义。
 * apiVersion 主版本不匹配即拒绝加载，不做运行时适配。
 */

export const PLUGIN_API_VERSION = 2;

/** 能力种类：宿主按 kind 只调用对应接口 */
export type PluginKind = "translator" | "ocr" | "tts";

export type PluginConfig = Record<string, unknown>;

/** 三种能力共有的生命周期钩子 */
export type PluginBase = {
  dispose?: () => void | Promise<void>;
  validateConfig?: (
    config: PluginConfig,
    runtime: PluginRuntime
  ) => Promise<void>;
};

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

export type TranslatorPlugin = PluginBase & {
  listModels?: (
    config: PluginConfig,
    runtime: PluginRuntime
  ) => Promise<ModelInfo[]>;
  translate: (
    req: TranslateRequest,
    opts: CallOptions
  ) => AsyncIterable<string>;
};

export type OcrRequest = {
  config: PluginConfig;
  image: { data: Uint8Array; mimeType: string };
  language?: string;
};

export type OcrResult = {
  text: string;
};

export type OcrPlugin = PluginBase & {
  recognize: (req: OcrRequest, opts: CallOptions) => Promise<OcrResult>;
};

export type TtsRequest = {
  config: PluginConfig;
  text: string;
  language?: string;
};

export type TtsResult = {
  audio: Uint8Array;
  mimeType: string;
};

export type TtsPlugin = PluginBase & {
  synthesize: (req: TtsRequest, opts: CallOptions) => Promise<TtsResult>;
};

export type VaduPlugin = TranslatorPlugin | OcrPlugin | TtsPlugin;
