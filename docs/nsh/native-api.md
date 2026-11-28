# NSH 平台 API 与任务契约

> 设置、内置服务商请求和翻译任务在 TypeScript 中实现。OCR、TTS 和第三方插件 API 属于目标设计。

## 1. 边界与类型来源

`src/feature/settings/index.ts` 组合各设置模块的命令。`src/feature/settings/store.ts` 统一读写普通配置，`providers/` 管理 Profile 校验及独立的 API Key。`src/api/` 通过 NSH `fetch` 请求服务商并校验上游响应。

## 2. API 按职责分组

| 模块              | 状态与调用语义                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Translation（TS） | 已实现。`start(input, onEvent)` 受理并登记回调，`cancel(requestId)` 取消翻译                                                       |
| 服务商请求（TS）  | 已实现。`listModels` 查询已保存服务商，`listModelsDraft` 查询已确认的草稿地址，`checkModel` 对当前模型发起对话。均使用 NSH `fetch` |
| Settings（TS）    | 已实现。校验和保存外观、快捷键与服务商 Profile，通过同一队列读取、保存与清除地址绑定的 API Key                                     |
| Ocr / Tts         | 设计。返回一次文本或音频结果，支持取消                                                                                             |
| Plugins           | 设计。安装用户插件、确认权限、启停与卸载                                                                                           |

窗口和快捷键调用 NSH 提供的平台接口。

### 已实现的 Settings

- `Settings.read(): Promise<AppSettings>`：等候已排队的更新后读取。缺键时先保存各模块的默认配置，再发布快照。已有配置直接校验读取。
- `Settings.setAppearance(patch: Partial<AppearanceSettings>): Promise<AppSettings>` 合并本次修改的显示模式、强调色或风格，校验后串行提交。
- `Settings.setShortcut(id: string, keystroke: string | null)` 校验并保存全局项的键位，`null` 表示未绑定。
- `Settings.resetShortcut(id)` 清空全局键位，保留开关状态。
- `Settings.setShortcutEnabled(id, enabled)` 保存全局项的开关，开启前检查冲突。这三个命令均返回 `Promise<AppSettings>`，修改局内项会以 `INVALID_CONFIG` 拒绝。
- `Settings.readProfile(id: string)` 等候已排队的写入并从最新配置读取指定 Profile。
- `Settings.readProfileKey(id, baseUrl)` 在同一队列中核对已保存的 Profile 地址并读取匹配的密钥。缺少匹配密钥时返回 `null`。
- `Settings.current(): AppSettings | null`：最近一次成功读取或保存的响应式快照，供外观主题、快捷键注册与翻译浮窗观察。启动前为 `null`。
- `Settings.saveProfile` 串行保存服务商配置，再将本次输入的 API Key 写入 NSH Storage 独立键，返回 `keyError` 告知密钥写入结果。删除、排序和清除密钥共用同一队列。
- `captureShortcutKeys(): string[]`：生成录入临时组合表，排除 NSH 已知保留键及取消 / 移焦键。

可预期错误以 `SettingsError` 拒绝，带安全的 `code` / `message`；错误码包括 `INVALID_CONFIG`、`SHORTCUT_CONFLICT`、`STORAGE_FULL` 和 `PERMISSION_DENIED`。页面仍捕获意外 Promise 拒绝，只显示通用安全提示。

`nsh.Storage` 提供持久化，`nsh.keymap` 提供语法解析、平台标签及窗口内临时录入。`nsh/desktop.GlobalShortcut.register(shortcut, onPress): Promise<boolean>` 用于真正的系统全局注册；它不是配置存储或录入 API。`src/feature/settings/shortcuts/runtime.ts` 仅在全局项开启且有键位时注册翻译浮窗动作。系统返回 `false` 或拒绝 Promise 时展示失败，不把保存成功当作注册成功。录入期间暂停，关闭开关、换绑、清空键位和卸载时通过 `unregister` 清理。同一模块通过 `nsh.keymap.bind` 绑定打开设置和固定窗口两个局内动作，仅可见且聚焦时启用，失焦、隐藏与关闭时清理；组合来自已校验的 `Settings.current()`，不使用 GlobalShortcut 注册。图钉和局内快捷键共用置顶动作，通过 `WindowRef.set({ level })` 切换窗口层级。存储格式、队列边界、后台写盘限制与后续备份设计见[配置存储](./storage.md)。

## 3. 结构化业务错误

业务错误包含 `code`、`message` 和 `retryable`。翻译受理返回 `ApiError` 或 `null`。请求失败以 `SettingsError` 或 `ProviderRequestError` 拒绝。异步翻译在终态事件的 `error` 字段返回安全错误。UI 捕获意外 Promise 拒绝并展示通用提示。OCR 与 TTS 草案使用带 `ok` 标签的 `NativeResult<T>`。

| ErrorCode            | 含义                               |
| -------------------- | ---------------------------------- |
| AUTH_FAILED          | 凭据缺失或服务端拒绝认证           |
| RATE_LIMITED         | 服务限流                           |
| NETWORK              | 网络不可达或连接失败               |
| TIMEOUT              | 宿主期限到达                       |
| INVALID_CONFIG       | 输入、配置或 Profile 引用不合法    |
| UNSUPPORTED_LANGUAGE | 能力不支持该语言                   |
| UNSUPPORTED_PROTOCOL | Profile 的 API 协议尚未接入        |
| PERMISSION_DENIED    | 插件、端点或系统能力未获授权       |
| PLUGIN_LOAD_FAILED   | 插件校验或初始化失败               |
| PLUGIN_CRASH         | 插件异常退出或资源超限             |
| ABORTED              | 一次性任务被取消或运行环境正在退出 |
| INTERNAL             | 其余宿主内部失败                   |

`message` 只能包含安全、可行动的信息，不回传原始上游正文、请求头或密钥。`retryable` 由核心决定，只提示用户可重试，不代表自动重试。插件错误码也以本表为准。

## 4. 翻译：受理、增量、终态

`start` 接收 `requestId`、`profileId`、所选模型 ID `model`、`text` 和目标语言 `target`。内置适配直接翻译原文，目标语言支持简体中文、繁体中文、英语、日语、韩语。回调按 `requestId` 接收增量及终态。

### 开始

1. UI 先生成新的 `requestId`，建立该请求的视图状态，再调用 `start`。
2. `start` 同步校验输入并登记任务。拒绝受理时返回 `ApiError`，受理成功返回 `null`。
3. 任务异步读取 Profile，确认已启用且包含请求指定的模型 ID，再使用该模型发起请求。凭据和请求地址沿用原有绑定校验。增量和终态由该请求的回调发送。

活动请求 ID 不得重复；重复请求返回 `INVALID_CONFIG`，不覆盖原任务。UI 不复用历史 ID。核心不得在调用期间重新选择 Profile 或让其他页面草稿替换本次配置。

### 事件

正常顺序为零到多个 `delta`，再到一个 `done`、`error` 或 `cancelled`。同一任务的事件有序，至多一个终态；回调仍有效时，受理的任务最终必须结束，不能永久挂起。

- `delta.text` 是增量片段，UI 追加展示。
- `done.text` 是完整权威结果，UI 用它校正最终文本，不能再追加一次。
- 核心只回调发起方，不向全部窗口广播翻译内容。
- 发生错误时保留已显示文本并标注失败，不把部分结果伪装为成功。
- 终态后释放任务、回调、网络流与取消资源；迟到结果不得产生第二终态。

### 取消与生命周期

- UI 取消时立即停止更新并保留已显示文本。`cancel` 通过该请求的 `AbortController` 中止 `fetch` 并释放 reader。
- `cancel` 可重复调用，已结束的请求不会再次触发事件。任务登记后即可取消，包括 `fetch` 发出前。
- 取消与完成竞速时，只允许先提交的终态生效；UI 已取消的视图不被迟到 `done` 覆盖。
- 工作台隐藏、关闭或组件卸载会取消活动请求。应用退出时释放 engine 和剩余任务。

## 5. OCR 与 TTS：一次性、可取消

两类能力都带 `requestId` 和 `profileId`，遵守与翻译相同的配置快照、授权、宿主期限、取消传播和旧结果过滤规则，但不强套文本增量事件：

| 能力 | 业务输入                         | 业务结果                                                |
| ---- | -------------------------------- | ------------------------------------------------------- |
| OCR  | 图片字节与媒体类型               | `NativeResult<{ text: string }>`                        |
| TTS  | 文本；声音等服务配置来自 Profile | `NativeResult<{ audio: Uint8Array; mimeType: string }>` |

取消后一次性调用以 `ABORTED` 结束；不再发送翻译的 `cancelled` 事件。一次性入口必须先登记任务，再交给异步工作，确保调用返回 Promise 后 `cancel` 已能找到任务。若 NSH 绑定无法保证该顺序，先调整为显式受理 API 并同步本文；不能等完整结果返回后才补发取消。

音频是业务字节，不把浏览器 Blob、HTML audio 或磁盘路径当作 NSH 契约。跨绑定的二进制表达、输入 / 输出大小、媒体类型与播放资源释放，需在对应切片中确定并测试后开放能力。

## 6. 输入、凭据与授权

- 翻译 UI 调用传入 `profileId` 和该 Profile 已保存的模型 ID，后续 OCR / TTS 调用沿用 `profileId`。核心从 Profile 得到插件与权限，拒绝任意插件路径、临时 config 或已保存密钥覆写。
- 核心验证对象形状、字段类型、非空文本、语言与当前 kind；文本上限 50,000、Profile 名称上限 100、URL 上限 2,000 个 Unicode 码点。这些是业务限制，不是 NSH 框架限制。
- 插件输出和外部网络响应同样是不可信输入，需要体积限制、类型检查与安全错误归一。
- 新增或更换 Base URL 时，由设置页展示完整地址并请求确认。内置适配只请求已保存或设置页已确认的 HTTP(S) 地址，拒绝重定向。HTTP 确认提示说明原文与凭据的明文传输风险。第三方插件的独立来源授权见[插件规范](./plugin-spec.md)。
- 插件安装与备份文件选择由宿主控制；UI 不可传任意路径覆盖应用文件。安装包内容与路径仍需校验。
- 设置页聚焦时通过 `Settings.readProfileKey(profileId, baseUrl)` 读取与当前接口地址匹配的 API Key，作为密码输入框的实际值。默认按字符掩码显示，眼睛按钮只切换掩码。仅提交用户编辑的密钥。留空保留已有 Key，输入新值可替换，确认删除服务商时清除其密钥。API Key 以明文存在 NSH Storage，与普通配置同一 `storage.json`，但使用独立键。
- `listModelsDraft(baseUrl, key)` 仅使用本次输入的非空密钥查询模型。新地址需要先在设置页确认完整地址。已保存地址输入新密钥后可直接查询。为某个地址输入的草稿密钥会在改址时清空。新建时也可先填密钥，再在地址确认框中指定首次使用的地址。查询过程不写配置、密钥或日志。
- `checkModel(profileId, model)` 使用已保存 Profile 的地址和绑定凭据。检测弹窗每次检测一个模型，可从服务商返回的模型或草稿已选的模型中选择。关闭检测弹窗会中止当前请求，关闭模型抽屉会中止模型列表请求。设置窗口隐藏、关闭或编辑器卸载时也会中止模型请求。

### NSH 网络行为

- 所有服务商请求使用 `redirect: "manual"`，拒绝 3xx。每次模型列表或健康检测请求的总期限为 25 秒，响应上限 1 MiB。翻译总期限 120 秒，等待响应头或下一块最多 25 秒，响应上限 2 MiB。连接建立由 NSH 后端管理，计入对应请求期限。
- NSH 0.6.1 的 macOS 后端使用系统代理。发送请求时设置 `credentials: "omit"`，本地探针仍观察到 NSURLSession 复用同源 Cookie。Windows / Linux 后端读取环境代理，阻塞读取期间可能延后断连。取消后应用立即丢弃迟到数据。

## 7. 验证清单

先用可控假插件 / 假 HTTP 服务验证，测试不依赖真实厂商或真实密钥：

- 正常增量、无增量直接结束、`done.text` 校正与唯一终态。
- 参数拒绝、重复 ID、禁用 / 不存在的 Profile、kind 不匹配、并发请求互不串结果。
- 受理前取消、流中取消、取消与完成竞速、插件忽略取消、关窗与卸载清理。
- 受理后超时 / 崩溃一定结束；任务表、回调与上游连接无泄漏。
- 结构化错误码和安全提示正确到达 UI，未知异常显示通用提示。
- OCR / TTS 的取消、二进制边界和资源释放，不仅验证 happy path。

应用检查使用 `nsh check` 与 `nsh test`；涉及插件加载、网络或动态执行的能力，还必须验证发布构建，不能仅凭开发模式通过。
