import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { customRequestHeaders } from "./headers";

describe("customRequestHeaders", () => {
  test("合法自定义头直通", () => {
    assert.deepEqual(
      customRequestHeaders({
        "X-Custom-Header": "value-1",
        "x-method": "GET",
      }),
      { "X-Custom-Header": "value-1", "x-method": "GET" }
    );
  });

  test("保留名拒绝（含大小写与 x- 前缀形态）", () => {
    const headers = customRequestHeaders({
      Authorization: "Bearer x",
      "accept-encoding": "gzip",
      "api-key": "k",
      authorization: "Bearer x",
      "Content-Length": "100",
      connection: "keep-alive",
      content_length: "100",
      content_type: "text/plain",
      "content-type": "text/plain",
      cookie: "session=1",
      host: "example.com",
      origin: "https://example.com",
      referer: "https://example.com/",
      "set-cookie": "a=b",
      "transfer-encoding": "chunked",
      user_agent: "curl",
      "user-agent": "curl",
      x_api_key: "k",
      "x-api-key": "k",
    });
    assert.deepEqual(headers, {});
  });

  test("敏感名拒绝（含大小写，不要求前缀匹配）", () => {
    const headers = customRequestHeaders({
      apikey: "k",
      "session-cookie": "c",
      token: "t",
      "X-Api-Key": "k",
      "X-Auth-Token": "t",
      "x-secret": "s",
    });
    assert.deepEqual(headers, {});
  });

  test("非法名称拒绝（空格名、控制字符）", () => {
    const headers = customRequestHeaders({
      "": "v",
      "Bad Header": "v",
      "Bad\u0000Header": "v",
      [`X-${"a".repeat(200)}`]: "v",
    });
    assert.deepEqual(headers, {});
  });

  test("边界：头名 128 通过、129 拒绝，值 500 通过、501 拒绝", () => {
    const okName = `X-${"a".repeat(126)}`;
    const longName = `X-${"a".repeat(127)}`;
    const headers = customRequestHeaders({
      [longName]: "v",
      [okName]: "v".repeat(500),
      "X-Over": "v".repeat(501),
    });
    assert.deepEqual(headers, { [okName]: "v".repeat(500) });
  });

  test("非法值拒绝（CRLF 注入、空值、超长值）", () => {
    const headers = customRequestHeaders({
      "X-Control": "a\u0001b",
      "X-Crlf": "a\r\nInjected: yes",
      "X-Empty": "",
      "X-Long": "x".repeat(501),
    });
    assert.deepEqual(headers, {});
  });

  test("非字符串值忽略", () => {
    const headers = customRequestHeaders({
      "X-Arr": ["a"],
      "X-Bool": true,
      "X-Null": null,
      "X-Num": 42,
      "X-Str": "ok",
    });
    assert.deepEqual(headers, { "X-Str": "ok" });
  });

  test("最多保留 10 个，超出丢弃", () => {
    const input: Record<string, string> = {};
    for (let i = 0; i < 12; i += 1) {
      input[`X-Header-${i}`] = `v${i}`;
    }
    const headers = customRequestHeaders(input);
    assert.equal(Object.keys(headers).length, 10);
    assert.equal(headers["X-Header-0"], "v0");
    assert.equal(headers["X-Header-9"], "v9");
    assert.equal("X-Header-10" in headers, false);
  });

  test("非对象输入返回空对象", () => {
    assert.deepEqual(customRequestHeaders(null), {});
    assert.deepEqual(customRequestHeaders(["a"]), {});
    assert.deepEqual(customRequestHeaders("x"), {});
    assert.deepEqual(customRequestHeaders(42), {});
    assert.deepEqual(customRequestHeaders(undefined), {});
  });
});
