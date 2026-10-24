import { join } from "node:path";

import { is } from "@electron-toolkit/utils";
import { BrowserWindow, shell } from "electron";

import icon from "../../resources/icon.png?asset";

// macOS 隐藏标题栏，只保留红黄绿三个原生按钮；渲染层顶部留出 28px 拖拽带对齐
const mainTitleBarOptions =
  process.platform === "darwin"
    ? {
        titleBarStyle: "hidden" as const,
        trafficLightPosition: { x: 16, y: 12 },
      }
    : {};

let quitting = false;
let mainWindow: BrowserWindow | null = null;
let quickWindow: BrowserWindow | null = null;
/** 置顶固定中：失焦不收起，关闭固定时恢复默认置顶层级 */
let quickWindowPinned = false;

/** before-quit 里置位，让翻译窗的 close 拦截放行真退出 */
export function markQuitting(): void {
  quitting = true;
}

// 单 bundle 双窗口：两窗共用 index.html，hash 区分根组件（见 renderer/src/main.tsx）
function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL + (hash ? `#${hash}` : ""));
    return;
  }
  win.loadFile(join(import.meta.dirname, "../renderer/index.html"), { hash });
}

function denyExternalOpen(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    autoHideMenuBar: true,
    height: 620,
    resizable: false,
    show: false,
    width: 960,
    ...mainTitleBarOptions,
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
  denyExternalOpen(win);
  loadRenderer(win);
  return win;
}

function createQuickWindow(): BrowserWindow {
  if (quickWindow && !quickWindow.isDestroyed()) {
    return quickWindow;
  }
  const win = new BrowserWindow({
    alwaysOnTop: true,
    frame: false,
    fullscreenable: false,
    height: 340,
    resizable: false,
    show: false,
    skipTaskbar: true,
    width: 480,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.js"),
      sandbox: false,
    },
  });
  quickWindow = win;

  // 失焦即收起（Bob/Raycast 交互）；固定或 DevTools 开着时不收，方便调试
  win.on("blur", () => {
    if (!(quickWindowPinned || win.webContents.isDevToolsOpened())) {
      win.hide();
    }
  });
  // 只藏不销毁，保住输入与结果状态；真退出由 quitting 放行
  win.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on("ready-to-show", () => {
    win.show();
    win.focus();
  });
  denyExternalOpen(win);
  loadRenderer(win, "/quick");
  return win;
}

export function showMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createMainWindow();
}

export function toggleMainWindow(): void {
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
  createMainWindow();
}

export function toggleQuickWindow(): void {
  // 首次唤起交给 ready-to-show，避免白屏闪现
  if (!quickWindow || quickWindow.isDestroyed()) {
    createQuickWindow();
    return;
  }
  if (quickWindow.isVisible() && quickWindow.isFocused()) {
    quickWindow.hide();
    return;
  }
  if (quickWindow.isMinimized()) {
    quickWindow.restore();
  }
  quickWindow.show();
  quickWindow.focus();
}

/** 浮窗「图钉」：固定时不失焦收起，且抬到 screen-saver 层级 */
export function setQuickWindowPinned(pinned: boolean): void {
  quickWindowPinned = pinned;
  if (!quickWindow || quickWindow.isDestroyed()) {
    return;
  }
  quickWindow.setAlwaysOnTop(pinned, "screen-saver");
  if (!pinned) {
    quickWindow.setAlwaysOnTop(true);
  }
}

export function getQuickWindowPinned(): boolean {
  return quickWindowPinned;
}
