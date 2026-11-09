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
type SecretsOptions = {
  decrypt?: (
    cipher: Buffer
  ) => Promise<{ result: string; shouldReEncrypt: boolean }>;
  encryptionAvailable?: boolean;
  platform?: NodeJS.Platform;
};

function loadSecrets(
  directory: string,
  encrypt: (plain: string) => Promise<Buffer>,
  options: SecretsOptions = {}
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
    process:
      options.platform === undefined
        ? process
        : { ...process, platform: options.platform },
    require: (name: string) => {
      if (name === "electron") {
        return {
          app: { getPath: () => directory },
          safeStorage: {
            decryptStringAsync:
              options.decrypt ??
              ((cipher: Buffer) =>
                Promise.resolve({
                  result: cipher.toString(),
                  shouldReEncrypt: false,
                })),
            encryptStringAsync: encrypt,
            getSelectedStorageBackend: () => "gnome_libsecret",
            isAsyncEncryptionAvailable: () =>
              Promise.resolve(options.encryptionAvailable ?? true),
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
    canPersistSecrets: () => boolean;
    getSecret: (id: string, name: string) => string | undefined;
    hasSecret: (id: string, name: string) => boolean;
    initSecrets: () => Promise<void>;
    mergeSecrets: (
      buckets: Record<string, Record<string, string>>
    ) => Promise<void>;
    secretStorageState: () => { available: boolean };
    setSecret: (id: string, name: string, value: string) => Promise<void>;
    snapshotSecrets: (
      ids: string[]
    ) => Promise<Record<string, Record<string, string>>>;
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

test("会被先前未完成的 secret 写串联，快照不导出未提交值", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-secrets-snapshot-"));
  const secrets = loadSecrets(directory, async (plain) =>
    Buffer.from(`encrypted:${plain}`)
  );
  try {
    await secrets.initSecrets();
    const pending = secrets.setSecret("profile-a", "apiKey", "latest");
    const snapshot = await secrets.snapshotSecrets([
      "profile-a",
      "profile-orphan",
    ]);
    await pending;
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
      "profile-a": { apiKey: "latest" },
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("纯会话密钥允许导出；有密钥的导入因无法持久化而拒绝", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-secrets-session-"));
  const secrets = loadSecrets(directory, async (plain) => Buffer.from(plain), {
    encryptionAvailable: false,
  });
  try {
    await secrets.initSecrets();
    await secrets.setSecret("profile-a", "apiKey", "session-key");
    assert.equal(secrets.canPersistSecrets(), false);
    assert.deepEqual(
      JSON.parse(JSON.stringify(await secrets.snapshotSecrets(["profile-a"]))),
      {
        "profile-a": { apiKey: "session-key" },
      }
    );
    await assert.rejects(
      secrets.mergeSecrets({ "new-id": { apiKey: "imported" } }),
      { code: "INTERNAL" }
    );
    assert.equal(secrets.hasSecret("new-id", "apiKey"), false);
    assert.equal(existsSync(join(directory, "secrets.bin")), false);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("存在未读取的密钥文件时拒绝完整快照", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-secrets-unread-"));
  writeFileSync(
    join(directory, "secrets.bin"),
    JSON.stringify({ entries: {}, version: 1 })
  );
  const secrets = loadSecrets(directory, async (plain) => Buffer.from(plain), {
    encryptionAvailable: false,
  });
  try {
    await secrets.initSecrets();
    assert.equal(secrets.secretStorageState().available, false);
    await assert.rejects(secrets.snapshotSecrets(["profile-a"]), {
      code: "INTERNAL",
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("批量导入保留旧桶，新进程重新解密后可取到新 ID 的原值", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-secrets-merge-"));
  const encrypt = async (plain: string) => Buffer.from(`encrypted:${plain}`);
  const decrypt = async (cipher: Buffer) => ({
    result: cipher.toString().replace("encrypted:", ""),
    shouldReEncrypt: false,
  });
  try {
    const first = loadSecrets(directory, encrypt, { decrypt });
    await first.initSecrets();
    await first.setSecret("old-id", "apiKey", "old-key");
    await first.mergeSecrets({ "new-id": { apiKey: "new-key" } });
    assert.equal(first.getSecret("old-id", "apiKey"), "old-key");
    assert.equal(first.getSecret("new-id", "apiKey"), "new-key");

    const second = loadSecrets(directory, encrypt, { decrypt });
    await second.initSecrets();
    assert.equal(second.getSecret("old-id", "apiKey"), "old-key");
    assert.equal(second.getSecret("new-id", "apiKey"), "new-key");
    assert.equal(second.hasSecret("new-id", "apiKey"), true);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("密钥解密失败时初始化失败，完整快照仍拒绝", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-secrets-decrypt-"));
  writeFileSync(
    join(directory, "secrets.bin"),
    JSON.stringify({
      entries: { "profile-a": { apiKey: { cipher: "Y2lwaGVy" } } },
      version: 1,
    })
  );
  const secrets = loadSecrets(directory, async (plain) => Buffer.from(plain), {
    decrypt: () => Promise.reject(new Error("decrypt failed")),
  });
  try {
    await assert.rejects(secrets.initSecrets());
    await assert.rejects(secrets.snapshotSecrets(["profile-a"]), {
      code: "INTERNAL",
    });
    await assert.rejects(
      secrets.mergeSecrets({ "new-id": { apiKey: "imported" } }),
      { code: "INTERNAL" }
    );
    assert.equal(secrets.getSecret("profile-a", "apiKey"), undefined);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("批量密钥写失败时旧桶/旧文件不变，不能假装导入成功", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vadu-secrets-merge-fail-"));
  let fail = false;
  const secrets = loadSecrets(directory, (plain) =>
    fail
      ? Promise.reject(new Error("encrypt failed"))
      : Promise.resolve(Buffer.from(`encrypted:${plain}`))
  );
  try {
    await secrets.initSecrets();
    await secrets.setSecret("old-id", "apiKey", "old-key");
    const disk = readFileSync(join(directory, "secrets.bin"), "utf8");
    fail = true;
    await assert.rejects(
      secrets.mergeSecrets({ "new-id": { apiKey: "new-key" } })
    );
    assert.equal(secrets.getSecret("old-id", "apiKey"), "old-key");
    assert.equal(secrets.hasSecret("new-id", "apiKey"), false);
    assert.equal(readFileSync(join(directory, "secrets.bin"), "utf8"), disk);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
