import { expect, open, test } from 'nsh/test';

import { provider, providerStorage } from './fixtures/provider-config';

const viewport = { width: 480, height: 320, platform: 'macos' } as const;

test('翻译窗口保留截图分区，原文编辑不触发翻译', async () => {
  const app = await open('./fixtures/Translate.tsx', viewport);

  expect(app.shows('label:翻译工作台')).toBe(true);
  expect(app.shows('id:translation-toolbar')).toBe(true);
  expect(app.shows('id:translation-source-panel')).toBe(true);
  expect(app.shows('id:translation-result >> text:翻译结果')).toBe(true);
  expect(app.shows('text:简体中文')).toBe(true);
  expect(app.shows('text:请在设置中启用服务商并保存模型。')).toBe(true);
  expect(app.enabled('label:目标语言')).toBe(true);
  expect(app.enabled('label:固定窗口')).toBe(true);
  expect(app.enabled('label:打开设置')).toBe(true);
  for (const label of [
    '朗读原文',
    '复制原文',
    '清空原文',
    '翻译服务商',
    '翻译',
  ]) {
    expect(app.shows('label:' + label)).toBe(true);
    expect(app.enabled('label:' + label)).toBe(false);
  }

  await app.type('id:translation-source-input', 'a\n待翻译的文本');
  expect(app.value('id:translation-source-input')).toBe('a\n待翻译的文本');
  expect(app.shows('id:translation-result >> text:翻译结果')).toBe(true);
  expect(app.requests()).toEqual([]);
  expect(app.storage()).toEqual({});
});

test('浮窗仅列出已启用、已设模型且协议已接入的配置，必须手动选择', async () => {
  const app = await open('./fixtures/Translate.tsx', {
    ...viewport,
    storage: providerStorage(
      provider('ready', '本轮服务'),
      provider('disabled', '停用配置', { enabled: false }),
      provider('no-model', '还没选模型', { model: '' }),
      provider('future', 'Responses 配置', { protocol: 'responses' }),
    ),
  });
  await app.type('id:translation-source-input', '待翻译');
  expect(app.enabled('id:translation-submit')).toBe(false);
  await app.press('id:translation-provider');
  expect(app.texts().filter((text) => text.endsWith(' · demo-model'))).toEqual([
    '本轮服务 · demo-model',
  ]);
  await app.press('text:本轮服务 · demo-model');
  expect(app.enabled('id:translation-submit')).toBe(true);
});

test('有原文时可完整复制并清空，空白时工具置灰禁用', async () => {
  const app = await open('./fixtures/Translate.tsx', {
    ...viewport,
    clipboard: '原剪贴板内容',
  });
  const input = 'id:translation-source-input';
  const copy = 'label:复制原文';
  const clear = 'label:清空原文';
  const read = 'label:朗读原文';
  const tools = [read, copy, clear];

  await app.type(input, ' ');
  for (const tool of tools) {
    expect(app.viewStyle(tool)?.opacity).toBeLessThan(1);
    expect(app.enabled(tool)).toBe(false);
  }
  const original = ' 第一行\n第二行 ';
  await app.type(input, '第一行\n第二行 ');
  for (const tool of tools) {
    expect(app.viewStyle(tool)?.opacity).toBe(1);
  }

  expect(app.enabled(read)).toBe(false);
  expect(app.enabled(copy)).toBe(true);
  expect(app.enabled(clear)).toBe(true);
  await app.press(copy);
  await app.waitUntil(() => app.clipboard() === original);
  expect(app.value(input)).toBe(original);

  await app.press(clear);
  expect(app.value(input)).toBe('');
  expect(app.clipboard()).toBe(original);
  for (const tool of tools) {
    expect(app.viewStyle(tool)?.opacity).toBeLessThan(1);
    expect(app.enabled(tool)).toBe(false);
  }
  await app.keyboard.press('a');
  expect(app.value(input)).toBe('a');
});

test('原文工具在深浅主题中都有可见的悬停背景', async () => {
  const app = await open('./fixtures/Translate.tsx', viewport);
  const input = 'id:translation-source-input';
  const panel = 'id:translation-source-panel';
  await app.type(input, '原文');

  for (const colorScheme of ['light', 'dark'] as const) {
    await app.setColorScheme(colorScheme);
    const panelBackground = app.viewStyle(panel)?.backgroundColor;
    for (const tool of ['label:复制原文', 'label:清空原文']) {
      const idleBackground = app.viewStyle(tool)?.backgroundColor;
      await app.hover(tool);
      const hoverBackground = app.viewStyle(tool)?.backgroundColor;
      expect(hoverBackground).toBeTruthy();
      expect(hoverBackground).not.toBe(panelBackground);
      expect(hoverBackground).not.toBe(idleBackground);
      await app.hover(input);
      expect(app.viewStyle(tool)?.backgroundColor).toBe(idleBackground);
    }
  }
});

test('翻译窗口使用语义配色，跟随系统切换深浅主题', async () => {
  const app = await open('./fixtures/Translate.tsx', {
    ...viewport,
    colorScheme: 'light',
  });

  expect(app.spanStyle('text:简体中文').color).toBe('#0a0a0aff');
  expect(app.spanStyle('id:translation-submit >> text:翻译').color).toBe(
    '#ffffffff',
  );
  expect(app.spanStyle('text:翻译结果').color).toBe('#737373ff');
  await app.setColorScheme('dark');
  expect(app.spanStyle('text:简体中文').color).toBe('#fafafaff');
  expect(app.spanStyle('id:translation-submit >> text:翻译').color).toBe(
    '#0a0a0aff',
  );
  expect(app.spanStyle('text:翻译结果').color).toBe('#a1a1a1ff');
});

test('翻译窗口缩放后保留输入、操作行与结果分区', async () => {
  const app = await open('./fixtures/Translate.tsx', viewport);
  await app.type('id:translation-source-input', '草稿');

  for (const [width, height] of [
    [320, 320],
    [640, 480],
    [480, 320],
  ]) {
    await app.setViewport(width, height);
    expect(app.shows('id:translation-language')).toBe(true);
    expect(app.shows('id:translation-submit')).toBe(true);
    expect(app.shows('id:translation-result >> text:翻译结果')).toBe(true);
    expect(app.value('id:translation-source-input')).toBe('草稿');
  }
});
