import { contextBridge, ipcRenderer } from "electron";

import type {
  AppPlatform,
  AppearancePatch,
  AppearanceSettings,
  BackupExportResult,
  BackupImportResult,
  HotkeyState,
  InAppHotkeyAction,
  InAppHotkeyState,
  IpcChannel,
  IpcResult,
  ModelHealthCheckParams,
  ModelHealthCheckResult,
  OcrParams,
  OcrResult,
  PluginDescriptor,
  Profile,
  SecretStorageState,
  TranslateEvent,
  TranslateParams,
  TtsParams,
  TtsPayload,
  VaduApi,
} from "../shared/ipc";
import { IPC } from "../shared/ipc";
import type { ModelInfo } from "../shared/plugin";

/** shared 一层只认三档平台；其它（freebsd 等）按非 mac 走 */
const platform: AppPlatform =
  process.platform === "darwin" || process.platform === "win32"
    ? process.platform
    : "linux";

/** 订阅封装：返回退订函数，不把 ipcRenderer.on 透传给渲染层 */
function subscribe<T>(
  channel: IpcChannel,
  fn: (payload: T) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
    fn(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

// 只暴露显式声明过的能力：不投 electronAPI，渲染层拿不到任意通道的 ipcRenderer
const vadu: VaduApi = {
  app: {
    getQuickWindowPinned: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.getQuickWindowPinned),
    getSecretStorage: (): Promise<IpcResult<SecretStorageState>> =>
      ipcRenderer.invoke(IPC.getSecretStorage),
    getShowMainWindowOnStartup: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.getShowMainWindowOnStartup),
    setQuickWindowContentHeight: (height: number): Promise<IpcResult<null>> =>
      ipcRenderer.invoke(IPC.setQuickWindowContentHeight, { height }),
    setQuickWindowPinned: (pinned: boolean): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.setQuickWindowPinned, { pinned }),
    setShowMainWindowOnStartup: (
      enabled: boolean
    ): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.setShowMainWindowOnStartup, { enabled }),
    showSettings: (): Promise<IpcResult<null>> =>
      ipcRenderer.invoke(IPC.showSettings),
    toggleQuickWindow: (): Promise<IpcResult<null>> =>
      ipcRenderer.invoke(IPC.toggleQuickWindow),
  },
  config: {
    deleteProfile: (profileId: string): Promise<IpcResult<null>> =>
      ipcRenderer.invoke(IPC.config.deleteProfile, { profileId }),
    exportBackup: (): Promise<IpcResult<BackupExportResult>> =>
      ipcRenderer.invoke(IPC.config.exportBackup),
    getAppearance: (): Promise<IpcResult<AppearanceSettings>> =>
      ipcRenderer.invoke(IPC.config.getAppearance),
    importBackup: (): Promise<IpcResult<BackupImportResult>> =>
      ipcRenderer.invoke(IPC.config.importBackup),
    listProfiles: (pluginId?: string): Promise<IpcResult<Profile[]>> =>
      ipcRenderer.invoke(IPC.config.listProfiles, pluginId ? { pluginId } : {}),
    migrateAppearance: (
      legacy: AppearancePatch
    ): Promise<IpcResult<AppearanceSettings>> =>
      ipcRenderer.invoke(IPC.config.migrateAppearance, legacy),
    onAppearanceChanged: (
      fn: (appearance: AppearanceSettings) => void
    ): (() => void) =>
      subscribe<AppearanceSettings>(IPC.config.appearanceChanged, fn),
    reorderProfiles: (orderedIds: string[]): Promise<IpcResult<Profile[]>> =>
      ipcRenderer.invoke(IPC.config.reorderProfiles, { orderedIds }),
    saveProfile: (profile: Profile): Promise<IpcResult<Profile>> =>
      ipcRenderer.invoke(IPC.config.saveProfile, profile),
    setAppearance: (
      patch: AppearancePatch
    ): Promise<IpcResult<AppearanceSettings>> =>
      ipcRenderer.invoke(IPC.config.setAppearance, patch),
  },
  hotkey: {
    get: (): Promise<IpcResult<HotkeyState>> =>
      ipcRenderer.invoke(IPC.getHotkey),
    getInApp: (): Promise<IpcResult<InAppHotkeyState>> =>
      ipcRenderer.invoke(IPC.getInAppHotkey),
    set: (accelerator: string | null): Promise<IpcResult<HotkeyState>> =>
      ipcRenderer.invoke(IPC.setHotkey, { accelerator }),
    setInApp: (
      action: InAppHotkeyAction,
      accelerator: string | null
    ): Promise<IpcResult<InAppHotkeyState>> =>
      ipcRenderer.invoke(IPC.setInAppHotkey, { accelerator, action }),
    suspend: (suspended: boolean): Promise<IpcResult<null>> =>
      ipcRenderer.invoke(IPC.setHotkeySuspended, { suspended }),
  },
  ocr: {
    recognize: (params: OcrParams): Promise<IpcResult<OcrResult>> =>
      ipcRenderer.invoke(IPC.ocr.recognize, params),
  },
  platform,
  plugins: {
    cancelHealthCheck: (requestId: string): void => {
      ipcRenderer.send(IPC.plugins.cancelHealthCheck, { requestId });
    },
    healthCheck: (
      params: ModelHealthCheckParams
    ): Promise<IpcResult<ModelHealthCheckResult>> =>
      ipcRenderer.invoke(IPC.plugins.healthCheck, params),
    list: (): Promise<IpcResult<PluginDescriptor[]>> =>
      ipcRenderer.invoke(IPC.plugins.list),
    listModels: (
      pluginId: string,
      profileId: string,
      config: Record<string, unknown>,
      secrets?: Record<string, string>
    ): Promise<IpcResult<ModelInfo[]>> =>
      ipcRenderer.invoke(IPC.plugins.listModels, {
        config,
        pluginId,
        profileId,
        ...(secrets ? { secrets } : {}),
      }),
  },
  secrets: {
    has: (profileId: string, name: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.secrets.has, { name, profileId }),
    set: (
      profileId: string,
      name: string,
      value: string
    ): Promise<IpcResult<null>> =>
      ipcRenderer.invoke(IPC.secrets.set, { name, profileId, value }),
  },
  translate: {
    cancel: (requestId: string): void => {
      ipcRenderer.send(IPC.translate.cancel, { requestId });
    },
    onEvent: (fn: (event: TranslateEvent) => void): (() => void) =>
      subscribe<TranslateEvent>(IPC.translate.event, fn),
    start: (
      params: TranslateParams
    ): Promise<IpcResult<{ requestId: string }>> =>
      ipcRenderer.invoke(IPC.translate.start, params),
  },
  tts: {
    synthesize: (params: TtsParams): Promise<IpcResult<TtsPayload>> =>
      ipcRenderer.invoke(IPC.tts.synthesize, params),
  },
};

contextBridge.exposeInMainWorld("vadu", vadu);
