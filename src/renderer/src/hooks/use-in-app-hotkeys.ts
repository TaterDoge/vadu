import { useEffect, useState } from "react";
import { toChord } from "@renderer/lib/hotkey";
import type { InAppHotkeyAction, InAppHotkeyState } from "@shared/ipc";
import type { UseHotkeyDefinition } from "@tanstack/react-hotkeys";

const ACTIONS: InAppHotkeyAction[] = ["openSettings", "togglePin"];

/**
 * 拉取局内快捷键绑定，转成可直接交给 `useHotkeys` 的定义。
 * 绑定非法（手改配置或旧版本写入）的动作不注册，等同未绑定。
 * 入参每次渲染都是新闭包，所以不做 memo，回调始终用最新的动作实现。
 */
export function useInAppHotkeys(
  actions: Record<InAppHotkeyAction, () => void>
): UseHotkeyDefinition[] {
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

  if (!bindings) {
    return [];
  }
  return ACTIONS.flatMap((action) => {
    const chord = toChord(bindings[action]);
    return chord ? [{ callback: actions[action], hotkey: chord }] : [];
  });
}
