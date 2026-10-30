import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { is } from "@electron-toolkit/utils";
import { BrowserWindow, screen, shell } from "electron";

import icon from "../../resources/icon.png?asset";

// macOS 隐藏标题栏并关掉红黄绿按钮：窗口靠渲染层顶部拖拽带移动，关窗走 Cmd+W 或托盘
const mainTitleBarOptions =
  process.platform === "darwin" ? { titleBarStyle: "hidden" as const } : {};

let quitting = false;
let mainWindow: BrowserWindow | null = null;
let quickWindow: BrowserWindow | null = null;
/** 内容为空时的设计稿高度，内容变高后这个值只当下限用 */
const QUICK_WINDOW_MIN_HEIGHT = 340;
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

function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * 开发态放行 HMR 同源，生产态只放行打包后的 index.html。
 * 不能直接放行 `file://`：那等于允许导航到本机任意 HTML，而新文档会带上 preload。
 */
function allowedPrefix(): string {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (is.dev && devUrl) {
    try {
      return new URL(devUrl).origin;
    } catch {
      // 启动参数被写坏时退回最严格的 file:// 口径
    }
  }
  return pathToFileURL(join(import.meta.dirname, "../renderer/index.html"))
    .href;
}

/**
 * 每个窗口自己绑 Cmd/Ctrl+W 关窗：macOS 默认菜单不该被当成唯一入口，
 * 红黄绿隐藏后更不能赌它还在。浮窗的 close 拦截会把「关」降级成隐藏，符合失焦即收起的交互。
 */
function enableCloseShortcut(win: BrowserWindow): void {
  // macOS 的 Ctrl+W 是输入框删词，只认 Cmd；其它平台认 Ctrl
  const modifier = process.platform === "darwin" ? "meta" : "control";
  win.webContents.on("before-input-event", (event, input) => {
    if (
      input.type === "keyDown" &&
      input.code === "KeyW" &&
      input[modifier] &&
      !input.shift &&
      !input.alt
    ) {
      event.preventDefault();
      win.close();
    }
  });
}

/**
 * 拦截两类外跳。`setWindowOpenHandler` 只管 window.open / target=_blank；
 * 顶层导航走 `will-navigate`，不拦就等于让远程页面在带 preload 的窗口里加载。
 */
function guardNavigation(win: BrowserWindow): void {
  const allowed = allowedPrefix();
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(allowed)) {
      return;
    }
    event.preventDefault();
    if (isHttpUrl(url)) {
      shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) {
      shell.openExternal(url);
    }
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

  // 主窗不再有原生按钮，Cmd+W / 托盘退出是唯一出口
  if (process.platform === "darwin") {
    win.setWindowButtonVisibility(false);
  }
  enableCloseShortcut(win);

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
  win.on("ready-to-show", () => {
    win.show();
  });
  guardNavigation(win);
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
    height: QUICK_WINDOW_MIN_HEIGHT,
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
  enableCloseShortcut(win);

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
  guardNavigation(win);
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

/**
 * 浮窗高度跟随内容，上限是屏幕可用高度。窗口被拖到工作区外时「上边缘到工作区底」
 * 可能反而比工作区高，所以两者取小；超出上限的部分退回页面滚动。
 */
export function setQuickWindowContentHeight(height: number): void {
  if (!quickWindow || quickWindow.isDestroyed()) {
    return;
  }
  const bounds = quickWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  const available = Math.min(
    workArea.height,
    workArea.y + workArea.height - bounds.y
  );
  // 窗口被拖到工作区下方时 available 可能 ≤ 0，而 setContentSize 不接非正数
  const next = Math.min(
    Math.max(Math.round(height), QUICK_WINDOW_MIN_HEIGHT),
    Math.max(available, 1)
  );
  if (next !== bounds.height) {
    quickWindow.setContentSize(bounds.width, next);
  }
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
