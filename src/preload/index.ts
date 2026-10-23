import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge, ipcRenderer } from "electron";

import {
  type HotkeyState,
  IPC,
  type IpcResult,
  type VaduApi,
} from "../shared/ipc";

// Custom APIs for renderer
const api = {};

const vadu: VaduApi = {
  hotkey: {
    get: (): Promise<IpcResult<HotkeyState>> =>
      ipcRenderer.invoke(IPC.getHotkey),
    set: (accelerator: string | null): Promise<IpcResult<HotkeyState>> =>
      ipcRenderer.invoke(IPC.setHotkey, { accelerator }),
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
