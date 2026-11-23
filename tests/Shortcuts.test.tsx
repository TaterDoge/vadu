import { expect, open, type OpenOptions, test } from 'nsh/test';

const toggle = 'id:shortcut-toggle-translate-input';
const recordingTip =
  'text:需要包含 ⌘ / Ctrl / Alt 等修饰键，主键可用字母、数字、方向键或标点键等；F1–F24 也可单独使用。';
const reset = 'label:重置唤起翻译浮窗快捷键';

async function openShortcuts(options: OpenOptions = {}) {
  const app = await open('../App.tsx', {
    width: 1200,
    height: 800,
    platform: 'macos',
    ...options,
  });
  await app.press('id:settings-shortcuts');
  return app;
}

test('键帽悬停不录入，点击录入后保存完整配置，重开读取并可重置', async () => {
  const app = await openShortcuts();
  await app.hover(toggle);
  expect(app.shows(recordingTip)).toBe(false);
  expect(app.storage()).toEqual({});

  await app.press(toggle);
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('mod+shift+k');
  expect(app.shows(recordingTip)).toBe(false);
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(app.shows('id:shortcut-toast')).toBe(false);
  const storage = app.storage();
  expect(JSON.parse(storage['vadu.config'])).toEqual({
    schemaVersion: 3,
    profiles: [],
    settings: {
      shortcuts: [
        { id: 'toggle-translate', keystroke: 'shift+mod+k' },
        { id: 'open-settings', keystroke: 'mod+,' },
        { id: 'pin-translate', keystroke: 'mod+p' },
      ],
    },
  });

  const reopened = await openShortcuts({ storage });
  expect(reopened.shows(`${toggle} >> text:K`)).toBe(true);
  await reopened.press(reset);
  expect(reopened.shows(`${toggle} >> text:M`)).toBe(true);
  expect(
    JSON.parse(reopened.storage()['vadu.config']).settings.shortcuts[0],
  ).toEqual({
    id: 'toggle-translate',
    keystroke: 'shift+mod+m',
  });
});

test('重置反馈使用 Toast，重复重置刷新提示并自动关闭', async () => {
  const app = await openShortcuts({ clock: {} });
  const toast = 'id:shortcut-toast';
  await app.press(reset);
  expect(app.shows(`${toast} >> text:快捷键已恢复默认。`)).toBe(true);

  await app.wait(2000);
  await app.press(reset);
  expect(app.count(toast)).toBe(1);
  await app.wait(2000);
  expect(app.shows(toast)).toBe(true);
  await app.wait(2000);
  expect(app.shows(toast)).toBe(false);

  await app.press(reset);
  await app.press(toggle);
  await app.keyboard.press('escape');
  expect(app.shows(recordingTip)).toBe(false);
  await app.press('id:settings-general');
  await app.wait(4000);
  await app.press('id:settings-shortcuts');
  expect(app.shows(toast)).toBe(false);
});

test('重置 Toast 悬停暂停计时并可滑动关闭', async () => {
  const app = await openShortcuts({ clock: {} });
  const toast = 'id:shortcut-toast';
  await app.press(reset);
  await app.wait(500);
  await app.hover(toast);
  await app.wait(4000);
  expect(app.shows(toast)).toBe(true);
  await app.hover(toggle);
  await app.wait(4000);
  expect(app.shows(toast)).toBe(false);

  await app.press(reset);
  await app.wait(500);
  await app.drag(toast, { x: 100 });
  await app.wait(300);
  expect(app.shows(toast)).toBe(false);
});

test('键盘可用 Enter 或 Space 开始录入，并保存功能键', async () => {
  const app = await openShortcuts();
  await app.press(toggle);
  await app.keyboard.press('escape');
  await app.keyboard.press('shift+tab');
  await app.keyboard.press('tab');
  await app.keyboard.press('enter');
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('escape');
  await app.keyboard.press('space');
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('f12');
  expect(app.shows(`${toggle} >> text:F12`)).toBe(true);
  expect(
    JSON.parse(app.storage()['vadu.config']).settings.shortcuts[0].keystroke,
  ).toBe('f12');
});

test('录制成功退出焦点，按 Enter 不会重新录入，再次点击仍可录入', async () => {
  const app = await openShortcuts();
  await app.hover(toggle);
  await app.press(toggle);
  await app.keyboard.press('mod+shift+l');
  expect(app.shows(`${toggle} >> text:L`)).toBe(true);
  expect(app.shows(recordingTip)).toBe(false);
  const saved = app.storage();

  await app.keyboard.press('enter');
  expect(app.shows(recordingTip)).toBe(false);
  await app.keyboard.press('alt+k');
  expect(app.storage()).toEqual(saved);

  await app.press(toggle);
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('alt+k');
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(app.shows(recordingTip)).toBe(false);
});

test('录制提示独立于设置项，再次点击键帽取消录入且保留原绑定', async () => {
  const app = await openShortcuts();
  await app.press(toggle);
  expect(
    app.shows(`id:shortcut-toggle-translate-tips >> ${recordingTip}`),
  ).toBe(true);
  expect(app.shows(`id:shortcut-toggle-translate >> ${recordingTip}`)).toBe(
    false,
  );
  await app.press(`${toggle} >> text:请按下快捷键…`);
  expect(app.shows(recordingTip)).toBe(false);
  expect(app.shows(`${toggle} >> text:请按下快捷键…`)).toBe(false);
  expect(app.shows(`${toggle} >> text:M`)).toBe(true);
  await app.keyboard.press('alt+k');
  expect(app.storage()).toEqual({});
  expect(app.shows(`${toggle} >> text:M`)).toBe(true);

  await app.press(toggle);
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('alt+k');
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(app.shows('id:shortcut-toggle-translate-tips')).toBe(false);
});

test('失焦取消后返回原键帽仍能重新录入', async () => {
  const app = await openShortcuts();
  await app.press(toggle);
  await app.press('id:shortcut-open-settings-input');
  await app.press(toggle);
  expect(app.shows(`${toggle} >> text:请按下快捷键…`)).toBe(true);
  expect(app.shows('id:shortcut-open-settings-input >> text:,')).toBe(true);
  await app.keyboard.press('alt+k');
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(
    JSON.parse(app.storage()['vadu.config']).settings.shortcuts[0].keystroke,
  ).toBe('alt+k');
});

test('冲突或裸字母不保存，保持录入并允许重新输入', async () => {
  const app = await openShortcuts({ clock: {} });
  const toast = 'id:shortcut-toast';
  await app.press(toggle);
  await app.keyboard.press('mod+p');
  expect(
    app.shows(`${toast} >> text:此快捷键已用于其他动作，请选择其他组合。`),
  ).toBe(true);
  expect(app.shows(recordingTip)).toBe(true);
  expect(app.storage()).toEqual({});
  await app.wait(4000);
  expect(app.shows(toast)).toBe(true);
  await app.keyboard.press('k');
  expect(
    app.shows(
      `${toast} >> text:请按 Command / Ctrl / Alt 与其他键的组合，或 F1–F24。`,
    ),
  ).toBe(true);
  expect(app.storage()).toEqual({});
  await app.keyboard.press('alt+k');
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(app.shows(recordingTip)).toBe(false);
  await app.wait(500);
  expect(app.shows(toast)).toBe(false);
});

test('取消录入清除错误，但不清除重置成功提示', async () => {
  const app = await openShortcuts({ clock: {} });
  const toast = 'id:shortcut-toast';
  await app.press(reset);
  await app.press(toggle);
  await app.keyboard.press('escape');
  expect(app.shows(`${toast} >> text:快捷键已恢复默认。`)).toBe(true);

  await app.press(toggle);
  await app.keyboard.press('mod+p');
  expect(
    app.shows(`${toast} >> text:此快捷键已用于其他动作，请选择其他组合。`),
  ).toBe(true);
  await app.keyboard.press('escape');
  await app.wait(500);
  expect(app.shows(toast)).toBe(false);
});

for (const key of ['escape', 'tab', 'shift+tab']) {
  test(`${key} 取消录入并清理临时键表`, async () => {
    const app = await openShortcuts();
    await app.press(toggle);
    await app.keyboard.press(key);
    expect(app.shows(recordingTip)).toBe(false);
    await app.keyboard.press('mod+shift+k');
    expect(app.storage()).toEqual({});
    expect(app.shows(`${toggle} >> text:M`)).toBe(true);
  });
}

test('切换录入目标后旧目标失焦，切页与退后台清理键表', async () => {
  const app = await openShortcuts();
  await app.press(toggle);
  await app.press('id:shortcut-open-settings-input');
  expect(app.shows(`${toggle} >> text:M`)).toBe(true);
  await app.keyboard.press('alt+k');
  expect(app.shows('id:shortcut-open-settings-input >> text:K')).toBe(true);
  expect(app.shows(`${toggle} >> text:M`)).toBe(true);
  const saved = app.storage();

  await app.press(toggle);
  await app.press('id:settings-general');
  await app.keyboard.press('mod+shift+k');
  expect(app.storage()).toEqual(saved);
  await app.press('id:settings-shortcuts');
  expect(app.shows(recordingTip)).toBe(false);
  await app.press(toggle);
  await app.setLifecycle('inactive');
  await app.setLifecycle('active');
  expect(app.shows(recordingTip)).toBe(false);
  await app.keyboard.press('mod+shift+k');
  expect(app.storage()).toEqual(saved);
});

test('恢复默认遇到冲突也保留原配置', async () => {
  const app = await openShortcuts();
  await app.press(toggle);
  await app.keyboard.press('alt+k');
  await app.press('id:shortcut-open-settings-input');
  await app.keyboard.press('mod+shift+m');
  const saved = app.storage();
  await app.press(reset);
  expect(
    app.shows(
      'id:shortcut-toast >> text:此快捷键已用于其他动作，请选择其他组合。',
    ),
  ).toBe(true);
  expect(app.shows('text:快捷键已恢复默认。')).toBe(false);
  expect(app.storage()).toEqual(saved);
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
});

for (const raw of ['{', '{"schemaVersion":999,"settings":{}}']) {
  test(`损坏或新版本配置不被覆盖：${raw}`, async () => {
    const storage = { 'vadu.config': raw };
    const app = await openShortcuts({ storage, clock: {} });
    expect(app.enabled(toggle)).toBe(false);
    expect(app.enabled(reset)).toBe(false);
    await app.wait(4000);
    const error =
      raw === '{'
        ? '配置格式损坏或不受支持，原配置已保留，未覆盖。'
        : '配置版本不受支持，请使用对应版本的应用；原配置未覆盖。';
    expect(app.shows(`id:shortcut-toast >> text:${error}`)).toBe(true);
    await app.drag('id:shortcut-toast', { x: 100 });
    await app.wait(500);
    expect(app.shows('id:shortcut-toast')).toBe(false);
    expect(app.storage()).toEqual(storage);
  });
}

test('存储配额不足时保留旧配置与键帽，不显示保存成功', async () => {
  const storage = { padding: 'x'.repeat(5 * 1024 * 1024 - 'padding'.length) };
  const app = await openShortcuts({ storage });
  await app.press(toggle);
  await app.keyboard.press('mod+shift+k');
  expect(app.shows('text:配置存储空间不足，修改未保存。')).toBe(true);
  expect(app.storage()).toEqual(storage);
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('escape');
  expect(app.shows(`${toggle} >> text:M`)).toBe(true);
});

test('Windows 录入 Ctrl 组合并以可移植 mod 保存', async () => {
  const app = await openShortcuts({ platform: 'windows' });
  expect(app.shows(`${toggle} >> text:Ctrl`)).toBe(true);
  await app.press(toggle);
  await app.keyboard.press('ctrl+shift+k');
  expect(app.shows(`${toggle} >> text:Ctrl`)).toBe(true);
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(
    JSON.parse(app.storage()['vadu.config']).settings.shortcuts[0].keystroke,
  ).toBe('mod+shift+k');
});
