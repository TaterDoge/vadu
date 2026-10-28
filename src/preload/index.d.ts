import type { VaduApi } from "../shared/ipc";

declare global {
  interface Window {
    vadu: VaduApi;
  }
}
