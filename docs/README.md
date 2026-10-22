# vadu 文档

vadu 是一个桌面翻译软件。翻译能力全部由「插件」提供，应用本身只负责调度、配置、UI 与插件生命周期管理。首要场景是 AI 翻译：用户填自己的 endpoint、密钥、模型。

## 文档地图

| 文档 | 内容 | 什么时候读 |
| --- | --- | --- |
| [architecture.md](./architecture.md) | 进程模型、分层、目录结构、数据流、架构决策记录 | 第一次接触本项目 / 要改整体结构 |
| [plugin-spec.md](./plugin-spec.md) | 插件清单格式、运行契约、生命周期、权限、错误码、版本兼容 | 写插件 / 改插件加载器 |
| [ai-provider.md](./ai-provider.md) | AI 翻译插件：预设厂商、协议适配器、prompt、流式解析、成本与多模态 | 接新的 AI 厂商 / 调翻译质量 |
| [ipc-contract.md](./ipc-contract.md) | 主进程 ↔ 渲染层通道表、共享类型、流式事件协议 | 加功能要跨进程 / 改 preload |
| [roadmap.md](./roadmap.md) | 里程碑、每阶段验收标准、明确不做的事 | 规划下一步 |

## 30 秒心智模型

```
渲染层 (React)                 主进程 (Node)                    外部
─────────────────────────────────────────────────────────────────────
翻译面板 UI  ──IPC──▶  translate service ──▶ plugin registry ──▶ 插件
   ▲                     │                        │              │
   └──流式 chunk──────────┘                       │              ▼
                                               配置/密钥       HTTP(S) 厂商 API
```

- **插件是翻译能力的唯一边界。** 主进程 core 不认识 OpenAI、DeepL 或任何厂商。
- **AI 是一个插件，多个协议适配器。** 不是「每厂商一个插件」，用户填 baseURL 就能覆盖大多数服务。
- **流式是默认形态。** 插件产出增量文本，core 累积并转发，UI 边收边渲染。
- **配置由清单驱动。** 插件的设置表单来自 `manifest.json` 的 schema，插件不写 UI 代码。

## 术语表

| 术语 | 含义 | 不是什么 |
| --- | --- | --- |
| **plugin** | 一个可加载的翻译服务实现，目录形态，含 `manifest.json` + 入口模块 | 不是 npm 包，不走 npm 依赖解析 |
| **kind** | 插件能力种类。当前只有 `translator`，预留 `ocr` / `tts` | 不是插件名 |
| **capabilities** | 插件声明支持的可选特性：`streaming`、`models`、`glossary`、`batch` | 不是权限 |
| **permissions** | 插件运行需要的资源声明，如 `net:https://api.openai.com` | 不是 capabilities，权限由宿主校验 |
| **apiVersion** | 插件契约版本号，整数递增，主版本不匹配即拒绝加载 | 不是插件自身版本 |
| **profile** | 用户在 UI 里保存的一套配置实例，例如「DeepSeek-快速」「本地 Ollama」 | 不是插件，一个插件可挂多个 profile |
| **preset** | 插件清单里预置的厂商模板（baseURL + 协议 + 默认模型），创建 profile 时填充 | 不是 profile，preset 只读 |
| **adapter** | ai 插件内部把统一请求翻译成某家 HTTP 协议的实现（openai / anthropic / gemini） | 不是插件，不对外暴露 |
| **runtime** | `PluginRuntime`：宿主注入给插件的长期上下文（受控 fetch、日志、密钥读取）。旧称 `ctx` | 不是全局对象，也不是每次调用新建 |
| **call options** | `CallOptions`：每次调用新建的 `{ signal, requestId }` | 不是 runtime，不跨调用复用 |

## 约定

- 文档语言中文，代码标识符英文。
- 接口签名以 `docs/` 为准，`src/shared/` 是它的落地实现；两者不一致视为 bug。
- 架构决策改动请同步更新 [architecture.md](./architecture.md) 的决策记录表，不要只在 PR 描述里写。
