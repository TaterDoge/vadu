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
src/components/ui/Item.tsx                # 可复用设置项容器
theme.json                               # shadcn 语义 token、深浅配色与强调色色板
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

设置窗口采用左右布局，侧栏包含品牌区与线框图标，使用常驻 MenuItem；NSH 0.5 的 Menu 是弹层，不适用于常驻导航。内容通过 `nsh/base` 的 NavStack / NavPage 路由。通用、服务商、外观、快捷键、备份恢复五个一级分类通过 `replace` 切换，默认通用，不累积返回历史；键盘通过 Tab 移动焦点、Enter / Space 激活。主窗口不提供翻译工作台入口；全局快捷键调用 `openTranslateWindow()` 创建或重用独立窗口并聚焦。`App.test.tsx` 覆盖品牌与默认页、分类切换、无返回历史、矮窗口滚动、尺寸变化与键盘导航；独立翻译窗口的唤起按钮仅存在于测试 fixture。

`Item` 用 NSH 的 `View` / `Text` 构建，`title` 必填，`description`、`media`、`actions` 可选；原生属性（如 `testID`、`style`、`class`、事件与可访问属性）继续透传到根容器。内容与操作区按可用宽度换行，业务状态由调用方拥有，不引入 React / shadcn 运行时。

```tsx
import { Item } from './src/components/ui/Item';

<Item
  title="设置项标题"
  description="设置项说明"
  media={<Image src={icon} class="h-5 w-5" />}
  actions={
    <Switch
      checked={enabled()}
      onChange={({ checked }) => enabled.set(checked)}
      accessibilityLabel="启用设置项"
    />
  }
/>;
```

## 菜单栏托盘

启动仍显示设置窗口，并通过 NSH `Tray` 显示 `hugeicons:translate` 托盘图标（macOS 为菜单栏图标）。点击图标展开「打开设置 / 退出 Vadu」菜单；关闭设置窗口只隐藏，不退出应用；「打开设置」重新显示并聚焦原窗口，保留当前分类与运行期外观。「退出 Vadu」使用原生 `quit` 角色结束应用。Dock 图标保持不变，未添加开机自启。

`src/tray.ts` 在设置窗口挂载时注册托盘与关闭监听，卸载时移除托盘；`nsh.json` 的 `window.closeOnPress: false` 阻止关闭按钮销毁主窗口。`tests/Tray.test.tsx` 覆盖启动可见、重复关闭隐藏与聚焦恢复；原生菜单栏图标和菜单行为仍需 macOS 实测，headless 不提供托盘菜单驱动。

## 原生主题

设置 → 外观可选择浅色、深色或跟随系统，支持中性、蓝色、翠绿、琥珀、玫红、紫色六种强调色，以及 Nova / Lyra 两种风格。默认跟随系统、中性色、Nova；切换即时作用于设置与翻译窗口，切页或重开翻译窗口不重置。启动时从 `vadu.config` 恢复已保存的选择。

- `nsh.json` 通过 `theme` 加载 `theme.json`，使用 NSH 的 `setTheme` / `setColorScheme`，不引入 CSS、React 或 shadcn 运行时。
- `theme.json` 是颜色的单一来源；色块预览也读取对应 token。非中性色只覆盖强调色及配对前景色，琥珀色始终使用深色文字。
- Nova 使用 Geist Mono；Lyra 使用 JetBrains Mono，仅切换字体，不再改变字号与圆角。两种字体随应用打包，来源与 OFL 许可证见 `assets/fonts/`；快捷键符号使用 Lucida Grande，缺字由平台回退。
- 新 UI 的颜色使用 `bg-background`、`text-foreground`、`border-border` 等语义类，不写死主题颜色；字号、行高、圆角与间距使用 `text-sm`、`leading-5`、`rounded-md`、`p-4` 等 NSH 内置类，不再定义主题尺寸 token。SVG 图标用原生 `tintColor` 跟随颜色 token。
- 原生滚动条宽 6pt，滑块使用前景色 20% / 悬停 35% 透明度。不设置 ring 样式；键盘焦点使用可见边框。窗口拖拽沿用原生 `desktop.windowDrag`，不迁入浏览器的 View Transition 或 `-webkit-*` 规则。

## 配置并开始翻译

1. 在**设置 → 服务商 → 翻译**中新增服务商。选择 **Chat Completions**，填写名称和含版本路径的 Base URL（如 `https://api.openai.com/v1`）。**Responses** 和 **Anthropic Messages** 可选择和保存，接入状态显示在协议下方。
2. 服务需要认证时填入 API Key。点击输入框右侧的眼睛可查看已保存的密钥或切换新输入值的显示。隐藏已保存的密钥后可输入替换值，留空保存会保留已存凭据。点击**保存**并确认新地址，应用将 API Key 写入 NSH Storage 的独立键（`vadu.secret.<profileId>`），绑定该服务商的接口地址。密钥以明文保存在本地 `storage.json` 中。
3. 点击「模型」标签右侧的**选择模型**，在弹层中搜索和选择模型。填写地址后，新输入的 API Key 可直接用于获取模型，无需先保存；首次请求该地址前需确认。展开时自动加载模型列表，右上角可刷新。也可直接输入模型 ID。保存模型并启用服务商。同一行的**健康检测**使用当前模型发起一次 Chat Completions 对话，确认模型能够正常回复，结果通过浮层通知显示。
4. 首次使用时，在**设置 → 快捷键 → 唤起翻译浮窗**点击键帽，录入一个全局组合键。按该组合打开浮窗，选择服务商与目标语言，输入原文后点击**翻译**。点击**取消翻译**或隐藏、关闭浮窗会取消请求，并保留已显示的译文。

模型列表、健康检测和 SSE 翻译使用 NSH `fetch`，代理与连接由平台网络栈管理。网络行为与取消语义见[平台 API](./docs/nsh/native-api.md)。

## 快捷键与配置存储

在**设置 → 快捷键**中，每行末尾的开关显示该项是否开启。全局项可以录入、开关和恢复默认。两个局内项的键帽和开关均为只读。按 Esc / Tab、失焦、切页或应用退后台会取消录入。设置模块校验键位、已启用项之间的冲突和 NSH 已知的系统保留组合。

已实现的动作由 `src/feature/settings/shortcuts/runtime.ts` 集中声明 action ID、作用域与执行函数，`setupShortcuts` 统一处理配置更新、全局注册与局内焦点边界。翻译窗口不再自行读取快捷键配置或调用 keymap；设置页仅负责录入 UI 与临时捕获。

“唤起翻译浮窗”默认开启、键位为空。录入后立即注册，关闭开关会释放组合，重新开启会沿用已保存的键位。恢复默认会清空键位，保留开关状态。重复按键会聚焦同一浮窗。未固定时，点击其他窗口或切换 Space 使浮窗失焦时会自动隐藏。macOS 上，浮窗聚焦时也可按 `⌘W` 隐藏，下次唤起保留原文。若已将 `⌘W` 分配给其他快捷键，优先使用已保存的绑定。设置窗口隐藏后快捷键仍有效。录入期间暂停全局与局内动作，取消后恢复，设置窗口卸载时统一清理绑定。全局项显示实际注册状态。注册失败会保留已保存的组合，可换键或释放占用后重新开启。

“浮窗内打开设置”默认 `mod+,`（macOS 为 Command + 逗号），仅翻译窗口聚焦时生效；显示并聚焦原设置窗口，保留当前分类，也可恢复隐藏或最小化的设置窗口。翻译窗失焦、隐藏或关闭时解绑。

“浮窗内切换固定窗口”默认 `mod+p`（macOS 为 `⌘P`），也可点击浮窗工具栏的图钉。固定后窗口置顶，切换到其他应用仍保持可见。再次触发即取消固定，恢复失焦自动隐藏。关闭后重新打开默认未固定。

普通配置集中保存在 NSH Storage 的 `vadu.config`，文档包含 `settings` 和 `profiles`。旧版快捷键按已开启读取，已保存的组合继续生效。校验失败时保留原值。NSH 后台写盘，保存返回不等于已 fsync。后续整包备份复用业务文档，不复制底层 Storage，不含密钥；当前尚无导入 / 导出功能。格式、路径、扩展方式与恢复确认流程见 [配置存储设计](./docs/nsh/storage.md)。

Settings 通过同一队列提交三个模块的修改，服务商密钥独立存储。`nsh` CLI 负责构建平台宿主和打包应用。

界面和托盘共用 `src/icons.ts` 内按需生成的图标。健康检测期间，按钮前的 Lucide 心电图切换为三点动画。桌面端按 `svg-spinners:3-dots-scale` 的节奏用 NSH 原生动画依次缩放圆点；开启系统“减少动态效果”时显示原版静态图标。`bun install` 从 `vendor/nsh-icons` 安装[上游 TSX 包](https://github.com/SuperNSH/icons/tree/95c1f04bef7e853309081f04039a5db2471b9107/packages/nsh-icons)。新增图标可运行 `bun run icons:add lucide:heart`，再运行 `bun fmt src/icons.ts`。图标许可见 [Hugeicons LICENSE](./assets/licenses/Hugeicons-LICENSE.txt)、[Lucide LICENSE](./assets/licenses/Lucide-LICENSE.txt) 和 [SVG Spinners LICENSE](./assets/licenses/SVG-Spinners-LICENSE.txt)。

```sh
bun install --frozen-lockfile # 安装依赖
nsh run                       # 启动本机开发宿主
nsh check                     # 检查 TS/TSX 类型
nsh test                      # 运行单元与 headless 交互测试
nsh package --target macos    # 默认输出到 .nsh/out/
```
