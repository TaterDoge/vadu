import { type App, expect, open, test } from 'nsh/test';

import { settingsDocument } from './fixtures/settings-config';

function status(app: App) {
  const text = app.texts().find((text) => text.startsWith('主题状态 '));
  expect(text).toBeDefined();
  return JSON.parse(text!.slice('主题状态 '.length));
}

const viewport = { width: 960, height: 900, platform: 'macos' } as const;

test('外观保存后重开，在进入外观页前应用已保存的主题', async () => {
  const app = await open('./fixtures/Theme.tsx', viewport);
  await app.press('id:settings-appearance');
  await app.press('id:appearance-dark');
  await app.press('id:accent-blue');
  await app.press('id:style-lyra');
  const storage = app.storage();
  const appearance = { mode: 'dark', accent: 'blue', style: 'lyra' };
  expect(JSON.parse(storage['vadu.config']).settings.appearance).toEqual(
    appearance,
  );

  const reopened = await open('./fixtures/Theme.tsx', {
    ...viewport,
    storage,
    colorScheme: 'light',
  });
  expect(status(reopened)).toMatchObject({
    ...appearance,
    scheme: 'dark',
    font: 'JetBrains Mono',
  });
  expect(status(reopened).primary).toBe(status(reopened).blue);
  expect(reopened.storage()).toEqual(storage);
});

test('外观保存失败时显示错误，保留原主题与配置，下一次保存可重试', async () => {
  let saved = JSON.stringify(settingsDocument());
  const original = saved;
  let fail = true;
  const app = await open('./fixtures/Theme.tsx', {
    ...viewport,
    modules: {
      nsh: {
        'Storage.getItem': () => saved,
        'Storage.setItem': (_key: string, value: string) => {
          if (fail) {
            fail = false;
            throw new Error('private failure detail');
          }
          saved = value;
        },
      },
    },
  });
  await app.press('id:settings-appearance');
  await app.press('id:accent-blue');
  expect(app.shows('text:无法访问配置，请稍后重试。')).toBe(true);
  expect(status(app).accent).toBe('neutral');
  expect(saved).toBe(original);
  await app.press('id:accent-blue');
  expect(status(app).accent).toBe('blue');
  expect(JSON.parse(saved).settings.appearance.accent).toBe('blue');
});

test('坏配置禁用外观编辑并保留原文档', async () => {
  const storage = { 'vadu.config': '{' };
  const app = await open('./fixtures/Theme.tsx', { ...viewport, storage });
  await app.press('id:settings-appearance');
  expect(app.enabled('id:appearance-dark')).toBe(false);
  expect(app.shows('text:配置格式损坏或不受支持，原配置已保留，未覆盖。')).toBe(
    true,
  );
  expect(app.storage()).toEqual(storage);
});

test('主题默认跟随系统，手动选择优先，切回系统后继续响应', async () => {
  const app = await open('./fixtures/Theme.tsx', {
    ...viewport,
    colorScheme: 'dark',
  });
  await app.press('id:settings-appearance');
  expect(status(app)).toMatchObject({
    mode: 'system',
    scheme: 'dark',
    accent: 'neutral',
    style: 'nova',
  });
  expect(app.spanStyle('text:Aa 0123456789 · 你好').color).toBe('#fafafaff');

  await app.setColorScheme('light');
  expect(status(app).scheme).toBe('light');
  expect(app.spanStyle('text:Aa 0123456789 · 你好').color).toBe('#0a0a0aff');
  await app.press('id:appearance-dark');
  await app.setColorScheme('dark');
  await app.setColorScheme('light');
  expect(status(app)).toMatchObject({ mode: 'dark', scheme: 'dark' });

  await app.press('id:appearance-light');
  await app.setColorScheme('dark');
  expect(status(app)).toMatchObject({ mode: 'light', scheme: 'light' });
  await app.press('id:appearance-system');
  expect(status(app)).toMatchObject({ mode: 'system', scheme: 'dark' });
  await app.setColorScheme('light');
  expect(status(app).scheme).toBe('light');
});

test('六种强调色使用主题色值，深浅前景可读，恢复中性不残留覆盖', async () => {
  const app = await open('./fixtures/Theme.tsx', viewport);
  await app.press('id:settings-appearance');

  for (const scheme of ['light', 'dark'] as const) {
    await app.setColorScheme(scheme);
    const neutral = status(app);
    for (const accent of ['blue', 'emerald', 'amber', 'rose', 'violet']) {
      await app.press('id:accent-' + accent);
      const selected = status(app);
      expect(selected.primary).toBe(selected[accent]);
      expect(selected.sidebarPrimary).toBe(selected.primary);
      expect(selected.sidebarForeground).toBe(selected.primaryForeground);
      expect(selected.border).toBe(neutral.border);
      expect(selected.neutral).toBe(neutral.primary);
      expect(app.spanStyle('text:强调色预览').color).toBe(
        accent === 'amber' || scheme === 'dark' ? '#0a0a0aff' : '#fafafaff',
      );
    }
    await app.press('id:accent-neutral');
    expect(status(app)).toMatchObject({
      primary: neutral.primary,
      primaryForeground: neutral.primaryForeground,
      sidebarPrimary: neutral.sidebarPrimary,
      sidebarForeground: neutral.sidebarForeground,
    });
  }
});

test('Nova 与 Lyra 切换字体但保持内置字号，导航卸载后保留并可恢复', async () => {
  const app = await open('./fixtures/Theme.tsx', viewport);
  await app.press('id:settings-appearance');
  expect(status(app)).toMatchObject({
    font: 'Geist Mono',
    keyFont: 'Lucida Grande',
  });
  expect(app.spanStyle('text:Aa 0123456789 · 你好').fontSize).toBe(20);
  expect(app.spanStyle('text:强调色预览').fontSize).toBe(14);

  await app.press('id:accent-amber');
  await app.press('id:style-lyra');
  expect(status(app)).toMatchObject({
    style: 'lyra',
    accent: 'amber',
    font: 'JetBrains Mono',
    keyFont: 'Lucida Grande',
  });
  expect(app.spanStyle('text:Aa 0123456789 · 你好').fontSize).toBe(20);
  expect(app.spanStyle('text:强调色预览').fontSize).toBe(14);
  await app.press('id:settings-shortcuts');
  expect(app.spanStyle('text:全局快捷键').fontSize).toBe(14);
  expect(app.spanStyle('text:唤起翻译浮窗').fontSize).toBe(14);
  expect(app.spanStyle('id:shortcut-open-settings >> text:⌘').fontSize).toBe(
    12,
  );
  await app.press('id:settings-appearance');
  expect(status(app).style).toBe('lyra');

  await app.press('id:style-nova');
  expect(status(app)).toMatchObject({
    style: 'nova',
    accent: 'amber',
    font: 'Geist Mono',
    keyFont: 'Lucida Grande',
  });
  expect(app.spanStyle('text:强调色预览').fontSize).toBe(14);
});

test('外观单选组支持方向键，翻译窗口打开期间共享主题且重开不重置', async () => {
  const app = await open('./fixtures/Theme.tsx', viewport);
  for (let index = 0; index < 3; index++) await app.keyboard.press('tab');
  await app.keyboard.press('enter');
  for (let index = 0; index < 3; index++) await app.keyboard.press('tab');
  await app.keyboard.press('right');
  expect(status(app).mode).toBe('light');
  await app.keyboard.press('right');
  expect(status(app).mode).toBe('dark');

  await app.press('id:open-translate');
  expect(app.window('translate').state()).not.toBeNull();
  await app.press('id:accent-blue');
  await app.press('id:style-lyra');
  expect(status(app)).toMatchObject({
    mode: 'dark',
    accent: 'blue',
    style: 'lyra',
  });
  await app.window('translate').pressClose();
  await app.press('id:open-translate');
  expect(app.window('translate').state()).not.toBeNull();
  expect(status(app)).toMatchObject({
    mode: 'dark',
    accent: 'blue',
    style: 'lyra',
  });
});
