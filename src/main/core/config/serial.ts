/**
 * settings 与 profiles 同居 config.json：外观保存、服务商保存、恢复导入必须共用
 * 一条写队列，否则后写的那个会拿旧快照覆盖别人刚提交的字段。
 */

import { VaduError } from "../../../shared/errors";

let chain: Promise<unknown> = Promise.resolve();
let writesLocked = false;

/**
 * 恢复提交成功后封锁所有配置写入，直到进程重启。
 * 这是单向闸门，不是事务：只防止重启前的旧保存把刚恢复的配置改回去。
 */
export function lockConfigWrites(): void {
  writesLocked = true;
}

export function assertConfigWritesAllowed(): void {
  if (writesLocked) {
    throw new VaduError("ABORTED", "应用正在重启，配置写入已停止");
  }
}

export function serializeConfigWrite<T>(
  operation: () => Promise<T> | T
): Promise<T> {
  const run = chain
    .catch(() => undefined)
    .then(() => {
      // 在轮到执行时检查：恢复前排队的旧写不能绕过恢复后的封锁
      assertConfigWritesAllowed();
      return operation();
    });
  chain = run;
  return run;
}
