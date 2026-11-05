import type { PluginKind } from "@shared/ipc";

/** tab 展示顺序 */
export const KIND_ORDER: PluginKind[] = ["translator", "ocr", "tts"];

export const KIND_LABEL: Record<PluginKind, string> = {
  ocr: "识别",
  translator: "翻译",
  tts: "语音",
};

export const KIND_EMPTY: Record<PluginKind, string> = {
  ocr: "没有可用的识别插件",
  translator: "没有可用的翻译插件",
  tts: "没有可用的语音插件",
};

export const KIND_ADD: Record<PluginKind, string> = {
  ocr: "新增识别服务商",
  translator: "新增翻译服务商",
  tts: "新增语音服务商",
};
