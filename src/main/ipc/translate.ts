import { ipcMain } from "electron";

import { VaduError } from "../../shared/errors";
import type { TranslateParams } from "../../shared/ipc";
import { IPC } from "../../shared/ipc";
import { cancelTranslate, startTranslate } from "../core/translate/service";
import { handle } from "./index";

function validateParams(raw: unknown): TranslateParams {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new VaduError("INVALID_CONFIG", "参数形状不合法");
  }
  const param = raw as Partial<TranslateParams>;
  if (
    typeof param.requestId !== "string" ||
    param.requestId.length === 0 ||
    param.requestId.length > 64
  ) {
    throw new VaduError("INVALID_CONFIG", "requestId 非法");
  }
  if (
    typeof param.pluginId !== "string" ||
    typeof param.profileId !== "string"
  ) {
    throw new VaduError("INVALID_CONFIG", "pluginId/profileId 缺失");
  }
  if (
    typeof param.text !== "string" ||
    param.text.trim().length === 0 ||
    param.text.length > 50_000
  ) {
    throw new VaduError("INVALID_CONFIG", "文本需非空且不超过 50000 字符");
  }
  if (
    param.source !== "auto" &&
    (typeof param.source !== "string" || param.source.length > 32)
  ) {
    throw new VaduError("INVALID_CONFIG", "源语言非法");
  }
  if (
    typeof param.target !== "string" ||
    param.target === "auto" ||
    param.target.length > 32
  ) {
    throw new VaduError("INVALID_CONFIG", "目标语言非法");
  }
  return {
    pluginId: param.pluginId,
    profileId: param.profileId,
    requestId: param.requestId,
    source: param.source ?? "auto",
    target: param.target,
    text: param.text,
    tone: param.tone,
  };
}

export function registerTranslateIpc(): void {
  handle<TranslateParams, { requestId: string }>(
    IPC.translate.start,
    (raw, ctx) => {
      const params = validateParams(raw);
      return Promise.resolve(startTranslate(params, ctx.sender));
    }
  );

  // 取消是「发了就不管」的指令：send 通道，不返回值
  ipcMain.on(IPC.translate.cancel, (event, payload: unknown) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return;
    }
    const { requestId } = payload as { requestId?: unknown };
    if (
      typeof requestId === "string" &&
      requestId.length > 0 &&
      requestId.length <= 64
    ) {
      cancelTranslate(requestId, event.sender);
    }
  });
}
