import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  CallOptions,
  PluginRuntime,
  TranslateRequest,
} from "../../../shared/plugin";
import { buildMessages } from "./prompt";
import { translate } from "./translate";

const ENCODER = new TextEncoder();

function sseResponse(parts: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(ENCODER.encode(part));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

type Call = { url: string; init: RequestInit };

function makeRuntime(respond: (call: Call) => Response | Promise<Response>): {
  runtime: PluginRuntime;
  calls: Call[];
} {
  const calls: Call[] = [];
  const runtime: PluginRuntime = {
    fetch: async (url, init) => {
      const call = { init: init ?? {}, url };
      calls.push(call);
      return await respond(call);
    },
    log: {
      debug: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    },
    secrets: { get: () => "sk-test", has: () => true },
  };
  return { calls, runtime };
}

async function collect(
  gen: AsyncGenerator<string>
): Promise<{ values: string[]; error?: Error & { code?: string } }> {
  const values: string[] = [];
  try {
    for await (const value of gen) {
      values.push(value);
    }
  } catch (error) {
    return { error: error as Error & { code?: string }, values };
  }
  return { values };
}

const OPENAI_CONFIG = {
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  protocol: "openai",
};

function req(config: Record<string, unknown> = {}): TranslateRequest {
  return {
    config: { ...OPENAI_CONFIG, ...config },
    glossary: [{ from: "hello", to: "你好" }],
    source: "en",
    target: "zh",
    text: "hello",
    tone: "formal",
  };
}

function opts(): CallOptions {
  return { requestId: "t1", signal: new AbortController().signal };
}

const OPENAI_SSE = [
  'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\n\n',
  "data: [DONE]\n\n",
];

const ANTHROPIC_SSE = [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":0}}}\n\n',
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你好"}}\n\n',
  'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
  'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":2}}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
];

const GEMINI_SSE = [
  'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"你好"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":2}}\n\n',
];

describe("translate · openai 协议", () => {
  test("SSE 逐 delta 输出，请求体带 messages/model/stream/默认温度", async () => {
    const { calls, runtime } = makeRuntime(() => sseResponse(OPENAI_SSE));
    const { values, error } = await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req(),
        runtime,
      })
    );
    assert.equal(error, undefined);
    assert.deepEqual(values, ["你", "好"]);
    const [call] = calls;
    assert.ok(call);
    assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(call.init.body));
    assert.deepEqual(body.messages, buildMessages(req()));
    assert.equal(body.model, "gpt-4.1-mini");
    assert.equal(body.stream, true);
    assert.equal(body.temperature, 0.3);
  });

  test("extra 原样并入请求体，核心字段优先", async () => {
    const { calls, runtime } = makeRuntime(() => sseResponse(OPENAI_SSE));
    await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req({ extra: { reasoning_effort: "low", temperature: 1.9 } }),
        runtime,
      })
    );
    const body = JSON.parse(String(calls[0]?.init.body));
    assert.equal(body.reasoning_effort, "low");
    // 温度是核心字段，extra 里的同名字段不覆盖
    assert.equal(body.temperature, 0.3);
  });

  test("自定义请求头与认证头同时下发", async () => {
    const { calls, runtime } = makeRuntime(() => sseResponse(OPENAI_SSE));
    await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req({ headers: { authorization: "Bearer x", "x-trace": "1" } }),
        runtime,
      })
    );
    const headers = calls[0]?.init.headers as Record<string, string>;
    assert.equal(headers["x-trace"], "1");
    assert.equal(headers.authorization, "Bearer sk-test");
  });

  test("用户粘贴完整端点地址时不重复拼接路径", async () => {
    const { calls, runtime } = makeRuntime(() => sseResponse(OPENAI_SSE));
    await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req({ baseURL: "https://api.openai.com/v1/chat/completions" }),
        runtime,
      })
    );
    assert.equal(calls[0]?.url, "https://api.openai.com/v1/chat/completions");
  });
});

describe("translate · 上游失败", () => {
  test("401 映射 AUTH_FAILED 且不泄漏上游原文", async () => {
    const { runtime } = makeRuntime(() =>
      jsonResponse(
        { error: { code: "invalid_api_key", message: "sk-abc leaked" } },
        401
      )
    );
    const { error, values } = await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req(),
        runtime,
      })
    );
    assert.deepEqual(values, []);
    assert.equal(error?.code, "AUTH_FAILED");
    assert.equal(error?.message.includes("sk-abc"), false);
  });

  test("429 映射 RATE_LIMITED", async () => {
    const { runtime } = makeRuntime(() =>
      jsonResponse({ error: { code: "insufficient_quota" } }, 429)
    );
    const { error } = await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req(),
        runtime,
      })
    );
    assert.equal(error?.code, "RATE_LIMITED");
  });

  test("404 映射 INVALID_CONFIG", async () => {
    const { runtime } = makeRuntime(() =>
      jsonResponse({ error: { code: "model_not_found" } }, 404)
    );
    const { error } = await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req(),
        runtime,
      })
    );
    assert.equal(error?.code, "INVALID_CONFIG");
  });

  test("流提前结束不当成成功", async () => {
    const { runtime } = makeRuntime(() =>
      sseResponse(['data: {"choices":[{"delta":{"content":"你"}}]}\n\n'])
    );
    const { error, values } = await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req(),
        runtime,
      })
    );
    assert.deepEqual(values, ["你"]);
    assert.equal(error?.code, "NETWORK");
  });

  test("宿主受控 fetch 的 PERMISSION_DENIED 原样透传", async () => {
    const { runtime } = makeRuntime(() => sseResponse(OPENAI_SSE));
    runtime.fetch = () =>
      Promise.reject(
        Object.assign(new Error("未允许访问"), { code: "PERMISSION_DENIED" })
      );
    const { error } = await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "openai",
        req: req(),
        runtime,
      })
    );
    assert.equal(error?.code, "PERMISSION_DENIED");
  });
});

describe("translate · 原生协议", () => {
  test("anthropic 走 /messages 且不发 extra", async () => {
    const { calls, runtime } = makeRuntime(() => sseResponse(ANTHROPIC_SSE));
    const { values } = await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "anthropic",
        req: req({
          baseURL: "https://api.anthropic.com/v1",
          extra: { reasoning_effort: "low" },
          model: "claude-sonnet-4-5",
          protocol: "anthropic",
        }),
        runtime,
      })
    );
    assert.deepEqual(values, ["你好"]);
    assert.equal(calls[0]?.url, "https://api.anthropic.com/v1/messages");
    const headers = calls[0]?.init.headers as Record<string, string>;
    assert.equal(headers["x-api-key"], "sk-test");
    assert.equal(headers.authorization, undefined);
    const body = JSON.parse(String(calls[0]?.init.body));
    assert.equal(body.reasoning_effort, undefined);
  });

  test("gemini 走 streamGenerateContent 且不发 extra", async () => {
    const { calls, runtime } = makeRuntime(() => sseResponse(GEMINI_SSE));
    const { values } = await collect(
      translate({
        apiKey: "sk-test",
        opts: opts(),
        protocol: "gemini",
        req: req({
          baseURL: "https://generativelanguage.googleapis.com/v1beta",
          extra: { reasoning_effort: "low" },
          model: "gemini-2.5-flash",
          protocol: "gemini",
        }),
        runtime,
      })
    );
    assert.deepEqual(values, ["你好"]);
    assert.ok(
      calls[0]?.url.startsWith(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"
      )
    );
    const body = JSON.parse(String(calls[0]?.init.body));
    assert.equal(JSON.stringify(body).includes("reasoning_effort"), false);
  });
});
