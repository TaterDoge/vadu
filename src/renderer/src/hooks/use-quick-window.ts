import { type RefObject, useEffect, useRef } from "react";

/** Esc 收起浮窗；与全局热键走同一 toggle 通道 */
export function useEscapeToHide(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        window.vadu.app.toggleQuickWindow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

/**
 * 窗口每次获得焦点都把焦点交给输入框。浮窗只藏不销毁，重新唤起不会重新挂载，
 * 只靠挂载时 focus() 会把焦点留在上次点过的按钮上
 */
export function useFocusOnShow<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const focus = (): void => {
      ref.current?.focus();
    };
    focus();
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("focus", focus);
    };
  }, []);
  return ref;
}
