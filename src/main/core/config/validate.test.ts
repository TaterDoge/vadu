import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { ConfigSchema } from "../../../shared/ipc";
import { validateConfigAgainstSchema } from "./validate";

const SCHEMA: ConfigSchema = {
  properties: {
    apiKey: { required: true, title: "API Key", type: "secret" },
    baseURL: {
      default: "https://api.openai.com/v1",
      placeholder: "https://api.example.com/v1",
      required: true,
      title: "接口地址",
      type: "string",
    },
    enabled: { title: "启用", type: "boolean" },
    extra: { title: "附加参数", type: "json" },
    model: { required: true, title: "模型", type: "string" },
    protocol: {
      enum: ["openai", "anthropic"],
      enumLabels: ["OpenAI 兼容", "Anthropic"],
      title: "协议",
      type: "string",
    },
    temperature: {
      maximum: 2,
      minimum: 0,
      title: "temperature",
      type: "number",
    },
  },
  required: ["baseURL", "model", "apiKey"],
  type: "object",
};

const REQUIRED_MODEL_MESSAGE_RE = /模型/;

describe("validateConfigAgainstSchema", () => {
  test("清洗未知字段、去 secret、应用默认与 trim", () => {
    const out = validateConfigAgainstSchema(
      {
        apiKey: "must-not-store",
        baseURL: "  https://api.openai.com/v1  ",
        hack: "dropped",
        model: " gpt-4.1-mini ",
      },
      SCHEMA
    );
    assert.deepEqual(out, {
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
    });
  });

  test("enum 越界拒绝", () => {
    assert.throws(
      () =>
        validateConfigAgainstSchema(
          { baseURL: "x", model: "m", protocol: "gemini" },
          SCHEMA
        ),
      { code: "INVALID_CONFIG" }
    );
  });

  test("number 越界与非数字拒绝", () => {
    assert.throws(
      () =>
        validateConfigAgainstSchema(
          { baseURL: "x", model: "m", temperature: 3 },
          SCHEMA
        ),
      { code: "INVALID_CONFIG" }
    );
    assert.throws(
      () =>
        validateConfigAgainstSchema(
          { baseURL: "x", model: "m", temperature: "hot" },
          SCHEMA
        ),
      { code: "INVALID_CONFIG" }
    );
  });

  test("boolean 拒绝非布尔", () => {
    assert.throws(
      () =>
        validateConfigAgainstSchema(
          { baseURL: "x", enabled: "yes", model: "m" },
          SCHEMA
        ),
      { code: "INVALID_CONFIG" }
    );
  });

  test("json 只接受对象", () => {
    assert.throws(
      () =>
        validateConfigAgainstSchema(
          { baseURL: "x", extra: ["a"], model: "m" },
          SCHEMA
        ),
      { code: "INVALID_CONFIG" }
    );
    const out = validateConfigAgainstSchema(
      { baseURL: "x", extra: { top_p: 0.9 }, model: "m" },
      SCHEMA
    );
    assert.deepEqual(out.extra, { top_p: 0.9 });
  });

  test("必填缺失报字段级错误，secret 必填不在此判定", () => {
    // baseURL 有默认值所以不报；model 无默认且缺失才报
    assert.throws(
      () => validateConfigAgainstSchema({ protocol: "openai" }, SCHEMA),
      { code: "INVALID_CONFIG", message: REQUIRED_MODEL_MESSAGE_RE }
    );
    // 只缺 apiKey（secret）不阻止保存
    const out = validateConfigAgainstSchema(
      { baseURL: "x", model: "m" },
      SCHEMA
    );
    assert.equal(out.apiKey, undefined);
  });

  test("字符串超长拒绝", () => {
    assert.throws(
      () =>
        validateConfigAgainstSchema(
          { baseURL: "x", model: "m".repeat(2001) },
          SCHEMA
        ),
      { code: "INVALID_CONFIG" }
    );
  });

  test("无 schema 时返回空配置", () => {
    assert.deepEqual(validateConfigAgainstSchema({ a: 1 }, undefined), {});
  });
});
