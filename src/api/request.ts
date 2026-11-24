const jsonLimit = 1024 * 1024;
const responseDeadline = 25_000;

export type RequestOptions = {
  url: string;
  headers: Record<string, string>;
  body?: object;
  signal?: AbortSignal;
};

export class ProviderRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export function invalidResponse() {
  return new ProviderRequestError(
    'NETWORK',
    '服务商返回的响应格式无效或不完整。',
  );
}

function checkStatus(response: Response) {
  if (
    response.redirected ||
    (response.status >= 300 && response.status < 400)
  ) {
    throw new ProviderRequestError(
      'PERMISSION_DENIED',
      '接口发生重定向，请保存实际的 Base URL。',
    );
  }
  if (response.ok) return;
  switch (response.status) {
    case 401:
    case 403:
      throw new ProviderRequestError(
        'AUTH_FAILED',
        '服务商拒绝访问，请检查 API Key 和权限。',
      );
    case 429:
      throw new ProviderRequestError(
        'RATE_LIMITED',
        '服务商限流或额度不足，请稍后重试。',
        true,
      );
    case 404:
      throw new ProviderRequestError(
        'INVALID_CONFIG',
        '服务商接口或模型不存在，请检查 Base URL 和模型 ID。',
      );
    default:
      if (response.status >= 500) {
        throw new ProviderRequestError(
          'NETWORK',
          '服务商暂时不可用，请稍后重试。',
          true,
        );
      }
      throw new ProviderRequestError(
        'INVALID_CONFIG',
        '服务商拒绝请求，请检查模型和高级选项。',
      );
  }
}

function decode(decoder: TextDecoder, chunk?: Uint8Array) {
  try {
    return decoder.decode(chunk, { stream: chunk !== undefined });
  } catch {
    throw invalidResponse();
  }
}

export async function* requestChunks(
  { url, headers: requestHeaders, body, signal: cancellation }: RequestOptions,
  accept: 'application/json' | 'text/event-stream',
) {
  const streaming = accept === 'text/event-stream';
  const controller = new AbortController();
  const signal = cancellation
    ? AbortSignal.any([cancellation, controller.signal])
    : controller.signal;
  const timeoutError = new ProviderRequestError(
    'TIMEOUT',
    '服务商响应超时，请重试。',
    true,
  );
  const expire = () => controller.abort(timeoutError);
  const deadline = setTimeout(expire, streaming ? 120_000 : responseDeadline);
  let idle: ReturnType<typeof setTimeout> | undefined;
  try {
    signal.throwIfAborted();
    const headers = new Headers(requestHeaders);
    headers.set('Accept', accept);
    if (body) headers.set('Content-Type', 'application/json');
    if (streaming) idle = setTimeout(expire, responseDeadline);
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      body: body ? JSON.stringify(body) : undefined,
      headers,
      signal,
      redirect: 'manual',
      credentials: 'omit',
    });
    clearTimeout(idle);
    signal.throwIfAborted();
    checkStatus(response);
    if (
      !response.body ||
      (streaming &&
        response.headers
          .get('content-type')
          ?.split(';')[0]
          .trim()
          .toLowerCase() !== accept)
    ) {
      throw invalidResponse();
    }
    const reader = response.body.getReader();
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const limit = streaming ? 2 * jsonLimit : jsonLimit;
      let size = 0;
      for (;;) {
        if (streaming) idle = setTimeout(expire, responseDeadline);
        const { done, value } = await reader.read();
        clearTimeout(idle);
        signal.throwIfAborted();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw invalidResponse();
        yield decode(decoder, value);
      }
      yield decode(decoder);
    } finally {
      reader.releaseLock();
    }
  } catch (cause) {
    if (cause instanceof ProviderRequestError) throw cause;
    if (controller.signal.reason === timeoutError) throw timeoutError;
    throw new ProviderRequestError(
      'NETWORK',
      '无法完成服务商请求，请检查地址和网络。',
      true,
    );
  } finally {
    clearTimeout(deadline);
    clearTimeout(idle);
    // 提前遇到 [DONE]、坏响应或非 2xx 时也停止读取上游。
    controller.abort();
  }
}

export function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw invalidResponse();
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function request(options: RequestOptions) {
  let text = '';
  for await (const chunk of requestChunks(options, 'application/json'))
    text += chunk;
  return parseJSON(text);
}
