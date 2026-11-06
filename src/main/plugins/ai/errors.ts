/**
 * 上游失败归一：只透机器可读错误码与状态码，绝不携带上游原文
 * （错误体里常夹带密钥片段与提示词）。
 */

export type CodedError = Error & { code?: string; status?: number };

export function coded(
  code: string,
  message: string,
  status?: number
): CodedError {
  const error: CodedError = new Error(message);
  error.code = code;
  if (status !== undefined) {
    error.status = status;
  }
  return error;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 机器可读错误码白名单：短、无凭据、无原文；其余一律丢弃只留状态码 */
const ERROR_CODE_RE = /^[a-z0-9_.-]{1,64}$/i;

export type UpstreamBody = Record<string, unknown>;

export function extractErrorCode(
  body: UpstreamBody | undefined
): string | undefined {
  const error = body?.error;
  if (!isRecord(error)) {
    return undefined;
  }
  const { code } = error;
  return typeof code === "string" && ERROR_CODE_RE.test(code)
    ? code
    : undefined;
}

export function mapHttpError(status: number, code?: string): CodedError {
  if (status === 401 || status === 403) {
    return coded("AUTH_FAILED", "认证失败，请检查 API Key", status);
  }
  if (status === 429) {
    return coded("RATE_LIMITED", "请求过于频繁或配额超限", status);
  }
  if (status === 404) {
    return coded(
      "INVALID_CONFIG",
      "接口或模型不存在，请检查 baseURL 与模型名",
      status
    );
  }
  return coded(
    "INTERNAL",
    code ? `上游返回错误：${code}` : `上游返回状态 ${status}`,
    status
  );
}

/** SDK 把错误体放在字符串里；解析失败就当作没有错误码 */
export function parseBody(raw: unknown): UpstreamBody | undefined {
  if (typeof raw !== "string") {
    return isRecord(raw) ? raw : undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function readErrorBody(
  res: Response
): Promise<UpstreamBody | undefined> {
  try {
    return parseBody(await res.text());
  } catch {
    return undefined;
  }
}
