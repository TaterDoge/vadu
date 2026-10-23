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

export type AppSettings = {
  defaultProfileId?: string;
  hotkey: string;
  theme: "system" | "light" | "dark";
  historyLimit: number;
  /** 全局术语表，M3 实现。渲染层不按请求传术语，core 统一注入 */
  glossary: { from: string; to: string }[];
};

export type VaduApi = {
  hotkey: {
    get: () => Promise<IpcResult<HotkeyState>>;
    set: (accelerator: string | null) => Promise<IpcResult<HotkeyState>>;
    suspend: (suspended: boolean) => Promise<IpcResult<null>>;
  };
};
