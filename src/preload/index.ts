import { contextBridge, ipcRenderer } from "electron";

import type {
  AppPlatform,
  HotkeyState,
  InAppHotkeyAction,
  InAppHotkeyState,
  IpcResult,
  VaduApi,
} from "../shared/ipc";
import { IPC } from "../shared/ipc";

/** shared 一层只认三档平台；其它（freebsd 等）按非 mac 走 */
const platform: AppPlatform =
  process.platform === "darwin" || process.platform === "win32"
    ? process.platform
    : "linux";

// 只暴露显式声明过的能力：不投 electronAPI，渲染层拿不到任意通道的 ipcRenderer
const vadu: VaduApi = {
  app: {
    getQuickWindowPinned: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.getQuickWindowPinned),
    getShowMainWindowOnStartup: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.getShowMainWindowOnStartup),
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
  platform,
};

contextBridge.exposeInMainWorld("vadu", vadu);
