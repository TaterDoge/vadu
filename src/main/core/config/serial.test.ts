import assert from "node:assert/strict";
import { test } from "node:test";

import { serializeConfigWrite } from "./serial";

test("配置写队列按提交顺序执行，前一次失败不阻断后一次", async () => {
  const events: string[] = [];
  const first = serializeConfigWrite(async () => {
    events.push("first:start");
    await Promise.resolve();
    events.push("first:end");
    throw new Error("fake failure");
  });
  const second = serializeConfigWrite(() => {
    events.push("second");
  });

  await assert.rejects(first, { message: "fake failure" });
  await second;
  assert.deepEqual(events, ["first:start", "first:end", "second"]);
});
