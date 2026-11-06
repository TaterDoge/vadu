import type { PluginConfig } from "../../../shared/plugin";

export const PROTOCOLS = ["openai", "anthropic", "gemini"] as const;

export type Protocol = (typeof PROTOCOLS)[number];

/** 老 profile 没有 protocol 字段：与 schema 默认值一致，回落 openai */
export function protocolOf(config: PluginConfig): Protocol {
  const raw = config.protocol;
  return PROTOCOLS.find((protocol) => protocol === raw) ?? "openai";
}
