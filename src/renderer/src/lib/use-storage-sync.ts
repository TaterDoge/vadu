import { useEffect } from "react";

/**
 * 外观设置各窗口独立持有：另一窗口改完，本窗口要自己再读一次。
 * storage 事件在本应用的打包产物里不一定送达，窗口重新获得焦点时再读一遍兜底。
 */
export function useStorageSync<T>(
  key: string,
  read: () => T,
  apply: (next: T) => void
): void {
  useEffect(() => {
    const sync = (): void => apply(read());
    const onStorage = (event: StorageEvent): void => {
      if (event.key === key) {
        sync();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
    };
  }, [key, read, apply]);
}
