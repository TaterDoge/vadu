# 插件规范

一份 vadu 插件 = 一个目录，含 `manifest.json`（声明）与一个入口模块（实现）。内置插件与第三方插件走完全相同的规范，只有加载来源不同。

## 1. 目录形态

```
my-plugin/
├── manifest.json        # 必须
├── index.mjs            # 必须，文件名由 manifest.main 指定
└── (可选) 其它资源       # 随目录一起复制，插件可自行读取相对路径
```

- 插件目录名不参与识别，`manifest.id` 才是身份。
- 插件**不支持** `dependencies` / 构建步骤 / TS 源码。入口必须是可直接 `import()` 的 JS（`.mjs` 或 CJS `.js`）。内置插件在打包时由 electron-vite 编译成该形态。
- **内置插件的产物是 CJS `index.js`**（本项目 `package.json` 没有 `"type": "module"`，electron-vite 的 main 构建输出 CJS），所以它的 `manifest.json` 写 `"main": "index.js"`；第三方插件推荐 `.mjs`。两种都由加载器用 `import()` 处理：ESM 取具名导出 `createPlugin`，CJS 取 `mod.createPlugin ?? mod.default?.createPlugin ?? mod.default`。
- 插件目录内的相对路径读取是允许的（它是自身资源）；跨出自身目录的路径访问不允许，也不会被宿主帮助。

## 2. manifest.json

```json
{
  "apiVersion": 1,
  "id": "vadu.ai",
  "name": "AI 翻译",
  "version": "0.1.0",
  "kind": "translator",
  "main": "index.mjs",
  "description": "通过任意 OpenAI 兼容 / Anthropic / Gemini 端点做翻译",
  "author": "vadu",
  "capabilities": { "streaming": true, "models": true, "glossary": true },
  "permissions": ["net:https://api.openai.com"],
  "config": {
    "type": "object",
    "required": ["protocol", "model", "apiKey"],
    "properties": {
      "protocol": {
        "type": "string",
        "title": "协议",
        "enum": ["openai", "anthropic", "gemini"],
        "enumLabels": ["OpenAI 兼容", "Anthropic", "Gemini"],
        "default": "openai"
      },
      "baseURL": { "type": "string", "title": "接口地址", "placeholder": "https://api.openai.com/v1" },
      "apiKey": { "type": "secret", "title": "API Key", "required": true },
      "model": { "type": "string", "title": "模型", "x-widget": "model-picker", "required": true },
      "temperature": { "type": "number", "title": "temperature", "default": 0.3, "minimum": 0, "maximum": 2 }
    }
  },
  "presets": [
    {
      "id": "deepseek",
      "label": "DeepSeek",
      "config": { "protocol": "openai", "baseURL": "https://api.deepseek.com/v1", "model": "deepseek-chat" },
      "models": ["deepseek-chat", "deepseek-reasoner"]
    }
  ]
}
```

### 字段

| 字段 | 必填 | 类型 | 语义 |
| --- | --- | --- | --- |
| `apiVersion` | 是 | 整数 | 契约版本。当前 `1`。与宿主不匹配则**拒绝加载** |
| `id` | 是 | string | 全局唯一，反向域名，小写，仅 `[a-z0-9._-]`。profile 与密钥都挂在它下面 |
| `name` | 是 | string | 界面展示名 |
| `version` | 是 | string | 插件自身 semver |
| `kind` | 是 | `"translator"` | 能力种类。当前只实现 `translator` |
| `main` | 是 | string | 入口相对路径，必须以 `.js` / `.mjs` 结尾 |
| `description` | 否 | string | 界面副标题 |
| `author` | 否 | string | 展示用 |
| `capabilities` | 否 | object | 声明可选特性，见下 |
| `permissions` | 否 | string[] | 资源声明，见 §6 |
| `config` | 否 | ConfigSchema | 设置表单定义，见 §3 |
| `presets` | 否 | Preset[] | 预置厂商模板，见 §4 |

`capabilities` 语义（宿主据此决定 UI 是否显示对应入口，插件谎报只影响自己）：

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `streaming` | `false` | `translate()` 会多次 yield 增量；为 false 时宿主也会按一次性 yield 处理 |
| `models` | `false` | 实现 `listModels()`，`x-widget: "model-picker"` 才有意义 |
| `glossary` | `false` | 接受 `req.glossary`，宿主才会传入术语表 |
| `batch` | `false` | 接受 `req.batch` 多段文本（M3） |

## 3. 配置 schema（vadu 子集）

**不是完整 JSON Schema。** 只支持以下形状，其余键被忽略；渲染层按此渲染表单，core 按此做运行时校验。

```ts
type ConfigField =
  | {
      type: "string";
      title: string;
      description?: string;
      default?: string;
      placeholder?: string;
      enum?: string[];
      enumLabels?: string[];
      required?: boolean;
      "x-widget"?: "model-picker";
    }
  | {
      type: "number";
      title: string;
      description?: string;
      default?: number;
      minimum?: number;
      maximum?: number;
      step?: number;
      required?: boolean;
    }
  | {
      type: "boolean";
      title: string;
      description?: string;
      default?: boolean;
    }
  | {
      /** 值不写入 config.json，加密存 secrets.bin，插件用 runtime.secrets 读取 */
      type: "secret";
      title: string;
      description?: string;
      placeholder?: string;
      required?: boolean;
      /** 该密钥对应的 HTTP header 提示，仅用于 UI 展示，不做注入 */
      header?: string;
    }
  | {
      /** 任意 JSON 对象，以 textarea 形式编辑，保存时校验可解析。厂商特有参数透传走这里 */
      type: "json";
      title: string;
      description?: string;
      default?: Record<string, unknown>;
      required?: boolean;
    };

type ConfigSchema = {
  type: "object";
  properties: Record<string, ConfigField>;
  required?: string[];
};
```

规则：

1. `secret` 字段的值**永远不会**出现在 `req.config` 里，也不会进入渲染层的 profile 数据（只有"已设置/未设置"状态）。插件只能通过 `runtime.secrets.get(name)` 取。
2. 校验由 core 在保存 profile 时执行：类型、`enum` 成员、`minimum`/`maximum`、`required`。不通过则拒绝保存并返回字段级错误。插件自己不需要重复校验，但 `validateConfig()` 可用于语义校验（如 key 是否有效）。
3. 未知字段忽略，不报错——插件可以在 manifest 升级时增加字段。
4. `x-widget: "model-picker"` 的渲染行为：下拉框 + 刷新按钮；刷新调用 `plugin.listModels(当前表单值)`；失败降级为普通文本输入。

   刷新时的密钥来源：**只用已保存的密钥**，不用输入框里的未保存值（那些值本来就不应该经过渲染层与主进程的这条路径，否则等于新开一条传密钥的通道）。因此：从未保存过密钥时点击刷新，直接提示"请先保存密钥"，不发请求。
5. 字段顺序 = `properties` 的书写顺序。
6. `type: "json"` 只接受可解析的 JSON 对象（不允许数组/标量），值直接以对象形式存进 profile。用于 `extra` 这类厂商特有参数；插件读到的已经是对象，不需要自己 `JSON.parse`。
7. 密钥存储能力不是插件能干预的：Linux 无密钥环时宿主可能拒绝落盘改为会话内存，插件只需处理好 `runtime.secrets.get()` 返回 `undefined`。

## 4. presets

preset 是**只读模板**。用户新建 profile 时可选一个 preset 预填 `config`，之后 profile 独立演化，preset 变更不影响已有 profile。

- `preset.config` 必须是 `config.properties` 的键的子集（`secret` 字段除外，preset 不能预填密钥）。
- `preset.models` 可选，用于 `model-picker` 在未联网时的候选列表。
- `preset.id` 在插件内唯一。

## 5. 运行契约

入口模块导出 `createPlugin`（ESM 具名导出，或 CJS 的 `module.exports = { createPlugin }`）：

```ts
// src/shared/plugin.ts 的对外形态
export const PLUGIN_API_VERSION = 1;

/** profile 的配置值，键由 manifest.config.properties 定义；secret 字段不在此列 */
export type PluginConfig = Record<string, unknown>;

export interface TranslatorPlugin {
  /** 单次翻译。必须尊重 signal；增量输出用多次 yield，非流式则 yield 一次全量。 */
  translate(req: TranslateRequest, opts: CallOptions): AsyncIterable<string>;

  /** 可选：校验失败请抛错误（§7），宿主会转成 `INVALID_CONFIG` */
  validateConfig?(config: PluginConfig, runtime: PluginRuntime): Promise<void>;

  /** 可选：capabilities.models 为 true 时实现。 */
  listModels?(config: PluginConfig, runtime: PluginRuntime): Promise<ModelInfo[]>;

  /** 可选：宿主在禁用/卸载/退出前调用，用于释放连接池、定时器等。 */
  dispose?(): void | Promise<void>;
}

export interface TranslateRequest {
  /** 待翻译文本（已在 core 侧裁剪空白，长度已限制） */
  text: string;
  /** BCP-47 语言码，或 "auto" */
  source: string;
  /** BCP-47 语言码，不会是 "auto" */
  target: string;
  /** 该 profile 的配置；secret 字段已被剔除 */
  config: PluginConfig;
  /** 术语表，仅当 capabilities.glossary 为 true 时传入 */
  glossary?: { from: string; to: string }[];
  /** 语体偏好，可选 */
  tone?: "default" | "formal" | "casual";
}

export interface CallOptions {
  /** 取消信号，必须传给 fetch */
  signal: AbortSignal;
  /** 本次调用的唯一 id，用于日志关联 */
  requestId: string;
}

export interface PluginRuntime {
  /** 受 permissions 约束的 fetch，见 §6 */
  fetch(input: string, init?: RequestInit): Promise<Response>;
  log: {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
  secrets: {
    get(name: string): string | undefined;
    /** 是否存在，不暴露值 */
    has(name: string): boolean;
  };
}

export interface ModelInfo {
  id: string;
  label?: string;
}
```

约定：

- 同一插件实例可能被**并发**调用（多个 profile / 多个翻译请求），实现需无共享可变状态或自行加锁。
- `translate()` 抛出的错误由宿主归一化，插件不需要拼 UI 文案。推荐直接抛带 `code` 的错误（见 §7），未标注的按 `INTERNAL` 处理。
- 插件不得在模块顶层做耗时初始化（网络请求、读大文件）；放到 `createPlugin()` 或首次 `translate()`。
- 插件**不得**读写 `config.json` / `secrets.bin` / 其它插件目录，**不得**调用 `app` / `ipcMain` / `shell`。这些调用在宿主已加载 Electron 的环境下技术上可行，属于越界行为，评审直接拒绝。
- **取消语义**：`signal.aborted` 后立即停止 yield 并关闭上游 reader，不要在 `finally` 里再 yield 一次“剩余内容”。已发出的增量不回滚，由 UI 标记“已取消”。生成器必须真正终止，禁止悬挂（宿主不会帮你 `return()` 两次）。
- 插件是**单次调用无状态**的：不要在插件实例上缓存上一次翻译的文本、语言或临时 build 结果，同一实例会被并发调用。
- **请求对象里不放厂商特有参数。** `TranslateRequest` 是所有插件共用的形状，任何“只有某家有”的参数属于该插件的 `config`（用 `type: "json"` 声明），由插件自己合进请求体。不要修改请求形状来适配单家厂商。
- **日志不得泄露用户内容与凭据**：不在 `meta` 里传 `req.text`、`req.glossary` 的完整值，不传 `Authorization` 头、完整密钥。宿主出口会截断，但被截断的日志已经失去调试价值——该传的是长度、语言对、状态码。
- **错误信息只给可行动信息**：允许带 HTTP 状态码与上游的机器可读错误码（如 `insufficient_quota`）；禁止把上游响应 body 原文或含密钥的 header 写进 `message`，它会直接显示在 UI 上。

## 6. 权限与受控 fetch

`permissions` 目前只有一种语法：

```
net:<url-prefix>
```

例：`net:https://api.openai.com`、`net:http://127.0.0.1:11434`（本地 Ollama）。

`runtime.fetch` 的行为：

1. 解析目标 URL，取 `origin`（scheme + host + port）。
2. 若 `manifest.permissions` 中没有任何 `net:` 前缀匹配该 origin，拒绝并抛 `PERMISSION_DENIED`。
3. 不在清单内声明的动态端点（如用户自填 baseURL）无法被静态声明——因此 `ai` 类插件允许在 manifest 中用通配 `net:*`，此时宿主在安装/首次保存配置时把实际 origin **展示给用户**，用户确认后才启用该 profile。

> **重要，别误解**：这个校验约束的是"插件通过 `runtime.fetch` 发出的请求"，不是沙箱。插件若直接用 `globalThis.fetch` 可以绕过。权限声明的价值是让用户看见插件要访问哪里、并让正常实现的插件行为可审计，而不是阻止恶意代码。第三方插件视为完全可信，见 [architecture.md#ADR-001](./architecture.md#7-架构决策记录)。

## 7. 错误

插件抛出 `Error` 子类或带 `code` 属性的错误，宿主归一化为 `PluginError` 并只向前端暴露 `{ code, message, retryable }`：

```ts
export type PluginErrorCode =
  | "AUTH_FAILED"          // 401/403、密钥无效
  | "RATE_LIMITED"         // 429、配额超限
  | "NETWORK"              // DNS/TCP/TLS 失败
  | "TIMEOUT"              // 超过宿主超时
  | "INVALID_CONFIG"       // 配置缺失或不合法
  | "UNSUPPORTED_LANGUAGE" // 不支持的语言对
  | "PERMISSION_DENIED"    // 请求未声明 origin
  | "PLUGIN_LOAD_FAILED"   // manifest/入口加载失败
  | "PLUGIN_CRASH"         // 插件抛未分类异常
  | "ABORTED"              // 用户取消，不展示为错误
  | "INTERNAL";
```

`retryable` 由宿主判定：`NETWORK` / `TIMEOUT` / `RATE_LIMITED` 为 true，其余 false。

插件侧抛法（无需引入宿主包）：

```ts
const err = new Error("model not found") as Error & { code?: string; status?: number };
err.code = "INVALID_CONFIG";
err.status = 404;
throw err;
```

宿主按 `code` → `status` → 消息特征（`401`、`429` 等）的顺序归类。

## 8. 版本兼容

- `apiVersion` 是**整数**，当前为 `1`。
- 宿主只加载 `apiVersion === PLUGIN_API_VERSION` 的插件。>、< 一律拒绝，错误 `PLUGIN_LOAD_FAILED`，文案说明需要更新插件或宿主。
- 不做运行时兼容层、不做字段级降级。契约一旦破坏性变更就 `+1`，并在插件列表里标出旧插件。
- 非破坏性新增（如多一个可选 capability）也必须 `+1`：插件需要靠版本判断自己能否依赖该字段。

## 9. 最小完整示例

一个非流式、单端点的翻译插件：

```json
{
  "apiVersion": 1,
  "id": "vadu.deeplexample",
  "name": "示例词典",
  "version": "1.0.0",
  "kind": "translator",
  "main": "index.mjs",
  "permissions": ["net:https://api.example.com"],
  "config": {
    "type": "object",
    "required": ["apiKey"],
    "properties": {
      "apiKey": { "type": "secret", "title": "API Key", "required": true },
      "endpoint": { "type": "string", "title": "接口地址", "default": "https://api.example.com" }
    }
  }
}
```

```js
// index.mjs
export function createPlugin(runtime) {
  return {
    async *translate(req, { signal }) {
      const key = runtime.secrets.get("apiKey");
      if (!key) {
        const e = new Error("缺少 API Key");
        e.code = "AUTH_FAILED";
        throw e;
      }

      const res = await runtime.fetch(
        new URL("/v1/translate", req.config.endpoint ?? "https://api.example.com").toString(),
        {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({ q: req.text, source: req.source, target: req.target }),
        }
      );

      if (!res.ok) {
        const e = new Error(`上游返回 ${res.status}`);
        e.code = res.status === 401 ? "AUTH_FAILED" : res.status === 429 ? "RATE_LIMITED" : "INTERNAL";
        throw e;
      }

      const data = await res.json();
      yield data.translation; // 非流式：只 yield 一次
    },
  };
}
```

## 10. 调试与自检

- 开发期把插件目录放到 `app.getPath("userData")/plugins/<id>/`，在 UI 里点"重新扫描"即可加载，不用重启。
- 插件日志统一带 `pluginId`，写进主进程日志；渲染层可在开发者工具的 Console 看到转发后的 `warn`/`error`。
- 插件加载失败时，渲染层插件列表会显示 `PLUGIN_LOAD_FAILED` 与具体原因（manifest 哪个字段、import 报错原文）。**不要**只在日志里记录。

提交插件前的自检清单：

- [ ] `apiVersion` 与目标宿主一致
- [ ] `id` 唯一且为反向域名
- [ ] 所有外部请求的 origin 已写进 `permissions`
- [ ] 所有 `fetch` 都传了 `signal`
- [ ] 没有读写宿主文件、没有调用 Electron 主进程 API
- [ ] 密钥只从 `runtime.secrets` 取，没有硬编码、没有写日志
- [ ] 流式实现会多次 yield，并在结束时停止（不留悬挂生成器）
- [ ] 401/429 已映射为 `AUTH_FAILED` / `RATE_LIMITED`
- [ ] `dispose()` 释放了定时器与连接
