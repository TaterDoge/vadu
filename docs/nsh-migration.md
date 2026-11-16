# NSH 迁移范围与进度

> 迁移业务契约，不迁移 Electron 机制。本文记录现状、已确认范围与验证顺序；具体架构和接口只在 [NSH 文档](./README.md) 中维护。

## 1. 当前实现

当前 `rewrite/nsh` 分支使用 NSH 0.5.0（TSX + Rust），已完成设置主窗口的分类导航、运行期主题切换、独立翻译窗口壳与快捷键录入持久化，不是旧版业务功能的等价实现。

| 位置 | 已实现 | 尚未实现 |
| --- | --- | --- |
| `App.tsx` | 启动并挂载设置主窗口 | 全局快捷键接线 |
| `src/windows/settings/SettingsWindow.tsx` | 左右布局、品牌与图标、五分类 MenuItem 侧栏、图标悬停动画、独立 Page 的统一渲染、NavStack 路由与键盘激活 | 设置项编辑、业务调用 |
| `src/windows/settings/pages/{general,providers,backup}/` | 三个分类的独立 Page 空容器，无公共标题或占位说明 | 页面内容与业务 |
| `theme.json`、`src/theme.ts`、`src/windows/settings/pages/appearance/AppearancePage.tsx` | 原生语义 token、浅 / 深 / 跟随系统、六种强调色、Nova / Lyra、捆绑字体、原生细滚动条与即时预览，两窗口共用运行期主题 | Rust Settings 持久化；当前重启恢复默认 |
| `src/windows/settings/pages/shortcuts/ShortcutsPage.tsx` | 全局 / 局内分组、键帽悬停与点击录入、平台标签、冲突校验、取消与清理、自动保存、全局项重置；启用开关仍禁用 | 实际全局 / 局内快捷键动作注册 |
| `src/components/ui/Item.tsx` | 可复用的设置项容器：内置字号标题（14pt）、可选说明（12pt）/ 媒体 / 操作插槽、窄宽度换行，保留 NSH 响应式 props 与原生属性透传 | 不承载设置值、持久化或快捷键业务 |
| `src/components/ui/Kbd.tsx` | 可复用的 Kbd / KbdGroup：参照 shadcn 的键帽样式：默认高度 / 最小宽度 28pt、四边各 4pt 内边距、内置圆角与主题配色、4pt 键间距与独立符号字体，保留原生属性及响应式样式透传 | 不承载快捷键录入或注册 |
| `src/components/ui/motion.ts` | 可复用的 `createIconHoverMotion()`，封装图标悬停动画与卸载清理 | 其他动画按需添加 |
| `src/windows/translate/TranslateWindow.tsx` | 独立窗口壳、创建与重用、隐藏唤起、关闭重开 | 快捷键唤起、翻译流与取消 |
| `App.test.tsx`、`tests/Item.test.tsx`、`tests/Kbd.test.tsx`、`tests/Theme.test.tsx` | 五个分类的独立挂载与卸载、无公共标题与占位说明、快捷键与可访问名称、Item 可选插槽与响应式更新、Kbd 单键 / 组合键、响应式样式透传与方形尺寸回归、禁用状态和键盘交互、系统外观跟随与手动优先、强调色恢复、字体切换时保持内置字号与打开翻译窗口后的主题状态保留；矮窗口侧栏滚动测试仍依赖当前不存在的滚动容器，属于既有失败 | 翻译窗口生命周期与业务、插件与配置测试 |
| `src/lib.rs`、`src/settings.rs`、`tests/Shortcuts.test.tsx` | `vadu/native` Settings、Rust 默认值与带版本配置文档、NSH Storage 持久化；Rust 配置测试与 TSX 录入 / 重置 / 冲突 / 清理 / 重开快照 / 配额 / Windows 语义测试；保留 Badge / Format / Counter 示例 | 其余业务核心、任务表、凭据服务、可靠落盘回执与真实磁盘恢复验证 |
| 插件与备份恢复 | 配置文档及整包备份恢复设计见 [配置存储](./nsh/storage.md) | 独立 VM、第三方安装、受控 HTTP、安全凭据存储、备份导入 / 导出 API 与 UI |

`.nsh/` 与 `target/` 为生成目录；不把生成类型或脚手架示例当业务已落地的证明。

## 2. 窗口与导航范围

```text
应用
├── 设置中心（主窗口）
│   ├── 通用
│   ├── 服务商（翻译 / OCR / TTS 的配置实例）
│   ├── 外观
│   ├── 快捷键
│   └── 备份恢复
└── 翻译工作台（独立窗口，仅快捷键唤起）
```

`App.tsx` 仅保留 NSH 启动代码，设置与翻译的 TSX 实现分别放在 `src/windows/settings/` 和 `src/windows/translate/`，不为每个窗口建立独立 engine 或 URL 入口。

主窗口启动尺寸为 960 × 620 逻辑点（`nsh.json` 的 `window.defaultSize`），保留拖拽缩放。默认“通用”，尺寸变化不重置分类，重启不持久化该选择。窗口保持左右布局，侧栏使用常驻 MenuItem，选中项为主题侧栏强调背景与加粗文字，圆角使用 NSH 内置尺寸，不随 Nova / Lyra 切换；NSH 0.5 的 Menu 是弹层，不包裹常驻导航。内容由 `nsh/base` 的 `createNavStack` / `NavStack` / `NavPage` 承载；一级分类用 `replace` 切换，不压入返回历史。侧栏选中态直接读取路由栈，不另存一份 `signal`。鼠标进入任一菜单整行时，仅图标播放一次 300ms 的轻抬与轻摆动画，结束回原位；每项在组件体内创建一次 `src/components/ui/motion.ts` 的 `createIconHoverMotion()`，将 `style` 绑定到图标、悬停时调用 `play()`；底层通过 NSH 原生 `createMotion` 播放并遵循系统的减少动态效果设置，组件卸载时停止动画。悬停不切换分类。键盘通过 Tab 移动焦点、Enter / Space 激活，不再使用 Tabs 的方向键自动切页。

翻译工作台不是主窗口里的可切换页面，也不提供主窗口导航入口。`openTranslateWindow()` 使用 `Window.open`，固定窗口 ID 为 `translate`；重复调用重用窗口并聚焦，隐藏后可重新显示，关闭后可重新创建。窗口不指定设置窗口为父窗口；快捷键尚未接线，唤起按钮仅在测试 fixture 中。服务类别、选中 Profile 与编辑草稿属于后续页面状态，不升级为全局导航。

五个分类通过独立 Page 渲染，窗口不再统一显示页面标题、分类说明或业务未迁移提示；通用、服务商、备份恢复页仅为空容器。外观页已提供显示模式、六种主题色、Nova / Lyra 字体切换与预览，字号、行高、圆角与间距使用 NSH 内置类，选择只保留本次运行；主题细节见 [README](../README.md#原生主题)。快捷键页已支持三项组合的录入、校验与持久化；录制时在对应 Item 下方显示独立的规则提示，键帽保留录制占位文案。再次点击当前录制键帽、Esc / Tab、失焦、切页或退后台取消录入，保留原绑定并停止捕获按键；全局项可恢复默认。开关仍为关闭且禁用，不假装已注册动作。配置通过 Rust Settings 保存，备份恢复只有设计、没有可用 UI 或 API。插件安装入口的具体 UI 留在插件管理切片中确定，不为此扩充本轮导航。

## 3. 已确认的迁移方向

- TSX 视图 → 带类型的 Rust 原生 API → Rust 核心 → 能力插件，不复刻 Electron IPC。
- NSH 自有窗口共享应用 engine；独立工作台不意味着独立 renderer 进程。
- **保留用户安装第三方 JS 插件**，采用自包含 bundle 与独立插件 VM；插件运行时是待实现能力。
- Plugin / Profile / Preset / Settings / Secrets 分开；密钥按 Profile 隔离，不回读 UI、不明文落盘。
- 翻译需要 requestId、逐块输出与真正中止上游的取消；OCR 返回文本、TTS 返回音频，两者一次性且可取消。
- 核心解析明确选择的 Profile，不保留旧工作台“取首个 AI 配置”的耦合。

调用、错误和权限细节分别以 [native-api.md](./nsh/native-api.md) 与 [plugin-spec.md](./nsh/plugin-spec.md) 为准，避免多处复制契约。

## 4. 先验证，再冻结接口

| 顺序 | 最小验证 | 通过条件 |
| --- | --- | --- |
| 1 | 假任务贯通原生调用与回调 | 类型生成、首帧、唯一终态、受理前取消与关窗清理无竞态 |
| 2 | 本地假服务验证流式 HTTP | 逐块到达、超时可结束、取消关闭上游，不把整包响应误当流 |
| 3 | 独立 VM 加载一个最小 JS 插件 | 发布模式可运行、权限不能绕过、死循环和内存超限可处理 |
| 4 | 一个 AI 协议端到端调用 | Profile 与安全凭据接线、并发不串数据；验证 SDK 是否适配 QuickJS |
| 5 | 用户插件安装 / 更新 / 禁用 / 卸载 | 清单与路径校验、权限确认、失败不挡启动、不静默删配置或密钥 |

每个切片带对应测试，再补 UI。OCR / TTS、独立工作台与平台设置按各自边界继续迁移，不因这张表承诺一次完成。质量门使用 `nsh check` 与 `nsh test`；加载、网络和运行时隔离还需发布构建实测。

## 5. 不随重写自动继承的内容

- Electron 的 main / renderer / preload、通道名、`safeStorage`、hash 窗口入口、构建与 Bun 脚本。
- 旧插件二进制 / JS 运行时兼容性、旧备份格式兼容、旧配置自动迁移或明文密钥导出授权。
- 旧版模型参数表、超时常数、草稿模型检测接口与未实现的术语表 / 缓存 / 自动重试路线图。
- 插件市场、自动分发、插件 UI、运行时 npm 安装与跨插件调用。

后续确需迁移的数据或高级功能，单独确认需求、格式、授权与失败恢复，不直接套旧文档。

## 6. 历史实现与框架参照

本分支不再保留 Electron 设计文档副本。旧实现与旧契约保存在 `main` 和 [`electron-final`](https://github.com/TaterDoge/vadu/tree/electron-final)，只有核对具体历史行为时才查，不作为 NSH 当前工程指令。

当前导航与窗口采用的 NSH 契约：[NavStack](https://nsh.dev/elements/nav-stack.md)、[桌面窗口](https://nsh.dev/modules/nsh-desktop.md)、[测试](https://nsh.dev/docs/testing-and-trace.md)。其他框架依据见[架构参照](./nsh/architecture.md#框架参照)。
