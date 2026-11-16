# vadu

## NSH 重写中

当前 `rewrite/nsh` 分支基于 NSH（TSX + Rust），已搭建设置主窗口的分类导航与独立翻译窗口壳。翻译工作台定位为仅通过快捷键唤起，快捷键尚未接线。翻译、插件和配置等业务功能尚未迁移；五个设置分类均由独立 Page 渲染；外观页提供原生主题切换，快捷键页保留设置项预览；通用、服务商、备份恢复页暂为空容器，不显示公共标题或占位说明。

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
src/windows/settings/pages/              # 外观可切换，快捷键预览操作禁用
src/windows/translate/TranslateWindow.tsx # 独立翻译窗口壳与唤起函数
src/lib.rs                               # Rust 原生模块入口
```

设置窗口采用左右布局，侧栏包含品牌区与线框图标，使用常驻 MenuItem；NSH 0.5 的 Menu 是弹层，不适用于常驻导航。内容通过 `nsh/base` 的 NavStack / NavPage 路由。通用、服务商、外观、快捷键、备份恢复五个一级分类通过 `replace` 切换，默认通用，不累积返回历史；键盘通过 Tab 移动焦点、Enter / Space 激活。主窗口不提供翻译工作台入口；`openTranslateWindow()` 使用 `Window.open` 创建或重用独立窗口并聚焦，后续由快捷键调用。`App.test.tsx` 覆盖品牌与默认页、分类切换、无返回历史、矮窗口滚动、尺寸变化与键盘导航；独立翻译窗口的唤起按钮仅存在于测试 fixture。

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

## 原生主题

设置 → 外观可选择浅色、深色或跟随系统，支持中性、蓝色、翠绿、琥珀、玫红、紫色六种强调色，以及 Nova / Lyra 两种风格。默认跟随系统、中性色、Nova；切换即时作用于设置与翻译窗口，切页或重开翻译窗口不重置。**当前只保留本次运行的选择，重启恢复默认；尚未接入 Rust Settings 持久化。**

- `nsh.json` 通过 `theme` 加载 `theme.json`，使用 NSH 的 `setTheme` / `setColorScheme`，不引入 CSS、React 或 shadcn 运行时。
- `theme.json` 是颜色的单一来源；色块预览也读取对应 token。非中性色只覆盖强调色及配对前景色，琥珀色始终使用深色文字。
- Nova 使用 Geist Mono 与 10pt 基础圆角；Lyra 使用 JetBrains Mono、零圆角及紧凑字号。两种字体随应用打包，来源与 OFL 许可证见 `assets/fonts/`；快捷键符号使用 Lucida Grande，缺字由平台回退。
- 新 UI 使用 `bg-background`、`text-foreground`、`border-border` 等语义类。可切换圆角与字号使用 `rounded-(--radius-md)`、`text-(length:--text-sm)`，不写死中性色和圆角。SVG 图标用原生 `tintColor` 跟随 token。
- 原生滚动条宽 6pt，滑块使用前景色 20% / 悬停 35% 透明度。不设置 ring 样式；键盘焦点使用可见边框。窗口拖拽沿用原生 `desktop.windowDrag`，不迁入浏览器的 View Transition 或 `-webkit-*` 规则。

当前目录也是 Rust crate（`Cargo.toml`、`src/lib.rs`；`nsh.json` 中 `"rust": "."`）。原生模块 `vadu/native` 暂时保留脚手架导出 `Badge`、`Format`、`Counter`，导航不依赖这些示例。

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
