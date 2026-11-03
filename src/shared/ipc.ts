import type { SerializedError } from "./errors";
import type { ModelInfo } from "./plugin";

export type { SerializedError } from "./errors";
export type { ModelInfo } from "./plugin";

export const IPC = {
  config: {
    listProfiles: "vadu:config:listProfiles",
    saveProfile: "vadu:config:saveProfile",
  },
  getHotkey: "vadu:app:getHotkey",
  getInAppHotkey: "vadu:app:getInAppHotkey",
  // 渲染层重载后本地状态归零，必须回读主进程真值，否则图标与实际置顶层级错位
  getQuickWindowPinned: "vadu:app:getQuickWindowPinned",
  getSecretStorage: "vadu:app:getSecretStorage",
  getShowMainWindowOnStartup: "vadu:app:getShowMainWindowOnStartup",
  plugins: {
    list: "vadu:plugins:list",
    listModels: "vadu:plugins:listModels",
  },
  secrets: {
    has: "vadu:secret:has",
    set: "vadu:secret:set",
  },
  setHotkey: "vadu:app:setHotkey",
  setHotkeySuspended: "vadu:app:setHotkeySuspended",
  setInAppHotkey: "vadu:app:setInAppHotkey",
  // 浮窗高度由渲染层内容决定：渲染层量高度，主进程负责夹进屏幕
  setQuickWindowContentHeight: "vadu:app:setQuickWindowContentHeight",
  setQuickWindowPinned: "vadu:app:setQuickWindowPinned",
  setShowMainWindowOnStartup: "vadu:app:setShowMainWindowOnStartup",
  showSettings: "vadu:app:showSettings",
  toggleQuickWindow: "vadu:app:toggleQuickWindow",
  translate: {
    cancel: "vadu:translate:cancel",
    event: "vadu:translate:event",
    start: "vadu:translate:start",
  },
} as const;

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SerializedError };

/** 通道名的字面量联合：注册与调用都靠它收口，避免裸字符串 */
type NestedChannelValue<T> = T extends string
  ? T
  : { [K in keyof T]: NestedChannelValue<T[K]> }[keyof T];

export type IpcChannel = NestedChannelValue<typeof IPC>;

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

// ── 插件 & 配置 ──────────────────────────────────────────────────────────────

export type PluginStatus = "ready" | "disabled" | "error";

export type ConfigField =
  | {
      type: "string";
      title: string;
      description?: string;
      default?: string;
      placeholder?: string;
      enum?: string[];
      enumLabels?: string[];
      required?: boolean;
      "x-widget"?: "model-picker";
    }
  | {
      type: "number";
      title: string;
      description?: string;
      default?: number;
      minimum?: number;
      maximum?: number;
      step?: number;
      required?: boolean;
    }
  | {
      type: "boolean";
      title: string;
      description?: string;
      default?: boolean;
    }
  | {
      type: "secret";
      title: string;
      description?: string;
      placeholder?: string;
      required?: boolean;
      header?: string;
    }
  | {
      type: "json";
      title: string;
      description?: string;
      default?: Record<string, unknown>;
      required?: boolean;
    };

export type ConfigSchema = {
  type: "object";
  properties: Record<string, ConfigField>;
  required?: string[];
};

export type PluginPreset = {
  id: string;
  label: string;
  config: Record<string, unknown>;
  models?: string[];
};

export type PluginDescriptor = {
  id: string;
  name: string;
  version: string;
  kind: "translator";
  description?: string;
  origin: "builtin" | "user";
  status: PluginStatus;
  errorMessage?: string;
  capabilities: {
    streaming: boolean;
    models: boolean;
    glossary: boolean;
    batch: boolean;
  };
  permissions: string[];
  configSchema?: ConfigSchema;
  presets: PluginPreset[];
  secretsSet: Record<string, boolean>;
};

export type Profile = {
  id: string;
  pluginId: string;
  name: string;
  preset?: string;
  config: Record<string, unknown>;
  /** 已向用户展示确认过的 origin，宿主受控 fetch 只允许发往这里 */
  allowedOrigins: string[];
  /** 服务商开关：关闭后保留配置；翻译与浮窗可选项过滤该服务商，旧 profile 无此字段默认启用 */
  enabled: boolean;
  createdAt: number;
};

// ── 翻译 ────────────────────────────────────────────────────────────────────

export type TranslateParams = {
  /** 渲染层预生成并先订阅事件，避免 start 应答前丢失事件 */
  requestId: string;
  pluginId: string;
  profileId: string;
  text: string;
  source: string;
  target: string;
  tone?: "default" | "formal" | "casual";
};

export type TranslateWarning =
  | "PLACEHOLDER_MISMATCH"
  | "EMPTY_OUTPUT"
  | "OUTPUT_TOO_LONG";

export type TranslateEvent =
  | { requestId: string; type: "delta"; text: string }
  | {
      requestId: string;
      type: "done";
      text: string;
      elapsedMs: number;
      warnings: TranslateWarning[];
    }
  | { requestId: string; type: "error"; error: SerializedError };

// ── 密钥存储状态 ─────────────────────────────────────────────────────────────

export type SecretStorageState = {
  available: boolean;
  backend?: string;
  plaintext: boolean;
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
    setQuickWindowContentHeight: (height: number) => Promise<IpcResult<null>>;
    setQuickWindowPinned: (pinned: boolean) => Promise<IpcResult<boolean>>;
    getQuickWindowPinned: () => Promise<IpcResult<boolean>>;
    getSecretStorage: () => Promise<IpcResult<SecretStorageState>>;
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
  plugins: {
    list: () => Promise<IpcResult<PluginDescriptor[]>>;
    listModels: (
      pluginId: string,
      profileId: string,
      config: Record<string, unknown>
    ) => Promise<IpcResult<ModelInfo[]>>;
  };
  translate: {
    start: (
      params: TranslateParams
    ) => Promise<IpcResult<{ requestId: string }>>;
    cancel: (requestId: string) => void;
    onEvent: (fn: (event: TranslateEvent) => void) => () => void;
  };
  config: {
    listProfiles: (pluginId?: string) => Promise<IpcResult<Profile[]>>;
    saveProfile: (profile: Profile) => Promise<IpcResult<Profile>>;
  };
  secrets: {
    has: (profileId: string, name: string) => Promise<IpcResult<boolean>>;
    set: (
      profileId: string,
      name: string,
      value: string
    ) => Promise<IpcResult<null>>;
  };
};
