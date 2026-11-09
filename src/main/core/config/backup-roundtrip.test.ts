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
import type { AppSettings, ConfigSchema, Profile } from "../../../shared/ipc";
import { type PluginLookup, buildBackup, planBackupImport } from "./backup";
import { DEFAULT_SETTINGS } from "./settings";

const TRANSLATOR_SCHEMA: ConfigSchema = {
  properties: {
    apiKey: { title: "API Key", type: "secret" },
    baseURL: { required: true, title: "接口地址", type: "string" },
    model: { required: true, title: "模型", type: "string" },
    token: { title: "Token", type: "secret" },
  },
  required: ["baseURL", "model"],
  type: "object",
};

const OCR_SCHEMA: ConfigSchema = {
  properties: {
    apiKey: { title: "API Key", type: "secret" },
    baseURL: { required: true, title: "接口地址", type: "string" },
    model: { required: true, title: "模型", type: "string" },
  },
  required: ["baseURL", "model"],
  type: "object",
};

const plugins = new Map([
  ["vadu.ai", { configSchema: TRANSLATOR_SCHEMA, status: "ready" as const }],
  ["vadu.ocr", { configSchema: OCR_SCHEMA, status: "ready" as const }],
]);
const lookup: PluginLookup = (pluginId) => plugins.get(pluginId);

const SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  defaultProfileId: "p1",
};

function profile(
  id: string,
  pluginId: string,
  config: Record<string, unknown>,
  enabled = true
): Profile {
  return {
    allowedOrigins: [],
    config,
    createdAt: 1,
    enabled,
    id,
    name: `服务商 ${id}`,
    pluginId,
  };
}

/** 简易可逆“加密”：真实产品仍由 safeStorage 负责；测试只验证明文不落 config */
function encrypt(plain: string): Buffer {
  return Buffer.from([...plain].reverse().join(""));
}

function decrypt(cipher: Buffer): { result: string; shouldReEncrypt: boolean } {
  return {
    result: [...cipher.toString()].reverse().join(""),
    shouldReEncrypt: false,
  };
}

function loadSecrets(directory: string) {
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
    exports,
    process,
    require: (name: string) => {
      if (name === "electron") {
        return {
          app: { getPath: () => directory },
          safeStorage: {
            decryptStringAsync: (cipher: Buffer) =>
              Promise.resolve(decrypt(cipher)),
            encryptStringAsync: (plain: string) =>
              Promise.resolve(encrypt(plain)),
            getSelectedStorageBackend: () => "gnome_libsecret",
            isAsyncEncryptionAvailable: () => Promise.resolve(true),
          },
        };
      }
      if (name === "../../../shared/errors") {
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
    getSecret: (id: string, name: string) => string | undefined;
    hasSecret: (id: string, name: string) => boolean;
    initSecrets: () => Promise<void>;
    mergeSecrets: (
      buckets: Record<string, Record<string, string>>
    ) => Promise<void>;
    setSecret: (id: string, name: string, value: string) => Promise<void>;
    snapshotSecrets: (
      ids: string[]
    ) => Promise<Record<string, Record<string, string>>>;
  };
}

test("跨目录/新进程完整往返：新 ID 取回原 key，config.json 不含明文", async () => {
  const source = mkdtempSync(join(tmpdir(), "vadu-full-source-"));
  const target = mkdtempSync(join(tmpdir(), "vadu-full-target-"));
  try {
    const sourceSecrets = loadSecrets(source);
    await sourceSecrets.initSecrets();
    await sourceSecrets.setSecret("p1", "apiKey", "translator-primary");
    await sourceSecrets.setSecret("p1", "token", "translator-token");
    await sourceSecrets.setSecret("p2", "apiKey", "ocr-key");
    await sourceSecrets.setSecret("p3", "apiKey", "disabled-key");

    const profiles = [
      profile("p1", "vadu.ai", {
        baseURL: "https://example.test/v1",
        model: "m",
      }),
      profile(
        "p2",
        "vadu.ocr",
        { baseURL: "https://ocr.test/v1", model: "ocr" },
        false
      ),
      profile(
        "p3",
        "vadu.ai",
        { baseURL: "https://third.test/v1", model: "third" },
        false
      ),
    ];
    const snapshot = await sourceSecrets.snapshotSecrets(
      profiles.map((entry) => entry.id)
    );
    const backup = buildBackup(SETTINGS, profiles, lookup, snapshot);
    assert.equal(backup.profiles.length, 3);
    assert.equal(
      backup.profiles.map((entry) => Object.keys(entry.secrets).length).join(),
      "2,1,1"
    );

    const plan = planBackupImport(backup, lookup);
    const byName = new Map(plan.profiles.map((entry) => [entry.name, entry]));
    const newP1 = byName.get("服务商 p1");
    const newP2 = byName.get("服务商 p2");
    const newP3 = byName.get("服务商 p3");
    assert.ok(newP1);
    assert.ok(newP2);
    assert.ok(newP3);
    assert.equal(plan.secretCount, 4);
    assert.deepEqual(plan.secrets[newP1.id], {
      apiKey: "translator-primary",
      token: "translator-token",
    });
    assert.deepEqual(plan.secrets[newP2.id], { apiKey: "ocr-key" });
    assert.deepEqual(plan.secrets[newP3.id], { apiKey: "disabled-key" });
    assert.equal(Object.hasOwn(plan.secrets, "p1"), false);

    const targetSecrets = loadSecrets(target);
    await targetSecrets.initSecrets();
    await targetSecrets.mergeSecrets(plan.secrets);
    assert.equal(
      targetSecrets.getSecret(newP1.id, "apiKey"),
      "translator-primary"
    );
    assert.equal(
      targetSecrets.getSecret(newP1.id, "token"),
      "translator-token"
    );
    assert.equal(targetSecrets.getSecret(newP2.id, "apiKey"), "ocr-key");
    assert.equal(targetSecrets.hasSecret(newP3.id, "apiKey"), true);
    assert.equal(targetSecrets.getSecret(newP1.id, "ocr-key"), undefined);

    const configText = JSON.stringify({
      profiles: plan.profiles,
      schemaVersion: 1,
      settings: plan.settings,
    });
    for (const key of [
      "translator-primary",
      "translator-token",
      "ocr-key",
      "disabled-key",
    ]) {
      assert.equal(configText.includes(key), false);
    }
    writeFileSync(join(target, "config.json"), configText, "utf8");
    assert.equal(
      readFileSync(join(target, "config.json"), "utf8").includes(
        "translator-primary"
      ),
      false
    );

    // 模拟重启：新模块从目标目录解密后仍能取到新 ID 的原 key
    const restarted = loadSecrets(target);
    await restarted.initSecrets();
    assert.equal(restarted.getSecret(newP1.id, "apiKey"), "translator-primary");
    assert.equal(restarted.getSecret(newP2.id, "apiKey"), "ocr-key");
    assert.equal(restarted.getSecret(newP3.id, "apiKey"), "disabled-key");
  } finally {
    rmSync(source, { force: true, recursive: true });
    rmSync(target, { force: true, recursive: true });
  }
});
