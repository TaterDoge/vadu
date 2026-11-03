import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { type EventSender, TaskRegistry } from "./tasks";

function sender(id: number): EventSender {
  return { id, send: () => undefined };
}

describe("TaskRegistry", () => {
  test("注册与取消只能由发起窗口发起", () => {
    const registry = new TaskRegistry();
    const owner = sender(1);
    const other = sender(2);
    const task = registry.register("r1", owner);
    assert.ok(task);
    assert.equal(registry.cancel("r1", other.id), false);
    assert.equal(task?.suppressed, false);
    assert.equal(registry.cancel("r1", owner.id), true);
    assert.equal(task?.suppressed, true);
    assert.equal(task?.controller.signal.aborted, true);
  });

  test("重复 requestId 拒绝注册", () => {
    const registry = new TaskRegistry();
    assert.ok(registry.register("r1", sender(1)));
    assert.equal(registry.register("r1", sender(2)), null);
  });

  test("sender 销毁中止其所有任务", () => {
    const registry = new TaskRegistry();
    const owner = sender(1);
    const taskA = registry.register("r1", owner);
    const taskB = registry.register("r2", owner);
    registry.register("r3", sender(2));
    registry.disposeBySender(1);
    assert.equal(taskA?.suppressed, true);
    assert.equal(taskB?.suppressed, true);
    assert.equal(taskB?.controller.signal.aborted, true);
    assert.equal(registry.size(), 3);
  });

  test("remove 清理任务", () => {
    const registry = new TaskRegistry();
    registry.register("r1", sender(1));
    registry.remove("r1");
    assert.equal(registry.size(), 0);
    assert.equal(registry.get("r1"), undefined);
  });
});
