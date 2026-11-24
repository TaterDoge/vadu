import { SettingsError } from '../feature/settings';
import { translationLanguages } from '../translation-languages';
import { ProviderRequestError } from './request';
import { streamTranslation } from './translation';

type TranslateInput = {
  requestId: string;
  profileId: string;
  text: string;
  target: string;
};

type ApiError = Pick<ProviderRequestError, 'code' | 'message' | 'retryable'>;

type TranslateEvent = { requestId: string } & (
  | { type: 'delta' | 'done'; text: string }
  | { type: 'error'; error: ApiError }
  | { type: 'cancelled' }
);

const requests = new Map<string, AbortController>();

function start(
  input: TranslateInput,
  onEvent: (event: TranslateEvent) => void,
): ApiError | null {
  const { requestId, profileId, text, target } = input;
  const language = translationLanguages.find(({ value }) => value === target);
  if (!language) {
    return new ProviderRequestError(
      'UNSUPPORTED_LANGUAGE',
      '请选择支持的目标语言。',
    );
  }
  if (!text.trim() || text.length > 100_000 || [...text].length > 50_000) {
    return new ProviderRequestError(
      'INVALID_CONFIG',
      '请输入原文，最多 50,000 字符。',
    );
  }
  if (
    !requestId ||
    requestId.length > 64 ||
    new TextEncoder().encode(requestId).length > 64
  ) {
    return new ProviderRequestError('INVALID_CONFIG', '翻译请求 ID 无效。');
  }
  if (requests.has(requestId)) {
    return new ProviderRequestError('INVALID_CONFIG', '翻译请求 ID 已在使用。');
  }

  const controller = new AbortController();
  requests.set(requestId, controller);
  const run = async () => {
    let translated = '';
    let terminal: TranslateEvent;
    try {
      await streamTranslation(
        profileId,
        text,
        language.promptName,
        controller.signal,
        (delta) => {
          translated += delta;
          onEvent({ requestId, type: 'delta', text: delta });
        },
      );
      terminal = { requestId, type: 'done', text: translated };
    } catch (cause) {
      const error =
        cause instanceof ProviderRequestError
          ? cause
          : cause instanceof SettingsError
            ? new ProviderRequestError(cause.code, cause.message)
            : new ProviderRequestError('INTERNAL', '无法完成翻译，请重试。');
      terminal = { requestId, type: 'error', error };
    }
    requests.delete(requestId);
    onEvent(
      controller.signal.aborted ? { requestId, type: 'cancelled' } : terminal,
    );
  };
  // 终态回调失效也不能留下未处理的拒绝。
  void run().catch(() => {});
  return null;
}

function cancel(requestId: string) {
  requests.get(requestId)?.abort();
}

export const Translation = { start, cancel };
