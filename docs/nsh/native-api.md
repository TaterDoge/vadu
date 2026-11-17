# NSH 原生 API 与任务契约

> 普通设置已在 `src/settings.ts` 实现，直接使用 NSH 的 TS API；翻译、插件及其余原生 API 为目标设计。下列原生 TypeScript 草案只表达调用语义，不是当前 `vadu/native` 已有成员或手写 SDK；原生绑定类型以 Rust 生成结果为准。

## 1. 边界与类型来源

普通配置直接导入 TS 设置模块，由它进行运行时校验与 Storage 读写；需要受控原生能力时才导入业务原生模块。Rust 负责对应输入的校验、授权与任务管理；TS 类型检查不能替代运行时校验。

- 复用现有 `vadu/native` 注册入口，按业务职责导出模块，不增加字符串通道分发器。
- 原生业务 DTO 在 Rust 定义，通过 NSH 绑定生成 TS；普通配置类型只在 `src/settings.ts` 定义，禁止两端重复维护同一接口。
- 先验证 DTO、带标签事件和业务结果能正确往返，再冻结具体 Rust 表达；不靠类型断言掩盖绑定缺失。
- 同步方法不做阻塞 I/O；接受任务与完成任务是两件事。

## 2. API 按职责分组

下表是命名与职责草案，不要求一次实现所有设置 API。

| 模块 | 调用语义 |
| --- | --- |
| Translation | `start(input, onEvent)` 受理并登记回调；`cancel(requestId)` 取消翻译 |
| Ocr | `recognize(input)` 返回一次文本结果；`cancel(requestId)` 取消 |
| Tts | `synthesize(input)` 返回一次音频结果；`cancel(requestId)` 取消 |
| Profiles | 查询 / 保存 / 启停配置；核心校验 schema 与已确认的网络授权 |
| Settings（TS，已实现） | 查询 / 保存应用偏好；统一经过 TS 设置模块 |
| Secrets | 查询是否已设置、写入或明确清除；没有读取密钥 API |
| Plugins | 查询状态、选择并安装用户插件、确认权限、启停与卸载 |

窗口和快捷键优先使用已有 NSH 平台接口；只有需要核心状态或权限管理时才提供相应原生入口。不复刻旧 Electron 的整个 app 通道集合。

### 已实现的 Settings

以下是 `src/settings.ts` 的实际导出，不属于 `vadu/native`，也不再维护 Rust Settings DTO：

- `Settings.read(): Promise<AppSettings>`：等候已排队的更新后读取；仅键不存在时使用默认值。
- `Settings.setShortcut(id: string, keystroke: string): Promise<AppSettings>`：串行读取最新配置、校验并更新单项。
- `Settings.resetShortcut(id: string): Promise<AppSettings>`：恢复单项默认值，也检查冲突。
- `Settings.current(): AppSettings | null`：最近一次成功读取或保存的响应式快照，供全局注册观察；启动前为 `null`，不用于绕过校验写回整包配置。
- `captureShortcutKeys(): string[]`：生成录入临时组合表，排除 NSH 已知保留键及取消 / 移焦键。

可预期错误以 `SettingsError` 拒绝，带安全的 `code` / `message`；错误码为 `INVALID_CONFIG`、`UNSUPPORTED_VERSION`、`SHORTCUT_CONFLICT`、`STORAGE_FULL`。页面仍捕获意外 Promise 拒绝，只显示通用安全提示。

`nsh.Storage` 提供持久化，`nsh.keymap` 提供语法解析、平台标签及窗口内临时录入。`nsh/desktop.GlobalShortcut.register(shortcut, onPress): Promise<boolean>` 用于真正的系统全局注册；它不是配置存储或录入 API。`src/shortcuts.ts` 已用它注册翻译浮窗全局动作；系统返回 `false` 或拒绝 Promise 时展示失败，不把保存成功当作注册成功。录入期间暂停，换绑与卸载通过 `unregister` 清理；翻译窗组件通过 `nsh.keymap.bind` 绑定打开设置局内动作，仅可见且聚焦时启用，失焦、隐藏与关闭时清理；组合来自已校验的 `Settings.current()`，不使用 GlobalShortcut 注册。固定窗口局内动作尚未实现。存储格式、队列边界、后台写盘限制与后续备份设计见[配置存储](./storage.md)。

## 3. 结构化业务错误

Rust 的普通 `Err` 只保证消息式抛出 / 拒绝，不能依赖 `error.code` 自动穿透。可预期失败使用明确 DTO：

```ts
type ApiError = {
  code: ErrorCode;
  message: string;
  retryable: boolean;
};

type NativeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };
```

这是 Vadu 的业务结果，不是为了模拟 Electron IPC。参数拒绝、一次性结果和流事件共用错误语义；意外的运行时异常仍需在 UI 边界兜底，不能显示原始堆栈。

| ErrorCode | 含义 |
| --- | --- |
| AUTH_FAILED | 凭据缺失或服务端拒绝认证 |
| RATE_LIMITED | 服务限流 |
| NETWORK | 网络不可达或连接失败 |
| TIMEOUT | 宿主期限到达 |
| INVALID_CONFIG | 输入、配置或 Profile 引用不合法 |
| UNSUPPORTED_LANGUAGE | 能力不支持该语言 |
| PERMISSION_DENIED | 插件、端点或系统能力未获授权 |
| PLUGIN_LOAD_FAILED | 插件校验或初始化失败 |
| PLUGIN_CRASH | 插件异常退出或资源超限 |
| ABORTED | 一次性任务被取消或运行环境正在退出 |
| INTERNAL | 其余宿主内部失败 |

`message` 只能包含安全、可行动的信息，不回传原始上游正文、请求头或密钥。`retryable` 由核心决定，只提示用户可重试，不代表自动重试。插件错误码也以本表为准。

## 4. 翻译：受理、增量、终态

```ts
type TranslateInput = {
  requestId: string;
  profileId: string;
  text: string;
  source: string;
  target: string;
};

type TranslateEvent =
  | { requestId: string; type: "delta"; text: string }
  | { requestId: string; type: "done"; text: string }
  | { requestId: string; type: "error"; error: ApiError }
  | { requestId: string; type: "cancelled" };

// 语义草案，不是已存在的导出。
declare const Translation: {
  start(
    input: TranslateInput,
    onEvent: (event: TranslateEvent) => void,
  ): Promise<NativeResult<{ requestId: string }>>;
  cancel(requestId: string): Promise<void>;
};
```

### 开始

1. UI 先生成新的 `requestId`，建立该请求的视图状态，再调用 `start`。
2. 核心校验输入、Profile 启用状态、插件 kind 与可用性，取本次配置快照。
3. 任务登记与回调绑定必须先于插件执行；禁止先启动网络、后单独订阅，避免丢首帧。
4. `start` 只等待受理，不等待翻译结束；校验失败返回 `ok: false`，不产生流事件。
5. 受理后的结果全部走该请求回调。事件可能早于受理 Promise 被 UI 观察到，UI 不能等 await 返回后才建立状态。

活动请求 ID 不得重复；重复请求返回 `INVALID_CONFIG`，不覆盖原任务。UI 不复用历史 ID。核心不得在调用期间重新选择 Profile 或让其他页面草稿替换本次配置。

### 事件

正常顺序为零到多个 `delta`，再到一个 `done`、`error` 或 `cancelled`。同一任务的事件有序，至多一个终态；回调仍有效时，受理的任务最终必须结束，不能永久挂起。

- `delta.text` 是增量片段，UI 追加展示。
- `done.text` 是完整权威结果，UI 用它校正最终文本，不能再追加一次。
- 核心只回调发起方，不向全部窗口广播翻译内容。
- 发生错误时保留已显示文本并标注失败，不把部分结果伪装为成功。
- 终态后释放任务、回调、网络流与取消资源；迟到结果不得产生第二终态。

### 取消与生命周期

- UI 取消时立即停止接受该请求的后续内容，保留已显示文本；核心终止上游 HTTP、流 reader 与插件调用。
- `cancel` 幂等；不存在或已结束的 ID 不报错、不复活任务。
- 如果取消发生在受理 Promise 返回前，UI 记住取消意图；受理成功后立即再调用 `cancel`，不能因竞态留下后台任务。即便受理过程中已有回调，也不再显示旧内容。
- 取消与完成竞速时，只允许先提交的终态生效；UI 已取消的视图不被迟到 `done` 覆盖。
- 新请求、组件卸载或工作台关闭时，调用方取消旧任务并清理回调；核心也要在插件失效、应用退出等生命周期边界兜底清理。共享 engine 不代表自动获得窗口级任务释放。
- 插件不响应 signal 时，宿主仍需中断 / 隔离执行并清理任务；不能只改 UI 上的 loading。

## 5. OCR 与 TTS：一次性、可取消

两类能力都带 `requestId` 和 `profileId`，遵守与翻译相同的配置快照、授权、宿主期限、取消传播和旧结果过滤规则，但不强套文本增量事件：

| 能力 | 业务输入 | 业务结果 |
| --- | --- | --- |
| OCR | 图片字节与媒体类型 | `NativeResult<{ text: string }>` |
| TTS | 文本；声音等服务配置来自 Profile | `NativeResult<{ audio: Uint8Array; mimeType: string }>` |

取消后一次性调用以 `ABORTED` 结束；不再发送翻译的 `cancelled` 事件。一次性入口必须先登记任务，再交给异步工作，确保调用返回 Promise 后 `cancel` 已能找到任务。若 NSH 绑定无法保证该顺序，先调整为显式受理 API 并同步本文；不能等完整结果返回后才补发取消。

音频是业务字节，不把浏览器 Blob、HTML audio 或磁盘路径当作 NSH 契约。跨绑定的二进制表达、输入 / 输出大小、媒体类型与播放资源释放，需在对应切片中确定并测试后开放能力。

## 6. 输入、凭据与授权

- 翻译 / OCR / TTS 的 UI 调用只选择 `profileId`，不接受任意插件路径、临时 config 或已保存密钥覆写。核心从 Profile 得到插件与权限。
- 核心验证对象形状、字段类型、非空文本、语言与当前 kind；文本上限 50,000、Profile 名称上限 100、URL 上限 2,000 个 Unicode 码点。这些是业务限制，不是 NSH 框架限制。
- 插件输出和外部网络响应同样是不可信输入，需要体积限制、类型检查与安全错误归一。
- `allowedOrigins` 只由宿主根据用户明确确认的端点授权生成，不直接信任 UI 或插件提交的白名单。
- 插件安装与备份文件选择由宿主控制；UI 不可传任意路径覆盖应用文件。安装包内容与路径仍需校验。
- 已保存密钥只提供 `has` 状态；新输入值仅用于明确的写入操作。保留、替换、清除必须区分，编辑表单留空不等于删除。
- 当前不复刻带草稿密钥和临时 config 的模型检测接口。若需要未保存配置检测，先单独定义短期凭据、授权和取消规则。

## 7. 验证清单

先用可控假插件 / 假 HTTP 服务验证，测试不依赖真实厂商或真实密钥：

- 正常增量、无增量直接结束、首帧早于受理返回、`done.text` 校正与至多一个终态。
- 参数拒绝、重复 ID、禁用 / 不存在的 Profile、kind 不匹配、并发请求互不串结果。
- 受理前取消、流中取消、取消与完成竞速、插件忽略取消、关窗与卸载清理。
- 受理后超时 / 崩溃一定结束；任务表、回调与上游连接无泄漏。
- Rust 错误 DTO 的码与安全消息正确到达 UI，未知异常不会泄漏密钥。
- OCR / TTS 的取消、二进制边界和资源释放，不仅验证 happy path。

应用检查使用 `nsh check` 与 `nsh test`；涉及插件加载、网络或动态执行的能力，还必须验证发布构建，不能仅凭开发模式通过。
