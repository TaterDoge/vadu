import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError, toSerializedError } from "../../../shared/errors";
import { IPC, type TranslateEvent } from "../../../shared/ipc";
import type { TranslateRequest } from "../../../shared/plugin";
import { createPlugin } from "../../plugins/ai";
import { validateManifest } from "../plugin/manifest";
import { TaskRegistry } from "./tasks";

test("真实内置 manifest 经 service 注入 glossary 并进入插件请求", async () => {
  const validated = validateManifest(
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../../plugins/ai/manifest.json"),
        "utf8"
      )
    )
  );
  assert.ok(validated.ok);
  assert.equal(validated.manifest.capabilities.glossary, true);
  const glossary = [{ from: "hello", to: "指定译词" }];
  let requestBody: Record<string, unknown> | undefined;
  const plugin = createPlugin({
    fetch: (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return Promise.resolve(
        Response.json({ choices: [{ message: { content: "指定译词" } }] })
      );
    },
    log: {
      debug: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    },
    secrets: { get: () => "fake", has: () => true },
  });
  const profile = {
    config: { baseURL: "https://example.invalid/v1", model: "fake" },
    enabled: true,
    id: "p",
    pluginId: validated.manifest.id,
  };
  const taskRegistry = new TaskRegistry();
  const imports: Record<string, unknown> = {
    "../../../shared/errors": { toSerializedError },
    "../../../shared/ipc": { IPC },
    "../config/store": {
      readProfiles: () => [profile],
      readSettings: () => ({ glossary }),
    },
    "../plugin/host": {
      hostTranslate: ({
        req,
        opts,
      }: {
        req: TranslateRequest;
        opts: { requestId: string; signal: AbortSignal };
      }) => {
        assert.deepEqual(req.glossary, glossary);
        return plugin.translate(req, opts);
      },
    },
    "../plugin/registry": {
      registry: {
        get: () => ({
          descriptor: { capabilities: validated.manifest.capabilities },
        }),
        isReady: () => true,
      },
    },
    "./tasks": { taskRegistry },
  };
  const exports: Record<string, unknown> = {};
  const { outputText } = ts.transpileModule(
    readFileSync(join(import.meta.dirname, "service.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  );
  runInNewContext(outputText, {
    console,
    Date,
    exports,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error("Unexpected import");
      }
      return imports[name];
    },
  });
  await new Promise<void>((resolve, reject) => {
    const sender = Object.assign(new EventEmitter(), {
      id: 1,
      send: (_channel: string, event: TranslateEvent) => {
        if (event.type === "error") {
          reject(new Error(event.error.message));
        }
        if (event.type === "done") {
          resolve();
        }
      },
    });
    (exports.startTranslate as (params: unknown, sender: unknown) => void)(
      {
        pluginId: profile.pluginId,
        profileId: profile.id,
        requestId: "manifest-glossary",
        source: "en",
        target: "zh",
        text: "hello",
      },
      sender
    );
  });
  const messages = requestBody?.messages as { content: string }[];
  assert.ok(messages[1]?.content.includes("hello => 指定译词"));
  assert.equal(taskRegistry.size(), 0);
});

test("已停用的服务商不能发起翻译", () => {
  const disabledProfile = {
    config: { baseURL: "https://example.invalid/v1", model: "fake" },
    enabled: false,
    id: "p-disabled",
    pluginId: "vadu.ai",
  };
  const imports: Record<string, unknown> = {
    "../../../shared/errors": { toSerializedError, VaduError },
    "../../../shared/ipc": { IPC },
    "../config/store": {
      readProfiles: () => [disabledProfile],
      readSettings: () => ({ glossary: [] }),
    },
    "../plugin/host": {
      hostTranslate: () => {
        throw new Error("不应到达适配器");
      },
    },
    "../plugin/registry": {
      registry: {
        get: () => ({
          descriptor: { capabilities: { glossary: false } },
        }),
        isReady: () => true,
      },
    },
    "./tasks": { taskRegistry: new TaskRegistry() },
  };
  const exports: Record<string, unknown> = {};
  const { outputText } = ts.transpileModule(
    readFileSync(join(import.meta.dirname, "service.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  );
  runInNewContext(outputText, {
    console,
    Date,
    exports,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error("Unexpected import");
      }
      return imports[name];
    },
  });
  const sender = Object.assign(new EventEmitter(), {
    id: 2,
    send: () => undefined,
  });
  assert.throws(
    () =>
      (exports.startTranslate as (params: unknown, s: unknown) => void)(
        {
          pluginId: "vadu.ai",
          profileId: "p-disabled",
          requestId: "disabled-profile",
          source: "en",
          target: "zh",
          text: "hello",
        },
        sender
      ),
    { code: "INVALID_CONFIG" }
  );
});
