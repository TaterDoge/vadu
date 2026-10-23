import { join } from "node:path";

import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { BrowserWindow, app, ipcMain, shell } from "electron";

import icon from "../../resources/icon.png?asset";
import { type HotkeyState, IPC } from "../shared/ipc";
import {
  applyHotkey,
  disposeHotkeys,
  getHotkeyState,
  initHotkey,
  setHotkeySuspended,
} from "./hotkey";
import { handle } from "./ipc";
import { createTray } from "./tray";

let mainWindow: BrowserWindow | null = null;

// macOS 隐藏标题栏，只保留红黄绿三个原生按钮；渲染层顶部留出 28px 拖拽带对齐
const titleBarOptions =
  process.platform === "darwin"
    ? {
        titleBarStyle: "hidden" as const,
        trafficLightPosition: { x: 16, y: 12 },
      }
    : {};

function createWindow(): void {
  // Create the browser window.
  const win = new BrowserWindow({
    autoHideMenuBar: true,
    height: 620,
    resizable: false,
    show: false,
    width: 960,
    ...titleBarOptions,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.js"),
      sandbox: false,
    },
  });
  mainWindow = win;

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.on("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }
}

function toggleWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isVisible() && mainWindow.webContents.isFocused()) {
      mainWindow.hide();
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow();
}

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

  initHotkey(toggleWindow);

  createWindow();
  createTray();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  disposeHotkeys();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
