import { expect, open, test } from 'nsh/test';

import { provider, providerStorage } from './fixtures/provider-config';

function openTasks() {
  return open('./fixtures/TranslationTasks.tsx', {
    platform: 'macos',
    storage: providerStorage(provider('ready', '测试服务商')),
    clock: {},
    host: {},
    network: {
      'POST https://example.com/v1/chat/completions': {
        headers: { 'content-type': 'text/event-stream' },
        delay: 2000,
        body: 'data: {"choices":[{"delta":{"content":"译文"}}]}\n\ndata: [DONE]\n\n',
      },
    },
  });
}

function events(app: Awaited<ReturnType<typeof openTasks>>): string[] {
  const text = app.texts().find((line) => line.startsWith('任务事件 '));
  return JSON.parse(text!.slice('任务事件 '.length));
}

test('重复 ID 拒绝受理，取消只结束对应请求一次，其他请求继续', async () => {
  const app = await openTasks();
  await app.host.send('start', 'first');
  await app.host.send('start', 'first');
  await app.host.send('start', 'second');
  await app.waitUntil(() => app.requests().length === 2);
  await app.host.send('cancel', 'first');
  await app.host.send('cancel', 'first');
  await app.wait(2100);
  expect(events(app)).toEqual([
    'first:INVALID_CONFIG',
    'first:cancelled',
    'second:delta',
    'second:done',
  ]);
});

test('关闭进行中翻译的浮窗立即取消任务，重开后旧响应不进入新窗口', async () => {
  const app = await openTasks();
  await app.host.send('open-translate');
  await app.type('id:translation-source-input', '示例');
  await app.press('id:translation-provider');
  await app.press('text:测试服务商 · demo-model');
  await app.press('label:翻译');
  await app.waitUntil(() => app.requests().length === 1);
  await app.window('translate').pressClose();
  await app.waitUntil(() => events(app).length === 1, { timeout: 500 });
  expect(events(app)[0].endsWith(':cancelled')).toBe(true);
  await app.host.send('open-translate');
  await app.wait(2100);
  expect(app.value('id:translation-source-input')).toBe('');
  expect(app.shows('id:translation-result >> text:翻译结果')).toBe(true);
  await app.window('translate').pressClose();
  expect(events(app)).toHaveLength(1);
});
