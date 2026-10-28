# IPC 契约

主进程与渲染层之间只有一层边界：`src/preload`。所有类型定义在 `src/shared/ipc.ts`，两侧 import 同一份。

主进程与渲染层同时打包发布，因此**通道不做版本协商**。改通道 = 同时改两侧，破坏性改动只需保证 `bun run typecheck` 通过。

## 1. 命名与形状

```
vadu:<domain>:<action>
```

- `domain`：`plugins` / `translate` / `config` / `secret` / `app`
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
  kind: "translator";
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
2. 每个 `requestId` 的事件序列：`delta*` → `done`，或 `delta*` → `error`。`done` / `error` 之后不再有该 `requestId` 的事件。
3. 取消后不再发送任何该 `requestId` 的事件（包括 `error`）。渲染层发出 `cancel` 后立即丢弃后续事件，但**保留已收到的 delta**并在面板上标记"已取消"——不做回滚（见 [architecture.md ADR-009](./architecture.md#7-架构决策记录)）。
4. 同一窗口可并发多个 `requestId`，渲染层按 `requestId` 分派到各自的面板。
5. `warnings` 只出现在 `done` 上，用于占位符/长度异常提示，见 [ai-provider.md §6](./ai-provider.md#6-core-侧的译文校验)。
6. **`done.text` 是权威值**。渲染层用 `done.text` 替换自己累加的结果，而不是只做校验。开发模式下两者不一致时打 warning。
7. **取消的时序不做严格保证**：abort 之前已进入发送队列的 delta 仍可能到达。渲染层收到 cancel 之后一律忽略该 `requestId` 的后续事件（含 `done`）。主进程在 abort 后设标志位，此后不再 `send`。

多窗口时事件需要按发起窗口定向发送：`start` 时记录 `event.sender`，后续用该 `webContents.send`，不要 `BrowserWindow.getAllWindows()` 广播。

### 配置

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:config:listProfiles` | invoke | `{ pluginId?: string }` | `Profile[]` |
| `vadu:config:saveProfile` | invoke | `Profile` | `Profile` |
| `vadu:config:deleteProfile` | invoke | `{ profileId: string }` | `void` |
| `vadu:config:getSettings` | invoke | — | `AppSettings` |
| `vadu:config:saveSettings` | invoke | `AppSettings` | `AppSettings` |

```ts
export type Profile = {
  id: string;              // uuid，宿主生成
  pluginId: string;
  name: string;            // 用户可读名，如「DeepSeek-快速」
  preset?: string;         // 创建时选用的 preset id
  config: Record<string, unknown>; // 不含 secret 字段
  createdAt: number;
};

export type AppSettings = {
  defaultProfileId?: string;
  hotkey: string | null;   // 全局快捷键，如 "CommandOrControl+Shift+T"；null = 用户解绑
  inAppHotkeys: {
    // 局内快捷键：窗口聚焦时生效，渲染层用 TanStack Hotkeys 自行监听，不经 globalShortcut
    openSettings: string | null; // 浮窗内打开设置，默认 "CommandOrControl+,"
    togglePin: string | null; // 浮窗内切换固定窗口，默认 "CommandOrControl+P"
  };
  theme: "system" | "light" | "dark";
  historyLimit: number;    // 默认 50
  /** 启动时是否弹出主窗，默认 false（静默驻留托盘，从托盘/Dock 进设置） */
  showMainWindowOnStartup: boolean;
  /** 全局术语表，M3 实现。渲染层不按请求传术语，core 统一注入 */
  glossary: { from: string; to: string }[];
};
```

### 密钥

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:secret:set` | invoke | `{ pluginId: string; name: string; value: string }` | `void` |
| `vadu:secret:clear` | invoke | `{ pluginId: string }` | `void` |

**没有 `secret:get` 通道，永远不要加。** 也**不提供掩码 / 片段回显**：返回 key 的任何一部分都需要把密钥送进渲染层，收益只是让用户认出是哪个 key——用 profile 名区分即可。

UI 回填规则：

- 新建 profile：密钥输入框空。
- 编辑已有 profile：输入框始终为空，placeholder 显示 `已设置（留空则不修改）` 或 `未设置`，数据来自 `PluginDescriptor.secretsSet`。
- 用户只提交空值 = 不修改；提交非空值 = 覆盖。
- 保存能力经 `vadu:app:getSecretStorage` 查询，返回 `{ available: boolean; backend?: string; plaintext: boolean }`。
- 明文降级（Linux 无密钥环）时 UI 必须显示警告并让用户显式选择"仅本次会话使用"，不静默落盘。

### 应用

| 通道 | 方向 | 入参 | 返回 |
| --- | --- | --- | --- |
| `vadu:app:getSecretStorage` | invoke | — | `{ available: boolean; backend?: string; plaintext: boolean }` |
| `vadu:app:openExternal` | invoke | `{ url: string }` | `void` |
| `vadu:app:getHotkey` | invoke | — | `HotkeyState` |
| `vadu:app:setHotkey` | invoke | `{ accelerator: string \| null }` | `HotkeyState` |
| `vadu:app:setHotkeySuspended` | invoke | `{ suspended: boolean }` | `null` |
| `vadu:app:toggleQuickWindow` | invoke | — | `null` |
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
    onChanged: (fn: (plugins: PluginDescriptor[]) => void) => subscribe(IPC.plugins.changed, fn),
  },
  translate: {
    start: (params: TranslateParams) => call(IPC.translate.start, params),
    cancel: (requestId: string) => ipcRenderer.send(IPC.translate.cancel, { requestId }),
    onEvent: (fn: (event: TranslateEvent) => void) => subscribe(IPC.translate.event, fn),
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
- 文件路径类入参（M3 的 `plugins:install`）只接受用户通过系统文件对话框选择的结果：主进程自己弹 `dialog.showOpenDialog`，**不接受渲染层传入路径字符串**。这是防目录穿越的硬要求。

## 6. 日志与可观测

- IPC 层记录通道名、耗时、结果码，**不记录入参文本**（翻译内容是用户隐私）。
- `requestId` 贯穿 main 日志、插件日志、渲染层事件，用于问题定位。
- 开发模式（`is.dev`）下 `vadu:translate:event` 额外打印首个 delta 的耗时，用于排查首字节超时。
