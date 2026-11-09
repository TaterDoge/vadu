# IPC 契约

主进程与渲染层之间只有一层边界：`src/preload`。所有类型定义在 `src/shared/ipc.ts`，两侧 import 同一份。

主进程与渲染层同时打包发布，因此**通道不做版本协商**。改通道 = 同时改两侧，破坏性改动只需保证 `bun run typecheck` 通过。

## 1. 命名与形状

```
vadu:<domain>:<action>
```

- `domain`：`plugins` / `translate` / `ocr` / `tts` / `config` / `secret` / `app`
- `action`：小驼峰动词或名词
- 通道名常量集中在 `src/shared/ipc.ts` 的 `IPC` 对象，业务代码禁止裸字符串

三种通信方式：

| 方式 | 用途 | 数量级 |
| --- | --- | --- |
| `invoke` / `handle` | 请求-响应，有返回值或错误 | 少量、非频繁 |
| `send`（main → renderer） | 单向事件推送 | 流式翻译的唯一通道 |
| `send`（renderer → main） | 只用于取消这类"发了就不管"的指令 | 极少 |

## 2. 返回值约定

**跨进程不靠异常传错误。** 每个 `invoke` 返回统一包装：

```ts
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: SerializedError };
```

原因：Electron 的 `ipcRenderer.invoke` 在 handler 抛错时，渲染层拿到的 `Error.message` 会被拼上一串 `"Error invoking remote method ..."` 前缀，且 `code` 等自定义字段全部丢失。用 `IpcResult` 可以带结构化错误，也让 TS 强制调用方处理失败分支。

错误形状与错误码是契约，定义在 `src/shared/errors.ts`，**不在业务代码里手写**：

```ts
type PluginErrorCode =
  | "AUTH_FAILED" | "RATE_LIMITED" | "NETWORK" | "TIMEOUT"
  | "INVALID_CONFIG" | "UNSUPPORTED_LANGUAGE" | "PERMISSION_DENIED"
  | "PLUGIN_LOAD_FAILED" | "PLUGIN_CRASH" | "ABORTED" | "INTERNAL";

type SerializedError = {
  code: PluginErrorCode;
  message: string;
  pluginId?: string;
  retryable: boolean;
};
```

集合与语义只在 [plugin-spec.md §7](./plugin-spec.md#7-错误) 定义一份，`src/shared/errors.ts` 是代码侧的同一份。

`retryable` 由 core 判定：`NETWORK` / `TIMEOUT` / `RATE_LIMITED` 为 true，其余 false。需要错误码穿过 IPC 时抛 `VaduError`，其余 `Error` 一律降级为 `INTERNAL`。

主进程侧统一包装函数（`src/main/ipc/index.ts`）：

```ts
export function handle<TArg, TResult>(
  channel: IpcChannel, // = (typeof IPC)[keyof typeof IPC]，禁止裸字符串
  fn: (arg: TArg, ctx: { sender: WebContents }) => Promise<TResult>
): void {
  ipcMain.handle(channel, async (event, arg: TArg): Promise<IpcResult<TResult>> => {
    try {
      return { ok: true, data: await fn(arg, { sender: event.sender }) };
    } catch (error) {
      // 只记通道与错误码：入参可能含密钥，绝不落日志
      console.error(`[ipc] ${channel} ${toSerializedError(error).code}`);
      return { ok: false, error: toSerializedError(error) };
    }
  });
}
```

`ctx.sender` 供 M2 的流式推流按发起窗口定向发送用（见 §5），现有通道忽略即可。

## 3. 通道表

### 插件

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:plugins:list` | invoke | — | `PluginDescriptor[]` |
| `vadu:plugins:rescan` | invoke | — | `PluginDescriptor[]` |
| `vadu:plugins:setEnabled` | invoke | `{ pluginId: string; enabled: boolean }` | `PluginDescriptor` |
| `vadu:plugins:listModels` | invoke | `{ pluginId: string; profileId: string; config: Record<string, unknown>; secrets?: Record<string, string> }` | `ModelInfo[]` |
| `vadu:plugins:healthCheck` | invoke | `ModelHealthCheckParams` | `{ elapsedMs: number }` |
| `vadu:plugins:cancelHealthCheck` | send（renderer→main） | `{ requestId: string }` | — |
| `vadu:plugins:changed` | send（main→renderer） | `PluginDescriptor[]` | — |
| `vadu:plugins:install` | invoke | —（主进程自己弹目录选择框，见 §5）（M3） | `PluginDescriptor` |
| `vadu:plugins:uninstall` | invoke | `{ pluginId: string }`（M3） | `void` |

```ts
export type PluginStatus = "ready" | "disabled" | "error";
/** error 可由 manifest 不合法、apiVersion 不匹配、import() 失败、createPlugin() 抛错任一触发 */

export type PluginDescriptor = {
  id: string;
  name: string;
  version: string;
  kind: "translator" | "ocr" | "tts";
  description?: string;
  origin: "builtin" | "user";
  status: PluginStatus;
  /** status === "error" 时的原因，直接展示给用户 */
  errorMessage?: string;
  capabilities: { streaming: boolean; models: boolean; glossary: boolean; batch: boolean };
  /** 展示给用户确认的权限清单 */
  permissions: string[];
  /** 设置表单的 schema（不是配置值）。配置值在 Profile.config */
  configSchema?: ConfigSchema;
  presets: PluginPreset[];
  /** 该插件每个 secret 字段是否已设置（不暴露值） */
  secretsSet: Record<string, boolean>;
};
```

`presets` 随列表一起返回，不单开通道：全部 preset 加起来只有几 KB，而多一次往返就要多处理一套加载态。若 M3 后 preset 带 logo 等大字段，再拆成 `vadu:plugins:getPresets`。

### 翻译

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:translate:start` | invoke | `TranslateParams` | `{ requestId: string }` |
| `vadu:translate:cancel` | send | `{ requestId: string }` | — |
| `vadu:translate:event` | send（main→renderer） | `TranslateEvent` | — |

```ts
export type TranslateParams = {
  /** 渲染层预生成并先订阅事件，避免 start 应答前丢失事件 */
  requestId: string;
  pluginId: string;
  profileId: string;
  text: string;
  /** BCP-47 或 "auto" */
  source: string;
  /** BCP-47，不可为 "auto" */
  target: string;
  tone?: "default" | "formal" | "casual";
};

export type TranslateEvent =
  | { requestId: string; type: "delta"; text: string }
  | { requestId: string; type: "done"; text: string; elapsedMs: number; warnings: TranslateWarning[] }
  | { requestId: string; type: "error"; error: SerializedError };

export type TranslateWarning = "PLACEHOLDER_MISMATCH" | "EMPTY_OUTPUT" | "OUTPUT_TOO_LONG";
```

### 从 `TranslateParams` 到 `TranslateRequest`

两者不是同一个类型：前者是渲染层能传的东西，后者是插件拿到的东西。映射全部在 `core/translate/service.ts` 里做，**渲染层无法直接指定插件 config**（否则等于让渲染层任意覆写配置与密钥相关字段）：

| `TranslateRequest` 字段 | 来源 |
| --- | --- |
| `text` / `source` / `target` / `tone` | `TranslateParams` 同名原样 |
| `config` | 按 `profileId` 查出 `Profile.config`；`secret` 字段本来就不在里面 |
| `glossary` | 全局术语表（`AppSettings.glossary`）中的条目；插件 `capabilities.glossary` 为 false 时置 `undefined` |

校验在 `ipc/` 层完成：`target` 不能是 `"auto"`，`source` 为 `"auto"` 或合法 BCP-47，`text` 非空且 ≤ 50,000 字符，`profileId` 必顶属于 `pluginId`。

**协议约束**

1. `start` 只负责登记并立刻返回 `requestId`，**不等待翻译完成**。所有结果经 `vadu:translate:event` 推送。
   - **requestId 由渲染层预生成并先订阅事件，再发 `start`**：事件永远不早于订阅，避免丢首帧。`start` 入参必须带该 `requestId`。
2. 每个 `requestId` 的事件序列：`delta*` → `done`，或 `delta*` → `error`。`done` / `error` 之后不再有该 `requestId` 的事件。
3. 取消后不再发送任何该 `requestId` 的事件（包括 `error`）。渲染层发出 `cancel` 后立即丢弃后续事件，但**保留已收到的 delta**并在面板上标记"已取消"——不做回滚（见 [architecture.md ADR-009](./architecture.md#7-架构决策记录)）。
4. 同一窗口可并发多个 `requestId`，渲染层按 `requestId` 分派到各自的面板。
5. `warnings` 只出现在 `done` 上，用于占位符/长度异常提示，见 [ai-provider.md §6](./ai-provider.md#6-core-侧的译文校验)。
6. **`done.text` 是权威值**。渲染层用 `done.text` 替换自己累加的结果，而不是只做校验。开发模式下两者不一致时打 warning。
7. **取消的时序不做严格保证**：abort 之前已进入发送队列的 delta 仍可能到达。渲染层收到 cancel 之后一律忽略该 `requestId` 的后续事件（含 `done`）。主进程在 abort 后设标志位，此后不再 `send`。

多窗口时事件需要按发起窗口定向发送：`start` 时记录 `event.sender`，后续用该 `webContents.send`，不要 `BrowserWindow.getAllWindows()` 广播。

### 识别与语音

两种能力都是**一次性请求-响应**，不流式、不提供取消通道：超时由主进程兜底（120s），超时整段失败。音频/图片字节直接走结构化克隆（`Uint8Array`），不经 base64。

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:ocr:recognize` | invoke | `OcrParams` | `OcrResult` |
| `vadu:tts:synthesize` | invoke | `TtsParams` | `TtsPayload` |

```ts
export type OcrParams = {
  /** 为空表示用该 kind 下第一个已启用的服务商 */
  profileId?: string;
  /** 图片字节，渲染层从剪贴板/拖拽读取后传入 */
  image: Uint8Array;
  /** 如 image/png、image/jpeg、image/webp；宿主只放行这三种 */
  mimeType: string;
  /** 期望语言提示，可选 */
  language?: string;
};

export type OcrResult = { text: string };

export type TtsParams = {
  /** 为空表示用该 kind 下第一个已启用的服务商 */
  profileId?: string;
  text: string;
  /** BCP-47，可选 */
  language?: string;
};

export type TtsPayload = {
  /** 音频字节，渲染层转 Blob URL 播放；不落盘 */
  audio: Uint8Array;
  mimeType: string;
};
```

`profileId` 缺省时的选择规则与浮窗一致：按存储顺序取该 kind 下第一个 `enabled` 的服务商；一个都没有时报 `INVALID_CONFIG`「未配置可用的识别/语音服务商」。

CSP 需要 `media-src 'self' blob:`，否则播放被拦。

### 配置

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:config:listProfiles` | invoke | `{ pluginId?: string; kind?: PluginKind }` | `Profile[]` |
| `vadu:config:saveProfile` | invoke | `Profile` | `Profile` |
| `vadu:config:reorderProfiles` | invoke | `{ orderedIds: string[] }` | `Profile[]` |
| `vadu:config:deleteProfile` | invoke | `{ profileId: string }` | `void` |
| `vadu:config:getAppearance` | invoke | — | `AppearanceSettings` |
| `vadu:config:setAppearance` | invoke | `AppearancePatch` | `AppearanceSettings` |
| `vadu:config:migrateAppearance` | invoke | `AppearancePatch`（旧 localStorage 值） | `AppearanceSettings` |
| `vadu:config:appearanceChanged` | send（main→renderer） | `AppearanceSettings` | — |
| `vadu:config:exportBackup` | invoke | —（风险确认在设置页 UI；主进程只弹保存框） | `BackupExportResult` |
| `vadu:config:importBackup` | invoke | —（主进程自己弹打开/确认框） | `BackupImportResult` |

```ts
export type Profile = {
  id: string;              // uuid，宿主生成
  pluginId: string;
  name: string;            // 用户可读名，如「DeepSeek-快速」
  preset?: string;         // 创建时选用的 preset id
  config: Record<string, unknown>; // 不含 secret 字段
  /** 保存 profile 时自动登记的 origin；宿主受控 fetch 只允许发往这里 */
  allowedOrigins: string[];
  /** 服务商开关：关闭后保留配置；翻译与浮窗可选项过滤该服务商，旧 profile 无此字段默认启用 */
  enabled: boolean;
  createdAt: number;
};

export type AppearanceSettings = {
  theme: "system" | "light" | "dark";
  style: "nova" | "lyra";
  accent: "neutral" | "blue" | "emerald" | "amber" | "rose" | "violet";
};

export type AppearancePatch = Partial<AppearanceSettings>;

export type AppSettings = {
  defaultProfileId?: string;
  hotkey: string | null;   // 全局快捷键，如 "CommandOrControl+Shift+T"；null = 用户解绑
  inAppHotkeys: {
    // 局内快捷键：窗口聚焦时生效，渲染层用 TanStack Hotkeys 自行监听，不经 globalShortcut
    openSettings: string | null; // 浮窗内打开设置，默认 "CommandOrControl+,"
    togglePin: string | null; // 浮窗内切换固定窗口，默认 "CommandOrControl+P"
  };
  theme: AppearanceSettings["theme"];
  style: AppearanceSettings["style"];
  accent: AppearanceSettings["accent"];
  historyLimit: number;    // 默认 50
  /** 启动时是否弹出主窗，默认 false（静默驻留托盘，从托盘/Dock 进设置） */
  showMainWindowOnStartup: boolean;
  /** 全局术语表，M3 实现。渲染层不按请求传术语，core 统一注入 */
  glossary: { from: string; to: string }[];
};

export type BackupExportResult =
  | { canceled: true }
  | { canceled: false; profileCount: number; secretCount: number };

export type BackupImportResult =
  | { canceled: true }
  | {
      canceled: false;
      profileCount: number;
      secretCount: number;
      /** v1 旧备份无密钥，UI 明确提示需重填 */
      legacy: boolean;
      restarting: true;
    };
```

保存 profile 时主进程串行校验；新 id 由宿主生成，已有 id 不可更改 pluginId。渲染层的 allowedOrigins 被忽略；保存时主进程把 `config.baseURL` 的 origin 自动登记进 `allowedOrigins`（不弹窗、只作受控 fetch 的运行时边界）。配置值必须通过插件 `configSchema` 清洗：未知字段忽略、secret 字段剔除、类型/enum/min/max/required 违规即拒绝保存。`enabled` 只接受布尔，缺省视为 `true`（旧 profile 无此字段时按启用处理）。

**外观**

`getAppearance` / `setAppearance` / `migrateAppearance` 只读写 `AppSettings` 的三个外观字段，写入与 profile 保存共用主进程配置写队列。`setAppearance` 接受部分字段，未传的字段保持不变；非法取值返回 `INVALID_CONFIG` 且不写盘。写成功后主进程向所有窗口 `send` `vadu:config:appearanceChanged`，两窗各自更新 DOM，不把 localStorage 当第二真值。

`migrateAppearance` 只负责本功能之前的外观迁移：配置缺少 `style` / `accent`（旧版本）时三个字段都可由旧 localStorage 补入；一旦配置带 `style` / `accent`（恢复或新保存过），三个字段都不被旧缓存覆盖。渲染层迁移成功后删除旧键 `vadu:theme` / `vadu:style` / `vadu:accent`；失败则保留旧键供下次重试，但仍回读主进程真值。`localStorage` 的 `vadu:appearance` 只作首帧缓存。

**设置备份/恢复**

`exportBackup` / `importBackup` 的路径选择都由主进程弹原生对话框，**入参不接受路径，也不回备份正文**。导出风险确认在渲染层设置页用 UI 弹窗完成，确认后才调用 `exportBackup`，因此该通道进来直接弹保存框。备份 JSON 固定 `format: "vadu-settings-backup"`、`formatVersion: 2`，`schemaVersion` 与当前配置版本一致；v1 旧备份仍可导入。文件上限 8 MiB、服务商上限 200。

**v2 完整备份**：每个 profile 含 `config` 与独立 `secrets: { [name]: string }`，覆盖当前 profile 的全部已保存密钥（所有 kind、启用/停用、多 secret 字段），不含无关联旧桶；空桶写 `{}`。`config` 里 schema secret 字段仍剔除，密钥只来自 secrets 桶。`headers` / `extra` 等自由 JSON 按现有 schema 原样保留，不再因为含 `Authorization` 等已保存配置而拒绝。只有用户主动导出的 JSON 含明文密钥；本机 `config.json` / renderer / 日志 / 错误永不含密钥，`secrets.bin` 仍由 `safeStorage` 加密。

`exportBackup` 在设置页确认后直接弹保存对话框；设置页取消、Esc 或关闭不调用该通道，保存框取消也不读配置/密钥、不写文件，不调用 `readSettings`，不产生损坏留档副作用。保存确认后用 `readBackupSnapshot()` + `snapshotSecrets()` 取有序快照：密钥快照等待 secret 写链；初始化/解密失败或存在未读取密钥文件时拒绝完整导出，纯会话密钥可导出。导出只写用户选择的 JSON 路径，不日志备份正文，不复制 `secrets.bin`；POSIX 下临时文件以 `0600` 创建并在 rename 后保留该权限（Windows 跳过）。

导入是**全量替换**，不是逐条保存：

- 先严格校验版本/类型/重复 ID/`defaultProfileId` 引用/快捷键语法/服务商数量/插件存在且 `ready`/`configSchema`。v2 必须每个 profile 有合法 `secrets` 对象；密钥名 1–100、值非空且 ≤4096、字段必须是插件 `secret`、单 profile ≤64 个，拒绝原型污染键；错误不带密钥值。导出与导入复用同一套 secrets 校验：旧 schema 字段、超限值或坏桶会让导出整次失败并指出服务商，不静默丢掉密钥，也不生成不可导入的备份。v1 无 secrets，按无密钥处理。
- 含密钥时先检查 `canPersistSecrets()`；无法安全持久化则在改 config 前明确拒绝，不得“恢复成功后重启丢钥匙”。本机无明文降级不变。
- 所有 profile 换新 UUID，`defaultProfileId` 重映射；`allowedOrigins` 忽略并按 `baseURL` 重建；新 UUID 密钥映射到新 profile。旧 `secrets.bin` 桶保留，不搬移/复用/删除。
- 原生确认：v2 显示密钥数量与明文文件风险；v1 明确旧备份不含密钥、恢复后需重填 API Key。取消零写入、零重启。
- 提交前写单份 `config.before-restore.json` 快照；先通过 secret 写链/safeStorage 合并新 UUID 密钥，再原子写 `config.json`。密钥写失败 config 不变、不封锁、不重启；config 最后写失败旧 profile/key 仍可用，新 ID 孤儿密文允许保留。
- `commitBackupImport` 是 async；调用方必须 await 成功后才在同一个同步队列回调内 `lockConfigWrites()` 并重启。提交失败不封锁、不重启。写封锁持续到重启，队列后续操作和直接 `updateSettings` / `saveProfile` / `writeConfigRaw` 全部 `ABORTED`。
- 导出目标不得是运行中的 `config.json` / `secrets.bin` / 恢复快照，符号链接与硬链接别名同样拦截。

### 模型列表（`vadu:plugins:listModels`）

服务商设置中模型字段「选择模型」浮层的唯一数据通道，语义：

- 入参 `profileId` 可以是未落盘的草稿 id（新增 dialog 传 `""`）：未保存的服务商也可获取模型列表，无需先保存；已保存 profile 仍直接命中。
- `secrets`（可选）是本次表单里用户已输入、尚未保存的密钥明文，**只用于本次模型列表请求**：绝不并入 `config`、绝不落盘、绝不写入日志（含插件日志与错误 message）。宿主校验形状：普通对象、值全为 string、键数 ≤ 16、单值长度 ≤ 8192，否则 `INVALID_CONFIG`。`secrets` 中出现的键优先于已保存的密钥桶；未出现的键回落已保存桶。
- origin 约束：
  - 已保存 profile：请求经受控 `runtime.fetch`，只允许发往已保存 `allowedOrigins` 里已登记的地址；即使本次表单改了 baseURL，未登记的新 origin 仍返回 `PERMISSION_DENIED`（保持「先保存再换地址」的保护）。
  - 草稿 profile：临时用本次 `config.baseURL` 派生 origin（仅本次调用生效，不登记白名单）；baseURL 缺失或非法时报 `INVALID_CONFIG`「请先填写正确的接口地址」，不放行。
- `config` 由渲染层传当前表单值（含未保存修改），宿主只做形状与字段数校验，不落盘；草稿 profile 仅在内存构造，请求成功/失败均无持久化副作用。
- 缺少对应密钥时由插件抛 `AUTH_FAILED`，渲染层不再前置拦截。
- 返回 `ModelInfo[]`，宿主去重并截断到 500 条；适配器侧截断到 200 条。
- 超时 30s，错误归一化与翻译一致（`TIMEOUT` / `NETWORK` / `AUTH_FAILED` …）。
- `ModelInfo = { id: string; label?: string }`，来自 `src/shared/plugin.ts`。

### 模型健康检测（`vadu:plugins:healthCheck` / `vadu:plugins:cancelHealthCheck`）

服务商设置中模型字段「健康检测」按钮的真实调用通道。**不改插件契约**：复用 `translator.translate()`，不新增插件方法、字段或 `apiVersion`。

```ts
export type ModelHealthCheckParams = {
  requestId: string;
  pluginId: string;
  profileId: string;
  config: Record<string, unknown>;
  secrets?: Record<string, string>;
};
```

- 固定请求：文本 `Hello`、`source: "en"`、`target: "zh-CN"`，不读取用户输入文本；`config` 必须是当前表单值且含非空 `model`，否则 `INVALID_CONFIG`。
- `config` 与 `secrets` 的形状/长度校验、`profileId` 可草稿、密钥覆盖与 origin 约束与 `listModels` 一致；`config` 还会按插件 `configSchema` 清洗（剔除 secret/未知字段，类型与必填不合规即拒绝）。已保存 profile 只用落盘 `allowedOrigins`；草稿只用本次 `baseURL` 派生 origin，新 origin 不静默放行；profile 属于其他插件时报 `INVALID_CONFIG`，草稿使用合成 id，绝不回落到其他 profile 的密钥桶。
- 成功只在插件完整返回过一次非空输出时成立；空输出、插件错误、取消、超时都为失败。返回结果只有 `elapsedMs`，**不返回、不记录译文正文**。
- 超时 30s，插件即使忽略 `AbortSignal` 也由宿主 deadline 竞速 settle，并清理任务表。
- `cancelHealthCheck` 是「发了就不管」的 send 通道；`requestId` 由渲染层生成，只有发起窗口能取消自己的任务，发送方窗口销毁即中止。渲染层在模型/配置/密钥变化或组件卸载时取消并丢弃旧结果。
- 请求只有本次调用副作用：不写 config，不修改 profile，不持久化任何密钥或检测结果。

### 密钥

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:secret:has` | invoke | `{ profileId: string; name: string }` | `boolean` |
| `vadu:secret:set` | invoke | `{ profileId: string; name: string; value: string }` | `void` |

清除单个密钥使用 `vadu:secret:set`，传对应 `profileId`、`name` 和空字符串 `value`；不另设 `secret:clear` 通道。

`vadu:secret:has` 只返回「该 profile 是否已保存某密钥」的布尔值，不暴露密钥任何片段，用于设置页表单占位（模型列表请求不再以它作前置判断，未保存草稿直接随请求携带临时密钥）；`PluginDescriptor.secretsSet` 是跨 profile 的聚合快照，不得用于当前 profile 的保存状态。

**没有 `secret:get` 通道，永远不要加。** 也**不提供掩码 / 片段回显**：返回 key 的任何一部分都需要把密钥送进渲染层，收益只是让用户认出是哪个 key——用 profile 名区分即可。

UI 回填规则：

- 新建 profile：密钥输入框空。
- 编辑已有 profile：输入框始终为空，placeholder 显示 `已设置（留空则不修改）` 或 `未设置`，数据来自 `PluginDescriptor.secretsSet`。
- 用户只提交空值 = 不修改；提交非空值 = 覆盖。
- 保存能力经 `vadu:app:getSecretStorage` 查询，返回 `{ available: boolean; backend?: string; plaintext: boolean }`。
- Linux 无安全密钥环或加密不可用时，宿主自动仅会话内存保存，UI 明确提示重启后需重新填写；不提供明文落盘选项。

### 应用

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:app:getSecretStorage` | invoke | — | `{ available: boolean; backend?: string; plaintext: boolean }` |
| `vadu:app:openExternal` | invoke | `{ url: string }` | `void` |
| `vadu:app:getHotkey` | invoke | — | `HotkeyState` |
| `vadu:app:setHotkey` | invoke | `{ accelerator: string \| null }` | `HotkeyState` |
| `vadu:app:setHotkeySuspended` | invoke | `{ suspended: boolean }` | `null` |
| `vadu:app:toggleQuickWindow` | invoke | — | `null` |
| `vadu:app:setQuickWindowContentHeight` | invoke | `{ height: number }` | `null` |
| `vadu:app:setQuickWindowPinned` | invoke | `{ pinned: boolean }` | `null` |
| `vadu:app:getQuickWindowPinned` | invoke | — | `boolean` |
| `vadu:app:showSettings` | invoke | — | `null` |
| `vadu:app:getInAppHotkey` | invoke | — | `InAppHotkeyState` |
| `vadu:app:setInAppHotkey` | invoke | `{ action: "openSettings" \| "togglePin"; accelerator: string \| null }` | `InAppHotkeyState` |
| `vadu:app:getShowMainWindowOnStartup` | invoke | — | `boolean` |
| `vadu:app:setShowMainWindowOnStartup` | invoke | `{ enabled: boolean }` | `boolean` |

`HotkeyState`：

```ts
export type HotkeyState = { accelerator: string | null; registered: boolean };
```

`accelerator` 用 Electron accelerator 语法（如 `CommandOrControl+Shift+T`），`registered: false` 表示注册失败（组合被系统或其他应用占用）。`AppSettings.hotkey` 存的就是这同一个 accelerator 字符串（见 `src/shared/hotkey.ts`）。录制期间主进程会 suspend 全局注册（`setHotkeySuspended(true)`），避免录到的组合立即触发唤起，录制结束恢复并换绑。

`openExternal` 只允许 `https:` 与 `http:`，其它协议（`file:`、自定义 scheme）直接拒绝。不要把这个能力暴露成 `shell.openExternal` 的直通。

`toggleQuickWindow` 显示/收起翻译浮窗，全局热键与渲染层（Esc 收起）共用同一入口。翻译窗与主窗共用 `index.html`，以 `#/quick` hash 区分根组件，由 `src/main/windows.ts` 管理窗口生命周期。

`setQuickWindowPinned` 切换浮窗「图钉」状态：固定中失焦不收起，并抬到 `screen-saver` 置顶层级；取消固定恢复默认置顶与失焦收起。状态仅存主进程内存（会话级），不持久化到 `AppSettings`。

`setQuickWindowContentHeight` 让浮窗高度跟随渲染层内容：渲染层用 `ResizeObserver` 量「顶栏 + 输入区 + 结果区」的自然高度（不量被 `min-h-svh` 约束的根节点，否则自我反馈），主进程把高度夹到 `[340, min(屏幕可用高度, 窗口上边缘到工作区底)]` 并 `setContentSize`。因此窗口不会因内容变长出滚动条；顶到屏幕底后才退回页面滚动，不会把内容裁掉。

`getQuickWindowPinned` 回读上面这个主进程内存状态。渲染层 `pinned` 只是本地 `useState`，渲染层重载（HMR / `Ctrl+R`）会把它重置为 `false`，而主进程仍固定中；浮窗挂载时必须回读，否则图标与实际置顶层级错位，用户点一下会以为「没效果」（实际是方向反了）。

`showSettings` 显示并聚焦设置窗口（主窗），浮窗内快捷键打开设置走这里，不复用 `toggleMainWindow`（避免设置窗已聚焦时被反向隐藏）。

**局内快捷键**（`getInAppHotkey` / `setInAppHotkey`）：与全局热键相对，只在窗口聚焦时生效。存储在 `AppSettings.inAppHotkeys`（同一 Electron accelerator 语法），但**不经 `globalShortcut`**——渲染层用 TanStack Hotkeys（`@tanstack/react-hotkeys`）自行监听，主进程只负责校验与持久化。当前绑定点：`openSettings`（默认 `CommandOrControl+,`）与 `togglePin`（默认 `CommandOrControl+P`，等价于点图钉按钮，走 `setQuickWindowPinned`）。绑定值在渲染层转成 TanStack chord（`CommandOrControl` → `Mod`）；TanStack 不认的组合退化为「未绑定」。浮窗只藏不销毁，改绑后靠重新聚焦时重拉 `getInAppHotkey` 生效。

## 4. preload 形状

```ts
// src/preload/index.ts
const vadu = {
  plugins: {
    list: () => call(IPC.plugins.list),
    rescan: () => call(IPC.plugins.rescan),
    setEnabled: (pluginId: string, enabled: boolean) => call(IPC.plugins.setEnabled, { enabled, pluginId }),
    listModels: (pluginId: string, profileId: string, config: Record<string, unknown>, secrets?: Record<string, string>) => call(IPC.plugins.listModels, { pluginId, profileId, config, secrets }),
    healthCheck: (params: ModelHealthCheckParams) => call(IPC.plugins.healthCheck, params),
    cancelHealthCheck: (requestId: string) => ipcRenderer.send(IPC.plugins.cancelHealthCheck, { requestId }),
    onChanged: (fn: (plugins: PluginDescriptor[]) => void) => subscribe(IPC.plugins.changed, fn),
  },
  translate: {
    start: (params: TranslateParams) => call(IPC.translate.start, params),
    cancel: (requestId: string) => ipcRenderer.send(IPC.translate.cancel, { requestId }),
    onEvent: (fn: (event: TranslateEvent) => void) => subscribe(IPC.translate.event, fn),
  },
  ocr: {
    recognize: (params: OcrParams) => call(IPC.ocr.recognize, params),
  },
  tts: {
    synthesize: (params: TtsParams) => call(IPC.tts.synthesize, params),
  },
  config: { /* 同上 */ },
  secrets: { /* 同上 */ },
  app: { /* 同上 */ },
};
contextBridge.exposeInMainWorld("vadu", vadu);
```

`subscribe` 必须返回退订函数，渲染层在组件卸载时调用；不允许把 `ipcRenderer.on` 直接透给渲染层（会泄漏 `event` 对象与无法退订的监听）。

`window.vadu` 的类型在 `src/preload/index.d.ts` 通过 `declare global` 声明，类型本体来自 `src/shared/ipc.ts` 的 `VaduApi`。**新增通道必须同时更新 `VaduApi`，否则渲染层拿不到类型。**

## 5. 入参校验

`invoke` 的入参来自渲染层，视为不可信输入（渲染层一旦被 XSS，等于可调用任意通道）：

- `ipc/` 层对每个入参做形状校验，不合法直接返回 `{ ok: false, error: { code: "INVALID_CONFIG" } }`。
- 字符串字段有长度上限（`text` ≤ 50,000 字符，`name` ≤ 100，URL ≤ 2,000）。
- `pluginId` / `profileId` 必须存在于当前内存表，不接受渲染层传入任意路径。
- 文件路径类入参（M3 的 `plugins:install`、`config:exportBackup` / `config:importBackup`）只接受用户通过系统文件对话框选择的结果：主进程自己弹 `dialog.showOpenDialog` / `showSaveDialog`，**不接受渲染层传入路径字符串**。这是防目录穿越的硬要求。
- 备份内容与文件大小也在主进程校验：渲染层拿不到密钥，也不能借路径覆盖 `config.json` / `secrets.bin`。

## 6. 日志与可观测

- IPC 层记录通道名、耗时、结果码，**不记录入参文本**（翻译内容是用户隐私）。
- `requestId` 贯穿 main 日志、插件日志、渲染层事件，用于问题定位。
- 开发模式（`is.dev`）下 `vadu:translate:event` 额外打印首个 delta 的耗时，用于排查首字节超时。
