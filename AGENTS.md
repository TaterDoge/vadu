# AGENTS.md — vadu

## 当前工程与范围

vadu 正在从 Electron 重写为 NSH 原生应用（TSX + Rust）。以当前工作树为准，不根据分支名推断实现；`README.md` 与部分文档中的 `rewrite/nsh` 是迁移背景。

- 已实现：设置主窗口五分类导航、运行期主题切换、独立翻译窗口壳、快捷键录入 / 校验 / 持久化 / 单项重置，以及“唤起翻译浮窗”全局快捷键、“浮窗内打开设置”局内快捷键。
- 尚未实现：“浮窗内切换固定窗口”局内动作、翻译 / OCR / TTS 业务、插件运行时与安装、备份导入 / 导出。通用、服务商、备份恢复页仍为空容器。
- 外观偏好仅保留本次运行，尚未接入 Settings 持久化；全局快捷键启动时自动注册，保存成功不代表注册成功，以页面状态为准；打开设置局内项自动启用，仅翻译窗聚焦时绑定；固定窗口项开关仍关闭且禁用。
- 历史 Electron 实现见 `electron-final` Tag；不恢复旧目录、IPC、preload、React renderer 或 Bun 构建脚本，不默认兼容旧配置 / 插件 / 备份。

## 代码地图

| 位置 | 职责 |
| --- | --- |
| `App.tsx` | 启动入口，仅挂载 `SettingsWindow` |
| `src/windows/settings/SettingsWindow.tsx` | 常驻 MenuItem 侧栏、NavStack / NavPage 路由、内容区域 |
| `src/windows/settings/pages/<分类>/` | 五个设置分类的独立 Page；业务状态由对应页面拥有 |
| `src/windows/translate/TranslateWindow.tsx` | 独立窗口壳、`openTranslateWindow()` 与失焦自动隐藏，不负责快捷键绑定 |
| `src/shortcuts.ts` | 集中声明 action / 作用域 / 执行函数，统一管理全局与局内绑定、换绑、录入暂停、状态与卸载清理 |
| `src/components/ui/` | `Item` 设置项容器、`Kbd` / `KbdGroup` 键帽、图标悬停动画 |
| `theme.json`、`src/theme.ts`、`assets/fonts/` | 语义颜色 token、运行期外观偏好、捆绑字体与许可证 |
| `src/lib.rs` | `vadu/native` 注册入口：脚手架示例 Badge / Format / Counter |
| `src/settings.ts` | 配置文档、默认值、快捷键校验、录入键表与 NSH Storage 串行读改写 |
| `App.test.tsx`、`tests/*.test.tsx` | NSH 交互测试；专用入口放在 `tests/fixtures/` |
| `nsh.json`、`Cargo.toml`、`Cargo.lock` | 应用标识 / 窗口 / 主题配置与 Rust 依赖 |

## 环境与命令

在仓库根目录执行。需要支持 Rust edition 2024 的工具链与 NSH CLI；当前 `nsh-core` / `nsh-base` 锁定为 0.6.0。升级时同步核对 CLI 与 `nsh-*` 依赖，不在无关任务中自动升级。

本工程没有 `package.json`，不需要 `npm install` / `bun install`。Rust 依赖由 Cargo 解析；首次 NSH 构建生成 `.nsh/tsconfig.json` 与 `.nsh/types/vadu/native.d.ts`，根 `tsconfig.json` 继承生成配置。

```sh
nsh --version                                     # 核对 CLI
cargo --version                                   # 核对 Rust 工具链
nsh run                                           # 本机开发宿主
nsh check                                         # Rust 检查、生成绑定并检查 TS/TSX
nsh test                                          # Rust 单元测试 + 全部 headless NSH 测试
nsh test "tests/Shortcuts.test.tsx"                 # 单个交互测试文件
nsh test --filter "default_and_document_roundtrip" # 按名称筛选，也作用于 Rust 测试
nsh test "tests/Shortcuts.test.tsx" --target macos --foreground
nsh package --target macos                        # macOS 发布包；其他目标见 CLI 帮助
```

- TSX 修改热更新；Rust 修改触发重编译与重启。
- macOS 原生快捷键录入测试需要 `--foreground`，会占用前台焦点；默认后台运行会触发生命周期取消录入。
- `.nsh/`、`target/` 是生成目录，不提交、不手改；默认打包输出在 `.nsh/out/`。应用 `Cargo.lock` 随依赖变更提交。
- 当前没有仓库 CI workflow 或 npm 测试 / lint 脚本，不虚构对应命令；格式与 lint 规则以 `biome.jsonc` 为准，Rust 遵循 rustfmt。

## 修改与验证

- 改动保持小而完整，复用现有组件和职责边界；不预建通用 RPC、仓储、订阅或迁移框架。
- 修改前核对调用方、测试、fixture、配置与文档；保留工作树中已有改动，不顺手修复无关问题。
- 非平凡逻辑增加或更新小测试。TSX 测试使用 `nsh/test` 的 `test` / `expect` / `open`，定位沿用 `id:`、`label:` 等原生选择器，不引入 DOM 测试框架。
- 质量门先 `nsh check`，再 `nsh test`。失败如实报告，不跳过断言伪装通过。
- 侧栏使用 `id:settings-sidebar-scroll` 的独立 Scroll 容器支持矮窗口滚动；涉及侧栏布局时一并运行 `App.test.tsx` 的滚动、尺寸变化与键盘导航回归。原生窗口的待验证项见 `docs/nsh-migration.md`。
- headless 的 `storage` 是隔离快照，不能证明真实磁盘恢复、OS 全局快捷键或跨平台原生事件。插件加载、流式网络、取消和权限还需发布构建实测。
- 行为改变时同步更新对应文档，明确区分“已实现”“目标设计”“待验证”；不把草案签名当作现成 SDK。

## UI 与原生绑定约定

- 使用 NSH 的 `View` / `Text`、`nsh/base` 组件及 `signal` / `effect` / `cleanup`；不套用 React hooks 或浏览器 DOM / CSS 机制。复用 `Item`、`Kbd`，不让通用展示组件承载配置或快捷键业务。
- JSX 元素条件渲染优先使用 NSH 内置 `<If when={...} else={...}>`；列表沿用 `<Each>`。文本、样式与普通属性计算不受此限制。
- 设置一级分类通过 `nav.replace` 切换，不累积返回历史；选中态直接读取路由栈，不再复制一份 signal。NSH 的 Menu 是弹层，不作为常驻侧栏容器。
- 翻译窗口仅定位为快捷键唤起的独立窗口，不增加设置导航入口；唤起按钮只用于测试 fixture。NSH 自有窗口共享应用 engine，不建立 Electron 式窗口广播。
- `theme.json` 是颜色单一来源；使用 `bg-background`、`text-foreground`、`border-border` 等语义类，字号、行高、圆角与间距使用 `text-sm`、`leading-5`、`rounded-md`、`p-4` 等 NSH 内置类，不再定义主题尺寸 token。SVG 用 `tintColor` 跟随 token，不写死主题颜色。
- 不设置 ring 样式；保留可见键盘焦点、可访问名称和原生窗口拖拽。注释用中文，只解释原因。
- 普通配置通过 `src/settings.ts` 调用 NSH 的 TS API；需要原生业务时才使用带类型的 `vadu/native`，其 DTO 由 Rust 生成。禁止手改 `.nsh/types/` 或在两端重复维护绑定接口。
- `Settings` 方法返回 Promise；页面同时处理 `SettingsError` 与意外 Promise 拒绝。同步原生导出不做阻塞网络 / 磁盘 I/O。

## 配置与安全边界

- `src/settings.ts` 是普通配置唯一业务入口。UI 只提交修改意图，模块串行读取最新文档、运行时校验并更新单项；不在页面分散调用 Storage 或回写旧整包快照。队列只协调同一应用 engine 内的调用，不承诺跨进程事务。
- 普通配置集中在 NSH Storage 的 `vadu.config`，带 `schemaVersion`。坏 JSON、不支持的版本、未知字段与非法组合拒绝覆盖；只有键不存在才使用默认值。
- 新增配置字段时同步 schema、实际旧版本迁移与测试；先完整校验再覆盖源数据，不预写空迁移链。
- NSH Storage 配额为总计 5 MiB，写入在后台执行；调用成功不等于已 fsync。不能据此承诺可靠落盘或直接复制底层 `storage.json` 作为备份。
- `nsh.json` 当前 ID 为 `com.example.vadu`；更改 ID 会改变数据目录，不会自动迁移旧数据。不得在无关任务中改 ID 或清理用户数据。
- Plugin / Profile / Preset / Settings / Secrets 分离。密钥只经系统安全存储持久化，不进普通配置、备份、日志或崩溃报告；安全存储不可用时拒绝持久化，不明文降级。
- 已保存密钥不回读 UI；新输入值仅短期用于提交，随后清空。日志不包含完整 key、Authorization、原文 / 译文或上游响应正文。
- 删除 Profile / 凭据、卸载伴随清理或恢复覆盖需要明确确认；不因重写自动删除数据或承诺旧格式兼容。
- 厂商协议只放能力插件；UI 不直连厂商，Rust 核心不内联厂商 HTTP。核心使用明确选中的 Profile，不暗取首个配置或静默换厂商。
- 第三方插件的独立 VM、受控网络 / 凭据桥仍待实现；禁止通过 UI 的 `eval` / `new Function` 加载插件。独立 VM 不等于 OS 沙箱，隔离验证前不开放安装入口；新增权限需宿主校验与用户确认。
- 翻译任务需要 requestId、逐块输出、唯一终态与真正关闭上游的取消；卸载 / 关窗必须清理任务和回调，不能只停止 UI 更新。

## 按任务读文档

- 当前范围与验证顺序：`docs/nsh-migration.md`。
- 窗口、分层、运行时与信任边界：`docs/nsh/architecture.md`。
- 原生调用、错误、任务与取消：`docs/nsh/native-api.md`。
- 配置格式、存储限制、扩展与备份恢复：`docs/nsh/storage.md`。
- 插件、AI 服务商、schema 与权限：`docs/nsh/plugin-spec.md`。
- 总索引与运行说明：`docs/README.md`、`README.md`。

文档各自维护契约，不在代码或其他文档复制整套接口。GitHub 查询和操作统一使用 `gh`；需要浏览器验证时使用 yab MCP。
