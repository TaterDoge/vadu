import { type App, expect, open, type OpenOptions, test } from 'nsh/test';

import { defaultShortcuts, settingsDocument } from './fixtures/settings-config';

const input = 'id:shortcut-toggle-translate-input';
const reset = 'label:重置唤起翻译浮窗快捷键';
const enabled = 'id:shortcut-toggle-translate-enabled';
const savedStroke = 'alt+m';
const savedConfig = settingsDocument([
  { ...defaultShortcuts[0], keystroke: savedStroke },
  ...defaultShortcuts.slice(1),
]);
const savedStorage = { 'vadu.config': JSON.stringify(savedConfig) };

function openFixture(options: OpenOptions = {}) {
  return open('./fixtures/Shortcuts.tsx', {
    width: 1200,
    height: 900,
    platform: 'macos',
    host: {},
    storage: savedStorage,
    ...options,
  });
}

function events(app: App): string[] {
  const text = app.texts().find((text) => text.startsWith('注册记录 '));
  if (!text) throw new Error('未找到快捷键注册记录');
  return JSON.parse(text.slice('注册记录 '.length));
}

async function pressShortcut(app: App, keystroke = savedStroke) {
  await app.host.send('press-shortcut', keystroke);
}

test('首次启动和切换空键位的开关都不注册系统热键', async () => {
  const app = await openFixture({ storage: {} });
  expect(JSON.parse(app.storage()['vadu.config'])).toEqual(settingsDocument());
  await app.press('id:settings-shortcuts');
  expect(app.shows('text:快捷键状态 未绑定')).toBe(true);
  await app.press(enabled);
  expect(app.shows('text:快捷键状态 已关闭')).toBe(true);
  await app.press(enabled);
  expect(app.shows('text:快捷键状态 未绑定')).toBe(true);
  expect(events(app)).toEqual([]);
});

test('关闭立即注销，重启保持关闭，重新开启沿用保存的组合', async () => {
  const app = await openFixture();
  await app.press('id:settings-shortcuts');
  await app.press(enabled);
  expect(events(app)).toEqual([
    `register:${savedStroke}`,
    `unregister:${savedStroke}`,
  ]);
  await app.host.send('press-stale-shortcut');
  expect(app.window('translate').state()).toBeNull();
  const reopened = await openFixture({ storage: app.storage() });
  expect(events(reopened)).toEqual([]);
  await reopened.press('id:settings-shortcuts');
  expect(reopened.shows('text:快捷键状态 已关闭')).toBe(true);
  await reopened.press(enabled);
  expect(events(reopened)).toEqual([`register:${savedStroke}`]);
  await pressShortcut(reopened);
  expect(reopened.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });
});

test('启动即注册已保存的组合，重复唤起、最小化恢复、关闭重开，主窗口隐藏后仍生效', async () => {
  const app = await openFixture();
  expect(events(app)).toEqual([`register:${savedStroke}`]);
  expect(app.shows('text:快捷键状态 已启用')).toBe(true);
  expect(app.window('translate').state()).toBeNull();
  expect(JSON.parse(app.storage()['vadu.config'])).toEqual(savedConfig);

  await app.window('main').pressClose();
  expect(app.window('main').state()).toMatchObject({ visible: false });
  await pressShortcut(app);
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });
  await pressShortcut(app);
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });

  await app.host.send('minimize-translate');
  expect(app.window('translate').state()).toMatchObject({ minimized: true });
  await pressShortcut(app);
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
    minimized: false,
  });
  await app.window('translate').pressClose();
  expect(app.window('translate').state()).toBeNull();
  await pressShortcut(app);
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });
});

test('⌘P 与图钉共用置顶状态，失焦保留，取消后失焦隐藏', async () => {
  const app = await openFixture();
  const translate = app.window('translate');
  await pressShortcut(app);
  await app.keyboard.press('cmd+p');
  expect(app.shows('text:窗口更新 {"level":"aboveDock"}')).toBe(true);
  expect(app.shows('label:取消固定窗口')).toBe(true);
  await app.host.send('focus-settings');
  expect(translate.state()).toMatchObject({ visible: true, focused: false });
  await app.keyboard.press('cmd+p');
  await pressShortcut(app);
  await app.press('label:取消固定窗口');
  expect(app.shows('text:窗口更新 {"level":"normal"}')).toBe(true);
  await app.host.send('focus-settings');
  expect(translate.state()).toMatchObject({ visible: false });

  await pressShortcut(app);
  await app.press('label:固定窗口');
  expect(app.shows('text:窗口更新 {"level":"aboveDock"}')).toBe(true);
  await app.keyboard.press('cmd+p');
  expect(app.shows('text:窗口更新 {"level":"normal"}')).toBe(true);
  await app.press('label:固定窗口');
  await app.host.send('close-translate');
  await app.waitUntil(() => translate.state() === null);
  await pressShortcut(app);
  expect(app.shows('label:固定窗口')).toBe(true);
});

test('全局快捷键唤起无边框翻译窗，隐藏不改变设置窗可见性', async () => {
  const app = await openFixture();

  await pressShortcut(app);
  await app.waitUntil(() => app.window('translate').state()?.focused === true);
  expect(app.shows('id:translation-workspace')).toBe(true);
  const text = app.texts().find((text) => text.startsWith('窗口参数 '));
  const options = JSON.parse(text?.slice('窗口参数 '.length) ?? 'null');
  expect(options?.level ?? 'normal').toBe('normal');
  expect(options).toMatchObject({
    id: 'translate',
    title: 'vadu 翻译',
    frame: 'none',
    transparent: true,
    workspaces: 'all',
  });
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });
  expect(app.window('main').state()).toMatchObject({
    visible: true,
    focused: false,
  });

  await app.host.send('focus-settings');
  expect(app.window('translate').state()).toMatchObject({ visible: false });
  expect(app.window('main').state()).toMatchObject({ visible: true });
  await app.host.send('hide-settings');

  await pressShortcut(app);
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });
  expect(app.window('main').state()).toMatchObject({
    visible: false,
    focused: false,
  });
});

test('翻译浮窗失焦时自动隐藏，快捷键恢复草稿，重复唤起保持显示', async () => {
  const app = await openFixture();
  const translate = app.window('translate');
  await pressShortcut(app);
  await app.type('id:translation-source-input', '草稿');
  await app.host.send('focus-settings');
  expect(translate.state()).toMatchObject({ visible: false, focused: false });

  await pressShortcut(app);
  expect(translate.state()).toMatchObject({ visible: true, focused: true });
  expect(app.value('id:translation-source-input')).toBe('草稿');
  await pressShortcut(app);
  expect(translate.state()).toMatchObject({ visible: true, focused: true });
});

test('录入暂停注册，保存后换绑，重置后释放组合', async () => {
  const app = await openFixture();
  await app.press('id:settings-shortcuts');
  expect(events(app)).toEqual([`register:${savedStroke}`]);
  await app.press(input);
  expect(app.shows('text:快捷键状态 录入期间已暂停')).toBe(true);
  await pressShortcut(app);
  expect(app.window('translate').state()).toBeNull();
  await app.keyboard.press('mod+shift+k');
  expect(events(app)).toEqual([
    `register:${savedStroke}`,
    `unregister:${savedStroke}`,
    'register:shift+mod+k',
  ]);
  expect(app.shows('text:快捷键状态 已启用')).toBe(true);
  await pressShortcut(app);
  expect(app.window('translate').state()).toBeNull();
  await pressShortcut(app, 'shift+mod+k');
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });

  await app.host.send('focus-settings');
  await app.press(reset);
  expect(events(app).at(-1)).toBe('unregister:shift+mod+k');
  expect(app.shows('text:快捷键状态 未绑定')).toBe(true);
  await pressShortcut(app, 'shift+mod+k');
  expect(app.window('translate').state()).toMatchObject({
    visible: false,
    focused: false,
  });
  await pressShortcut(app);
  expect(app.window('translate').state()).toMatchObject({ visible: false });
});

test('启动读取已保存组合，不等待打开快捷键页，更新其他配置不重复注册', async () => {
  const storage = {
    'vadu.config': JSON.stringify(
      settingsDocument([
        { ...defaultShortcuts[0], keystroke: 'alt+k' },
        ...defaultShortcuts.slice(1),
      ]),
    ),
  };
  const app = await openFixture({ storage });
  expect(events(app)).toEqual(['register:alt+k']);
  await app.host.send('update-appearance');
  expect(events(app)).toEqual(['register:alt+k']);
  await pressShortcut(app, 'alt+k');
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });
});

test('取消、切页、退后台恢复注册，卸载释放按键且过期回调无效', async () => {
  const app = await openFixture();
  await app.press('id:settings-shortcuts');
  await app.press(input);
  await app.keyboard.press('escape');
  expect(app.shows('text:快捷键状态 已启用')).toBe(true);
  await app.press(input);
  await app.press('id:settings-general');
  expect(app.shows('text:快捷键状态 已启用')).toBe(true);
  await app.press('id:settings-shortcuts');
  await app.press(input);
  expect(app.shows('text:快捷键状态 录入期间已暂停')).toBe(true);
  await app.setLifecycle('inactive');
  expect(app.shows('text:快捷键状态 已启用')).toBe(true);
  await app.setLifecycle('active');
  await app.host.send('unmount-settings');
  expect(events(app).at(-1)).toBe(`unregister:${savedStroke}`);
  await app.host.send('press-stale-shortcut');
  await pressShortcut(app);
  expect(app.window('translate').state()).toBeNull();
});

test('局内动作由统一管理器处理，录入期间暂停并恢复', async () => {
  const app = await openFixture();
  await app.host.send('hide-settings');
  await pressShortcut(app);
  await app.host.send('set-recording', true);
  await app.keyboard.press('cmd+,');
  expect(app.window('main').state()).toMatchObject({ visible: false });
  expect(app.window('translate').state()).toMatchObject({ focused: true });

  await app.host.send('set-recording', false);
  await app.keyboard.press('cmd+,');
  expect(app.window('main').state()).toMatchObject({
    visible: true,
    focused: true,
  });
});

test('统一管理器卸载释放局内绑定，重挂后绑定已打开的翻译窗', async () => {
  const app = await openFixture();
  await app.host.send('hide-settings');
  await pressShortcut(app);
  await app.host.send('unmount-settings');
  await app.keyboard.press('cmd+,');
  expect(app.window('main').state()).toMatchObject({ visible: false });
  expect(app.window('translate').state()).toMatchObject({
    visible: true,
    focused: true,
  });

  await app.host.send('mount-settings');
  await app.keyboard.press('cmd+,');
  expect(app.window('main').state()).toMatchObject({
    visible: true,
    focused: true,
  });
});

for (const registration of ['occupied', 'reject', 'throw']) {
  test(`系统注册失败明确提示且允许换键重试：${registration}`, async () => {
    const app = await openFixture({ host: { params: { registration } } });
    await app.press('id:settings-shortcuts');
    const message =
      registration === 'occupied'
        ? '注册失败：组合键可能已被占用，或当前平台不支持。请更换组合键。'
        : '注册失败，请重新录入快捷键后重试。';
    expect(app.shows('id:shortcut-toggle-translate-status')).toBe(true);
    expect(app.shows(`text:${message}`)).toBe(true);
    expect(JSON.parse(app.storage()['vadu.config'])).toEqual(savedConfig);
    await app.press(input);
    await app.keyboard.press('alt+k');
    expect(app.shows('text:快捷键状态 已启用')).toBe(true);
    await pressShortcut(app, 'alt+k');
    expect(app.window('translate').state()).toMatchObject({ visible: true });
  });
}

for (const registered of [true, false]) {
  test(`旧注册延迟返回 ${registered} 不覆盖新状态或复活旧回调`, async () => {
    const app = await openFixture({
      host: { params: { registration: 'delayed' } },
    });
    expect(app.shows('text:快捷键状态 正在注册…')).toBe(true);
    await app.press('id:settings-shortcuts');
    await app.press(input);
    await app.keyboard.press('alt+k');
    await app.host.send('resolve-first', registered);
    expect(app.shows('text:快捷键状态 已启用')).toBe(true);
    await app.host.send('press-stale-shortcut');
    expect(app.window('translate').state()).toBeNull();
    await pressShortcut(app, 'alt+k');
    expect(app.window('translate').state()).toMatchObject({ visible: true });
  });
}

for (const raw of ['{', '{"settings":{}}']) {
  test(`配置不可用时不注册默认键且不覆盖原数据：${raw}`, async () => {
    const storage = { 'vadu.config': raw };
    const app = await openFixture({ storage });
    expect(events(app)).toEqual([]);
    expect(app.storage()).toEqual(storage);
    expect(app.shows('text:快捷键状态 已启用')).toBe(false);
  });
}

test('保存失败保留原绑定，取消录入后重新注册原组合', async () => {
  const storage = savedStorage;
  const app = await openFixture({
    storage,
    modules: {
      nsh: {
        'Storage.setItem': () => {
          throw new Error('unavailable');
        },
      },
    },
  });
  await app.press('id:settings-shortcuts');
  await app.press(input);
  await app.keyboard.press('alt+k');
  expect(app.shows('text:无法访问配置，请稍后重试。')).toBe(true);
  expect(app.shows('text:快捷键状态 录入期间已暂停')).toBe(true);
  expect(app.storage()).toEqual(storage);
  await app.keyboard.press('escape');
  expect(events(app).at(-1)).toBe(`register:${savedStroke}`);
  await pressShortcut(app, 'alt+k');
  expect(app.window('translate').state()).toBeNull();
  await pressShortcut(app);
  expect(app.window('translate').state()).toMatchObject({ visible: true });
});
