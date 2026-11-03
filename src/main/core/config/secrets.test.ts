import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { VaduError } from "../../../shared/errors";

// 在独立模块作用域注入 Electron，实际持久化代码仍写入临时用户目录。
function loadSecrets(
  directory: string,
  encrypt: (plain: string) => Promise<Buffer>
) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(join(import.meta.dirname, "secrets.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    Buffer,
    console,
    exports,
    process,
    require: (name: string) => {
      if (name === "electron") {
        return {
          app: { getPath: () => directory },
          safeStorage: {
            encryptStringAsync: encrypt,
            isAsyncEncryptionAvailable: () => Promise.resolve(true),
          },
        };
      }
      if (name.endsWith("shared/errors")) {
        return { VaduError };
      }
      if (name === "node:fs") {
        return { existsSync, readFileSync, renameSync, writeFileSync };
      }
      if (name === "node:path") {
        return { join };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports as {
    initSecrets: () => Promise<void>;
    setSecret: (id: string, name: string, value: string) => Promise<void>;
    getSecret: (id: string, name: string) => string | undefined;
  };
}

test("secrets 写盘失败保留旧内存，下一次写入恢复且 profile 隔离", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-secrets-test-"));
  let fail = false;
  const secrets = loadSecrets(directory, (plain) =>
    fail
      ? Promise.reject(new Error("fake encryption failure"))
      : Promise.resolve(Buffer.from(`encrypted:${plain}`))
  );
  try {
    await secrets.initSecrets();
    await secrets.setSecret("profile-a", "apiKey", "old");
    const disk = readFileSync(join(directory, "secrets.bin"), "utf8");
    fail = true;
    await assert.rejects(secrets.setSecret("profile-a", "apiKey", "lost"));
    assert.equal(secrets.getSecret("profile-a", "apiKey"), "old");
    assert.equal(readFileSync(join(directory, "secrets.bin"), "utf8"), disk);
    fail = false;
    await Promise.all([
      secrets.setSecret("profile-a", "apiKey", "new"),
      secrets.setSecret("profile-b", "apiKey", "other"),
    ]);
    assert.equal(secrets.getSecret("profile-a", "apiKey"), "new");
    assert.equal(secrets.getSecret("profile-b", "apiKey"), "other");
    const file = JSON.parse(
      readFileSync(join(directory, "secrets.bin"), "utf8")
    );
    assert.equal(
      Buffer.from(file.entries["profile-a"].apiKey.cipher, "base64").toString(),
      "encrypted:new"
    );
    assert.equal(
      Buffer.from(file.entries["profile-b"].apiKey.cipher, "base64").toString(),
      "encrypted:other"
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("secrets 坏文件不覆盖，初始化失败保持会话模式", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-secrets-test-"));
  const target = join(directory, "secrets.bin");
  writeFileSync(target, '{"version":1,"entries":{"broken":null}}');
  const original = readFileSync(target, "utf8");
  const secrets = loadSecrets(directory, async (plain) => Buffer.from(plain));
  try {
    await assert.rejects(secrets.initSecrets());
    await secrets.setSecret("session", "apiKey", "memory-only");
    assert.equal(readFileSync(target, "utf8"), original);
    assert.equal(secrets.getSecret("session", "apiKey"), "memory-only");
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
