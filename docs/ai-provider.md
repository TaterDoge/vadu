# AI 翻译

vadu 的首选翻译形态。一个内置插件 `vadu.ai` 覆盖所有 AI 厂商，用户自带 endpoint + 密钥 + 模型。

本文只写与"AI 翻译"相关的决策；插件的通用规范见 [plugin-spec.md](./plugin-spec.md)。

## 1. 为什么是"一个插件 + 多个适配器"

如果每接一家厂商就加一个插件，`plugins/` 会长成一堆 90% 相同、只差 baseURL 与请求体的目录。实际上生态已经收敛：

- OpenAI `/chat/completions` 已成为事实标准，DeepSeek、Moonshot、DashScope、智谱、MiniMax、SiliconFlow、OpenRouter、Groq、Together、Ollama、LM Studio、vLLM 都提供官方兼容端点。
- Anthropic 与 Gemini **也各自提供官方 OpenAI 兼容层**，但官方明确说明兼容层是"测试/对比用"，完整能力（thinking、prompt caching、PDF、引用）只走原生协议。

因此适配器按**协议**而不是按**厂商**划分：

| 适配器 | 用途 | 何时使用 |
| --- | --- | --- |
| `openai` | `/chat/completions`，SSE，`data: {...}` 直到 `data: [DONE]` | 默认。所有兼容厂商 + OpenAI 官方 |
| `anthropic` | `/v1/messages`，具名 SSE 事件，`anthropic-version` 头 | 需要 thinking / prompt caching / 原生能力时 |
| `gemini` | `/models/{model}:streamGenerateContent`，默认 NDJSON，`?alt=sse` 才是 SSE | 需要原生多模态 / 结构化输出时 |

### 为什么不拆成 3 个插件

一个自然的反对意见：既然有 3 套协议，为什么不拆成 `openai` / `anthropic` / `gemini` 三个插件，每个只管自己？

因为**插件是按"用户要装几个东西"拆的，不是按"代码有几套"拆的**。拆开后：

- 用户要覆盖 DeepSeek + Claude + Gemini，得装 3 个插件、建 3 个 profile，而它们其实是同一件事（"用我的模型翻译"）。
- preset 列表被撕成三份，UI 上"选择服务商"不再是唯一入口。
- 三个插件共享 prompt、语言码、占位符校验、超时策略，要么复制三份，要么抽个公共包（那就等于又合回去了）。

反过来的真正风险是"适配器随厂商增长膨胀"，而这个风险来自**按厂商分支**的实现方式，不来自插件数量。约束很硬：

> **适配器数量恒等于协议数量（3），与厂商数量无关。** 新增厂商只能加 preset 数据，不能加适配器、不能在适配器里写 `if (baseURL.includes(...))`。**

适配器只做两件事：把 `TranslateRequest` 编成该协议的 HTTP body；把该协议的流解析成 `string` 增量。任何厂商特有的参数走 `profile.config.extra`（一个 JSON 对象输入框）原封不动透传进请求体，适配器**不做参数名映射**（`top_p` / `topP` / `reasoning_effort` 各协议就写各协议的写法，让用户自己填）。这样厂商差异永远不会变成代码分支。

厂商差异只在两处落数据，不落代码：

1. **preset**（manifest 里）：厂商名 + baseURL + 默认模型 + 推荐协议。
2. **profile**（用户配置）：用户可能随时覆盖 baseURL/模型，preset 只是初值。

新增一家 OpenAI 兼容厂商 = 往 `presets` 加一条数据。**不需要写代码、不需要改适配器。** 这是本设计成立的核心检验点。

## 2. 内置 presets

作为 `src/main/plugins/ai/manifest.json` 的 `presets` 数据维护。baseURL 必须写到"适配器拼接路径之前"为止（`openai` 适配器会拼 `/chat/completions`）。

| preset id | 展示名 | protocol | baseURL | 默认模型 |
| --- | --- | --- | --- | --- |
| `openai` | OpenAI | openai | `https://api.openai.com/v1` | `gpt-4.1-mini` |
| `anthropic` | Anthropic | anthropic | `https://api.anthropic.com/v1` | `claude-sonnet-4-5` |
| `gemini` | Google Gemini | gemini | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.5-flash` |
| `deepseek` | DeepSeek | openai | `https://api.deepseek.com/v1` | `deepseek-chat` |
| `moonshot` | Moonshot / Kimi | openai | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| `dashscope` | 阿里百炼 / Qwen | openai | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| `zhipu` | 智谱 GLM | openai | `https://open.bigmodel.cn/api/paas/v4` | `glm-4.5` |
| `minimax` | MiniMax | openai | `https://api.minimax.io/v1` | `MiniMax-M2` |
| `siliconflow` | SiliconFlow | openai | `https://api.siliconflow.cn/v1` | `Qwen/Qwen3-8B` |
| `openrouter` | OpenRouter | openai | `https://openrouter.ai/api/v1` | `openai/gpt-4.1-mini` |
| `groq` | Groq | openai | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| `together` | Together AI | openai | `https://api.together.ai/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| `ollama` | 本地 Ollama | openai | `http://127.0.0.1:11434/v1` | `qwen3:8b` |
| `lmstudio` | 本地 LM Studio | openai | `http://127.0.0.1:1234/v1` | 用户自填 |
| `vllm` | 本地 vLLM | openai | `http://127.0.0.1:8000/v1` | 用户自填 |

注意事项（踩过的坑，不要"优化"掉）：

- **baseURL 归一化**：去尾部 `/`，然后按协议拼路径。用户常直接粘贴 `https://api.openai.com/v1/chat/completions`——适配器要检测并剥离已存在的 `/chat/completions`、`/v1/messages` 等后缀。
- **智谱不要拼 `/chat/completions`**（其 baseURL 已是 `/v4`，接 `/chat/completions` 正确，但不要重复 `/api/paas`）。
- **Gemini 原生** baseURL 到 `/v1beta` 为止，适配器拼 `/models/{model}:streamGenerateContent`；OpenAI 兼容层则是 `/v1beta/openai/`，两者不要混。
- **国内域名与海外域名账号不互通**（SiliconFlow `.cn` / `.com`），preset 只给一个，另一个由用户改 baseURL。
- 模型名会过期。preset 的默认模型只影响首次创建 profile，`model-picker` 刷新时以 `GET /models` 为准，失败则用 preset 的 `models` 候选列表。

## 3. prompt

固定 system 消息 + 用户文本。**不要**把待翻译文本塞进 system 消息（会带来提示注入面），也不要做"请翻译成 X"式的多轮对话。

```ts
// src/main/plugins/ai/prompt.ts
const SYSTEM = `你是翻译引擎。把用户提供的文本翻译成目标语言。

规则：
- 只输出译文，不要解释、不要加引号、不要保留"译文："之类的前缀。
- 保持原文的段落、换行、列表层级与 Markdown 结构。
- 占位符原样保留：{{...}}、%s、%d、{0}、<tag>...</tag>、${...} 不得翻译或改写。
- 代码块、URL、邮箱、@提及不翻译。
- 术语表优先于你的判断。
- 若原文已是目标语言，原样返回。`;

function buildMessages(req: TranslateRequest): ChatMessage[] {
  const parts = [`目标语言（BCP-47）：${req.target}`];
  if (req.source !== "auto") parts.push(`源语言（BCP-47）：${req.source}`);
  if (req.tone === "formal") parts.push("语体：正式书面");
  if (req.tone === "casual") parts.push("语体：口语化");
  if (req.glossary?.length) {
    parts.push(`术语表（原文 => 译文）：\n${req.glossary.map((g) => `${g.from} => ${g.to}`).join("\n")}`);
  }
  parts.push(`原文：\n<<<\n${req.text}\n>>>`);

  return [
    { content: SYSTEM, role: "system" },
    { content: parts.join("\n\n"), role: "user" },
  ];
}
```

要点与理由：

- **只输出译文**：AI 默认喜欢解释"以下是翻译"，流式场景下这些前缀会先刷到屏幕上再被覆盖（做不到），必须用 prompt 抑制。
- **`<<<` 包围原文**：降低原文里的指令被执行的几率。不是安全边界，只是降低误触发。
- **占位符清单写死在 prompt 里**：软件界面文本（最常见场景）含大量 `{{name}}` / `%s`，翻译错一个就是运行时报错。翻译后 core 会做一次占位符校验（见 §6）。
- **`temperature` 默认 0.3**：翻译要稳定不要创意。reasoning 类模型（`deepseek-reasoner`、thinking 档位）会显著变慢且翻译没有增益，UI 里不做推荐。
- 不支持 `response_format: json_object`，翻译输出就是纯文本。需要结构化（多段原文对应多段译文）时由 core 拆分多次调用，不做 JSON 模式。

## 4. 流式解析

三种格式不能共用解析器：

### openai

```
data: {"choices":[{"delta":{"content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: [DONE]
```

按行读，`data: ` 前缀剥离，`[DONE]` 结束，取 `choices[0].delta.content`。空 content（首帧只有 `role`）跳过。`choices[0].finish_reason` 非空后停止。

### anthropic

SSE 有事件名，**不能当纯 `data:` 拼接**：

```
event: message_start
data: {...}
event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"你"}}
event: message_stop
data: {...}
```

按 `event:` 分发：只有 `content_block_delta` 且 `delta.type === "text_delta"` 时取 `delta.text`；`message_stop` 结束；`error` 事件（如 `overloaded_error`，对应 HTTP 529）转 `RATE_LIMITED` / `INTERNAL`。请求头必须带 `anthropic-version`（与 `x-api-key` 配对，不要用 `Authorization: Bearer`）。

### gemini

原生 `streamGenerateContent` **默认返回 NDJSON**（每行一个完整 `GenerateContentResponse` JSON），加 `?alt=sse` 才是 SSE。适配器统一用 `?alt=sse`，省掉两种解析路径。文本在 `candidates[0].content.parts[*].text`，注意 `parts` 可能是数组且混有非文本 part。

### 共性实现约束

- **按行切帧要处理跨 chunk 截断**：`TextDecoder` 用 `{ stream: true }`，缓冲区保留最后不完整的一行，下次拼接。
- **不缓冲全量再输出**：收到一个 delta 就 `yield` 一个，否则流式无意义。
- 上游 `stream: true` 但对方直接返回完整 JSON（部分兼容实现如此），要降级为单次 yield，不要卡死等待更多帧。
- 非 2xx 时先读 response body 的文本再抛错——AI 厂商的错误原因（模型不存在、额度不足）几乎都在 body 里。

## 5. 超时、重试、取消

- **首字节超时 20s，总计超时 120s**。流式请求不能用单一总超时覆盖一切；首字节超时才是用户真正感知的"卡住"。
- **不自动重试流式请求**。已经向用户显示了半句话之后再重来会闪烁，且部分厂商按 token 计费会重复扣。重试只在"首个 chunk 之前失败"时允许，且最多 1 次、仅对 `NETWORK` / `TIMEOUT` / `429`。
- 取消一律通过 `AbortSignal` 下传到 `runtime.fetch`。适配器在 `catch` 里判断 `signal.aborted` 后抛 `code = "ABORTED"`，由宿主静默处理。

## 6. core 侧的译文校验

AI 输出不可信，core 在拼装完成后做两件事，都不阻塞展示：

1. **占位符差异检测**：对比原文与译文中的占位符多重集。不一致时在 UI 上给一条警告（"变量可能被翻译，请检查"），不自动重试。
2. **空输出/超长检测**：`text.trim() === ""` 视为 `INTERNAL`（不同模型偶发）；输出长度超过原文 20 倍视为模型失控，标记警告。

不做的校验：语言识别、术语一致性检查。前者误判率高，后者需要额外的 LLM 调用。

## 7. 多模态（M2 之后）

图片翻译需要"看图出文字"，与文本翻译是两条路径：

- 契约上预留而不是现在实现：`TranslateRequest` 增加可选 `image?: { mimeType: string; dataBase64: string }`，`capabilities` 增加 `vision: true`。`apiVersion` 到那时 `+1`。
- 只有 `gemini`、OpenAI 多模态模型、部分 Qwen-VL 支持；`anthropic` 原生也支持。`openai` 适配器需要按模型判断是否允许图片输入。
- OCR 是另一条路（`kind: "ocr"` 插件 + 独立 pipeline），与 `ai` 插件的 vision 能力并存，不要混进同一个服务。选型留到 M3 再定，现在不设计。

## 8. 评测

AI 翻译没法用肉眼保证不回归。最小可用的做法：

- `src/main/plugins/ai/__fixtures__/` 放 20 组代表性输入：短句、含 `{{var}}` 的 UI 文案、Markdown 列表、代码块、长段落、中英日互译。
- 集成测试用**假适配器**（本地 HTTP server 回放固定 SSE 帧）验证解析器，不打真实 API。
- prompt 改动必须人工跑一遍 fixture 的英文/中文各一组，比对 diff，不追求"更好"，只防止结构破坏（缩进、列表、占位符）。
- 不引入 BLEU/COMET 之类指标：它们与人感觉的相关性在 UI 文案这种短句上很低，维护成本高。

## 9. 已知取舍

- **不做流式改写的"回退重译"**：如果首字之后发现模型跑偏，用户只能取消重来。
- **不做多模型投票/对比**：一次翻译一个模型，成本与延迟优先。
- **不做自动降级到内置免费服务**：应用不内置任何密钥，无密钥时引导用户配置，不偷偷换成别家。
- **token 用量暂不上报**：插件契约当前是 `AsyncIterable<string>`，拿不到 usage。需要成本统计时扩契约为 `TranslateDelta` 并 `apiVersion + 1`。
