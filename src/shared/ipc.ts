export const IPC = {
  getHotkey: "vadu:app:getHotkey",
  getInAppHotkey: "vadu:app:getInAppHotkey",
  // 渲染层重载后本地状态归零，必须回读主进程真值，否则图标与实际置顶层级错位
  getQuickWindowPinned: "vadu:app:getQuickWindowPinned",
  getShowMainWindowOnStartup: "vadu:app:getShowMainWindowOnStartup",
  setHotkey: "vadu:app:setHotkey",
  setHotkeySuspended: "vadu:app:setHotkeySuspended",
  setInAppHotkey: "vadu:app:setInAppHotkey",
  setQuickWindowPinned: "vadu:app:setQuickWindowPinned",
  setShowMainWindowOnStartup: "vadu:app:setShowMainWindowOnStartup",
  showSettings: "vadu:app:showSettings",
  toggleQuickWindow: "vadu:app:toggleQuickWindow",
} as const;

export type SerializedError = { code: string; message?: string };

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SerializedError };

export type HotkeyState = { accelerator: string | null; registered: boolean };

/** 局内快捷键的绑定点；目前只有浮窗内打开设置 */
export type InAppHotkeyAction = "openSettings";

export type InAppHotkeyState = { openSettings: string | null };

export type AppSettings = {
  defaultProfileId?: string;
  hotkey: string;
  /** 局内快捷键（窗口聚焦时生效，渲染层自行监听），不经 globalShortcut */
  inAppHotkeys: { openSettings: string | null };
  /** 启动时是否弹出主窗；关掉后只能从托盘 / Dock 唤起 */
  showMainWindowOnStartup: boolean;
  theme: "system" | "light" | "dark";
  historyLimit: number;
  /** 全局术语表，M3 实现。渲染层不按请求传术语，core 统一注入 */
  glossary: { from: string; to: string }[];
};

export type VaduApi = {
  app: {
    toggleQuickWindow: () => Promise<IpcResult<null>>;
    showSettings: () => Promise<IpcResult<null>>;
    getShowMainWindowOnStartup: () => Promise<IpcResult<boolean>>;
    setShowMainWindowOnStartup: (
      enabled: boolean
    ) => Promise<IpcResult<boolean>>;
    setQuickWindowPinned: (pinned: boolean) => Promise<IpcResult<boolean>>;
    getQuickWindowPinned: () => Promise<IpcResult<boolean>>;
  };
  hotkey: {
    get: () => Promise<IpcResult<HotkeyState>>;
    set: (accelerator: string | null) => Promise<IpcResult<HotkeyState>>;
    suspend: (suspended: boolean) => Promise<IpcResult<null>>;
    getInApp: () => Promise<IpcResult<InAppHotkeyState>>;
    setInApp: (
      action: InAppHotkeyAction,
      accelerator: string | null
    ) => Promise<IpcResult<InAppHotkeyState>>;
  };
};
