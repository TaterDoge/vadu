import { randomUUID } from 'crypto';

import { cleanup, signal } from 'nsh';

import { Translation } from '../../api/translation-task';

export function createTranslationSession() {
  const requestId = signal<string | null>(null);
  const result = signal('');
  const error = signal('');
  const cancelled = signal(false);

  function submit(
    profileId: string,
    model: string,
    target: string,
    text: string,
  ) {
    const id = randomUUID();
    requestId.set(id);
    result.set('');
    error.set('');
    cancelled.set(false);
    try {
      const failure = Translation.start(
        { requestId: id, profileId, model, target, text },
        (event) => {
          if (event.requestId !== requestId()) return;
          if (event.type === 'delta') {
            result.set(result() + event.text);
            return;
          }
          requestId.set(null);
          if (event.type === 'done') result.set(event.text);
          if (event.type === 'error') error.set(event.error.message);
          if (event.type === 'cancelled') cancelled.set(true);
        },
      );
      if (!failure) return;
      error.set(failure.message);
    } catch {
      error.set('无法启动翻译，请重试。');
    }
    requestId.set(null);
  }

  function cancel() {
    const id = requestId();
    if (!id) return;
    // 先撤销视图对该 ID 的订阅，再中止可能仍会返回事件的请求。
    requestId.set(null);
    cancelled.set(true);
    Translation.cancel(id);
  }

  cleanup(cancel);
  return {
    pending: () => requestId() !== null,
    result,
    error,
    cancelled,
    submit,
    cancel,
  };
}
