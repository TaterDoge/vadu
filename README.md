# vadu

## NSH 重写中

应用基于 NSH，界面使用 TSX，业务使用 TypeScript。设置主窗口和独立翻译浮窗共享应用状态，浮窗通过全局快捷键唤起。桌面版已接入 OpenAI 兼容 Chat Completions，支持保存服务商、从接口获取模型、流式翻译和取消。外观支持主题切换与重启恢复，快捷键支持录入、校验、持久化与单项重置。OCR、TTS、第三方插件与备份恢复仍在迁移中。

- 原 GitHub 仓库和提交历史继续保留，`main` 暂时保持 Electron 实现。
- 重写前的 Electron 快照保存在 [`electron-final`](https://github.com/TaterDoge/vadu/tree/electron-final) Tag。
- [迁移范围与进度](./docs/nsh-migration.md) 记录已实现内容、导航边界与后续验证顺序。
- [NSH 文档索引](./docs/README.md) 维护当前架构、平台 API 与第三方 JS 插件设计；本分支不再保留 Electron 文档副本。

## NSH 工程

`App.tsx` 只负责启动，窗口实现放在 `src/windows/`：

```text
App.tsx                                  # 挂载设置主窗口
src/windows/settings/SettingsWindow.tsx   # 设置侧栏与内容路由
components/ui/                           # shadcn-nsh 组件
lib/ui/                                  # shadcn-nsh 主题、样式与图标工具
theme.json                               # 深浅配色、语义 token 与强调色色板
src/windows/settings/pages/              # 分类页、服务商配置、外观与快捷键
src/feature/settings/index.ts            # 窗口与翻译业务调用的 Settings 入口
src/feature/settings/store.ts            # 整包读写、串行更新与响应式快照
src/feature/settings/appearance/         # 显示模式、强调色、风格的校验、保存与应用
src/feature/settings/shortcuts/          # 默认组合、冲突校验、保存重置与全局 / 局内绑定
src/feature/settings/providers/          # Profile 结构、校验、保存排序与地址绑定的密钥
src/tray.ts                              # 原生托盘与主窗口关闭隐藏
src/windows/translate/TranslateWindow.tsx # 翻译浮窗与唤起函数
src/windows/translate/translation-session.ts # 当前窗口的活动请求、结果和取消
src/api/request.ts                       # NSH fetch、HTTP 校验与 JSON 请求
src/api/stream.ts                        # SSE 事件读取
src/api/models.ts                        # 模型列表与健康检测
src/api/translation.ts                   # 翻译请求与 Chat Completions 解析
src/api/translation-task.ts              # 翻译事件、请求生命周期与取消
```

设置侧栏使用 shadcn-nsh 的固定 Sidebar，内容由 NavStack / NavPage 承载。通用、服务商、外观、快捷键、备份恢复五个一级分类通过 `replace` 切换，默认通用。键盘用 Tab 移动焦点，Enter 或 Space 激活。全局快捷键调用 `openTranslateWindow()` 聚焦独立翻译窗。侧栏滚动、缩放与键盘导航由 `App.test.tsx` 覆盖。

组件源码由 CLI 写入项目，registry 固定在 v0.11.0。新增通用控件前先查现有组件，按需运行 `bunx --bun shadcn-nsh@0.11.0 add <组件名>`。复制组件的来源与许可见 [NOTICE](./NOTICE)、[shadcn-nsh MIT](./assets/licenses/shadcn-nsh-LICENSE.txt)、[NSH Apache-2.0](./assets/licenses/NSH-LICENSE-APACHE.txt)。

## 菜单栏托盘

启动仍显示设置窗口，并通过 NSH `Tray` 显示 `hugeicons:translate` 托盘图标（macOS 为菜单栏图标）。点击图标展开「打开设置 / 退出 Vadu」菜单；关闭设置窗口只隐藏，不退出应用；「打开设置」重新显示并聚焦原窗口，保留当前分类与运行期外观。「退出 Vadu」使用原生 `quit` 角色结束应用。Dock 图标保持不变，未添加开机自启。

`src/tray.ts` 在设置窗口挂载时注册托盘与关闭监听，卸载时移除托盘；`nsh.json` 的 `window.closeOnPress: false` 阻止关闭按钮销毁主窗口。`tests/Tray.test.tsx` 覆盖启动可见、重复关闭隐藏与聚焦恢复；原生菜单栏图标和菜单行为仍需 macOS 实测，headless 不提供托盘菜单驱动。

## 原生主题

设置 → 外观可选择浅色、深色或跟随系统，支持默认色、蓝色、翠绿、琥珀、玫红、紫色六种强调色，以及 Nova / Lyra 两种风格。默认跟随系统、使用预设的黄绿色和 Nova。切换即时作用于设置与翻译窗口，启动时从 `vadu.config` 恢复已保存的选择。

- NSH Gallery 预设来自 shadcn-nsh v0.11.0 的 `init --theme nsh-gallery`。`lib/ui/preset.ts` 导出 Theme v5 预设，`theme.json` 提供构建时配色与应用自定义 token。外观设置通过 `defineTheme` 和 `selectTheme` 应用强调色和字体，通过 `setColorScheme` 应用显示模式。琥珀色使用深色前景。
- Nova 使用 Geist Mono，Lyra 使用 JetBrains Mono。两种字体随应用打包，来源与 OFL 许可证见 `assets/fonts/`。键帽修饰键符号使用 Lucida Grande。
- 组件采用 Gallery 的圆角、渐变和阴影，按钮的键盘焦点沿用 Gallery 预设，使用 `ring` 色边框和 3 点半透明光环。普通输入框的焦点边框使用当前强调色。滚动条沿用 NSH 原生实现，窗口拖拽使用 `desktop.windowDrag`。

## 配置并开始翻译

1. 在**设置 → 服务商 → 翻译**中新增服务商。选择 **Chat Completions**，填写名称和含版本路径的 Base URL（如 `https://api.openai.com/v1`）。**Responses** 和 **Anthropic Messages** 可选择和保存，接入状态显示在协议下方。
2. 服务需要认证时填入 API Key。点击输入框右侧的眼睛可查看已保存的密钥或切换新输入值的显示。隐藏已保存的密钥后可输入替换值，留空保存会保留已存凭据。点击**保存**并确认新地址，应用将 API Key 写入 NSH Storage 的独立键（`vadu.secret.<profileId>`），绑定该服务商的接口地址。密钥以明文保存在本地 `storage.json` 中。
3. 点击**选择模型**打开右侧抽屉，在列表中搜索、勾选或取消勾选多个模型，也可手动添加模型 ID。具备连接条件时自动加载模型列表，右上角可刷新。未保存的地址可用本次输入的 API Key 获取列表，首次请求前需确认地址。点击完成后，已选模型逐行显示，可点击行末的减号逐项移除。随后保存并启用服务商。点击**测试**打开模型检测弹窗，从已获取或已选的模型中选一个进行检测。请求使用已保存的服务商配置和 API Key，进度和结果显示在弹窗内。
4. 首次使用时，在**设置 → 快捷键 → 唤起翻译浮窗**点击键帽，录入一个全局组合键。按该组合打开浮窗，选择服务商及其具体模型与目标语言，输入原文后点击**翻译**。点击**取消翻译**或隐藏、关闭浮窗会取消请求，并保留已显示的译文。

模型列表、健康检测和 SSE 翻译使用 NSH `fetch`，代理与连接由平台网络栈管理。网络行为与取消语义见[平台 API](./docs/nsh/native-api.md)。

## 快捷键与配置存储

在**设置 → 快捷键**中，每行末尾的开关显示该项是否开启。全局项可以录入、开关和恢复默认。两个局内项的键帽和开关均为只读。按 Esc / Tab、失焦、切页或应用退后台会取消录入。设置模块校验键位、已启用项之间的冲突和 NSH 已知的系统保留组合。

已实现的动作由 `src/feature/settings/shortcuts/runtime.ts` 集中声明 action ID、作用域与执行函数，`setupShortcuts` 统一处理配置更新、全局注册与局内焦点边界。翻译窗口不再自行读取快捷键配置或调用 keymap；设置页仅负责录入 UI 与临时捕获。

“唤起翻译浮窗”默认开启、键位为空。录入后立即注册，关闭开关会释放组合，重新开启会沿用已保存的键位。恢复默认会清空键位，保留开关状态。重复按键会聚焦同一浮窗。未固定时，点击其他窗口或切换 Space 使浮窗失焦时会自动隐藏。macOS 上，浮窗聚焦时也可按 `⌘W` 隐藏，下次唤起保留原文。若已将 `⌘W` 分配给其他快捷键，优先使用已保存的绑定。设置窗口隐藏后快捷键仍有效。录入期间暂停全局与局内动作，取消后恢复，设置窗口卸载时统一清理绑定。全局项显示实际注册状态。注册失败会保留已保存的组合，可换键或释放占用后重新开启。

使用 Rift 管理虚拟工作区时，可将翻译窗排除在工作区分配之外。在 `~/.config/rift/config.toml` 的 `virtual_workspaces.app_rules` 中添加以下规则，匹配 NSH 开发宿主中的翻译窗标题。

```toml
{ app_name = "nsh", title_regex = "^vadu 翻译$", manage = false },
```

执行 `rift-cli execute config reload` 后重开 vadu，使翻译窗使用新标题。

“浮窗内打开设置”默认 `mod+,`（macOS 为 Command + 逗号），仅翻译窗口聚焦时生效；显示并聚焦原设置窗口，保留当前分类，也可恢复隐藏或最小化的设置窗口。翻译窗失焦、隐藏或关闭时解绑。

“浮窗内切换固定窗口”默认 `mod+p`（macOS 为 `⌘P`），也可点击浮窗工具栏的图钉。固定后窗口置顶，切换到其他应用仍保持可见。再次触发即取消固定，恢复失焦自动隐藏。关闭后重新打开默认未固定。

普通配置集中保存在 NSH Storage 的 `vadu.config`，文档包含 `settings` 和 `profiles`。旧版快捷键按已开启读取，已保存的组合继续生效。校验失败时保留原值。NSH 后台写盘，保存返回不等于已 fsync。后续整包备份复用业务文档，不复制底层 Storage，不含密钥；当前尚无导入 / 导出功能。格式、路径、扩展方式与恢复确认流程见 [配置存储设计](./docs/nsh/storage.md)。

Settings 通过同一队列提交三个模块的修改，服务商密钥独立存储。`nsh` CLI 负责构建平台宿主和打包应用。

界面图标使用 `lucide` 和 shadcn-nsh 的 Icon。健康检测期间，按钮显示 Spinner，并遵循系统的减少动态效果设置。原生托盘使用 `src/icons.ts` 中的 Hugeicons 图标，由 `vendor/nsh-icons` 生成。许可见 [Hugeicons](./assets/licenses/Hugeicons-LICENSE.txt) 与 [Lucide](./assets/licenses/Lucide-LICENSE.txt)。

```sh
bun install --frozen-lockfile # 安装依赖
nsh run                       # 启动本机开发宿主
nsh check                     # 检查 TS/TSX 类型
nsh test                      # 运行单元与 headless 交互测试
nsh package --target macos    # 默认输出到 .nsh/out/
```
