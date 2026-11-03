import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { IPC } from "../../shared/ipc";

test("translate cancel 忽略非法 payload 与超长 requestId", () => {
  let cancel: (event: unknown, payload: unknown) => void = () => undefined;
  const calls: unknown[][] = [];
  const exports: Record<string, unknown> = {};
  const { outputText } = ts.transpileModule(
    readFileSync(join(import.meta.dirname, "translate.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  );
  const imports: Record<string, unknown> = {
    "../../shared/errors": {},
    "../../shared/ipc": { IPC },
    "../core/translate/service": {
      cancelTranslate: (...args: unknown[]) => calls.push(args),
    },
    "./index": { handle: () => undefined },
    electron: {
      ipcMain: {
        on: (_channel: string, callback: typeof cancel) => {
          cancel = callback;
        },
      },
    },
  };
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error("Unexpected import");
      }
      return imports[name];
    },
  });
  (exports.registerTranslateIpc as () => void)();
  const event = { sender: {} };
  for (const payload of [
    undefined,
    null,
    [],
    "id",
    1,
    {},
    { requestId: [] },
    { requestId: "" },
    { requestId: "x".repeat(65) },
  ]) {
    assert.doesNotThrow(() => cancel(event, payload));
  }
  assert.equal(calls.length, 0);
  cancel(event, { requestId: "x".repeat(64) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.[1], event.sender);
});
