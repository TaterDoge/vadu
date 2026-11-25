import { expect, open, test } from 'nsh/test';

test('Kbd 支持单键和组合键，保留响应式内容、样式与可访问属性', async () => {
  const app = await open('./fixtures/Kbd.tsx', {
    width: 360,
    height: 640,
    platform: 'macos',
  });

  expect(app.shows('id:standalone-key')).toBe(true);
  expect(app.shows('text:Esc')).toBe(true);
  expect(app.shows('label:Command + M')).toBe(true);
  expect(app.shows('id:default-group >> text:⌘')).toBe(true);
  expect(app.shows('id:default-group >> text:M')).toBe(true);
  expect(app.spanStyle('text:M')).toMatchObject({
    fontSize: 12,
    fontWeight: 500,
    color: '#5f636aff',
  });

  await app.keyboard.press('tab');
  await app.keyboard.press('enter');
  expect(app.count('id:default-group')).toBe(0);
  expect(app.count('label:Command + M')).toBe(0);
  expect(app.shows('label:Option + P')).toBe(true);
  expect(app.shows('id:alternate-group >> text:⌥')).toBe(true);
  expect(app.shows('id:alternate-group >> text:P')).toBe(true);
});

test('单键键帽方正，支持覆盖高度与最小宽度', async () => {
  const app = await open('./fixtures/Kbd.tsx', {
    width: 360,
    height: 640,
    platform: 'macos',
  });

  const keySize = () => {
    const [width, height] = (
      app.texts().find((text) => text.startsWith('键帽尺寸 ')) ?? ''
    )
      .split(' ')[1]
      .split('x')
      .map(Number);
    return { width, height };
  };

  expect(keySize()).toEqual({ width: 20, height: 20 });
  await app.press('id:change-keys');
  expect(keySize()).toEqual({ width: 32, height: 32 });
});
