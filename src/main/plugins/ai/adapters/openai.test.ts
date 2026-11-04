import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  CallOptions,
  PluginRuntime,
  TranslateRequest,
} from "../../../../shared/plugin";
import { buildMessages } from "../prompt";
import { buildChatCompletionUrl } from "../url";
import { openAiListModels, openAiTranslate, parseOpenAiSse } from "./openai";

const ENCODER = new TextEncoder();

function sseResponse(parts: Array<string | Uint8Array>): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(
          typeof part === "string" ? ENCODER.encode(part) : part
        );
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

async function collect(
  gen: AsyncGenerator<string>
): Promise<{ values: string[]; error?: Error }> {
  const values: string[] = [];
  try {
    for await (const value of gen) {
      values.push(value);
    }
  } catch (error) {
    return { error: error as Error, values };
  }
  return { values };
}

const REQ: TranslateRequest = {
  config: { baseURL: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  glossary: [{ from: "hello", to: "你好" }],
  source: "en",
  target: "zh",
  text: "hello",
  tone: "formal",
};

function opts(): { opts: CallOptions; controller: AbortController } {
  const controller = new AbortController();
  return { controller, opts: { requestId: "t1", signal: controller.signal } };
}

function makeRuntime(fetchImpl: PluginRuntime["fetch"]): PluginRuntime {
  return {
    fetch: fetchImpl,
    log: {
      debug: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    },
    secrets: { get: () => "sk-test", has: () => true },
  };
}

describe("parseOpenAiSse", () => {
  test("跳过 role 帧，只取 content delta", async () => {
    const body = sseResponse([
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    const { values, error } = await collect(
      parseOpenAiSse(body.body, opts().opts.signal)
    );
    assert.equal(error, undefined);
    assert.deepEqual(values, ["你"]);
  });

  test("UTF-8 字符跨 chunk 截断仍拼接正确", async () => {
    const frame = 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n';
    const bytes = ENCODER.encode(frame);
    const splitAt = bytes.length - 1;
    const body = sseResponse([bytes.slice(0, splitAt), bytes.slice(splitAt)]);
    const { values } = await collect(
      parseOpenAiSse(body.body, opts().opts.signal)
    );
    assert.deepEqual(values, ["你好"]);
  });

  test("CRLF 与多行 data", async () => {
    const body = sseResponse([
      'data: {"choices":[{"delta":{"content":"A"}},\n',
      'data:   {"delta":{"content":"B"}}]}\r\n\r\n',
    ]);
    const { values } = await collect(
      parseOpenAiSse(body.body, opts().opts.signal)
    );
    // 多行 data 按 \n 拼接后仍是完整 JSON，只取 choices[0] 的 delta
    assert.deepEqual(values, ["A"]);
  });

  test("finish_reason 停止后续帧", async () => {
    const body = sseResponse([
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"B"},"finish_reason":"stop"}]}\n\n',
      'data: {"choices":[{"delta":{"content":"C"}}]}\n\n',
    ]);
    const { values } = await collect(
      parseOpenAiSse(body.body, opts().opts.signal)
    );
    assert.deepEqual(values, ["A", "B"]);
  });

  test("malformed 帧明确失败", async () => {
    const body = sseResponse([
      "data: not-json\n\n",
      'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
    ]);
    const { values, error } = await collect(
      parseOpenAiSse(body.body, opts().opts.signal)
    );
    assert.deepEqual(values, []);
    assert.ok(error);
  });

  test("error 帧映射 RATE_LIMITED 且不泄漏原文", async () => {
    const body = sseResponse([
      'data: {"error":{"code":"insufficient_quota","message":"quota x"}}\n\n',
    ]);
    const { error } = await collect(
      parseOpenAiSse(body.body, opts().opts.signal)
    );
    assert.ok(error);
    assert.equal(error.message.includes("insufficient_quota"), false);
    assert.equal((error as Error & { code?: string }).code, "RATE_LIMITED");
  });

  test("取消后中止", async () => {
    const { controller, opts: callOpts } = opts();
    const body = sseResponse([
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
    ]);
    const gen = parseOpenAiSse(body.body, callOpts.signal);
    const first = await gen.next();
    assert.equal(first.value, "A");
    controller.abort();
    await assert.rejects(gen.next(), { code: "ABORTED" });
  });
});

describe("openAiTranslate", () => {
  test("非流式 JSON 降级为单次 yield", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const runtime = makeRuntime(async (url, init) => {
      calls.push({ init: init ?? {}, url });
      return await jsonResponse({
        choices: [{ message: { content: "你好" } }],
      });
    });
    const { values } = await collect(
      openAiTranslate({
        apiKey: "sk-test",
        opts: opts().opts,
        req: REQ,
        runtime,
      })
    );
    assert.deepEqual(values, ["你好"]);
    assert.equal(
      calls[0]?.url,
      buildChatCompletionUrl("https://api.openai.com/v1")
    );
    assert.equal(
      (calls[0]?.init.headers as Record<string, string> | undefined)
        ?.authorization,
      "Bearer sk-test"
    );
    assert.ok(calls[0]?.init.signal);
    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
      messages: buildMessages(REQ),
      model: "gpt-4.1-mini",
      stream: true,
      temperature: 0.3,
    });
    const messages = buildMessages(REQ);
    assert.ok(messages[0]?.content.includes("Markdown"));
    assert.ok(messages[0]?.content.includes("{{...}}"));
    assert.ok(messages[1]?.content.includes("源语言（BCP-47）：en"));
    assert.ok(messages[1]?.content.includes("hello => 你好"));
    assert.ok(messages[1]?.content.includes("语体：正式书面"));
    assert.ok(messages[1]?.content.includes("<<<\nhello\n>>>"));
  });

  test("temperature 取自配置，extra 合并且核心字段优先", async () => {
    const calls: { init: RequestInit }[] = [];
    const runtime = makeRuntime(async (_url, init) => {
      calls.push({ init: init ?? {} });
      return await jsonResponse({
        choices: [{ message: { content: "你好" } }],
      });
    });
    const req: TranslateRequest = {
      ...REQ,
      config: {
        ...REQ.config,
        extra: {
          messages: [{ content: "x", role: "system" }],
          model: "evil-model",
          stream: false,
          temperature: 0.9,
          top_p: 0.5,
        },
        temperature: 0.7,
      },
    };
    const { values } = await collect(
      openAiTranslate({
        apiKey: "sk-test",
        opts: opts().opts,
        req,
        runtime,
      })
    );
    assert.deepEqual(values, ["你好"]);
    const body = JSON.parse(String(calls[0]?.init.body));
    assert.equal(body.temperature, 0.7);
    assert.equal(body.model, "gpt-4.1-mini");
    assert.equal(body.stream, true);
    assert.deepEqual(body.messages, buildMessages(REQ));
    assert.equal(body.top_p, 0.5);
  });

  test("temperature 非有限数字回落 0.3", async () => {
    const calls: { init: RequestInit }[] = [];
    const runtime = makeRuntime(async (_url, init) => {
      calls.push({ init: init ?? {} });
      return await jsonResponse({ choices: [{ message: { content: "好" } }] });
    });
    await collect(
      openAiTranslate({
        apiKey: "sk-test",
        opts: opts().opts,
        req: { ...REQ, config: { ...REQ.config, temperature: "hot" } },
        runtime,
      })
    );
    assert.equal(JSON.parse(String(calls[0]?.init.body)).temperature, 0.3);
  });

  test("自定义请求头随 POST 发出，保留头被过滤", async () => {
    const calls: { init: RequestInit }[] = [];
    const runtime = makeRuntime(async (_url, init) => {
      calls.push({ init: init ?? {} });
      return await jsonResponse({ choices: [{ message: { content: "好" } }] });
    });
    const req: TranslateRequest = {
      ...REQ,
      config: {
        ...REQ.config,
        headers: {
          authorization: "Bearer evil",
          "Content-Type": "text/plain",
          "X-Custom": "v1",
          "X-Pad": "",
        },
      },
    };
    await collect(
      openAiTranslate({
        apiKey: "sk-test",
        opts: opts().opts,
        req,
        runtime,
      })
    );
    const headers = calls[0]?.init.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer sk-test");
    assert.equal(headers["content-type"], "application/json");
    assert.equal(headers["X-Custom"], "v1");
    assert.equal("Authorization" in headers, false);
    assert.equal("Content-Type" in headers, false);
  });

  test("401 映射 AUTH_FAILED 且不泄漏 body 原文", async () => {
    const runtime = makeRuntime(async () =>
      jsonResponse(
        { error: { code: "invalid_api_key", message: "sk-secret-key" } },
        401
      )
    );
    const { error } = await collect(
      openAiTranslate({
        apiKey: "sk-test",
        opts: opts().opts,
        req: REQ,
        runtime,
      })
    );
    assert.ok(error);
    assert.equal((error as Error & { code?: string }).code, "AUTH_FAILED");
    assert.equal(error.message.includes("sk-secret-key"), false);
  });

  test("429 映射 RATE_LIMITED", async () => {
    const runtime = makeRuntime(async () => jsonResponse({}, 429));
    const { error } = await collect(
      openAiTranslate({
        apiKey: "sk-test",
        opts: opts().opts,
        req: REQ,
        runtime,
      })
    );
    assert.ok(error);
    assert.equal((error as Error & { code?: string }).code, "RATE_LIMITED");
  });

  test("网络异常抛 TypeError（由宿主归一化为 NETWORK）", async () => {
    const runtime = makeRuntime(() =>
      Promise.reject(new TypeError("fetch failed"))
    );
    const { error } = await collect(
      openAiTranslate({
        apiKey: "sk-test",
        opts: opts().opts,
        req: REQ,
        runtime,
      })
    );
    assert.ok(error);
    assert.ok(error instanceof TypeError);
  });
});

describe("openAiListModels", () => {
  const CONFIG = { baseURL: "https://api.openai.com/v1/" };

  test("GET /models 携带 Bearer，映射 data 列表并归一 URL", async () => {
    const calls: { init: RequestInit; url: string }[] = [];
    const runtime = makeRuntime((url, init) => {
      calls.push({ init: init ?? {}, url });
      return Promise.resolve(
        jsonResponse({
          data: [
            { id: "gpt-4.1-mini" },
            { id: "gpt-4o", label: "GPT-4o" },
            { id: "" },
          ],
        })
      );
    });
    const models = await openAiListModels({
      apiKey: "sk-test",
      config: CONFIG,
      runtime,
    });
    assert.deepEqual(models, [
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { id: "gpt-4o", label: "GPT-4o" },
    ]);
    assert.equal(calls[0]?.url, "https://api.openai.com/v1/models");
    assert.equal(
      (calls[0]?.init.headers as Record<string, string> | undefined)
        ?.authorization,
      "Bearer sk-test"
    );
    assert.equal(calls[0]?.init.method, "GET");
  });

  test("超 200 条截断且跳过坏条目", async () => {
    const data = Array.from({ length: 250 }, (_, index) => ({
      id: `model-${index}`,
    }));
    (data as unknown[]).push(null, { id: 42 });
    const runtime = makeRuntime(() => Promise.resolve(jsonResponse({ data })));
    const models = await openAiListModels({
      apiKey: "sk-test",
      config: CONFIG,
      runtime,
    });
    assert.equal(models.length, 200);
    assert.equal(models[0]?.id, "model-0");
  });

  test("GET /models 携带自定义头且过滤保留头", async () => {
    const calls: { init: RequestInit; url: string }[] = [];
    const runtime = makeRuntime((url, init) => {
      calls.push({ init: init ?? {}, url });
      return Promise.resolve(jsonResponse({ data: [{ id: "gpt-4.1-mini" }] }));
    });
    await openAiListModels({
      apiKey: "sk-test",
      config: {
        ...CONFIG,
        headers: {
          cookie: "session=1",
          "X-API-Key": "nope",
          "X-Vendor": "acme",
        },
      },
      runtime,
    });
    const headers = calls[0]?.init.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer sk-test");
    assert.equal(headers["X-Vendor"], "acme");
    assert.equal("cookie" in headers, false);
    assert.equal("X-API-Key" in headers, false);
  });

  test("带 query 的 baseURL 拼接 /models 保留查询参数", async () => {
    const calls: { init: RequestInit; url: string }[] = [];
    const runtime = makeRuntime((url, init) => {
      calls.push({ init: init ?? {}, url });
      return Promise.resolve(jsonResponse({ data: [{ id: "gpt-4.1-mini" }] }));
    });
    await openAiListModels({
      apiKey: "sk-test",
      config: { baseURL: "https://api.openai.com/v1/?api-version=2025-01-01" },
      runtime,
    });
    assert.equal(
      calls[0]?.url,
      "https://api.openai.com/v1/models?api-version=2025-01-01"
    );
  });

  test("401 映射 AUTH_FAILED 且不泄漏 body 原文", async () => {
    const runtime = makeRuntime(() =>
      Promise.resolve(
        jsonResponse(
          { error: { code: "invalid_api_key", message: "sk-secret-key" } },
          401
        )
      )
    );
    await assert.rejects(
      openAiListModels({ apiKey: "sk-test", config: CONFIG, runtime }),
      { code: "AUTH_FAILED" }
    );
  });

  test("429 映射 RATE_LIMITED", async () => {
    const runtime = makeRuntime(() => Promise.resolve(jsonResponse({}, 429)));
    await assert.rejects(
      openAiListModels({ apiKey: "sk-test", config: CONFIG, runtime }),
      { code: "RATE_LIMITED" }
    );
  });

  test("缺少 data 数组视为 INVALID_CONFIG", async () => {
    const runtime = makeRuntime(() => Promise.resolve(jsonResponse({})));
    await assert.rejects(
      openAiListModels({ apiKey: "sk-test", config: CONFIG, runtime }),
      { code: "INVALID_CONFIG" }
    );
  });

  test("不可解析响应映射 INTERNAL", async () => {
    const runtime = makeRuntime(() =>
      Promise.resolve(new Response("not-json", { status: 200 }))
    );
    await assert.rejects(
      openAiListModels({ apiKey: "sk-test", config: CONFIG, runtime }),
      { code: "INTERNAL" }
    );
  });
});

test("EOF 提交无末尾空行的最后帧", async () => {
  await Promise.all(
    ["", "\n", "\r\n"].map(async (suffix) => {
      const response = sseResponse([
        'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}' +
          suffix,
      ]);
      const result = await collect(
        parseOpenAiSse(response.body, opts().opts.signal)
      );
      assert.deepEqual(result.values, ["好"]);
      assert.equal(result.error, undefined);
    })
  );
});

test("流缺少结束标记和尾部 UTF-8 截断不得假成功", async () => {
  const response = sseResponse([
    'data: {"choices":[{"delta":{"content":"半句"}}]}\n\n',
  ]);
  const result = await collect(
    parseOpenAiSse(response.body, opts().opts.signal)
  );
  assert.deepEqual(result.values, ["半句"]);
  assert.ok(result.error);
  const bytes = ENCODER.encode('data: {"choices":[{"delta":{"content":"好');
  const truncated = sseResponse([bytes.slice(0, -1)]);
  assert.ok(
    (await collect(parseOpenAiSse(truncated.body, opts().opts.signal))).error
  );
});

test("HTTP 200 JSON error 复用机器错误映射", async () => {
  await Promise.all(
    [
      ["insufficient_quota", "RATE_LIMITED"],
      ["invalid_api_key", "AUTH_FAILED"],
      ["model_not_found", "INVALID_CONFIG"],
    ].map(async ([code, expected]) => {
      const result = await collect(
        openAiTranslate({
          apiKey: "fake",
          opts: opts().opts,
          req: REQ,
          runtime: makeRuntime(async () =>
            jsonResponse({ error: { code, message: "sk-do-not-leak" } })
          ),
        })
      );
      assert.equal((result.error as Error & { code: string }).code, expected);
      assert.ok(!result.error?.message.includes("sk-do-not-leak"));
    })
  );
});

test("合法多行 data 的 CRLF 跨 chunk 不提前提交", async () => {
  const response = sseResponse([
    'data: {"choices":[\r',
    '\ndata: {"delta":{"content":"好"},"finish_reason":"stop"}]}\r\n\r\n',
  ]);
  const result = await collect(
    parseOpenAiSse(response.body, opts().opts.signal)
  );
  assert.deepEqual(result.values, ["好"]);
  assert.equal(result.error, undefined);
});

test("EOF 残余 CR 作为行尾处理", async () => {
  const response = sseResponse([
    'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\r',
  ]);
  const result = await collect(
    parseOpenAiSse(response.body, opts().opts.signal)
  );
  assert.deepEqual(result.values, ["好"]);
  assert.equal(result.error, undefined);
});

test("带 query 的 baseURL 发出完整正确请求 URL", async () => {
  let requestedUrl = "";
  const result = await collect(
    openAiTranslate({
      apiKey: "fake",
      opts: opts().opts,
      req: {
        ...REQ,
        config: {
          ...REQ.config,
          baseURL: "https://example.invalid/v1?api-version=2025-01-01",
        },
      },
      runtime: makeRuntime((url) => {
        requestedUrl = url;
        return Promise.resolve(
          jsonResponse({ choices: [{ message: { content: "好" } }] })
        );
      }),
    })
  );
  assert.equal(result.error, undefined);
  assert.deepEqual(result.values, ["好"]);
  assert.equal(
    requestedUrl,
    "https://example.invalid/v1/chat/completions?api-version=2025-01-01"
  );
});
