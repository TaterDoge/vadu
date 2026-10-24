import { globalShortcut } from "electron";

import { isSupportedAccelerator } from "../shared/hotkey";
import type { HotkeyState, InAppHotkeyState } from "../shared/ipc";
import { readSettings, saveSettings } from "./core/config/store";

let onTrigger: () => void = () => undefined;
let state: HotkeyState = { accelerator: null, registered: false };

function registerCurrent(): void {
  state.registered = false;
  if (!state.accelerator) {
    return;
  }
  try {
    state.registered = globalShortcut.register(state.accelerator, onTrigger);
  } catch {
    state.registered = false;
  }
}

export function initHotkey(trigger: () => void): HotkeyState {
  onTrigger = trigger;
  const stored = readSettings().hotkey;
  state = {
    accelerator: stored && isSupportedAccelerator(stored) ? stored : null,
    registered: false,
  };
  registerCurrent();
  return state;
}

export function applyHotkey(accelerator: string | null): HotkeyState {
  if (accelerator !== null && !isSupportedAccelerator(accelerator)) {
    throw new Error(`不支持的快捷键: ${accelerator}`);
  }
  if (state.accelerator) {
    globalShortcut.unregister(state.accelerator);
  }
  // OS 级 hotkey 会吞掉按键，录制时必须先让出，恢复后才能注册
  globalShortcut.setSuspended(false);
  state = { accelerator, registered: false };
  registerCurrent();
  saveSettings({ ...readSettings(), hotkey: state.accelerator ?? "" });
  return state;
}

export function getHotkeyState(): HotkeyState {
  return state;
}

export function getInAppHotkeyState(): InAppHotkeyState {
  const stored = readSettings().inAppHotkeys.openSettings;
  // 手改配置文件的坏值让它退化为「未绑定」，而不是把非法组合交给渲染层
  return {
    openSettings: stored && isSupportedAccelerator(stored) ? stored : null,
  };
}

export function applyInAppHotkey(
  action: string,
  accelerator: string | null
): InAppHotkeyState {
  if (action !== "openSettings") {
    throw new Error(`未知的局内快捷键: ${action}`);
  }
  if (accelerator !== null && !isSupportedAccelerator(accelerator)) {
    throw new Error(`不支持的快捷键: ${accelerator}`);
  }
  const settings = readSettings();
  saveSettings({
    ...settings,
    inAppHotkeys: { ...settings.inAppHotkeys, openSettings: accelerator },
  });
  return { openSettings: accelerator };
}

export function setHotkeySuspended(suspended: boolean): void {
  globalShortcut.setSuspended(suspended);
}

export function disposeHotkeys(): void {
  globalShortcut.unregisterAll();
}
