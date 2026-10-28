import type { SerializedError } from "./errors";

export type { SerializedError } from "./errors";

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

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SerializedError };

/** 通道名的字面量联合：注册与调用都靠它收口，避免裸字符串 */
export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** 渲染层只关心这三档，其余平台按非 mac 处理 */
export type AppPlatform = "darwin" | "win32" | "linux";

export type HotkeyState = { accelerator: string | null; registered: boolean };

/** 局内快捷键的绑定点：浮窗内打开设置、切换窗口固定 */
export const IN_APP_HOTKEY_ACTIONS = ["openSettings", "togglePin"] as const;

export type InAppHotkeyAction = (typeof IN_APP_HOTKEY_ACTIONS)[number];

export type InAppHotkeyState = {
  openSettings: string | null;
  togglePin: string | null;
};

/** 出厂默认绑定：主进程读配置的兜底与设置页「重置」共用同一份，避免两处各写一份 */
export const DEFAULT_HOTKEYS = {
  global: "CommandOrControl+Shift+T",
  inApp: {
    openSettings: "CommandOrControl+,",
    togglePin: "CommandOrControl+P",
  },
} satisfies { global: string; inApp: InAppHotkeyState };

export type AppSettings = {
  defaultProfileId?: string;
  /** null = 用户解绑了全局热键 */
  hotkey: string | null;
  /** 局内快捷键（窗口聚焦时生效，渲染层自行监听），不经 globalShortcut */
  inAppHotkeys: InAppHotkeyState;
  /** 启动时是否弹出主窗；关掉后只能从托盘 / Dock 唤起 */
  showMainWindowOnStartup: boolean;
  theme: "system" | "light" | "dark";
  historyLimit: number;
  /** 全局术语表，M3 实现。渲染层不按请求传术语，core 统一注入 */
  glossary: { from: string; to: string }[];
};

export type VaduApi = {
  /** 由 preload 注入：渲染层不再拿 window.electron，避免直通 ipcRenderer */
  platform: AppPlatform;
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
