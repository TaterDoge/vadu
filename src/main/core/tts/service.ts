/**
 * 语音合成编排：把渲染层请求映射为插件调用，一次返回完整音频。
 * 不走事件通道：synthesize 是请求-响应，超时由宿主兜底。
 */

import { VaduError } from "../../../shared/errors";
import type { TtsParams, TtsPayload } from "../../../shared/ipc";
import type { TtsRequest } from "../../../shared/plugin";
import { readProfiles } from "../config/store";
import { hostSynthesize } from "../plugin/host";
import { registry } from "../plugin/registry";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function synthesize(params: TtsParams): Promise<TtsPayload> {
  const profiles = readProfiles();
  const ttsPluginIds = new Set(
    registry
      .list()
      .filter((entry) => entry.kind === "tts")
      .map((entry) => entry.id)
  );
  const profile = params.profileId
    ? profiles.find((entry) => entry.id === params.profileId)
    : profiles.find(
        (entry) => entry.enabled && ttsPluginIds.has(entry.pluginId)
      );
  if (!profile) {
    throw new VaduError("INVALID_CONFIG", "未配置可用的语音服务商");
  }
  const plugin = registry.getTts(profile.pluginId);
  if (!plugin) {
    throw new VaduError("INVALID_CONFIG", "该 profile 不属于 tts 插件");
  }
  if (!profile.enabled) {
    throw new VaduError("INVALID_CONFIG", "该服务商已停用");
  }
  if (!registry.isReady(profile.pluginId)) {
    throw new VaduError("PLUGIN_LOAD_FAILED", "语音插件未就绪");
  }
  const req: TtsRequest = {
    config: profile.config,
    language: params.language,
    text: params.text,
  };
  const result = await hostSynthesize({
    create: plugin.create,
    pluginId: profile.pluginId,
    profile,
    req,
  });
  if (result.audio.byteLength === 0) {
    throw new VaduError("INTERNAL", "插件返回空音频");
  }
  if (result.audio.byteLength > MAX_AUDIO_BYTES) {
    throw new VaduError("INVALID_CONFIG", "音频超过 10MB 上限");
  }
  return result;
}
