# AGENTS.md — vadu

## 当前工程

vadu 正在 `rewrite/nsh` 分支迁移到 NSH（TSX + Rust），当前依赖 NSH 0.5.0。已实现设置主窗口分类导航与独立翻译窗口壳，翻译、插件和配置业务尚未迁移。

- `App.tsx`：NSH 启动入口，仅挂载设置主窗口；TSX 窗口实现放在 `src/windows/`。
- `src/windows/settings/SettingsWindow.tsx`：左右布局，侧栏使用常驻 MenuItem，内容由 `nsh/base` 的 NavStack / NavPage 路由；五个一级分类通过 replace 切换，不累积返回历史。
- `src/windows/translate/TranslateWindow.tsx`：翻译窗口壳与 `openTranslateWindow()`，通过 Window.open 创建、重用并聚焦独立窗口。
- `App.test.tsx`：侧栏导航、键盘交互与尺寸变化测试；独立窗口唤起按钮仅在 `tests/fixtures/Windows.tsx` 中。
- `src/lib.rs`：`vadu/native` 原生注册入口，目前只有 Badge / Format / Counter 示例。
- `nsh.json`、`Cargo.toml`：应用与 Rust 依赖配置；CLI 与 `nsh-*` 版本保持一致。
- 翻译工作台定位为仅快捷键唤起的独立窗口，不接入主窗口导航；窗口壳已实现，全局快捷键尚未接线。

## 按任务读文档

| 任务 | 必读 |
| --- | --- |
| 确认当前范围与实现状态 | [docs/nsh-migration.md](docs/nsh-migration.md) |
| 调整分层、窗口、存储或信任边界 | [docs/nsh/architecture.md](docs/nsh/architecture.md) |
| 新增原生 API、任务、取消或错误 | [docs/nsh/native-api.md](docs/nsh/native-api.md) |
| 插件、AI 服务商、schema 或权限 | [docs/nsh/plugin-spec.md](docs/nsh/plugin-spec.md) |

文档是当前设计来源，但草案不等于已实现能力。修改行为时同步文档；先核实 NSH 绑定与发布模式，不能将设计签名写成已生成 API。Electron 历史只在 `main` / `electron-final` 查询，不恢复旧工程约定。

## 检查与文件纪律

- 运行、构建说明见 [README.md](README.md)。质量门：`nsh check`，然后 `nsh test`；不运行旧 Bun / Electron 脚本。
- 新增非平凡逻辑带小测试；插件加载、流式网络、取消和权限还需发布构建验证，不只测开发模式。
- `.nsh/` 与 `target/` 是生成文件，不提交；应用 `Cargo.lock` 随代码提交。
- 不手改 `.nsh/types/`。UI ↔ Rust 的 DTO 由 Rust 声明生成，不两端各写一份接口。
- 复用当前 NSH 组件与响应式模式，不迁入 React renderer、shadcn、preload 或 Electron 路由机制。
- 生成或修改 TSX 时，JSX 元素的条件渲染优先使用 NSH 内置 `<If when={...} else={...}>...</If>`，尽量避免用三目表达式切换元素；文本、样式和普通属性值的计算不受此限制。
- 注释用中文，只解释原因；不要设置 ring 样式，保留键盘焦点和可访问名称。

## 架构硬约束

- UI → 带类型的原生 API → Rust 核心 → 能力插件；不建立字符串 IPC 通道或通用 RPC。
- 厂商协议只放插件；UI 不直连厂商，核心不内联厂商 HTTP。插件只做一次调用，不自行持久化配置或实现核心重试 / 缓存策略。
- 保留用户安装第三方 JS 插件。独立插件 VM 与受控宿主桥是待实现目标，不是现成安全保证；禁止用 UI 的 `eval` / `new Function` 装插件。
- NSH 自有窗口共享应用 engine，不套用 Electron 多 renderer 模型；任务仍需 requestId、回调归属与生命周期清理。
- 翻译要逐块输出且可取消上游；OCR / TTS 一次性、可取消。不要只停止 UI 更新而留下后台任务。
- Plugin / Profile / Preset / Settings / Secrets 分离。明确选择 Profile，不暗取首个 AI 配置，不静默换厂商。
- 插件契约破坏性变更需同时更新文档与 apiVersion；兼容可选字段不机械升版。新增权限先定义语义再实现。

## 安全红线

- 已保存密钥不回读 UI、不写普通配置、日志或崩溃报告；只经系统安全存储持久化。不可用时拒绝持久化，禁止明文降级，不使用 Electron `safeStorage`。
- 用户新输入密钥仅走短期输入与提交路径，提交后清空；不进入共享或持久化 UI 状态。
- 日志不得包含完整 key、Authorization 头、原文 / 译文或上游响应正文；默认只记状态。确需识别 key 时最多前 4 后 4 位，短 key 全遮蔽。
- 插件只取得本次 Profile 的受控网络与凭据上下文，不注入文件、进程、UI 或任意原生能力；NSH 应用 capabilities 不能替代插件权限检查。
- 第三方插件启用前展示来源与权限；权限扩大重新确认。独立 VM 不是 OS 沙箱，隔离验证前不开放安装入口。
- 删除 Profile / 凭据、卸载伴随数据清理或备份覆盖需明确确认；不得因重写自动清理用户数据、导出明文密钥或承诺旧格式兼容。
- 新增外链、文件 / 进程或其他敏感系统能力前说明理由，先定义并测试宿主侧授权；禁止原样透传系统接口。
