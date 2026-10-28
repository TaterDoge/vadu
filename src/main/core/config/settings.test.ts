import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { AppSettings } from "../../../shared/ipc";
import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  mergeConfig,
  toSettings,
} from "./settings";

describe("toSettings", () => {
  test("空值与错误容器回默认", () => {
    assert.deepEqual(toSettings(undefined), DEFAULT_SETTINGS);
    assert.deepEqual(toSettings(null), DEFAULT_SETTINGS);
    assert.deepEqual(toSettings("未绑定"), DEFAULT_SETTINGS);
    assert.deepEqual(toSettings([]), DEFAULT_SETTINGS);
  });

  test("null 与空串都读成「用户解绑」，不会把默认热键装回去", () => {
    assert.equal(toSettings({ hotkey: null }).hotkey, null);
    // 旧版本把解绑存成空串，升级后必须仍然保持解绑
    assert.equal(toSettings({ hotkey: "" }).hotkey, null);
  });

  test("坏类型回落到默认", () => {
    assert.equal(toSettings({ hotkey: 42 }).hotkey, DEFAULT_SETTINGS.hotkey);
  });

  test("局内快捷键逐项容错，坏值不影响另一项", () => {
    const settings = toSettings({
      inAppHotkeys: { openSettings: 42, togglePin: "CommandOrControl+K" },
    });
    assert.equal(
      settings.inAppHotkeys.openSettings,
      DEFAULT_SETTINGS.inAppHotkeys.openSettings
    );
    assert.equal(settings.inAppHotkeys.togglePin, "CommandOrControl+K");
  });

  test("启动开关只接受布尔", () => {
    assert.equal(
      toSettings({ showMainWindowOnStartup: "yes" }).showMainWindowOnStartup,
      false
    );
    assert.equal(
      toSettings({ showMainWindowOnStartup: true }).showMainWindowOnStartup,
      true
    );
  });

  test("主题走白名单", () => {
    assert.equal(toSettings({ theme: "dark" }).theme, "dark");
    assert.equal(toSettings({ theme: "purple" }).theme, DEFAULT_SETTINGS.theme);
  });

  test("历史条数只接受正有限数", () => {
    assert.equal(toSettings({ historyLimit: 100 }).historyLimit, 100);
    assert.equal(
      toSettings({ historyLimit: "50" }).historyLimit,
      DEFAULT_SETTINGS.historyLimit
    );
    assert.equal(
      toSettings({ historyLimit: -1 }).historyLimit,
      DEFAULT_SETTINGS.historyLimit
    );
  });

  test("术语表必须是数组", () => {
    const entries = [{ from: "LLM", to: "大语言模型" }];
    assert.deepEqual(toSettings({ glossary: entries }).glossary, entries);
    assert.deepEqual(
      toSettings({ glossary: "x" }).glossary,
      DEFAULT_SETTINGS.glossary
    );
  });

  test("未知字段原样保留，避免旧版本写入的配置被抹掉", () => {
    const settings = toSettings({ extra: "keep" });
    assert.equal((settings as Record<string, unknown>).extra, "keep");
  });
});

describe("mergeConfig", () => {
  const settings: AppSettings = { ...DEFAULT_SETTINGS, hotkey: null };

  test("保留 settings 的兄弟字段", () => {
    const merged = mergeConfig(
      { profiles: [{ id: "a" }], schemaVersion: 99 },
      settings
    );
    assert.deepEqual(merged.profiles, [{ id: "a" }]);
  });

  test("settings 与 schemaVersion 以本次写入为准", () => {
    const merged = mergeConfig(
      { schemaVersion: 99, settings: { hotkey: "Alt+A" } },
      settings
    );
    assert.deepEqual(merged.settings, settings);
    assert.equal(merged.schemaVersion, SCHEMA_VERSION);
  });

  test("没有旧文件时也能写", () => {
    assert.deepEqual(mergeConfig(null, settings), {
      schemaVersion: SCHEMA_VERSION,
      settings,
    });
  });
});
