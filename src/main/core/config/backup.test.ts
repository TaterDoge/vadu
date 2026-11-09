import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { AppSettings, ConfigSchema, Profile } from "../../../shared/ipc";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupSecrets,
  type PluginLookup,
  buildBackup,
  planBackupFromText,
  planBackupImport,
} from "./backup";
import { DEFAULT_SETTINGS } from "./settings";

const SCHEMA: ConfigSchema = {
  properties: {
    apiKey: { required: true, title: "API Key", type: "secret" },
    baseURL: { required: true, title: "接口地址", type: "string" },
    extra: { title: "提供商选项", type: "json" },
    headers: { title: "请求头", type: "json" },
    model: { required: true, title: "模型", type: "string" },
    token: { title: "Token", type: "secret" },
  },
  required: ["baseURL", "model", "apiKey"],
  type: "object",
};

const OTHER_SCHEMA: ConfigSchema = {
  properties: {
    apiKey: { title: "API Key", type: "secret" },
    baseURL: { required: true, title: "接口地址", type: "string" },
    model: { required: true, title: "模型", type: "string" },
  },
  required: ["baseURL", "model"],
  type: "object",
};

const plugins = new Map<
  string,
  { configSchema: ConfigSchema; status: "ready" }
>([
  ["vadu.ai", { configSchema: SCHEMA, status: "ready" }],
  ["vadu.ocr", { configSchema: OTHER_SCHEMA, status: "ready" }],
]);

const lookup: PluginLookup = (pluginId) => plugins.get(pluginId);

const SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  accent: "blue",
  defaultProfileId: "p1",
  hotkey: "CommandOrControl+Shift+K",
  style: "lyra",
  theme: "dark",
};

const NO_SECRETS: BackupSecrets = {};

function profile(id: string, overrides: Partial<Profile> = {}): Profile {
  return {
    allowedOrigins: ["https://renderer.invalid"],
    config: {
      apiKey: "config-secret-must-be-dropped",
      baseURL: "https://example.test/v1",
      model: "m",
      unknown: "drop-me",
    },
    createdAt: 1,
    enabled: true,
    id,
    name: `服务商 ${id}`,
    pluginId: "vadu.ai",
    ...overrides,
  };
}

describe("buildBackup", () => {
  test("v2 导出 config secret 剔除，独立 secrets 桶完整保留", () => {
    const backup = buildBackup(
      SETTINGS,
      [
        profile("p1", {
          config: { ...profile("p1").config, headers: { x: "1" } },
        }),
        profile("p2", { enabled: false, name: "第二个" }),
      ],
      lookup,
      {
        orphan: { apiKey: "must-not-export" },
        p1: { apiKey: "key-one" },
        p2: { apiKey: "key-two" },
      }
    );

    assert.equal(backup.format, BACKUP_FORMAT);
    assert.equal(backup.formatVersion, 2);
    assert.equal(BACKUP_FORMAT_VERSION, 2);
    assert.equal(backup.schemaVersion, 1);
    assert.deepEqual(
      backup.profiles.map((entry) => [entry.id, entry.enabled]),
      [
        ["p1", true],
        ["p2", false],
      ]
    );
    assert.equal(backup.profiles[0]?.config.apiKey, undefined);
    assert.equal(backup.profiles[0]?.config.unknown, undefined);
    assert.deepEqual(backup.profiles[0]?.config.headers, { x: "1" });
    assert.deepEqual(backup.profiles[0]?.secrets, { apiKey: "key-one" });
    assert.deepEqual(backup.profiles[1]?.secrets, { apiKey: "key-two" });
    assert.equal(JSON.stringify(backup).includes("must-not-export"), false);
    // 导入时 allowedOrigins 会被忽略，所以导出不携带
    assert.equal("allowedOrigins" in (backup.profiles[0] ?? {}), false);
  });

  test("自定义 headers/extra 的敏感键按原配置保留，不再拒绝完整备份", () => {
    const config = {
      ...profile("p1").config,
      extra: { max_tokens: 512, nested: { token_limit: 1000 } },
      headers: {
        Authorization: "Bearer existing",
        "Content-Type": "application/json",
      },
    };
    const backup = buildBackup(
      SETTINGS,
      [profile("p1", { config })],
      lookup,
      NO_SECRETS
    );
    assert.deepEqual(backup.profiles[0]?.config.extra, {
      max_tokens: 512,
      nested: { token_limit: 1000 },
    });
    assert.deepEqual(backup.profiles[0]?.config.headers, {
      Authorization: "Bearer existing",
      "Content-Type": "application/json",
    });
    assert.deepEqual(backup.profiles[0]?.secrets, {});
  });

  test("导出复用导入校验：schema 删除 secret 或坏桶整次拒绝且带服务商", () => {
    const noSecretSchema: ConfigSchema = {
      ...SCHEMA,
      properties: {
        baseURL: SCHEMA.properties.baseURL,
        extra: SCHEMA.properties.extra,
        headers: SCHEMA.properties.headers,
        model: SCHEMA.properties.model,
      },
    };
    const noSecretLookup: PluginLookup = (pluginId) =>
      pluginId === "vadu.ai"
        ? { configSchema: noSecretSchema, status: "ready" }
        : undefined;
    const cases = [
      {
        lookup: noSecretLookup,
        secrets: { p1: { apiKey: "legacy-field" } },
      },
      {
        lookup,
        secrets: { p1: { apiKey: "x".repeat(4097) } },
      },
    ];
    for (const entry of cases) {
      assert.throws(
        () =>
          buildBackup(SETTINGS, [profile("p1")], entry.lookup, entry.secrets),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, "INVALID_CONFIG");
          assert.equal(
            String((error as Error).message).includes("服务商 p1"),
            true
          );
          assert.equal(
            String((error as Error).message).includes("legacy-field"),
            false
          );
          assert.equal(
            String((error as Error).message).includes("x".repeat(20)),
            false
          );
          return true;
        }
      );
    }
  });

  test("合法多 secret 导出后仍能完整导入", () => {
    const backup = buildBackup(SETTINGS, [profile("p1")], lookup, {
      p1: { apiKey: "key-one", token: "token-one" },
    });
    assert.deepEqual(backup.profiles[0]?.secrets, {
      apiKey: "key-one",
      token: "token-one",
    });
    const plan = planBackupImport(backup, lookup);
    assert.deepEqual(plan.secrets[plan.profiles[0]?.id ?? ""], {
      apiKey: "key-one",
      token: "token-one",
    });
  });

  test("插件未就绪时拒绝导出", () => {
    assert.throws(
      () =>
        buildBackup(
          SETTINGS,
          [profile("p1", { pluginId: "missing" })],
          lookup,
          NO_SECRETS
        ),
      { code: "PLUGIN_LOAD_FAILED" }
    );
  });

  test("默认服务商引用不存在时拒绝导出", () => {
    assert.throws(
      () =>
        buildBackup(
          { ...SETTINGS, defaultProfileId: "nope" },
          [],
          lookup,
          NO_SECRETS
        ),
      { code: "INVALID_CONFIG" }
    );
  });

  test("服务商条数超过上限时整次拒绝", () => {
    const profiles = Array.from({ length: 201 }, (_, index) =>
      profile(`p${index}`)
    );
    assert.throws(() => buildBackup(SETTINGS, profiles, lookup, NO_SECRETS), {
      code: "INVALID_CONFIG",
    });
  });
});

describe("planBackupFromText", () => {
  test("v2 完整往返：新 UUID、默认服务商重映射、密钥跟新 ID、origin 重建", () => {
    const backup = buildBackup(
      SETTINGS,
      [
        profile("p1", {
          config: {
            baseURL: "https://example.test/v1/chat/completions",
            model: "m",
          },
        }),
        profile("p2", {
          config: { baseURL: "https://ocr.test/v1", model: "ocr" },
          enabled: false,
          name: "识别",
          pluginId: "vadu.ocr",
        }),
      ],
      lookup,
      {
        p1: { apiKey: "key-one" },
        p2: { apiKey: "key-two" },
      }
    );
    // 手工塞入恶意 origin，导入必须完全忽略
    const raw = JSON.parse(JSON.stringify(backup)) as {
      profiles: { allowedOrigins?: string[] }[];
    };
    const first = raw.profiles.at(0);
    if (first) {
      first.allowedOrigins = ["https://evil.invalid"];
    }

    const plan = planBackupFromText(JSON.stringify(raw), lookup);
    assert.equal(plan.formatVersion, 2);
    assert.equal(plan.secretCount, 2);
    assert.deepEqual(
      plan.profiles.map((entry) => [entry.name, entry.enabled]),
      [
        ["服务商 p1", true],
        ["识别", false],
      ]
    );
    assert.equal(plan.profiles[0]?.id === "p1", false);
    assert.equal(plan.profiles[1]?.id === "p2", false);
    assert.deepEqual(plan.profiles[0]?.allowedOrigins, [
      "https://example.test",
    ]);
    assert.deepEqual(plan.profiles[1]?.allowedOrigins, ["https://ocr.test"]);
    assert.equal(plan.profiles[0]?.config.baseURL, "https://example.test/v1");
    assert.equal(plan.settings.defaultProfileId, plan.profiles[0]?.id);
    assert.deepEqual(plan.secrets[plan.profiles[0]?.id ?? ""], {
      apiKey: "key-one",
    });
    assert.deepEqual(plan.secrets[plan.profiles[1]?.id ?? ""], {
      apiKey: "key-two",
    });
  });

  test("v1 旧备份兼容：无密钥、提示为 0 计数", () => {
    const backup = buildBackup(SETTINGS, [profile("p1")], lookup, NO_SECRETS);
    const legacy = JSON.parse(JSON.stringify(backup)) as Record<
      string,
      unknown
    >;
    legacy.formatVersion = 1;
    const profiles = legacy.profiles as { secrets?: unknown }[];
    for (const entry of profiles) {
      entry.secrets = undefined;
    }
    const plan = planBackupFromText(JSON.stringify(legacy), lookup);
    assert.equal(plan.formatVersion, 1);
    assert.equal(plan.secretCount, 0);
    assert.deepEqual(plan.secrets, {});
    assert.equal(plan.profiles.length, 1);
  });

  test("两次导入生成互不相同的新 UUID，密钥不落旧桶", () => {
    const backup = buildBackup(SETTINGS, [profile("p1")], lookup, {
      p1: { apiKey: "key-one" },
    });
    const first = planBackupImport(backup, lookup);
    const second = planBackupImport(backup, lookup);
    assert.notEqual(first.profiles[0]?.id, second.profiles[0]?.id);
    assert.equal(Object.hasOwn(first.secrets, "p1"), false);
    assert.equal(
      Object.hasOwn(first.secrets, first.profiles[0]?.id ?? ""),
      true
    );
    assert.equal(
      Object.hasOwn(second.secrets, second.profiles[0]?.id ?? ""),
      true
    );
  });

  test("v2 缺 secrets/坏类型/超限/未知 secret 字段整次拒绝", () => {
    const backup = buildBackup(SETTINGS, [profile("p1")], lookup, {
      p1: { apiKey: "key-one" },
    });
    const clone = () => JSON.parse(JSON.stringify(backup)) as typeof backup;
    const reject = (mutate: (value: typeof backup) => void) => {
      const value = clone();
      mutate(value);
      assert.throws(() => planBackupImport(value, lookup), {
        code: "INVALID_CONFIG",
      });
    };

    reject((value) => {
      (value.profiles[0] as { secrets?: unknown }).secrets = undefined;
    });
    reject((value) => {
      (value.profiles[0] as { secrets: unknown }).secrets = [];
    });
    reject((value) => {
      (value.profiles[0] as { secrets: Record<string, unknown> }).secrets = {
        apiKey: 1,
      };
    });
    reject((value) => {
      (value.profiles[0] as { secrets: Record<string, unknown> }).secrets = {
        apiKey: "",
      };
    });
    reject((value) => {
      (value.profiles[0] as { secrets: Record<string, unknown> }).secrets = {
        apiKey: "x".repeat(4097),
      };
    });
    reject((value) => {
      (value.profiles[0] as { secrets: Record<string, unknown> }).secrets = {
        unknownSecret: "value",
      };
    });
    reject((value) => {
      (value.profiles[0] as { secrets: Record<string, unknown> }).secrets =
        Object.fromEntries(
          Array.from({ length: 65 }, (_, index) => [`secret${index}`, "x"])
        );
    });
    reject((value) => {
      (value.profiles[0] as { secrets: Record<string, unknown> }).secrets =
        JSON.parse('{"__proto__":"x"}') as Record<string, string>;
    });
  });

  test("未知格式/配置版本整次拒绝", () => {
    const backup = buildBackup(SETTINGS, [profile("p1")], lookup, NO_SECRETS);
    assert.throws(
      () => planBackupImport({ ...backup, format: "other" }, lookup),
      { code: "INVALID_CONFIG" }
    );
    assert.throws(
      () => planBackupImport({ ...backup, formatVersion: 3 }, lookup),
      { code: "INVALID_CONFIG" }
    );
    assert.throws(
      () => planBackupImport({ ...backup, schemaVersion: 2 }, lookup),
      { code: "INVALID_CONFIG" }
    );
  });

  test("坏类型、重复 ID、缺失引用与非法快捷键都整次拒绝", () => {
    const backup = buildBackup(SETTINGS, [profile("p1")], lookup, NO_SECRETS);
    assert.throws(
      () =>
        planBackupImport(
          { ...backup, settings: { ...backup.settings, theme: "purple" } },
          lookup
        ),
      { code: "INVALID_CONFIG" }
    );
    assert.throws(
      () =>
        planBackupImport(
          { ...backup, profiles: [backup.profiles[0], backup.profiles[0]] },
          lookup
        ),
      { code: "INVALID_CONFIG" }
    );
    assert.throws(
      () =>
        planBackupImport(
          {
            ...backup,
            settings: { ...backup.settings, defaultProfileId: "nope" },
          },
          lookup
        ),
      { code: "INVALID_CONFIG" }
    );
    assert.throws(
      () =>
        planBackupImport(
          { ...backup, settings: { ...backup.settings, hotkey: "T" } },
          lookup
        ),
      { code: "INVALID_CONFIG" }
    );
    assert.throws(
      () =>
        planBackupImport(
          {
            ...backup,
            profiles: [
              {
                ...backup.profiles[0],
                config: { ...backup.profiles[0]?.config, baseURL: "ftp://x" },
              },
            ],
          },
          lookup
        ),
      { code: "INVALID_CONFIG" }
    );
  });

  test("缺插件整次拒绝，不做部分导入", () => {
    const backup = buildBackup(SETTINGS, [profile("p1")], lookup, NO_SECRETS);
    assert.throws(() => planBackupImport(backup, () => undefined), {
      code: "PLUGIN_LOAD_FAILED",
    });
  });

  test("坏 JSON 归类为 INVALID_CONFIG", () => {
    assert.throws(() => planBackupFromText("{", lookup), {
      code: "INVALID_CONFIG",
    });
  });
});
