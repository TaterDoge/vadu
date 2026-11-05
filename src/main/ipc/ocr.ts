import { VaduError } from "../../shared/errors";
import { IPC, type OcrParams, type OcrResult } from "../../shared/ipc";
import { recognize } from "../core/ocr/service";
import { handle } from "./index";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Electron 结构化克隆可能把 Uint8Array 降级成 Buffer（同为 ArrayBufferView），
 * 统一归一成 Uint8Array 再交给 core。
 */
function normalizeImage(raw: unknown): Uint8Array {
  if (!ArrayBuffer.isView(raw)) {
    throw new VaduError("INVALID_CONFIG", "image 必须是二进制数据");
  }
  const view = raw as ArrayBufferView;
  if (view.byteLength === 0) {
    throw new VaduError("INVALID_CONFIG", "图片为空");
  }
  if (view.byteLength > MAX_IMAGE_BYTES) {
    throw new VaduError("INVALID_CONFIG", "图片超过 10MB 上限");
  }
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function validateParams(raw: unknown): OcrParams {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new VaduError("INVALID_CONFIG", "参数形状不合法");
  }
  const param = raw as Partial<OcrParams>;
  if (
    typeof param.mimeType !== "string" ||
    !ALLOWED_MIME_TYPES.has(param.mimeType)
  ) {
    throw new VaduError("INVALID_CONFIG", "mimeType 不支持");
  }
  if (
    param.profileId !== undefined &&
    (typeof param.profileId !== "string" || param.profileId.length > 64)
  ) {
    throw new VaduError("INVALID_CONFIG", "profileId 非法");
  }
  if (
    param.language !== undefined &&
    (typeof param.language !== "string" || param.language.length > 32)
  ) {
    throw new VaduError("INVALID_CONFIG", "language 非法");
  }
  return {
    image: normalizeImage(param.image),
    language: param.language,
    mimeType: param.mimeType,
    profileId: param.profileId || undefined,
  };
}

export function registerOcrIpc(): void {
  handle<OcrParams, OcrResult>(IPC.ocr.recognize, (raw) => {
    const params = validateParams(raw);
    return recognize(params);
  });
}
