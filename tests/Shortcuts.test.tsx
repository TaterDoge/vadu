import { expect, open, type OpenOptions, test } from 'nsh/test';

import { defaultShortcuts, settingsDocument } from './fixtures/settings-config';

const toggle = 'id:shortcut-toggle-translate-input';
const recordingTip =
  'text:需要包含 ⌘ / Ctrl / Alt 等修饰键，主键可用字母、数字、方向键或标点键等；F1–F24 也可单独使用。';
const reset = 'label:重置唤起翻译浮窗快捷键';
const enabled = 'id:shortcut-toggle-translate-enabled';
const emptyInput = `${toggle} >> text:点击录入`;

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

test('首次打开全局键位为空，录入后重开读取自定义组合，重置后清空', async () => {
  const app = await openShortcuts();
  expect(JSON.parse(app.storage()['vadu.config'] ?? 'null')).toEqual(
    settingsDocument(),
  );
  expect(app.shows(emptyInput)).toBe(true);
  const promptBackground = app.viewStyle(toggle)?.backgroundColor;
  expect(promptBackground).toBeTruthy();
  expect(app.shows('id:shortcut-open-settings-input >> text:,')).toBe(true);
  expect(app.shows('id:shortcut-pin-translate-input >> text:P')).toBe(true);
  await app.hover(toggle);
  expect(app.shows(recordingTip)).toBe(false);

  await app.press(toggle);
  expect(app.shows(recordingTip)).toBe(true);
  expect(app.viewStyle(toggle)?.backgroundColor).toBe(promptBackground);
  await app.keyboard.press('mod+shift+k');
  expect(app.shows(recordingTip)).toBe(false);
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(app.viewStyle(toggle)?.backgroundColor).not.toBe(promptBackground);
  expect(app.shows('id:shortcut-toast')).toBe(false);
  const storage = app.storage();
  expect(JSON.parse(storage['vadu.config'])).toEqual(
    settingsDocument([
      { ...defaultShortcuts[0], keystroke: 'shift+mod+k' },
      ...defaultShortcuts.slice(1),
    ]),
  );

  const reopened = await openShortcuts({ storage });
  expect(reopened.shows(`${toggle} >> text:K`)).toBe(true);
  await reopened.press(reset);
  expect(reopened.shows(emptyInput)).toBe(true);
  expect(reopened.viewStyle(toggle)?.backgroundColor).toBe(promptBackground);
  expect(JSON.parse(reopened.storage()['vadu.config'])).toEqual(
    settingsDocument(),
  );
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
  await app.keyboard.press('tab');
  expect(app.shows(recordingTip)).toBe(false);
  await app.keyboard.press('shift+tab');
  await app.keyboard.press('enter');
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('shift+tab');
  expect(app.shows(recordingTip)).toBe(false);
  await app.keyboard.press('tab');
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
  const saved = app.storage();
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
  expect(app.shows(emptyInput)).toBe(true);
  await app.keyboard.press('alt+k');
  expect(app.storage()).toEqual(saved);
  expect(app.shows(emptyInput)).toBe(true);

  await app.press(toggle);
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('alt+k');
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(app.shows('id:shortcut-toggle-translate-tips')).toBe(false);
});

test('点击全局开关退出录入，返回原键帽仍能重新录入', async () => {
  const app = await openShortcuts();
  await app.press(toggle);
  await app.press(enabled);
  expect(app.shows(recordingTip)).toBe(false);
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
  const saved = app.storage();
  const toast = 'id:shortcut-toast';
  await app.press(toggle);
  await app.keyboard.press('mod+p');
  expect(
    app.shows(`${toast} >> text:此快捷键已用于其他动作，请选择其他组合。`),
  ).toBe(true);
  expect(app.shows(recordingTip)).toBe(true);
  expect(app.storage()).toEqual(saved);
  await app.wait(4000);
  expect(app.shows(toast)).toBe(true);
  await app.keyboard.press('k');
  expect(
    app.shows(
      `${toast} >> text:请按 Command / Ctrl / Alt 与其他键的组合，或 F1–F24。`,
    ),
  ).toBe(true);
  expect(app.storage()).toEqual(saved);
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

test('Esc 取消录入后释放焦点，按 Enter 不会重新录入', async () => {
  const app = await openShortcuts();
  await app.press(toggle);
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('escape');
  expect(app.shows(recordingTip)).toBe(false);
  await app.keyboard.press('enter');
  expect(app.shows(recordingTip)).toBe(false);
  await app.press(toggle);
  expect(app.shows(recordingTip)).toBe(true);
});

for (const key of ['escape', 'tab', 'shift+tab']) {
  test(`${key} 取消录入并清理临时键表`, async () => {
    const app = await openShortcuts();
    const saved = app.storage();
    await app.press(toggle);
    await app.keyboard.press(key);
    expect(app.shows(recordingTip)).toBe(false);
    await app.keyboard.press('mod+shift+k');
    expect(app.storage()).toEqual(saved);
    expect(app.shows(emptyInput)).toBe(true);
  });
}

test('切页与退后台清理录入键表', async () => {
  const app = await openShortcuts();
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

test('关闭时可预设键位，开启遇冲突保持关闭，恢复默认只清空键位', async () => {
  const app = await openShortcuts();
  await app.press(enabled);
  await app.press(toggle);
  await app.keyboard.press('mod+,');
  const saved = app.storage();
  await app.press(enabled);
  expect(
    app.shows(
      'id:shortcut-toast >> text:此快捷键已用于其他动作，请选择其他组合。',
    ),
  ).toBe(true);
  expect(app.storage()).toEqual(saved);
  expect(app.shows('id:shortcut-toggle-translate >> text:已关闭')).toBe(true);
  await app.press(reset);
  expect(app.shows(emptyInput)).toBe(true);
  expect(
    JSON.parse(app.storage()['vadu.config']).settings.shortcuts[0],
  ).toEqual({ ...defaultShortcuts[0], enabled: false });
});

for (const raw of ['{', '{"settings":{}}']) {
  test(`配置格式无效时禁用快捷键编辑并保留原值：${raw}`, async () => {
    const storage = { 'vadu.config': raw };
    const app = await openShortcuts({ storage, clock: {} });
    expect(app.enabled(toggle)).toBe(false);
    expect(app.enabled(reset)).toBe(false);
    expect(app.enabled(enabled)).toBe(false);
    await app.wait(4000);
    const error = '配置格式损坏或不受支持，原配置已保留，未覆盖。';
    expect(app.shows(`id:shortcut-toast >> text:${error}`)).toBe(true);
    await app.drag('id:shortcut-toast', { x: 100 });
    await app.wait(500);
    expect(app.shows('id:shortcut-toast')).toBe(false);
    expect(app.storage()).toEqual(storage);
  });
}

test('存储配额不足时保留旧配置与键帽，不显示保存成功', async () => {
  const config = JSON.stringify(settingsDocument());
  const storage = {
    'vadu.config': config,
    padding: 'x'.repeat(
      5 * 1024 * 1024 - 'padding'.length - 'vadu.config'.length - config.length,
    ),
  };
  const app = await openShortcuts({ storage });
  await app.press(toggle);
  await app.keyboard.press('mod+shift+f12');
  expect(app.shows('text:配置存储空间不足，修改未保存。')).toBe(true);
  expect(app.storage()).toEqual(storage);
  expect(app.shows(recordingTip)).toBe(true);
  await app.keyboard.press('escape');
  expect(app.shows(emptyInput)).toBe(true);
});

test('Windows 录入 Ctrl 组合并以可移植 mod 保存', async () => {
  const app = await openShortcuts({ platform: 'windows' });
  expect(app.shows(emptyInput)).toBe(true);
  await app.press(toggle);
  await app.keyboard.press('ctrl+shift+k');
  expect(app.shows(`${toggle} >> text:Ctrl`)).toBe(true);
  expect(app.shows(`${toggle} >> text:K`)).toBe(true);
  expect(
    JSON.parse(app.storage()['vadu.config']).settings.shortcuts[0].keystroke,
  ).toBe('mod+shift+k');
});
