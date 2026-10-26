import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge, ipcRenderer } from "electron";

import {
  type HotkeyState,
  IPC,
  type InAppHotkeyAction,
  type InAppHotkeyState,
  type IpcResult,
  type VaduApi,
} from "../shared/ipc";

// Custom APIs for renderer
const api = {};

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
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
    contextBridge.exposeInMainWorld("vadu", vadu);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.api = api;
  // @ts-expect-error (define in dts)
  window.vadu = vadu;
}
