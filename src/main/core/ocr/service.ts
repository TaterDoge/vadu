/**
 * OCR 编排：把渲染层请求映射为插件调用，一次返回整图文本。
 * 不走事件通道：recognize 是请求-响应，超时由宿主兜底。
 */

import { VaduError } from "../../../shared/errors";
import type { OcrParams, OcrResult } from "../../../shared/ipc";
import type { OcrRequest } from "../../../shared/plugin";
import { readProfiles } from "../config/store";
import { hostRecognize } from "../plugin/host";
import { registry } from "../plugin/registry";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function recognize(params: OcrParams): Promise<OcrResult> {
  const profiles = readProfiles();
  const ocrPluginIds = new Set(
    registry
      .list()
      .filter((entry) => entry.kind === "ocr")
      .map((entry) => entry.id)
  );
  const profile = params.profileId
    ? profiles.find((entry) => entry.id === params.profileId)
    : profiles.find(
        (entry) => entry.enabled && ocrPluginIds.has(entry.pluginId)
      );
  if (!profile) {
    throw new VaduError("INVALID_CONFIG", "未配置可用的识别服务商");
  }
  const plugin = registry.getOcr(profile.pluginId);
  if (!plugin) {
    throw new VaduError("INVALID_CONFIG", "该 profile 不属于 ocr 插件");
  }
  if (!profile.enabled) {
    throw new VaduError("INVALID_CONFIG", "该服务商已停用");
  }
  if (!registry.isReady(profile.pluginId)) {
    throw new VaduError("PLUGIN_LOAD_FAILED", "识别插件未就绪");
  }
  if (params.image.byteLength === 0) {
    throw new VaduError("INVALID_CONFIG", "图片为空");
  }
  if (params.image.byteLength > MAX_IMAGE_BYTES) {
    throw new VaduError("INVALID_CONFIG", "图片超过 10MB 上限");
  }
  const req: OcrRequest = {
    config: profile.config,
    image: { data: params.image, mimeType: params.mimeType },
    language: params.language,
  };
  const result = await hostRecognize({
    create: plugin.create,
    pluginId: profile.pluginId,
    profile,
    req,
  });
  return result;
}
