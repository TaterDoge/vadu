import { VaduError } from "../../shared/errors";
import { IPC, type TtsParams, type TtsPayload } from "../../shared/ipc";
import { synthesize } from "../core/tts/service";
import { handle } from "./index";

function validateParams(raw: unknown): TtsParams {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new VaduError("INVALID_CONFIG", "参数形状不合法");
  }
  const param = raw as Partial<TtsParams>;
  if (
    typeof param.text !== "string" ||
    param.text.trim().length === 0 ||
    param.text.length > 4000
  ) {
    throw new VaduError("INVALID_CONFIG", "文本需非空且不超过 4000 字符");
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
    language: param.language,
    profileId: param.profileId || undefined,
    text: param.text,
  };
}

export function registerTtsIpc(): void {
  handle<TtsParams, TtsPayload>(IPC.tts.synthesize, (raw) => {
    const params = validateParams(raw);
    return synthesize(params);
  });
}
