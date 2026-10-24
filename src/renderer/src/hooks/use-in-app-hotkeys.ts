import { useEffect, useMemo, useState } from "react";
import { toChord } from "@renderer/lib/hotkey";
import type { InAppHotkeyState } from "@shared/ipc";
import type { UseHotkeyDefinition } from "@tanstack/react-hotkeys";

/** 局内动作的实现；新增动作时在这里补一行并与 `InAppHotkeyAction` 对齐 */
const ACTIONS = {
  openSettings: (): void => {
    window.vadu.app.showSettings().catch((reason) => console.error(reason));
  },
} satisfies Record<keyof InAppHotkeyState, () => void>;

/**
 * 拉取局内快捷键绑定，转成可直接交给 `useHotkeys` 的定义。
 * 绑定非法（手改配置或旧版本写入）的动作不注册，等同未绑定。
 */
export function useInAppHotkeys(): UseHotkeyDefinition[] {
  const [bindings, setBindings] = useState<InAppHotkeyState | null>(null);

  useEffect(() => {
    const load = (): void => {
      window.vadu.hotkey
        .getInApp()
        .then((result) => {
          if (result.ok) {
            setBindings(result.data);
          }
        })
        .catch((reason) => console.error(reason));
    };
    load();
    // 浮窗只藏不销毁，设置页改绑后靠重新聚焦拉取最新绑定（ADR-010）
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("focus", load);
    };
  }, []);

  return useMemo(() => {
    const chord = toChord(bindings?.openSettings ?? null);
    return chord ? [{ callback: ACTIONS.openSettings, hotkey: chord }] : [];
  }, [bindings]);
}
