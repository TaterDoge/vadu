import { globalShortcut } from "electron";

import { VaduError } from "../shared/errors";
import { isSupportedAccelerator } from "../shared/hotkey";
import {
  type HotkeyState,
  IN_APP_HOTKEY_ACTIONS,
  type InAppHotkeyAction,
  type InAppHotkeyState,
} from "../shared/ipc";
import { readSettings, updateSettings } from "./core/config/store";

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
    throw new VaduError("INVALID_CONFIG", `不支持的快捷键: ${accelerator}`);
  }
  if (state.accelerator) {
    globalShortcut.unregister(state.accelerator);
  }
  state = { accelerator, registered: false };
  registerCurrent();
  updateSettings({ hotkey: state.accelerator });
  return state;
}

export function getHotkeyState(): HotkeyState {
  return state;
}

// 手改配置文件的坏值让它退化为「未绑定」，而不是把非法组合交给渲染层
function validAccelerator(value: string | null): string | null {
  return value && isSupportedAccelerator(value) ? value : null;
}

export function getInAppHotkeyState(): InAppHotkeyState {
  const stored = readSettings().inAppHotkeys;
  return {
    openSettings: validAccelerator(stored.openSettings),
    togglePin: validAccelerator(stored.togglePin),
  };
}

export function applyInAppHotkey(
  action: InAppHotkeyAction,
  accelerator: string | null
): InAppHotkeyState {
  if (!IN_APP_HOTKEY_ACTIONS.includes(action)) {
    throw new VaduError("INVALID_CONFIG", `未知的局内快捷键: ${action}`);
  }
  if (accelerator !== null && !isSupportedAccelerator(accelerator)) {
    throw new VaduError("INVALID_CONFIG", `不支持的快捷键: ${accelerator}`);
  }
  const current = readSettings().inAppHotkeys;
  updateSettings({ inAppHotkeys: { ...current, [action]: accelerator } });
  return getInAppHotkeyState();
}

// 挂起状态的拥有方是录制器，这里只转发，不在保存时顺手恢复
export function setHotkeySuspended(suspended: boolean): void {
  globalShortcut.setSuspended(suspended);
}

export function disposeHotkeys(): void {
  globalShortcut.unregisterAll();
}
