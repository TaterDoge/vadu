# AGENTS.md — vadu

桌面翻译软件。Electron 主进程承载翻译引擎与插件运行时，React 渲染层只做 UI。

## 先读哪份文档

按任务查表，不要从头读：

| 你要做的事 | 必读 |
| --- | --- |
| 新增/修改翻译服务方（含接新 AI 厂商） | [docs/ai-provider.md](docs/ai-provider.md) → [docs/plugin-spec.md](docs/plugin-spec.md) |
| 写一个新插件（内置或第三方） | [docs/plugin-spec.md](docs/plugin-spec.md) |
| 改主进程 ↔ 渲染层的通道、加新的 IPC | [docs/ipc-contract.md](docs/ipc-contract.md) |
| 了解进程边界、分层、目录归属、架构决策 | [docs/architecture.md](docs/architecture.md) |
| 查术语（profile / preset / adapter / kind …） | [docs/README.md](docs/README.md) |
| 规划下一步做什么 | [docs/roadmap.md](docs/roadmap.md) |

文档是唯一事实来源。代码与文档不一致时，先改文档再改代码，或同一次提交里一起改。

## 硬性约定

**分层**
- 翻译能力只能来自插件。主进程 core 不得内联任何厂商的 HTTP 调用（含 OpenAI）。
- 插件不得直接 `require("node:fs")` / 读写配置 / 存取明文密钥；一律走注入的 `ctx`。
- 插件只做「一次翻译调用」。语言检测、术语表、缓存、重试、批量属于 core，不要在插件里重复实现。
- 渲染层不直接发网络请求。所有外部请求经主进程插件，受 CSP 与 manifest 权限约束。

**通道**
- 主进程与渲染层共用的类型只放 `src/shared/`，两侧 import 同一份，禁止各写一份 `interface`。
- IPC 通道名统一 `vadu:` 前缀，全部登记在 `src/shared/ipc.ts`，不要在业务代码里写裸字符串。
- 长任务（流式翻译）必须可取消：每个请求带 `requestId`，`cancel` 通道可终止上游 fetch。

**插件**
- 插件清单是 `manifest.json`，`apiVersion` 主版本不匹配即拒绝加载，不做运行时适配。
- 新增插件契约字段 = 破坏性变更，必须同时更新 `docs/plugin-spec.md` 与 `apiVersion`。
- 新增权限字符串（`net:` 之外）必须先在 `docs/plugin-spec.md` 定义语义再实现。

## 工程约定

- 包管理器 `bun`，锁文件 `bun.lock`；脚本用 `bun run <script>`。
- 质量门：`bun run typecheck` + `bun run check`（Biome + ultracite）。提交前必须两条都过。
- 代码风格由 Biome 决定，不手工争论：导入分组见 `biome.jsonc`，禁止无意义注释。
- 注释只写「为什么」，且用中文；不要写复述代码的注释。
- 渲染层组件用 `@renderer/*` 别名；UI 基础件来自 shadcn（`base-nova` 风格，`@base-ui/react` 内核），不要另起一套设计系统。
- 主进程与 preload 用 `tsconfig.node.json` 的规则，渲染层用 `tsconfig.web.json`；新增跨环境目录要同时进两个 tsconfig 的 `include`。
- 不给 `window` 加未在 `src/preload/index.d.ts` 声明的能力。`contextIsolation` 保持开启，`nodeIntegration` 保持关闭。

## 安全红线

- API key 只经 `safeStorage` 加密后落盘，禁止明文写入配置、日志、渲染层状态、崩溃报告。
- 日志里不得出现完整 key / Authorization 头；截断到前 4 后 4 位。
- 插件视为完全可信（同 Obsidian 模型）：引入第三方插件前必须展示其 `permissions`，不得静默启用。
- 新增 `shell.openExternal`、`webSecurity`、`sandbox` 相关改动，先说明理由再动手。
