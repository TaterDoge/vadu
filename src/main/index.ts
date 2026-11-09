import { electronApp, optimizer } from "@electron-toolkit/utils";
import { app } from "electron";

import {
  type HotkeyState,
  IPC,
  type InAppHotkeyAction,
  type InAppHotkeyState,
} from "../shared/ipc";
import { initSecrets } from "./core/config/secrets";
import { readSettings, updateSettings } from "./core/config/store";
import { registry } from "./core/plugin/registry";
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
import { registerBackupIpc } from "./ipc/backup";
import { registerConfigIpc } from "./ipc/config";
import { registerOcrIpc } from "./ipc/ocr";
import { registerPluginsIpc } from "./ipc/plugins";
import { registerSecretsIpc } from "./ipc/secrets";
import { registerTranslateIpc } from "./ipc/translate";
import { registerTtsIpc } from "./ipc/tts";
import { createTray } from "./tray";
import {
  getQuickWindowPinned,
  markQuitting,
  setQuickWindowContentHeight,
  setQuickWindowPinned,
  showMainWindow,
  toggleQuickWindow,
} from "./windows";

// 双开会抢同一份 config.json 与同一个全局热键：抢不到锁只留首实例
function start(): void {
  app.on("second-instance", () => {
    // 冷启动期间第二次双击也会走到这里，此时 app 还没 ready，建窗会抛错
    app.whenReady().then(() => {
      showMainWindow();
    });
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.whenReady().then(async () => {
    // Set app user model id for windows; must match electron-builder appId
    electronApp.setAppUserModelId("com.vadu.app");

    // 密钥解密与插件加载失败都不阻断启动：失败时插件列表显示原因
    try {
      await initSecrets();
    } catch {
      console.error("[secrets] 初始化失败，使用会话内存");
    }
    try {
      await registry.discover();
    } catch (error) {
      console.error(
        `[bootstrap] ${error instanceof Error ? error.message : String(error)}`
      );
    }

    registerConfigIpc();
    registerBackupIpc();
    registerPluginsIpc();
    registerSecretsIpc();
    registerTranslateIpc();
    registerTtsIpc();
    registerOcrIpc();

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    app.on("browser-window-created", (_, win) => {
      optimizer.watchWindowShortcuts(win);
    });

    handle<null, HotkeyState>(IPC.getHotkey, () =>
      Promise.resolve(getHotkeyState())
    );
    handle<{ accelerator: string | null }, HotkeyState>(
      IPC.setHotkey,
      ({ accelerator }) => Promise.resolve(applyHotkey(accelerator))
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
    handle<{ height: number }, null>(
      IPC.setQuickWindowContentHeight,
      ({ height }) => {
        setQuickWindowContentHeight(height);
        return Promise.resolve(null);
      }
    );
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
    handle<null, InAppHotkeyState>(IPC.getInAppHotkey, () =>
      Promise.resolve(getInAppHotkeyState())
    );
    handle<
      { accelerator: string | null; action: InAppHotkeyAction },
      InAppHotkeyState
    >(IPC.setInAppHotkey, ({ accelerator, action }) =>
      Promise.resolve(applyInAppHotkey(action, accelerator))
    );

    handle<null, boolean>(IPC.getShowMainWindowOnStartup, () =>
      Promise.resolve(readSettings().showMainWindowOnStartup)
    );
    handle<{ enabled: boolean }, boolean>(
      IPC.setShowMainWindowOnStartup,
      ({ enabled }) =>
        Promise.resolve(
          updateSettings({ showMainWindowOnStartup: enabled })
            .showMainWindowOnStartup
        )
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
}

if (app.requestSingleInstanceLock()) {
  start();
} else {
  app.exit(0);
}
