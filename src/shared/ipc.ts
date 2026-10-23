export const IPC = {
  getHotkey: "vadu:app:getHotkey",
  setHotkey: "vadu:app:setHotkey",
  setHotkeySuspended: "vadu:app:setHotkeySuspended",
} as const;

export type SerializedError = { code: string; message?: string };

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SerializedError };

export type HotkeyState = { accelerator: string | null; registered: boolean };

export type VaduApi = {
  hotkey: {
    get: () => Promise<IpcResult<HotkeyState>>;
    set: (accelerator: string | null) => Promise<IpcResult<HotkeyState>>;
    suspend: (suspended: boolean) => Promise<IpcResult<null>>;
  };
};
