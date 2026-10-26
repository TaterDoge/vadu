# 架构

本文描述 vadu 的进程边界、模块归属、关键数据流与架构决策。改动整体结构前先读这里，改完回来更新。

## 1. 目标与约束

**目标**

1. 翻译能力可插拔：厂商适配是数据/插件，不是核心代码。
2. AI 优先：用户自带 endpoint + 密钥 + 模型，无需应用内置密钥。
3. 流式优先：翻译结果边生成边显示。
4. 第三方插件可安装、可禁用、可卸载，出问题不影响宿主启动。

**约束**

1. 渲染层受 CSP 限制，不能直连厂商 API（且多数 API 不允许浏览器直连）。
2. 密钥必须加密落盘，不能停留在渲染层或明文配置里。
3. 项目当前零运行时校验库、零状态管理库、零网络库。新增依赖要有明确理由。
4. Electron 主进程是 Node 环境，插件以本地文件形态加载，不经过 npm 依赖解析。

## 2. 进程模型

```
┌────────────────────────┐        ┌──────────────────────────────┐
│ 渲染进程 (Chromium)     │        │ 主进程 (Node)                 │
│                        │        │                              │
│ React 19 + Tailwind    │◀──IPC─▶│ ipc/       通道适配           │
│ 只做 UI 与本地视图状态   │        │ core/      插件/翻译/配置      │
│ 无网络、无文件、无密钥   │        │ plugins/   内置翻译插件        │
└────────────────────────┘        └───────────┬──────────────────┘
                                              │ HTTPS
                                    ┌─────────▼─────────┐
                                    │ 厂商 API / 本地模型 │
                                    └───────────────────┘
```

只有两个进程。插件在**主进程内**加载执行，不做进程隔离。

这里必须把话说清楚，否则后面会有人按错误前提改架构：

1. **`utilityProcess` 不是沙箱。** 官方文档的定位是"承载不可信服务/CPU 密集/易崩组件的进程隔离"，子进程里 `require('node:fs')`、读 `userData`、发任意网络请求全部可用。它解决的是**崩溃与阻塞隔离**，不是**权限隔离**。想真正限制插件权限，只能上 JS VM 受限执行环境或 Chromium 沙箱渲染进程 + 全 RPC 代理，代价是插件能力被砍到只剩宿主暴露的几个函数。
2. **翻译插件的权限面本来就窄**：一次 HTTP 调用 + 读自己的配置。真正的风险是它作为第三方代码能看到主进程内存里的**所有**密钥，这一点任何进程内加载都改变不了。
3. 结论：**插件视为完全可信代码**，与 Obsidian 插件同一模型。准入手段是"用户手动安装 + 安装前展示权限与来源 + 默认禁用未签名插件"，不是运行时隔离。

迁移触发条件（满足任一条再重新评估，届时 ADR-001 需要重写）：上插件市场、支持插件自动更新、或插件开始承载非 HTTP 能力（本地文件处理、剪贴板常驻）。

`manifest.permissions` 因此只是**面向用户的透明度声明**，不是安全边界。见 [plugin-spec.md §6](./plugin-spec.md#6-权限与受控-fetch)。

## 3. 分层

四个目录，职责互斥：

| 目录 | 职责 | 不允许 |
| --- | --- | --- |
| `src/shared/` | 契约：IPC 通道名、请求/事件/错误类型、插件契约类型、语言码 | 含 Electron/Node/DOM 依赖 |
| `src/main/core/` | 机制：插件加载与调用、翻译编排、缓存、配置与密钥持久化 | 认识任何具体厂商 |
| `src/main/plugins/` | 策略：具体翻译能力实现（内置 `ai`） | 直接读写文件/配置/密钥 |
| `src/main/ipc/` | 通道适配：校验入参 → 调 core → 回填错误 | 含业务逻辑 |
| `src/renderer/` | UI 与视图状态 | 网络请求、文件访问、密钥 |

`src/shared/` 同时被两套 tsconfig 覆盖（`tsconfig.node.json` 与 `tsconfig.web.json` 的 `include` 都要加 `src/shared/**/*`），因此它只能放纯 TypeScript 类型、纯函数、常量。

### core/plugin — 插件运行时

| 模块 | 职责 |
| --- | --- |
| `manifest.ts` | 手写校验 manifest 形状；`apiVersion` 兼容判定 |
| `loader.ts` | 双源发现（内置 + `userData/plugins`），动态 `import()`，逐个隔离失败 |
| `registry.ts` | 内存插件表：已加载/已禁用/加载失败三种状态；变更事件 |
| `host.ts` | 调用包装：构造 `PluginRuntime`、注入受控 `fetch`、超时、取消、错误归一化 |

加载失败的插件**不阻断启动**：记录错误，在 UI 的插件列表里显示为"加载失败 + 原因"，继续加载其它插件。

### core/translate — 编排

`service.ts` 是翻译唯一入口，职责：

1. 入参规范化（语言码、空白裁剪、长度上限）。
2. 按 `pluginId + profileId` 解析出插件实例与该 profile 的配置。
3. 命中缓存则直接返回。
4. 调 `host.translate()`，消费 `AsyncIterable<string>`，转发给渲染层。
5. 累积完整文本后写入缓存。

插件只负责"一次调用"。**以下全部由 core 承担**：语言检测、术语表合并策略、缓存、重试与退避、批量拆分、并发限流。

### core/config — 持久化

- `config.json`（`app.getPath("userData")`）：`{ schemaVersion, settings, profiles[] }`，原子写（写临时文件再 rename）。
- `secrets.bin`：`safeStorage` 加密后的密钥表，结构 `{ [pluginId]: { [secretName]: base64 } }`。
- 两者都由 `store.ts` / `secrets.ts` 独占，其它模块只拿接口。

**密钥存储必须用异步 API。** `safeStorage` 的同步 API（`isEncryptionAvailable` / `encryptString` / `decryptString`）自 Electron 45 起弃用、46 移除，本项目从第一天就用异步形态：

```ts
await safeStorage.isAsyncEncryptionAvailable();
const cipher = await safeStorage.encryptStringAsync(plain);
const { plainText, shouldReEncrypt } = await safeStorage.decryptStringAsync(cipher);
```

`shouldReEncrypt === true`（密钥环轮换）时必须立即回写新密文，否则某次系统更新后用户的 key 会全部解不开。

**Linux 降级**：`safeStorage.getSelectedStorageBackend()` 返回 `basic_text` 表示没有可用的密钥环（GNOME Keyring / KWallet 都没装），此时密文是用硬编码口令加密的，**等同明文**。行为规定：

| 情况 | 行为 |
| --- | --- |
| 加密可用且非 `basic_text` | 正常加密落盘 |
| `basic_text` 或加密不可用 | 默认**不落盘**，密钥仅存本次会话内存；UI 明确告知原因，并提供一个"仍然保存（不安全）"的显式选项 |

绝不静默降级。用户必须知道自己填的 key 是明文躺在磁盘上的。

## 4. 目录结构

```
src/
├── shared/
│   ├── ipc.ts                # 通道名常量 + 请求/响应/事件类型
│   ├── plugin.ts             # 插件契约（manifest / runtime / request）
│   ├── errors.ts             # PluginErrorCode + 序列化形状
│   └── languages.ts          # BCP-47 语言码与展示名
├── main/
│   ├── index.ts              # app 生命周期、单例窗口、托盘
│   ├── window.ts
│   ├── tray.ts
│   ├── ipc/
│   │   ├── index.ts          # 统一注册入口
│   │   ├── translate.ts
│   │   ├── plugins.ts
│   │   └── config.ts
│   ├── core/
│   │   ├── plugin/{manifest,loader,registry,host}.ts
│   │   ├── translate/{service,cache,language}.ts
│   │   ├── config/{store,secrets}.ts
│   │   └── log.ts
│   └── plugins/
│       └── ai/
│           ├── manifest.json
│           ├── index.ts
│           ├── prompt.ts
│           └── adapters/{openai,anthropic,gemini}.ts
├── preload/
│   ├── index.ts              # contextBridge 暴露 window.vadu
│   └── index.d.ts
└── renderer/src/
    ├── app.tsx              # 壳：ThemeProvider + SidebarProvider + 分区切换（当前是本地 state）
    ├── lib/                 # 渲染层通用能力（主题、shadcn style 切换）
    ├── hooks/
    └── components/
        ├── ui/                # shadcn 生成件；只改样式不改结构
        ├── layout/            # 侧边栏、页面骨架、分区登记、style 切换器
        └── pages/             # 各分区页面内容（一个分区一个文件）
```

图标分两套：业务组件（`layout/`、`pages/`、`quick/`）用 Iconify 类名 `icon-[lucide--*]`，由 `@iconify/tailwind4` 在构建期把 SVG 内联成 CSS `data:` URI（运行时零网络、零 JS，受 `img-src data:` 约束）；`components/ui/` 是 shadcn 生成件，保持 `lucide-react` 不动。类名类型见 `lib/icons.ts`。

插件目录在运行时有两个来源：

- 内置：`out/main/plugins/<id>/`（随应用打包，只读）。
- 外部：`app.getPath("userData")/plugins/<id>/`（用户安装，可写）。

加载器对两个根目录用**完全相同**的发现与校验逻辑，只有 `origin: "builtin" | "user"` 的差别。这是本设计的关键约束：内置插件不能走特例路径，否则第三方插件生态永远无法验证。

### 内置插件的构建落点

内置插件不能被打进 `out/main/index.js`——它必须保持为可被动态 `import()` 的独立模块。因此 `electron.vite.config.ts` 需要加一个额外入口，并把 `manifest.json` 复制到产物目录：

```ts
// electron.vite.config.ts（节选）
import { copyFileSync, mkdirSync } from "node:fs";

const copyPluginManifests: Plugin = {
  name: "copy-plugin-manifests",
  writeBundle() {
    mkdirSync("out/main/plugins/ai", { recursive: true });
    copyFileSync("src/main/plugins/ai/manifest.json", "out/main/plugins/ai/manifest.json");
  },
};

export default defineConfig({
  main: {
    plugins: [copyPluginManifests],
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts"),
          "plugins/ai/index": resolve("src/main/plugins/ai/index.ts"),
        },
        output: { entryFileNames: "[name].js" },
      },
    },
  },
  // preload / renderer 不变
});
```

配套的 `electron-builder.yml`：

```yaml
asarUnpack:
  - resources/**
  - out/main/plugins/**   # 插件目录解包到 app.asar.unpacked，避开 asar 内动态 import 的边角问题
```

`out/main/plugins/**` 的 `asarUnpack` 是保险而非必需：asar 内的动态 `import()` 在 Electron 29 之后已基本修复，但打包态仍偶有报告。插件是运行时才解析的路径，让它在真实文件系统上更省心。加载器定位内置插件时必须把 `app.asar` 路径重写为 `app.asar.unpacked`（Electron 只对 `child_process` 的 spawn 自动做这件事，`import()` 不会）。

两个根目录的解析就三行，写清楚避免实现时自己发明：

```ts
// core/plugin/loader.ts
const appRoot = app.getAppPath(); // 开发态 = 项目根；打包态 = <resources>/app.asar
const builtinRoot = join(appRoot, "main/plugins").replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`);
const userRoot = join(app.getPath("userData"), "plugins");
```

注意：打包态的 `out/main/` 在 asar 里对应 `app.asar/main/`（electron-builder 把 `out/**` 映射为 asar 根），所以是 `main/plugins` 而不是 `out/main/plugins`。这个路径映射写错了插件会在开发态正常、打包后静默消失。

## 5. 关键数据流

### 5.1 启动

```
app.whenReady
  → core/config/store.load()          读 config.json，缺失则写默认
  → core/config/secrets.init()        初始化 safeStorage 状态
  → core/plugin/loader.discover()     扫描两个插件根目录，校验 manifest
  → core/plugin/loader.loadAll()      逐个 import，失败隔离
  → core/plugin/registry.ready()
  → createTray()
  → settings.showMainWindowOnStartup ? createWindow() : 只驻留托盘
  → 渲染层 invoke vadu:plugins:list
```

### 5.2 一次流式翻译

```
renderer  invoke vadu:translate:start(params)
             │
             ▼
ipc/translate  校验 params → service.start()
             │  生成 requestId，登记 AbortController
             ▼
service  → 缓存未命中 → host.translate(pluginId, profileId, req)
             │
             ├─ 构造 PluginRuntime（含受控 fetch / secrets / log）
             ├─ plugin.translate(req, { signal, requestId })  →  AsyncIterable<string>
             ▼
         for await  每个 delta → webContents.send(vadu:translate:event, {requestId,type:"delta",text})
             │
             ▼
         done → 拼装完整文本 → 缓存 → send({type:"done"})
         throw → 归一化为 PluginError → send({type:"error"})
```

`start` 立刻返回 `{ requestId }`，结果全部走 main→renderer 的 `send` 事件，不走 `invoke` 的返回值。原因：`invoke` 是单次请求响应模型，无法表达 N 个增量，也不能在中途取消。

### 5.3 取消

渲染层 `vadu:translate:cancel(requestId)` → service 找到 `AbortController` 并 abort → 适配器里的 `fetch(signal)` 立即中断 → 生成器抛 `AbortError` → host 归一化为 `ABORTED`，**不当作错误事件上报**，仅清理状态。

**语义规定**：取消不回滚。渲染层保留已收到的 delta，在面板上标记"已取消"，并且此后丢弃该 `requestId` 的任何事件。主进程侧在 abort 后不再 `send` 任何事件——即使上游多吐了一帧。生成器的 `finally` 负责关闭 reader/连接，这是唯一必须的清理（见 ADR-009）。

### 5.4 安装第三方插件

从 M3 开始：用户在 UI 选择插件目录或 `.zip` → 主进程解压到 `userData/plugins/<id>/` → 展示 manifest 的 `permissions` 与来源 → 用户确认 → 重新扫描 → 出现在插件列表（默认启用）。卸载为删除该目录并清理其 profile 与密钥。

## 6. 错误模型

错误在 core 边界归一化，插件抛出的任何东西都转成 `PluginError`，跨 IPC 只传可序列化形状：

```ts
type SerializedError = {
  code: PluginErrorCode;
  message: string;
  pluginId?: string;
  retryable: boolean;
};
```

`code` 枚举：`AUTH_FAILED`、`RATE_LIMITED`、`NETWORK`、`TIMEOUT`、`INVALID_CONFIG`、`UNSUPPORTED_LANGUAGE`、`PERMISSION_DENIED`、`PLUGIN_LOAD_FAILED`、`PLUGIN_CRASH`、`ABORTED`、`INTERNAL`。

渲染层按 `code` 决定提示文案与是否显示"重试"按钮，不解析 `message`。`retryable` 由 core 判定，不由 UI 猜。

### 日志与脱敏

所有日志经 `core/log.ts` 单一出口，注入给插件的 `runtime.log` 也走它。出口处做两件事：

```ts
function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value !== "string") continue;
    const k = key.toLowerCase();
    // 凭据类键：只留首尾 4 位
    if (k.includes("auth") || k.includes("key") || k.includes("token") || k.includes("secret")) {
      meta[key] = value.length > 8 ? `${value.slice(0, 4)}****${value.slice(-4)}` : "****";
    }
    // 用户原文：截断，避免插件顺手把 req.text 写进日志
    else if (value.length > 100) {
      meta[key] = `${value.slice(0, 20)}…[${value.length} chars]`;
    }
  }
  return meta;
}
```

同时规定：**日志里永不出现 `Authorization` 头、任何 `sk-…` 形式的字符串、以及用户待翻译文本的完整内容。** 插件即使自己把 `req.text` 塞进 `meta`，出口也会被截断（防御不是信任）。错误信息同理：core 归一化时正则剔除 `sk-[A-Za-z0-9_-]+`、`Bearer\s+\S+` 后再发给渲染层。

## 7. 架构决策记录

| 编号 | 决策 | 理由 | 代价 |
| --- | --- | --- | --- |
| ADR-001 | 插件在主进程内运行，不做进程隔离；第三方插件靠"用户手动安装 + 权限展示 + 默认禁用未签名"准入 | 官方 `utilityProcess` 并非沙箱（子进程仍有完整 Node 权限），只能解决崩溃/阻塞隔离；翻译插件的权限面只有一次 HTTP | 恶意插件可读全部密钥、可写任意文件。缓解：安装前显式警告、默认禁用、上市场/自动更新前必须重做隔离（见 §2 迁移触发条件） |
| ADR-002 | AI 是**一个**插件 + 多个协议适配器，而非每厂商一个插件 | 大多数厂商兼容 OpenAI 协议，插件数量爆炸换来的是重复代码 | 厂商私有参数靠 profile 里的 `extra`（`type: "json"` 配置）原样透传，适配器不做参数名映射；非 OpenAI 兼容协议要单独写适配器 |
| ADR-003 | 流式用 `requestId` + `webContents.send` 事件，不用 `MessagePort` | 通道集中在一处、易日志化、易做全局取消；MessagePort 需要额外生命周期管理 | 单个 `webContents` 上事件混流，靠 `requestId` 区分；多窗口需广播路由 |
| ADR-004 | 插件不写 UI，设置表单由 manifest 的 `config` schema 驱动 | 插件 UI 会带来框架耦合与安全面扩大；翻译配置是扁平的 | 复杂交互（OAuth 登录、模型列表刷新）需要用宿主提供的少量控件类型，不能任意定制 |
| ADR-005 | 不引入 zod / electron-store，手写 manifest 校验与 JSON 持久化 | 需要校验的只有几个固定形状；两个小文件不需要通用能力 | 校验代码要手写，容易漏字段；用类型 + 显式断言 + 单元测试兜住 |
| ADR-006 | `apiVersion` 为整数，不匹配即拒绝加载 | 兼容层会随插件增长变成永久负担 | 契约升级会废弃旧插件，需要写迁移说明 |
| ADR-007 | 插件 `translate()` 返回 `AsyncIterable<string>`，只吐增量文本 | 最窄契约：非流式厂商 yield 一次即可，宿主不需要区分两种模式 | 暂时拿不到 token 用量与结构化元信息；需要时再扩契约并升 `apiVersion` |
| ADR-008 | 配置 schema 用**可序列化的 JSON 子集**，不用 zod | 插件是纯 JS 目录，配置 UI 必须从数据生成；zod 只能存在于 TS 构建期，无法跨进程传给渲染层，也无法描述第三方插件 | 手写约 80 行校验器（只支持 7 个约束）+ 单元测试；表达能力有限，复杂交互靠 `x-widget` 扩展 |
| ADR-009 | 取消是"尽力而为"，不回滚已显示的译文 | 事务式回滚需要缓存整个流并重放，用户看到的闪烁比"半句译文 + 已取消标记"更差 | 用户需要在 UI 上看到"已取消"状态，不能静默停住 |
| ADR-010 | 局内快捷键由渲染层用 TanStack Hotkeys（keydown）绑定，不经主进程 `globalShortcut`；主进程只校验与持久化 `AppSettings.inAppHotkeys` | 全局热键是 OS 级稀缺资源且会吞键；窗口聚焦时才生效的组合键犯不着占用系统层 | 浮窗失焦即失效；与全局热键同组合时全局优先；改绑靠重新聚焦重拉，不广播 |

## 8. 明确不做

- 不做插件市场 / 在线分发（M3 只做本地安装）。
- 不做 OCR、语音、词典插件（契约里 `kind` 预留，但运行时只实现 `translator`）。
- 不做插件间依赖与插件间调用。
- 不做多账号并发、团队共享配置。
- 不做渲染层按插件动态加载组件。

## 9. 演进路径

新增非翻译能力（如 `ocr`）时的最小改动面：

1. `src/shared/plugin.ts` 扩 `PluginKind` 与对应请求类型，`apiVersion` +1。
2. `core/plugin/registry.ts` 按 `kind` 建索引（当前是平表）。
3. 新增 `core/<kind>/service.ts`，与 `translate/service.ts` 同构。
4. 加对应 IPC 通道与 UI 面板。

插件加载、清单校验、配置与密钥机制无需改动——这是这套分层成立与否的检验点。
