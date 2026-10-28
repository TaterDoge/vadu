import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  acceleratorFromEvent,
  formatAccelerator,
  isSupportedAccelerator,
} from "./hotkey";

/** 只读这几个属性，用最小对象代替真实 KeyboardEvent */
function keyEvent(init: {
  code: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}): KeyboardEvent {
  return {
    altKey: init.altKey ?? false,
    code: init.code,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
  } as KeyboardEvent;
}

describe("isSupportedAccelerator", () => {
  test("接受带非 Shift 修饰键的组合", () => {
    assert.equal(isSupportedAccelerator("CommandOrControl+Shift+T"), true);
    assert.equal(isSupportedAccelerator("CommandOrControl+,"), true);
    assert.equal(isSupportedAccelerator("Alt+F12"), true);
  });

  test("拒绝只有 Shift 的组合", () => {
    assert.equal(isSupportedAccelerator("Shift+T"), false);
  });

  test("拒绝空串、重复修饰符、未知主键与缺主键", () => {
    assert.equal(isSupportedAccelerator(""), false);
    assert.equal(isSupportedAccelerator("CommandOrControl"), false);
    assert.equal(isSupportedAccelerator("Control+Control+T"), false);
    assert.equal(isSupportedAccelerator("CommandOrControl+Foo"), false);
  });
});

describe("acceleratorFromEvent", () => {
  test("mac 上 meta 视作主修饰键", () => {
    assert.equal(
      acceleratorFromEvent(keyEvent({ code: "KeyT", metaKey: true }), true),
      "CommandOrControl+T"
    );
  });

  test("非 mac 上 meta 降级为 Super", () => {
    assert.equal(
      acceleratorFromEvent(keyEvent({ code: "KeyT", metaKey: true }), false),
      "Super+T"
    );
  });

  test("修饰符按固定顺序输出", () => {
    assert.equal(
      acceleratorFromEvent(
        keyEvent({ altKey: true, code: "KeyT", metaKey: true, shiftKey: true }),
        true
      ),
      "CommandOrControl+Alt+Shift+T"
    );
  });

  test("只有 Shift 或缺可识别主键时返回 null", () => {
    assert.equal(
      acceleratorFromEvent(keyEvent({ code: "KeyT", shiftKey: true }), true),
      null
    );
    assert.equal(
      acceleratorFromEvent(
        keyEvent({ code: "NumpadAdd", metaKey: true }),
        true
      ),
      null
    );
  });
});

describe("formatAccelerator", () => {
  test("按平台给出逐键标签", () => {
    assert.deepEqual(formatAccelerator("CommandOrControl+Shift+T", true), [
      "⌘",
      "⇧",
      "T",
    ]);
    assert.deepEqual(formatAccelerator("CommandOrControl+Shift+T", false), [
      "Ctrl",
      "Shift",
      "T",
    ]);
  });

  test("空值返回空数组", () => {
    assert.deepEqual(formatAccelerator("", true), []);
  });
});
