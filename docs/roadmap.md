# 路线图

按垂直切片推进：每个里程碑结束时应用都能跑、能翻、能验收。不做"先把框架写完再验证"的横向推进——那套做法在插件架构上尤其危险，因为契约只有被一个真实插件用过才知道对不对。

## M0 · 骨架（0.5 天）

**交付**

- `src/shared/{ipc,plugin,errors,languages}.ts` 落地，类型与文档一致。
- `src/main/ipc/index.ts` 的 `handle()` 包装 + 一个 `vadu:plugins:list` 返回空数组。
- `src/preload` 暴露 `window.vadu`，`index.d.ts` 声明 `VaduApi`。
- 两个 tsconfig 的 `include` 加 `src/shared/**/*`。
- 删掉现有 `ping` 演示 IPC 与 demo 页。

**验收**

- `bun run typecheck` + `bun run check` 通过。
- 渲染层调用 `window.vadu.plugins.list()` 拿到 `{ ok: true, data: [] }`。

## M1 · 一次非流式翻译（1–2 天）

**交付**

- `core/plugin/{manifest,loader,registry,host}.ts`：扫描两个根目录、校验 manifest、`import()`、失败隔离。
- `core/config/store.ts`：`config.json` 原子读写 + `schemaVersion`。
- `core/translate/service.ts` 的**非流式**路径：一次调用、一次返回。
- `plugins/ai/`：manifest + preset（先只放 `openai` 一个）+ `adapters/openai.ts` 的**非流式**实现。
- 构建配置：`electron.vite.config.ts` 多入口 + manifest 复制；`electron-builder.yml` 加 `asarUnpack: out/main/plugins/**`。
- 渲染层：翻译输入框 + 结果区 + 一个"翻译"按钮；配置暂时写死在 `config.json` 里手改。

**验收**

- 配好 `https://api.openai.com/v1` + key + 模型后，能中译英、英译中。
- 把 `manifest.json` 的 `apiVersion` 改成 `2`，插件显示"加载失败：契约版本不匹配"，**应用仍能启动**。
- 把 `apiKey` 写成错的，UI 显示"认证失败"而不是"未知错误"。
- 断网时显示"网络错误"，且 `retryable` 为 true。

## M2 · 流式 + 取消 + 密钥（2–3 天）

**交付**

- `AsyncIterable<string>` 流式路径 + `vadu:translate:event` 事件通道 + `requestId` 生命周期。
- `vadu:translate:cancel` + `AbortSignal` 全链路下传；UI 显示"已取消"并保留已出内容。
- `core/config/secrets.ts`：`safeStorage` **异步** API、`shouldReEncrypt` 回写、`basic_text` 检测与降级提示。
- `PROFILE` 的增删改查 IPC + profile 切换 UI。
- schema 驱动设置表单（`string` / `number` / `boolean` / `secret` / `enum` / `json`）+ 保存时校验。
- 剩余 preset（anthropic / gemini / deepseek / ollama…）按 [ai-provider.md §2](./ai-provider.md#2-内置-presets) 补齐。
- `model-picker`（调 `listModels()`，失败降级文本输入）。

**验收**

- 翻译 200 字英文，首字 1s 内出现，后续持续增量。
- 中途点取消：1s 内停止，上游连接关闭（用本地假 SSE server 观察）。
- Linux 无密钥环环境下：保存 key 时出现明确警告，选择"仅本次会话"后重启应用 key 消失、且不会写入 `secrets.bin`。
- profile 切换后立即用新配置翻译，无需重启。

## M3 · 三协议 + 第三方插件（3–5 天）

**交付**

- `anthropic` / `gemini` 适配器（原生协议，含 SSE 帧解析与 NDJSON→SSE 差异）。
- 占位符校验（`PLACEHOLDER_MISMATCH`）+ 空输出/超长检测 + 结果区警告条。
- 首字节超时 20s / 总计 120s + 首个 chunk 前的单次重试。
- 内存 LRU 翻译缓存（key = pluginId + profileId + 语言对 + 文本哈希）。
- 第三方插件安装：`dialog.showOpenDialog` → 复制到 `userData/plugins/<id>/` → 展示 `permissions` 与来源 → 用户确认 → 重新扫描。
- 插件启用/禁用/卸载 + 目录监听（`fs.watch` 或"重新扫描"按钮，二选一，不做自动热重载）。
- 插件列表 UI（状态、错误原因、权限、来源标记）。

**验收**

- 同一个 `ai` 插件 + 3 个 profile（`protocol` 分别为 `openai` / `anthropic` / `gemini`），对同一段英文发起翻译，三者均返回中文译文，且无 `PLUGIN_CRASH` / `INTERNAL` 错误。
- 装一个手写的 20 行示例插件（无流式）：保存后插件列表显示 `ready`，选中它翻译 `hello` 返回非空结果。
- 装一个 `apiVersion: 2` 的插件，被拒绝且给出可读原因。
- 卸载插件后，其 profile 与密钥一并清理，无残留。
- 占位符被翻译时出现警告条，但译文仍显示。

## 明确不做（当前阶段）

- 插件市场、在线安装、自动更新、签名校验。
- 插件沙箱与权限运行时强制（见 [architecture.md §2](./architecture.md#2-进程模型)）。
- `kind` 除 `translator` 之外的实现（`ocr` / `tts` 只留类型位）。
- 图片翻译、截图取词、全局快捷键弹窗（M4 起再评估，快捷键字段已在 `AppSettings` 里预留）。
- 翻译历史持久化、导出、云同步。
- token 用量与成本统计（需契约扩到 `TranslateDelta` 并 `apiVersion + 1`，M4 再评估）。
- 评测指标自动化（BLEU/COMET）。

## 风险与对应

| 风险 | 影响 | 对应 |
| --- | --- | --- |
| `apiVersion` 契约早期改动频繁 | 每次改动都要废弃旧插件 | M3 之前不对外发布插件规范；内部只维护 `ai` 一个插件，改动成本可控 |
| 模型名 / baseURL 过期 | preset 失效，用户以为软件坏了 | 首选模型都可由 `model-picker` 覆盖；preset 只是初值，错误提示指向"改配置"而不是"上报 bug" |
| 第三方插件无沙箱 | 恶意插件读全部密钥 | 默认禁用 + 安装前展示权限 + 文档明确风险；上市场前必须重做隔离 |
| 各家"OpenAI 兼容"实现不完全一致 | 某些厂商的 SSE 帧解析失败 | 解析器容错（跳过无法解析的帧、非流式降级为单次 yield），并在 preset 上标注已验证 |
| 流式取消后上游仍在计费 | 用户被多扣钱 | abort 尽量下传到 `fetch`；`finally` 关闭 reader；不做自动重试以避免重复计费 |
