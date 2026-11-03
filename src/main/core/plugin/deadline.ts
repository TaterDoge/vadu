/**
 * 宿主侧 deadline 竞速：插件 Promise 可能长期挂起且不理会 AbortSignal，
 * 仅靠 signal 无法保证 settle；用竞速强行超时，并吸收迟到拒绝避免未处理。
 */

import { VaduError } from "../../../shared/errors";

export function withDeadline<T>(
  job: Promise<T>,
  ms: number,
  message = "操作超时"
): Promise<T> {
  // 迟到拒绝必须有 handler，否则 race 已由 deadline 取胜后会触发未处理拒绝
  job.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new VaduError("TIMEOUT", message)), ms);
  });
  const raced = Promise.race([job, deadline]);
  raced.finally(() => clearTimeout(timer)).catch(() => undefined);
  return raced;
}
