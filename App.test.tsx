import { expect, open, test } from 'nsh/test';

test('侧栏显示品牌与五个分类，切换时不显示公共标题与说明', async () => {
  const app = await open('./App.tsx', {
    width: 1200,
    height: 800,
    platform: 'macos',
  });

  expect(app.shows('text:vadu')).toBe(true);
  expect(app.shows('text:管理面板')).toBe(true);
  expect(app.shows('label:设置分类')).toBe(true);
  expect(app.count('label:通用')).toBe(2);
  expect(app.count('text:应用偏好设置尚未迁移。')).toBe(0);
  expect(app.count('text:设置项业务尚未迁移，暂不可编辑。')).toBe(0);
  const sidebar = app.layout('id:settings-sidebar-scroll')!;
  for (const [id, label] of [
    ['general', '通用'],
    ['providers', '服务商'],
    ['appearance', '外观'],
    ['shortcuts', '快捷键'],
    ['backup', '备份恢复'],
  ]) {
    expect(app.count(`id:settings-${id}`)).toBe(1);
    expect(app.shows(`label:${label}`)).toBe(true);
    expect(app.shows(`id:settings-${id} >> text:${label}`)).toBe(true);
    const row = app.layout(`id:settings-${id}`)!;
    const leftInset = row.x - sidebar.x;
    expect(leftInset).toBeGreaterThan(0);
    expect(sidebar.x + sidebar.width - (row.x + row.width)).toBe(leftInset);
  }

  for (const [id, label] of [
    ['providers', '服务商'],
    ['appearance', '外观'],
    ['shortcuts', '快捷键'],
    ['backup', '备份恢复'],
    ['general', '通用'],
  ]) {
    await app.press(`id:settings-${id}`);
    expect(app.count(`label:${label}`)).toBe(2);
    expect(app.count(`id:settings-${id} >> text:${label}`)).toBe(1);
    expect(app.count(`id:settings-router >> text:${label}`)).toBe(0);
    expect(app.count('text:设置项业务尚未迁移，暂不可编辑。')).toBe(0);
    expect(app.count('id:settings-shortcuts-page')).toBe(
      id === 'shortcuts' ? 1 : 0,
    );
    expect(app.count('id:settings-content')).toBe(1);
    expect(app.layout('id:settings-content')!.y).toBe(
      app.layout('id:settings-router')!.y,
    );
  }
  await app.press('id:settings-general');
  // 原生驱动无历史时空操作，headless 则报告无可返回页面。
  await app.back().catch((error) => {
    expect(error).toMatchObject({ code: 'ERR_NSH_TEST_NO_BACK' });
  });
  expect(app.count('label:通用')).toBe(2);
});

test('快捷键分类挂载独立页面，切换后不残留内容', async () => {
  const app = await open('./App.tsx', {
    width: 1200,
    height: 800,
    platform: 'macos',
  });

  expect(app.count('id:settings-shortcuts-page')).toBe(0);
  await app.press('id:settings-shortcuts');
  expect(app.shows('id:settings-shortcuts-page')).toBe(true);
  expect(app.shows('text:全局快捷键')).toBe(true);
  expect(app.shows('text:局内快捷键')).toBe(true);
  expect(app.shows('id:shortcut-toggle-translate-status')).toBe(true);
  for (const id of ['toggle-translate', 'open-settings', 'pin-translate']) {
    expect(app.count(`id:shortcut-${id}`)).toBe(1);
    expect(app.shows(`id:shortcut-${id}-enabled`)).toBe(true);
    expect(app.enabled(`id:shortcut-${id}-enabled`)).toBe(
      id === 'toggle-translate',
    );
  }
  expect(app.shows('id:shortcut-open-settings-status')).toBe(true);
  expect(app.texts()).toContain('已启用');
  expect(app.shows('id:shortcut-toggle-translate >> text:未绑定')).toBe(true);
  expect(app.shows('id:shortcut-pin-translate >> text:已启用')).toBe(true);
  for (const [id, keys] of [
    ['toggle-translate', ['点击录入']],
    ['open-settings', ['⌘', ',']],
    ['pin-translate', ['⌘', 'P']],
  ] as const) {
    expect(app.enabled(`id:shortcut-${id}-input`)).toBe(
      id === 'toggle-translate',
    );
    for (const key of keys) {
      expect(app.shows(`id:shortcut-${id} >> text:${key}`)).toBe(true);
    }
  }
  expect(app.enabled('label:重置唤起翻译浮窗快捷键')).toBe(true);
  expect(app.count('label:重置浮窗内打开设置快捷键')).toBe(0);
  expect(app.count('label:重置浮窗内切换固定窗口快捷键')).toBe(0);
  expect(app.count('id:settings-content')).toBe(1);

  await app.press('id:settings-general');
  expect(app.count('label:通用')).toBe(2);
  expect(app.count('id:settings-shortcuts-page')).toBe(0);

  await app.press('id:settings-shortcuts');
  expect(app.count('id:settings-shortcuts-page')).toBe(1);
});

test('窄窗口侧栏只显示居中图标，底部按钮可展开和折叠', async () => {
  const app = await open('./App.tsx', {
    width: 560,
    height: 800,
    platform: 'macos',
  });
  const collapsedWidth = 64;
  const expandedWidth = 216;
  const assertCollapsed = () => {
    const sidebar = app.layout('id:settings-sidebar')!;
    expect(sidebar.width).toBe(collapsedWidth);
    expect(app.count('text:vadu')).toBe(0);
    expect(app.count('text:管理面板')).toBe(0);
    const center = sidebar.x + sidebar.width / 2;
    for (const [id, label] of [
      ['general', '通用'],
      ['providers', '服务商'],
      ['appearance', '外观'],
      ['shortcuts', '快捷键'],
      ['backup', '备份恢复'],
    ]) {
      const selector = `id:settings-${id}`;
      expect(app.count(`${selector} >> text:${label}`)).toBe(0);
      expect(app.shows(`label:${label}`)).toBe(true);
      const row = app.layout(selector)!;
      expect(row.clipped).toBe(false);
      expect(row.width).toBe(row.height);
      expect(Math.abs(row.x + row.width / 2 - center)).toBeLessThanOrEqual(1);
    }
    for (const selector of ['text:v', 'label:展开侧栏']) {
      const item = app.layout(selector)!;
      expect(item.clipped).toBe(false);
      expect(Math.abs(item.x + item.width / 2 - center)).toBeLessThanOrEqual(1);
    }
  };

  await app.setViewport(560, 800);
  await app.waitFor('label:展开侧栏');
  assertCollapsed();
  await app.press('label:展开侧栏');
  expect(app.layout('id:settings-sidebar')!.width).toBe(expandedWidth);
  expect(app.shows('text:vadu')).toBe(true);
  expect(app.shows('id:settings-general >> text:通用')).toBe(true);
  await app.setViewport(700, 800);
  expect(app.layout('id:settings-sidebar')!.width).toBe(expandedWidth);

  await app.press('label:折叠侧栏');
  assertCollapsed();
  await app.press('id:settings-backup');
  expect(app.count('label:备份恢复')).toBe(2);

  await app.setViewport(768, 800);
  await app.waitFor('label:折叠侧栏');
  expect(app.layout('id:settings-sidebar')!.width).toBe(expandedWidth);
  expect(app.shows('text:vadu')).toBe(true);
  expect(app.count('label:备份恢复')).toBe(2);
  await app.setViewport(767, 800);
  await app.waitFor('label:展开侧栏');
  assertCollapsed();
  expect(app.count('label:备份恢复')).toBe(2);
});

test('侧栏支持 Tab 移焦、Enter 与 Space 激活', async () => {
  const app = await open('./App.tsx', {
    width: 1200,
    height: 800,
    platform: 'macos',
  });

  await app.keyboard.press('tab');
  await app.keyboard.press('tab');
  expect(app.count('label:通用')).toBe(2);
  await app.keyboard.press('enter');
  expect(app.count('label:服务商')).toBe(2);
  expect(app.count('label:通用')).toBe(1);
  await app.keyboard.press('tab');
  await app.keyboard.press('space');
  expect(app.count('label:外观')).toBe(2);
  expect(app.count('label:服务商')).toBe(1);
});

for (const reducedMotion of [false, true]) {
  test(`侧栏图标悬停不切页，重复悬停后仍可激活（减少动态效果：${reducedMotion}）`, async () => {
    const app = await open('./App.tsx', {
      width: 1200,
      height: 800,
      platform: 'macos',
      reducedMotion,
      clock: {},
    });

    for (const id of [
      'general',
      'providers',
      'appearance',
      'shortcuts',
      'backup',
    ]) {
      await app.hover(`id:settings-${id}`);
      expect(app.count('label:通用')).toBe(2);
    }

    await app.hover('id:settings-providers');
    await app.hover('id:settings-general');
    await app.hover('id:settings-providers');
    await app.press('id:settings-providers');
    expect(app.count('label:服务商')).toBe(2);
    expect(app.count('label:通用')).toBe(1);
  });
}

test('矮窗口可滚动侧栏，调整尺寸保留分类', async () => {
  const app = await open('./App.tsx', {
    width: 1200,
    height: 800,
    platform: 'macos',
  });

  await app.setViewport(600, 240);
  await app.scroll('id:settings-sidebar-scroll', 400);
  await app.press('id:settings-backup');
  expect(app.count('label:备份恢复')).toBe(2);
  await app.setViewport(1200, 800);
  expect(app.count('label:备份恢复')).toBe(2);
});
