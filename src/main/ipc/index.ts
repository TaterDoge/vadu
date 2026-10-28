import type { WebContents } from "electron";
import { ipcMain } from "electron";

import { toSerializedError } from "../../shared/errors";
import type { IpcChannel, IpcResult } from "../../shared/ipc";

/**
 * 统一注册 invoke 通道：错误序列化成带码的形状，日志只记通道与码。
 * `ctx.sender` 预留给 M2 的按窗口定向推流，现在不需要就忽略。
 */
export function handle<TArg, TResult>(
  channel: IpcChannel,
  fn: (arg: TArg, ctx: { sender: WebContents }) => Promise<TResult>
): void {
  ipcMain.handle(
    channel,
    async (event, arg: TArg): Promise<IpcResult<TResult>> => {
      try {
        return {
          data: await fn(arg, { sender: event.sender }),
          ok: true,
        };
      } catch (error) {
        // 只记通道与码：上游错误体可能带密钥片段，绝不能落日志
        const serialized = toSerializedError(error);
        console.error(`[ipc] ${channel} ${serialized.code}`);
        return { error: serialized, ok: false };
      }
    }
  );
}
