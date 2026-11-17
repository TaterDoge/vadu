# vadu

## NSH 重写中

当前 `rewrite/nsh` 分支基于 NSH（TSX + Rust），已搭建设置主窗口的分类导航与独立翻译窗口壳。翻译工作台通过全局快捷键唤起或隐藏。五个设置分类均由独立 Page 渲染；外观页提供运行期原生主题切换；快捷键页支持录入、校验、持久化与单项重置；通用、服务商、备份恢复页暂为空容器。翻译、插件与其余配置业务尚未迁移。

- 原 GitHub 仓库和提交历史继续保留，`main` 暂时保持 Electron 实现。
- 重写前的 Electron 快照保存在 [`electron-final`](https://github.com/TaterDoge/vadu/tree/electron-final) Tag。
- [迁移范围与进度](./docs/nsh-migration.md) 记录已实现内容、导航边界与后续验证顺序。
- [NSH 文档索引](./docs/README.md) 维护当前架构、原生 API 与第三方 JS 插件设计；本分支不再保留 Electron 文档副本。

## NSH 工程

`App.tsx` 只负责启动，窗口实现放在 `src/windows/`：

```text
App.tsx                                  # 挂载设置主窗口
src/windows/settings/SettingsWindow.tsx   # 设置侧栏与内容路由
src/components/ui/Item.tsx                # 可复用设置项容器
src/theme.ts                             # 应用级外观偏好、字体与原生主题切换
theme.json                               # shadcn 语义 token、深浅配色与强调色色板
src/windows/settings/pages/              # 外观可切换，快捷键可录入并保存
src/settings.ts                          # TS 配置校验与 NSH Storage 持久化
src/shortcuts.ts                         # 集中定义快捷键动作，统一管理全局 / 局内绑定与清理
src/tray.ts                              # 原生托盘与主窗口关闭隐藏
src/windows/translate/TranslateWindow.tsx # 独立翻译窗口壳与唤起函数
src/lib.rs                               # Rust 原生模块入口
```

设置窗口采用左右布局，侧栏包含品牌区与线框图标，使用常驻 MenuItem；NSH 0.5 的 Menu 是弹层，不适用于常驻导航。内容通过 `nsh/base` 的 NavStack / NavPage 路由。通用、服务商、外观、快捷键、备份恢复五个一级分类通过 `replace` 切换，默认通用，不累积返回历史；键盘通过 Tab 移动焦点、Enter / Space 激活。主窗口不提供翻译工作台入口；`openTranslateWindow()` 使用 `Window.open` 创建或重用独立窗口并聚焦，`toggleTranslateWindow()` 由全局快捷键调用，窗口可见时隐藏，否则唤起。`App.test.tsx` 覆盖品牌与默认页、分类切换、无返回历史、矮窗口滚动、尺寸变化与键盘导航；独立翻译窗口的唤起按钮仅存在于测试 fixture。

`Item` 用 NSH 的 `View` / `Text` 构建，`title` 必填，`description`、`media`、`actions` 可选；原生属性（如 `testID`、`style`、`class`、事件与可访问属性）继续透传到根容器。内容与操作区按可用宽度换行，业务状态由调用方拥有，不引入 React / shadcn 运行时。

```tsx
import { Item } from "./src/components/ui/Item";

<Item
  title="设置项标题"
  description="设置项说明"
  media={<Image src={icon} class="h-5 w-5" />}
  actions={<Switch checked={enabled()} onChange={({ checked }) => enabled.set(checked)} accessibilityLabel="启用设置项" />}
/>
```

## 菜单栏托盘

启动仍显示设置窗口，并通过 NSH `Tray` 显示 V 字托盘图标（macOS 为菜单栏图标）。点击图标展开「打开设置 / 退出 Vadu」菜单；关闭设置窗口只隐藏，不退出应用；「打开设置」重新显示并聚焦原窗口，保留当前分类与运行期外观。「退出 Vadu」使用原生 `quit` 角色结束应用。Dock 图标保持不变，未添加开机自启。

`src/tray.ts` 在设置窗口挂载时注册托盘与关闭监听，卸载时移除托盘；`nsh.json` 的 `window.closeOnPress: false` 阻止关闭按钮销毁主窗口。`tests/Tray.test.tsx` 覆盖启动可见、重复关闭隐藏与聚焦恢复；原生菜单栏图标和菜单行为仍需 macOS 实测，headless 不提供托盘菜单驱动。

## 原生主题

设置 → 外观可选择浅色、深色或跟随系统，支持中性、蓝色、翠绿、琥珀、玫红、紫色六种强调色，以及 Nova / Lyra 两种风格。默认跟随系统、中性色、Nova；切换即时作用于设置与翻译窗口，切页或重开翻译窗口不重置。**当前只保留本次运行的选择，重启恢复默认；尚未接入 Settings 持久化。**

- `nsh.json` 通过 `theme` 加载 `theme.json`，使用 NSH 的 `setTheme` / `setColorScheme`，不引入 CSS、React 或 shadcn 运行时。
- `theme.json` 是颜色的单一来源；色块预览也读取对应 token。非中性色只覆盖强调色及配对前景色，琥珀色始终使用深色文字。
- Nova 使用 Geist Mono；Lyra 使用 JetBrains Mono，仅切换字体，不再改变字号与圆角。两种字体随应用打包，来源与 OFL 许可证见 `assets/fonts/`；快捷键符号使用 Lucida Grande，缺字由平台回退。
- 新 UI 的颜色使用 `bg-background`、`text-foreground`、`border-border` 等语义类，不写死主题颜色；字号、行高、圆角与间距使用 `text-sm`、`leading-5`、`rounded-md`、`p-4` 等 NSH 内置类，不再定义主题尺寸 token。SVG 图标用原生 `tintColor` 跟随颜色 token。
- 原生滚动条宽 6pt，滑块使用前景色 20% / 悬停 35% 透明度。不设置 ring 样式；键盘焦点使用可见边框。窗口拖拽沿用原生 `desktop.windowDrag`，不迁入浏览器的 View Transition 或 `-webkit-*` 规则。

## 快捷键与配置存储

设置 → 快捷键：点击键帽后按组合键录入；Esc / Tab、失焦、切页或应用退后台取消。TS 设置模块校验无效 / 重复 / NSH 已知系统保留组合，保存后重新打开可读取；全局项可恢复默认值。

已实现的动作由 `src/shortcuts.ts` 集中声明 action ID、作用域与执行函数，`setupShortcuts()` 统一处理配置更新、全局注册与局内焦点边界。翻译窗口不再自行读取快捷键配置或调用 keymap；设置页仅负责录入 UI 与临时捕获。

“唤起 / 隐藏翻译浮窗”在启动时自动注册已保存的组合，未配置时默认 `mod+shift+m`（macOS 为 Command+Shift+M，其余桌面为 Ctrl+Shift+M）。窗口可见时隐藏，否则创建或恢复并聚焦；设置窗口隐藏后仍有效。录入任一快捷键期间暂停全局与局内动作，取消后恢复，保存或重置成功后立即换绑；设置窗口卸载时统一清理绑定。全局项显示真实注册状态，不再使用禁用开关；注册失败不回滚已保存配置，也不静默换键，请更换组合或释放占用后重新录入。

“浮窗内打开设置”默认 `mod+,`（macOS 为 Command + 逗号），仅翻译窗口聚焦时生效；显示并聚焦原设置窗口，保留当前分类，也可恢复隐藏或最小化的设置窗口。录入新组合保存后立即生效，重开读取已保存组合；翻译窗失焦、隐藏或关闭时解绑，不注册为系统全局快捷键。该项显示启用状态，不提供额外开关；“浮窗内切换固定窗口”仍未实现，开关保持禁用。

普通配置集中保存在 NSH Storage 的 `vadu.config`，使用带 `schemaVersion` 的 JSON；损坏或较新版本拒绝覆盖。NSH 后台写盘，保存返回不等于已 fsync。后续整包备份复用业务文档，不复制底层 Storage，不含密钥；当前尚无导入 / 导出功能。格式、路径、扩展方式与恢复确认流程见 [配置存储设计](./docs/nsh/storage.md)。

当前目录也是 Rust crate（`Cargo.toml`、`src/lib.rs`；`nsh.json` 中 `"rust": "."`）。普通配置由 `src/settings.ts` 直接使用 NSH 的 TS API；`vadu/native` 保留脚手架导出 `Badge`、`Format`、`Counter`，导航不依赖这些示例。

```sh
nsh run                      # this machine's backend; --target ios, android, web, macos, linux, windows or gpui
nsh check                    # cargo check of the crate, then type checks App.tsx against the declarations generated from it
nsh test                     # cargo test, then App.test.tsx, headless; --target to run it on a platform
nsh package --target web     # or ios, android, macos, linux, windows
```

`nsh` describes the crate's exports with a small program of the crate and builds the app's hosts with it linked in.
TSX edits are hot updates; Rust edits rebuild and restart the app. The first build writes the crate's TypeScript declarations into
`.nsh/types/vadu/native.d.ts`, doc comments included.

A function or a member runs the way its Rust signature says: one that is not `async` runs inside the TSX call and
returns its value (`Format.times(2)`, `counter.count`); an `async fn` returns a Promise and runs as a task with NSH's
services; a module function taking `cx: &mut ModuleCx` reaches the platform in order with the UI and returns a Promise.
Register more in `src/lib.rs` with `registry.register::<…>()` (components), `registry.module::<…>()` and
`registry.class::<…>()`.

The `nsh` commands build the app's hosts from the NSH crates `Cargo.toml` depends on: crates.io's at the version of the
`nsh` you run (keep the `nsh-*` dependencies at that version when you upgrade `nsh`), or an NSH checkout's by path.

NSH-generated files stay in `.nsh/`: runner sources in `.nsh/rust/` and default packages in `.nsh/out/`.
Cargo keeps its normal `target/` directory and respects your existing `CARGO_TARGET_DIR`.

We recommend building with [huacnlee/cargo](https://github.com/huacnlee/cargo), the Cargo NSH is developed with: a
drop-in fork that builds each dependency once for all your projects and Git worktrees and keeps its build directory
under a size limit on its own, with nothing to configure. It builds under `~/.cargo/targets/` and still puts the
binaries in `target/`; it replaces `~/.cargo/bin/cargo`, and its README says how to put rustup's back.

```sh
curl -fsSL https://huacnlee.github.io/cargo/install.sh | sh     # Windows: irm https://huacnlee.github.io/cargo/install.ps1 | iex
```
