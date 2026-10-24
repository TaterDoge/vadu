import { Menu, Tray, app, nativeImage } from "electron";

import icon from "../../resources/icon.png?asset";
import { toggleMainWindow } from "./windows";

// 托盘对象被 GC 回收后图标会直接消失，必须保留模块级引用
let tray: Tray | null = null;

export function createTray(): void {
  if (tray) {
    return;
  }
  const image = nativeImage.createFromPath(icon).resize({
    height: 16,
    width: 16,
  });

  tray = new Tray(image);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        click: () => {
          toggleMainWindow();
        },
        label: "打开设置",
      },
      { type: "separator" },
      {
        click: () => {
          // relaunch 只登记重启，必须 exit 才能立刻退出；quit 可能被 before-quit 拦下
          app.relaunch();
          app.exit(0);
        },
        label: "重启",
      },
      {
        click: () => {
          app.quit();
        },
        label: "退出",
      },
    ])
  );
}
