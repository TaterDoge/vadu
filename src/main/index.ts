import { electronApp, optimizer } from "@electron-toolkit/utils";
import { app, ipcMain } from "electron";

import { type HotkeyState, IPC, type InAppHotkeyState } from "../shared/ipc";
import { readSettings, saveSettings } from "./core/config/store";
import {
  applyHotkey,
  applyInAppHotkey,
  disposeHotkeys,
  getHotkeyState,
  getInAppHotkeyState,
  initHotkey,
  setHotkeySuspended,
} from "./hotkey";
import { handle } from "./ipc";
import { createTray } from "./tray";
import {
  getQuickWindowPinned,
  markQuitting,
  setQuickWindowPinned,
  showMainWindow,
  toggleQuickWindow,
} from "./windows";

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, win) => {
    optimizer.watchWindowShortcuts(win);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  handle<null, HotkeyState>(IPC.getHotkey, async () => getHotkeyState());
  handle<{ accelerator: string | null }, HotkeyState>(
    IPC.setHotkey,
    async ({ accelerator }) => applyHotkey(accelerator)
  );
  handle<{ suspended: boolean }, null>(
    IPC.setHotkeySuspended,
    ({ suspended }) => {
      setHotkeySuspended(suspended);
      return Promise.resolve(null);
    }
  );
  handle<null, null>(IPC.toggleQuickWindow, () => {
    toggleQuickWindow();
    return Promise.resolve(null);
  });
  handle<null, null>(IPC.showSettings, () => {
    showMainWindow();
    return Promise.resolve(null);
  });
  handle<{ pinned: boolean }, boolean>(
    IPC.setQuickWindowPinned,
    ({ pinned }) => {
      setQuickWindowPinned(pinned);
      return Promise.resolve(getQuickWindowPinned());
    }
  );
  handle<null, boolean>(IPC.getQuickWindowPinned, () =>
    Promise.resolve(getQuickWindowPinned())
  );
  handle<null, InAppHotkeyState>(IPC.getInAppHotkey, async () =>
    getInAppHotkeyState()
  );
  handle<{ action: string; accelerator: string | null }, InAppHotkeyState>(
    IPC.setInAppHotkey,
    async ({ accelerator, action }) => applyInAppHotkey(action, accelerator)
  );

  handle<null, boolean>(IPC.getShowMainWindowOnStartup, () =>
    Promise.resolve(readSettings().showMainWindowOnStartup)
  );
  handle<{ enabled: boolean }, boolean>(
    IPC.setShowMainWindowOnStartup,
    ({ enabled }) => {
      saveSettings({ ...readSettings(), showMainWindowOnStartup: enabled });
      return Promise.resolve(enabled);
    }
  );

  // 全局热键唤起翻译浮窗；主窗走托盘/Dock
  initHotkey(toggleQuickWindow);

  // 关掉启动弹窗后只剩托盘常驻，用户从托盘 / Dock 进设置
  if (readSettings().showMainWindowOnStartup) {
    showMainWindow();
  }
  createTray();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    showMainWindow();
  });
});

app.on("before-quit", () => {
  markQuitting();
});

app.on("will-quit", () => {
  disposeHotkeys();
});

// 托盘常驻：翻译窗只藏不关，主窗关了应用也留在托盘，退出走托盘菜单
app.on("window-all-closed", () => {
  // 故意不退出，见上
});
