import { ipcMain } from "electron";

import type { IpcResult, SerializedError } from "../../shared/ipc";

function toSerializedError(error: unknown): SerializedError {
  return {
    code: "INTERNAL",
    message: error instanceof Error ? error.message : String(error),
  };
}

export function handle<TArg, TResult>(
  channel: string,
  fn: (arg: TArg) => Promise<TResult>
): void {
  ipcMain.handle(
    channel,
    async (_event, arg: TArg): Promise<IpcResult<TResult>> => {
      try {
        return { data: await fn(arg), ok: true };
      } catch (error) {
        return { error: toSerializedError(error), ok: false };
      }
    }
  );
}
