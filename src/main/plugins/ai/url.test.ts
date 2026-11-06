import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildChatCompletionUrl, normalizeBaseUrl } from "../../core/url";
import { buildModelsUrl } from "./url";

const SCHEME_ERROR_RE = /开头/;
const CREDENTIALS_ERROR_RE = /用户名或密码/;
const FRAGMENT_ERROR_RE = /片段/;

describe("normalizeBaseUrl", () => {
  test("去尾斜杠", () => {
    assert.equal(
      normalizeBaseUrl("https://api.openai.com/v1/"),
      "https://api.openai.com/v1"
    );
  });

  test("剥离已粘贴的 /chat/completions", () => {
    assert.equal(
      normalizeBaseUrl("https://api.openai.com/v1/chat/completions"),
      "https://api.openai.com/v1"
    );
  });

  test("剥离并去尾斜杠组合", () => {
    assert.equal(
      normalizeBaseUrl("https://api.openai.com/v1/chat/completions/"),
      "https://api.openai.com/v1"
    );
  });

  test("拒绝非 http/https", () => {
    assert.throws(() => normalizeBaseUrl("ftp://example.com"), SCHEME_ERROR_RE);
    assert.throws(
      () => normalizeBaseUrl("file:///etc/passwd"),
      SCHEME_ERROR_RE
    );
  });

  test("拒绝凭据", () => {
    assert.throws(
      () => normalizeBaseUrl("https://user:pass@api.openai.com/v1"),
      CREDENTIALS_ERROR_RE
    );
  });

  test("拒绝片段", () => {
    assert.throws(
      () => normalizeBaseUrl("https://api.openai.com/v1#frag"),
      FRAGMENT_ERROR_RE
    );
  });

  test("保留端口与查询参数", () => {
    assert.equal(
      normalizeBaseUrl("http://127.0.0.1:11434/v1/?x=1"),
      "http://127.0.0.1:11434/v1?x=1"
    );
  });
});

describe("buildChatCompletionUrl", () => {
  test("拼接 /chat/completions", () => {
    assert.equal(
      buildChatCompletionUrl("https://api.deepseek.com/v1"),
      "https://api.deepseek.com/v1/chat/completions"
    );
  });
});

describe("buildModelsUrl", () => {
  test("baseURL 无路径时不产生 //models", () => {
    assert.equal(
      buildModelsUrl("http://localhost:3425"),
      "http://localhost:3425/models"
    );
    assert.equal(
      buildModelsUrl("http://localhost:3425/"),
      "http://localhost:3425/models"
    );
  });

  test("保留 /v1 前缀与查询参数", () => {
    assert.equal(
      buildModelsUrl("https://api.openai.com/v1/?api-version=2025-01-01"),
      "https://api.openai.com/v1/models?api-version=2025-01-01"
    );
  });
});
