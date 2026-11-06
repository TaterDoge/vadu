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
- 插件**不支持** `dependencies` / 构建步骤 / TS 源码。入口必须是可直接 `import()` 的 JS（`.mjs` 或 CJS `.js`）。内置插件在打包时由 electron-vite 编译成该形态，允许构建期把第三方库打进产物（目录里仍没有 `node_modules`，`ai` 插件就是这样带的 AI SDK）；第三方插件没有构建期，不能引用未随目录交付的包。
- **内置插件的产物是 CJS `index.js`**（本项目 `package.json` 没有 `"type": "module"`，electron-vite 的 main 构建输出 CJS），所以它的 `manifest.json` 写 `"main": "index.js"`；第三方插件推荐 `.mjs`。两种都由加载器用 `import()` 处理：ESM 取具名导出 `createPlugin`，CJS 取 `mod.createPlugin ?? mod.default?.createPlugin ?? mod.default`。
- 插件目录内的相对路径读取是允许的（它是自身资源）；跨出自身目录的路径访问不允许，也不会被宿主帮助。

## 2. manifest.json

```json
{
  "apiVersion": 2,
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
      "temperature": { "type": "number", "title": "温度", "minimum": 0, "maximum": 2, "x-advanced": true }
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
| `apiVersion` | 是 | 整数 | 契约版本。当前 `2`。与宿主不匹配则**拒绝加载** |
| `id` | 是 | string | 插件身份全局唯一，反向域名，小写，仅 `[a-z0-9._-]`。profile 通过 pluginId 关联插件，密钥按 profileId 隔离 |
| `name` | 是 | string | 界面展示名 |
| `version` | 是 | string | 插件自身 semver |
| `kind` | 是 | `"translator"` \| `"ocr"` \| `"tts"` | 能力种类，决定入口模块要实现哪套方法（§5）。一个插件只声明一种 kind，profile 归属只在对应能力的列表里出现 |
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
      /** 默认收进折叠的「高级选项」 */
      "x-advanced"?: boolean;
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
      "x-advanced"?: boolean;
    }
  | {
      type: "boolean";
      title: string;
      description?: string;
      default?: boolean;
      "x-advanced"?: boolean;
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
      "x-advanced"?: boolean;
    }
  | {
      /** 任意 JSON 对象，以 textarea 形式编辑，保存时校验可解析。厂商特有参数透传走这里 */
      type: "json";
      title: string;
      description?: string;
      default?: Record<string, unknown>;
      required?: boolean;
      "x-advanced"?: boolean;
    };

type ConfigSchema = {
  type: "object";
  properties: Record<string, ConfigField>;
  required?: string[];
};
```

规则：

1. `secret` 字段的值**永远不会**出现在 `req.config` 里，也不会进入渲染层的 profile 数据（只有"已设置/未设置"状态）。插件只能通过 `runtime.secrets.get(name)` 取。宿主按 `profileId` 分桶，runtime 绑定本次调用的 profile，同插件不同 profile 的同名密钥彼此隔离。
2. 校验由 core 在保存 profile 时执行：类型、`enum` 成员、`minimum`/`maximum`、`required`。不通过则拒绝保存并返回字段级错误。插件自己不需要重复校验，但 `validateConfig()` 可用于语义校验（如 key 是否有效）。
3. 未知字段忽略，不报错——插件可以在 manifest 升级时增加字段。
4. 当前实现按字段名 `model` 识别模型选择控件，`x-widget: "model-picker"` 尚未接入渲染层。对声明 `capabilities.models` 的插件，将无 `enum` 的字符串 `model` 字段渲染为可编辑输入框和右上「选择模型」按钮；其他类型和枚举字段沿用普通 schema 控件。按钮打开可搜索浮层，首次打开获取并缓存当前 profile/配置的模型列表，支持刷新；按模型 ID 或展示名搜索，选择后回填输入框并关闭。获取失败可重试或继续手动输入；切换 profile 或请求配置时丢弃缓存、搜索状态及过期响应。

   刷新条件（由宿主强制）：

   - **profile 可为草稿**：`profileId` 指向已落盘 profile 或未落盘的草稿 id（新增 dialog 传 `""`）；新建服务商首次保存前即可发起请求，UI 不再要求先保存。
   - **密钥用本次表单输入**：`secrets` 可选，携带用户已输入、未保存的密钥明文，仅用于本次请求（不落盘、不进日志、不并入 config），命中键优先于已保存密钥桶；对应 secret 字段从未设置且本次未输入时，适配器抛 `AUTH_FAILED`「缺少 API Key」。
   - **origin**：已保存 profile 只允许已登记的 `allowedOrigins`（保存 profile 时自动登记该 profile 的 baseURL origin），未登记 origin 返回 `PERMISSION_DENIED`；草稿临时用本次 baseURL 派生 origin，取不到合法 baseURL 报 `INVALID_CONFIG`。

   返回的 `ModelInfo[]` 宿主去重并截断到 500 条，适配器侧截断到 200 条；单次调用超时 30s。

   **健康检测**：「选择模型」前还有「健康检测」按钮。它用固定文本 `Hello`、`en → zh-CN` 真正调用一次插件的 `translate()`，**不新增任何插件契约字段，也不升 `apiVersion`**。草稿 profile、本次表单密钥与 origin 约束和模型列表完全一致（已保存 profile 改到未登记 origin 不会被静默放行）。只有插件完整返回非空输出才算成功；错误按 §7 展示既有 `code` + `message`，空输出、取消、超时都算失败。宿主不返回、渲染层不展示也不记录译文正文。超时 30s，插件即使忽略 `AbortSignal` 也由宿主 deadline 竞速 settle 并清理任务；模型、配置、密钥变化或组件卸载时取消并丢弃旧结果。高级 `type: "json"` 字段无法解析时，不得拿旧配置发起检测或显示成功。

   **模型选择器只对 `translator` 生效。** `ocr` / `tts` 没有 `listModels` 契约，枚举选项（如音色、输出格式）用 `type: "string"` + `enum` 声明，渲染层直接出下拉框。
5. 字段顺序 = `properties` 的书写顺序。
6. `"x-advanced": true` 的字段默认收进折叠的「高级选项」（渲染层放在基础字段之后、保存区之前，默认收起）；校验行为与普通字段完全一致，插件读到的是普通 profile 配置值。
7. `type: "json"` 只接受可解析的 JSON 对象（不允许数组/标量），值直接以对象形式存进 profile。用于 `extra` 这类厂商特有参数；插件读到的已经是对象，不需要自己 `JSON.parse`。
8. 密钥存储能力不是插件能干预的：Linux 无密钥环时宿主可能拒绝落盘改为会话内存，插件只需处理好 `runtime.secrets.get()` 返回 `undefined`。

## 4. presets

preset 是**只读模板**。用户新建 profile 时可选一个 preset 预填 `config`，之后 profile 独立演化，preset 变更不影响已有 profile。

- `preset.config` 必须是 `config.properties` 的键的子集（`secret` 字段除外，preset 不能预填密钥）。
- `preset.models` 可选，用于 `model-picker` 在未联网时的候选列表。
- `preset.id` 在插件内唯一。

## 5. 运行契约

入口模块导出 `createPlugin`（ESM 具名导出，或 CJS 的 `module.exports = { createPlugin }`）：

```ts
// src/shared/plugin.ts 的对外形态
export const PLUGIN_API_VERSION = 2;

/** 能力种类，必须与 manifest.kind 一致。宿主按 kind 只调用对应接口 */
export type PluginKind = "translator" | "ocr" | "tts";

/** profile 的配置值，键由 manifest.config.properties 定义；secret 字段不在此列 */
export type PluginConfig = Record<string, unknown>;

/** 三种能力共有的生命周期钩子 */
export interface PluginBase {
  /** 可选：校验失败请抛错误（§7），宿主会转成 `INVALID_CONFIG` */
  validateConfig?(config: PluginConfig, runtime: PluginRuntime): Promise<void>;

  /** 可选：宿主在禁用/卸载/退出前调用，用于释放连接池、定时器等。 */
  dispose?(): void | Promise<void>;
}

export interface TranslatorPlugin extends PluginBase {
  /** 单次翻译。必须尊重 signal；增量输出用多次 yield，非流式则 yield 一次全量。 */
  translate(req: TranslateRequest, opts: CallOptions): AsyncIterable<string>;

  /** 可选：capabilities.models 为 true 时实现。 */
  listModels?(config: PluginConfig, runtime: PluginRuntime): Promise<ModelInfo[]>;
}

export interface OcrPlugin extends PluginBase {
  /** 单次识别。返回识别出的纯文本；宿主按换行还原多栏排版 */
  recognize(req: OcrRequest, opts: CallOptions): Promise<OcrResult>;
}

export interface TtsPlugin extends PluginBase {
  /** 单次合成。整段音频一次返回，宿主不做流式播放（§8） */
  synthesize(req: TtsRequest, opts: CallOptions): Promise<TtsResult>;
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

export interface OcrRequest {
  /** 该 profile 的配置；secret 字段已被剔除 */
  config: PluginConfig;
  /** 图片字节，宿主已从剪贴板读取并限制大小 */
  image: { data: Uint8Array; mimeType: string };
  /** 期望语言提示，可选；缺省表示不指定 */
  language?: string;
}

export interface OcrResult {
  /** 识别文本；空串表示未识别到文字，宿主在 UI 提示，不算错误 */
  text: string;
}

export interface TtsRequest {
  /** 该 profile 的配置；secret 字段已被剔除 */
  config: PluginConfig;
  /** 待朗读文本，长度已由宿主限制 */
  text: string;
  /** BCP-47 语言码，可选 */
  language?: string;
}

export interface TtsResult {
  /** 音频字节（mp3/wav 等浏览器可播放容器），宿主转成 Blob URL 交给 `<audio>` */
  audio: Uint8Array;
  /** 如 `audio/mpeg`，用于 Blob 的 type */
  mimeType: string;
}
```

`createPlugin()` 返回的对象必须实现 `manifest.kind` 对应的接口：`translator` → `translate()`（可选 `listModels()`），`ocr` → `recognize()`，`tts` → `synthesize()`。宿主按 kind 取值，方法缺失视为 `PLUGIN_CRASH`。

约定：

- 同一插件实例可能被**并发**调用（多个 profile / 多个翻译请求），实现需无共享可变状态或自行加锁。
- `translate()` / `recognize()` / `synthesize()` 抛出的错误由宿主归一化，插件不需要拼 UI 文案。推荐直接抛带 `code` 的错误（见 §7），未标注的按 `INTERNAL` 处理。
- 插件不得在模块顶层做耗时初始化（网络请求、读大文件）；放到 `createPlugin()` 或首次 `translate()`。
- 插件**不得**读写 `config.json` / `secrets.bin` / 其它插件目录，**不得**调用 `app` / `ipcMain` / `shell`。这些调用在宿主已加载 Electron 的环境下技术上可行，属于越界行为，评审直接拒绝。
- **取消语义**：`signal.aborted` 后立即停止 yield 并关闭上游 reader，不要在 `finally` 里再 yield 一次“剩余内容”。已发出的增量不回滚，由 UI 标记“已取消”。生成器必须真正终止，禁止悬挂（宿主不会帮你 `return()` 两次）。
- 插件是**单次调用无状态**的：不要在插件实例上缓存上一次翻译的文本、语言或临时 build 结果，同一实例会被并发调用。
- **请求对象里不放厂商特有参数。** `TranslateRequest` / `OcrRequest` / `TtsRequest` 是同类插件共用的形状，任何“只有某家有”的参数属于该插件的 `config`（用 `type: "json"` 声明），由插件自己合进请求体。不要修改请求形状来适配单家厂商。
- **OCR 与 TTS 不做流式。** `recognize()` 与 `synthesize()` 一次返回完整结果；宿主不做音频分块播放，也不提供逐块回调。长文本合成超时即整段失败，等真有流式音频需求再扩契约。
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
3. 不在清单内声明的动态端点（如用户自填 baseURL）无法被静态声明——因此 `ai` 类插件允许在 manifest 中用通配 `net:*`，此时宿主在保存 profile 时把 baseURL 的 origin 自动登记进该 profile 的 `allowedOrigins` 并随配置持久化。该白名单只是受控 fetch 的运行时边界，不是面向用户的安全闸门：宿主不为新 origin 弹确认框。

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

- `apiVersion` 是**整数**，当前为 `2`。
- 宿主只加载 `apiVersion === PLUGIN_API_VERSION` 的插件。>、< 一律拒绝，错误 `PLUGIN_LOAD_FAILED`，文案说明需要更新插件或宿主。
- 不做运行时兼容层、不做字段级降级。只有**破坏已有插件**的变更才 `+1`：改已有字段语义、删方法、改请求形状。
- 纯加性变更**不**升 `apiVersion`：新增 `kind` 可用值、新增可选 capability 键、新增可选 manifest 字段。不认识的 `kind` 由清单校验拒绝并给出可读原因，不靠版本号代劳。
- `kind` 的可用值随宿主版本单调增加，不会移除；本版为 `translator` / `ocr` / `tts`。
- 例外：新增 `kind` 时同时出现的**可选**契约成员（如 `OcrPlugin`）也属于加性变更，不升版本——旧插件的 `kind` 不在新集合里，本就不会被新方法调用。

## 9. 最小完整示例

### 9.1 翻译插件

一个非流式、单端点的翻译插件：

```json
{
  "apiVersion": 2,
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

### 9.2 语音插件（tts）

```json
{
  "apiVersion": 2,
  "id": "vadu.ttsexample",
  "name": "示例朗读",
  "version": "1.0.0",
  "kind": "tts",
  "main": "index.mjs",
  "permissions": ["net:https://api.example.com"],
  "config": {
    "type": "object",
    "required": ["apiKey"],
    "properties": {
      "apiKey": { "type": "secret", "title": "API Key", "required": true },
      "voice": { "type": "string", "title": "音色", "enum": ["alloy", "nova"], "default": "alloy" }
    }
  }
}
```

```js
// index.mjs
export function createPlugin(runtime) {
  return {
    async synthesize(req, { signal }) {
      const key = runtime.secrets.get("apiKey");
      if (!key) {
        const e = new Error("缺少 API Key");
        e.code = "AUTH_FAILED";
        throw e;
      }
      const res = await runtime.fetch("https://api.example.com/v1/audio/speech", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ input: req.text, voice: req.config.voice }),
      });
      if (!res.ok) {
        const e = new Error(`上游返回 ${res.status}`);
        e.code = res.status === 401 ? "AUTH_FAILED" : "INTERNAL";
        throw e;
      }
      // 插件拿到的是 Node 环境：转成 Uint8Array 交给宿主
      return { audio: new Uint8Array(await res.arrayBuffer()), mimeType: "audio/mpeg" };
    },
  };
}
```

### 9.3 识别插件（ocr）

```json
{
  "apiVersion": 2,
  "id": "vadu.ocrextample",
  "name": "示例取词",
  "version": "1.0.0",
  "kind": "ocr",
  "main": "index.mjs",
  "permissions": ["net:https://api.example.com"],
  "config": {
    "type": "object",
    "required": ["apiKey", "model"],
    "properties": {
      "apiKey": { "type": "secret", "title": "API Key", "required": true },
      "model": { "type": "string", "title": "视觉模型", "required": true }
    }
  }
}
```

```js
// index.mjs
export function createPlugin(runtime) {
  return {
    async recognize(req, { signal }) {
      const key = runtime.secrets.get("apiKey");
      const base64 = Buffer.from(req.image.data).toString("base64");
      const res = await runtime.fetch("https://api.example.com/v1/chat/completions", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: req.config.model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "按阅读顺序输出图中的文字，不要翻译" },
              { type: "image_url", image_url: { url: `data:${req.image.mimeType};base64,${base64}` } },
            ],
          }],
        }),
      });
      if (!res.ok) {
        const e = new Error(`上游返回 ${res.status}`);
        e.code = res.status === 401 ? "AUTH_FAILED" : "INTERNAL";
        throw e;
      }
      const data = await res.json();
      return { text: data.choices?.[0]?.message?.content ?? "" };
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
