import type { ElectronAPI } from "@electron-toolkit/preload";

import type { VaduApi } from "../shared/ipc";

declare global {
  interface Window {
    api: unknown;
    electron: ElectronAPI;
    vadu: VaduApi;
  }
}
