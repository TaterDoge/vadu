import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { VaduError } from "../../../shared/errors";
import { withDeadline } from "./deadline";

describe("withDeadline", () => {
  test("job 更快正常返回", async () => {
    const result = await withDeadline(Promise.resolve(42), 2000);
    assert.equal(result, 42);
  });

  test("job 挂起超 deadline 拒绝 TIMEOUT", async () => {
    const hang = new Promise<never>(() => undefined);
    await assert.rejects(withDeadline(hang, 10, "测试超时"), {
      code: "TIMEOUT",
    });
  });

  test("迟到拒绝被吸收，不产生未处理拒绝", async () => {
    let rejectLater: (reason?: unknown) => void = () => undefined;
    const job = new Promise<never>((_, reject) => {
      rejectLater = reject;
    });
    const raced = withDeadline(job, 5, "测试超时");
    await assert.rejects(raced, { code: "TIMEOUT" });
    rejectLater(new Error("late"));
    await new Promise((resolve) => setTimeout(resolve, 15));
  });

  test("VaduError 携带 TIMEOUT 码", () => {
    const error = new VaduError("TIMEOUT", "test");
    assert.equal(error.code, "TIMEOUT");
  });
});
