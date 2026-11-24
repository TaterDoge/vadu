import { expect, open, type OpenOptions, test } from 'nsh/test';

import { provider, providerStorage } from './fixtures/provider-config';
import { defaultShortcuts, settingsDocument } from './fixtures/settings-config';

async function openWindows(options: OpenOptions = {}) {
  return open('./fixtures/Windows.tsx', {
    width: 1200,
    height: 800,
    platform: 'macos',
    host: {},
    ...options,
  });
}

test('翻译窗口 Command + 逗号恢复设置窗口并保留分类', async () => {
  const app = await openWindows();
  const main = app.window('main');
  await app.press('id:settings-appearance');
  await main.pressClose();
  await app.host.send('open-translate');
  await app.keyboard.press('cmd+,');
  expect(main.state()).toMatchObject({ visible: true, focused: true });
  expect(app.count('label:外观')).toBe(2);
  expect(app.window('translate').state()).toMatchObject({ visible: false });

  await app.host.send('minimize-settings');
  await app.waitUntil(() => main.state()?.minimized === true);
  await app.host.send('open-translate');
  await app.keyboard.press('cmd+,');
  expect(main.state()).toMatchObject({
    visible: true,
    focused: true,
    minimized: false,
  });
  expect(app.count('label:外观')).toBe(2);
});

test('单击翻译窗设置按钮恢复设置窗口并保留分类', async () => {
  const app = await openWindows();
  const main = app.window('main');
  await app.press('id:settings-appearance');
  await main.pressClose();
  await app.host.send('open-translate');
  await app.press('id:translation-toolbar >> label:打开设置');
  expect(main.state()).toMatchObject({ visible: true, focused: true });
  expect(app.count('label:外观')).toBe(2);
  expect(app.window('translate').state()).toMatchObject({ visible: false });
});

test('翻译窗口首次唤起即把键盘输入交给原文输入', async () => {
  const app = await openWindows();
  await app.host.send('open-translate');
  await app.keyboard.press('a');
  expect(app.value('id:translation-source-input')).toBe('a');
});

test('翻译窗口 Command + W 隐藏窗口，重新唤起后保留原文与输入焦点', async () => {
  const app = await openWindows();
  await app.host.send('open-translate');
  await app.type('id:translation-source-input', 'a');
  await app.keyboard.press('cmd+w');
  expect(app.window('translate').state()).toMatchObject({ visible: false });
  await app.host.send('open-translate');
  await app.keyboard.press('b');
  expect(app.value('id:translation-source-input')).toBe('ab');
});

test('隐藏浮窗取消进行中的翻译，重新唤起后忽略迟到的响应', async () => {
  const app = await openWindows({
    storage: providerStorage(provider('ready', '本轮服务')),
    clock: {},
    network: {
      'POST https://example.com/v1/chat/completions': {
        delay: 3000,
        headers: { 'content-type': 'text/event-stream' },
        body: 'data: {"choices":[{"delta":{"content":"迟到译文"}}]}\n\ndata: [DONE]\n\n',
      },
    },
  });
  await app.host.send('open-translate');
  await app.type('id:translation-source-input', 'Fake source');
  await app.press('id:translation-provider');
  await app.press('text:本轮服务 · demo-model');
  await app.press('label:翻译');
  await app.waitUntil(() => app.requests().length === 1);
  await app.host.send('hide-translate');
  expect(app.window('translate').state()?.visible).toBe(false);

  await app.wait(3000);
  await app.host.send('open-translate');
  expect(app.shows('id:translation-result >> text:已取消翻译')).toBe(true);
  expect(app.shows('id:translation-result >> text:迟到译文')).toBe(false);
  expect(app.enabled('label:翻译')).toBe(true);
});

test('设置窗口录入不触发翻译窗口动作，浮窗隐藏或关闭后解绑', async () => {
  const app = await openWindows();
  const main = app.window('main');
  await app.host.send('open-translate');
  await app.host.send('open-settings');
  await app.press('id:settings-shortcuts');
  const saved = app.storage();
  await app.press('id:shortcut-toggle-translate-input');
  await app.keyboard.press('cmd+,');
  expect(app.shows('text:此快捷键已用于其他动作，请选择其他组合。')).toBe(true);
  expect(app.storage()).toEqual(saved);
  await app.keyboard.press('escape');

  await main.pressClose();
  await app.host.send('hide-translate');
  await app.keyboard.press('cmd+,');
  expect(main.state()).toMatchObject({ visible: false });

  await app.host.send('open-translate');
  await app.window('translate').pressClose();
  await app.keyboard.press('cmd+,');
  expect(main.state()).toMatchObject({ visible: false });

  await app.host.send('open-translate');
  await app.keyboard.press('cmd+,');
  expect(main.state()).toMatchObject({ visible: true, focused: true });
});

test('旧配置中打开设置的 Command + W 优先于隐藏，键位和开关只读', async () => {
  const storage = {
    'vadu.config': JSON.stringify(
      settingsDocument([
        { id: 'toggle-translate', keystroke: 'alt+k' },
        { id: 'open-settings', keystroke: 'cmd+w' },
        { id: 'pin-translate', keystroke: 'mod+p' },
      ]),
    ),
  };
  const app = await openWindows({ storage });
  await app.press('id:settings-shortcuts');
  expect(app.shows('id:shortcut-open-settings-input >> text:W')).toBe(true);
  for (const id of ['open-settings', 'pin-translate']) {
    for (const control of ['input', 'enabled']) {
      await expect(
        app.press(`id:shortcut-${id}-${control}`),
      ).rejects.toMatchObject({ code: 'ERR_NSH_TEST_DISABLED' });
    }
  }
  expect(app.storage()).toEqual(storage);

  await app.host.send('open-translate');
  await app.keyboard.press('cmd+,');
  expect(app.window('main').state()).toMatchObject({ focused: false });
  await app.keyboard.press('cmd+w');
  expect(app.window('main').state()).toMatchObject({
    visible: true,
    focused: true,
  });

  const reopened = await openWindows({ storage });
  expect(reopened.count('id:settings-shortcuts-page')).toBe(0);
  await reopened.window('main').pressClose();
  await reopened.host.send('open-translate');
  await reopened.keyboard.press('cmd+,');
  expect(reopened.window('main').state()).toMatchObject({ visible: false });
  await reopened.keyboard.press('cmd+w');
  expect(reopened.window('main').state()).toMatchObject({
    visible: true,
    focused: true,
  });
});

test('已关闭的局内项保持只读，不拦截窗口隐藏或置顶', async () => {
  const app = await openWindows({
    storage: {
      'vadu.config': JSON.stringify(
        settingsDocument([
          defaultShortcuts[0],
          { ...defaultShortcuts[1], keystroke: 'cmd+w', enabled: false },
          { ...defaultShortcuts[2], enabled: false },
        ]),
      ),
    },
  });
  await app.press('id:settings-shortcuts');
  expect(app.shows('id:shortcut-open-settings >> text:未启用')).toBe(true);
  expect(app.enabled('id:shortcut-open-settings-enabled')).toBe(false);
  await app.window('main').pressClose();
  await app.host.send('open-translate');
  await app.keyboard.press('cmd+p');
  expect(app.shows('label:固定窗口')).toBe(true);
  await app.keyboard.press('cmd+w');
  expect(app.window('translate').state()).toMatchObject({ visible: false });
  expect(app.window('main').state()).toMatchObject({ visible: false });
});

test('配置损坏时不偷偷启用默认局内绑定或覆盖配置', async () => {
  const storage = { 'vadu.config': '{' };
  const app = await openWindows({ storage });
  await app.window('main').pressClose();
  await app.host.send('open-translate');
  await app.keyboard.press('cmd+,');
  expect(app.window('main').state()).toMatchObject({ visible: false });
  expect(app.storage()).toEqual(storage);
});
