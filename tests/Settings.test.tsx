import { expect, open, test } from 'nsh/test';

import {
  checkProfile,
  normalizeBaseUrl,
} from '../src/feature/settings/providers/config';
import { provider, providerStorage } from './fixtures/provider-config';
import {
  defaultAppearance,
  defaultShortcuts as defaults,
  settingsDocument as config,
} from './fixtures/settings-config';

test('接口地址规范化并拒绝歧义或含凭据的地址', () => {
  const url = normalizeBaseUrl('https://EXAMPLE.com:443/proxy/v1///');
  expect(url.href).toBe('https://example.com/proxy/v1');
  expect(url.origin).toBe('https://example.com');
  expect(normalizeBaseUrl('https://example.com').href).toBe(
    'https://example.com/',
  );
  for (const raw of [
    'https://@example.com',
    'https://a:b@example.com/v1',
    'https://example.com?key=x',
    'https://example.com#',
    'https:///example.com',
    'file:///tmp/x',
  ]) {
    expect(() => normalizeBaseUrl(raw)).toThrow(
      '请输入有效的 HTTP 或 HTTPS 接口地址',
    );
  }
});

test('Profile 校验允许空模型，拒绝托管请求头、重复请求头和嵌套凭据', () => {
  const base = provider('one', '测试', { model: '' });
  expect(checkProfile(base).profile).toEqual(base);
  for (const [patch, message] of [
    [{ headers: '{"Host":"other.example"}' }, '请求头不能覆盖连接或消息格式。'],
    [{ headers: '{"X-App":"one","x-app":"two"}' }, '请求头名称重复。'],
    [{ providerOptions: '{"stream":false}' }, '服务商选项不能覆盖模型'],
    [
      { providerOptions: '{"nested":[{"X-Access-Token":"mock"}]}' },
      '服务商选项不能包含认证或凭据字段。',
    ],
  ] as const) {
    expect(() => checkProfile({ ...base, ...patch })).toThrow(message);
  }
});

function status(app: Awaited<ReturnType<typeof open>>) {
  const text = app.texts().find((text) => text.startsWith('配置状态 '));
  return JSON.parse(text!.slice('配置状态 '.length));
}

const invalidDocuments = [
  { name: '空值', value: null },
  { name: '缺少设置', value: { profiles: [] } },
  { name: '缺少服务商列表', value: { settings: config().settings } },
  {
    name: '外观缺失',
    value: { ...config(), settings: { shortcuts: defaults } },
  },
  ...[
    ['缺少字段', { mode: 'dark', accent: 'blue' }],
    ['未知字段', { ...defaultAppearance, additional: true }],
    ['显示模式无效', { ...defaultAppearance, mode: 'auto' }],
    ['主题色无效', { ...defaultAppearance, accent: 'unknown' }],
    ['风格无效', { ...defaultAppearance, style: null }],
  ].map(([name, appearance]) => ({
    name: '外观' + name,
    value: { ...config(), settings: { shortcuts: defaults, appearance } },
  })),
  { name: '未知顶层字段', value: { ...config(), extra: true } },
  {
    name: '未知设置字段',
    value: { ...config(), settings: { ...config().settings, extra: true } },
  },
  {
    name: '未知绑定字段',
    value: config([{ ...defaults[0], extra: true }, ...defaults.slice(1)]),
  },
  { name: '缺少动作', value: config(defaults.slice(1)) },
  { name: '重复动作', value: config([defaults[0], defaults[0], defaults[2]]) },
  {
    name: '未知 API 协议',
    value: {
      ...config(),
      profiles: [{ ...provider('one', '测试'), protocol: 'unknown' }],
    },
  },
  {
    name: '未知动作',
    value: config([
      { ...defaults[0], id: 'unknown', keystroke: 'alt+k' },
      ...defaults.slice(1),
    ]),
  },
  {
    name: '快捷键不是字符串或空值',
    value: config([{ ...defaults[0], keystroke: 7 }, ...defaults.slice(1)]),
  },
  {
    name: '局内键位为空',
    value: config([
      defaults[0],
      { ...defaults[1], keystroke: null },
      defaults[2],
    ]),
  },
  {
    name: '开关不是布尔值',
    value: config([{ ...defaults[0], enabled: 1 }, ...defaults.slice(1)]),
  },
  {
    name: '混用新旧绑定字段',
    value: config([
      { id: 'toggle-translate', keystroke: 'alt+k' },
      ...defaults.slice(1),
    ]),
  },
  {
    name: '已关闭的绑定使用非法键位',
    value: config([
      { ...defaults[0], enabled: false, keystroke: 'k' },
      ...defaults.slice(1),
    ]),
  },
];

for (const { name, value } of invalidDocuments) {
  test(`配置拒绝${name}并保留原数据`, async () => {
    const storage = { 'vadu.config': JSON.stringify(value) };
    const app = await open('fixtures/Settings.tsx', {
      platform: 'macos',
      storage,
    });
    await app.press('id:read');
    expect(status(app)).toEqual({ code: 'INVALID_CONFIG' });
    expect(app.storage()).toEqual(storage);
  });
}

for (const keystroke of [
  'k',
  'shift+k',
  'mod++',
  'mod+unknown',
  'mod+f25',
  'ctrl+ctrl+k',
  'mod+q',
  'mod+h',
  'alt+mod+h',
  'mod+m',
  'ctrl+cmd+f',
  'x'.repeat(129),
]) {
  test(`配置拒绝非法或保留快捷键：${keystroke}`, async () => {
    const storage = {
      'vadu.config': JSON.stringify(
        config([{ ...defaults[0], keystroke }, ...defaults.slice(1)]),
      ),
    };
    const app = await open('fixtures/Settings.tsx', {
      platform: 'macos',
      storage,
    });
    await app.press('id:read');
    expect(status(app)).toEqual({ code: 'INVALID_CONFIG' });
    expect(app.storage()).toEqual(storage);
  });
}

for (const [first, second] of [
  ['Command+P', 'mod+p'],
  ['mod+return', 'cmd+enter'],
  ['mod+plus', 'cmd+='],
]) {
  test(`别名组合也检查冲突：${first} / ${second}`, async () => {
    const storage = {
      'vadu.config': JSON.stringify(
        config([
          { ...defaults[0], keystroke: first },
          { ...defaults[1], keystroke: second },
          { ...defaults[2], keystroke: 'alt+k' },
        ]),
      ),
    };
    const app = await open('fixtures/Settings.tsx', {
      platform: 'macos',
      storage,
    });
    await app.press('id:read');
    expect(status(app)).toEqual({ code: 'SHORTCUT_CONFLICT' });
    expect(app.storage()).toEqual(storage);
  });
}

for (const platform of ['macos', 'windows', 'linux'] as const) {
  test(`${platform} 两项并发保存不互相覆盖，键表可绑定且无重复`, async () => {
    const apple = platform === 'macos';
    const app = await open('fixtures/Settings.tsx', {
      platform,
      host: { params: { first: apple ? 'Command+Alt+K' : 'CTRL+SHIFT+K' } },
    });
    await app.press('id:update');
    const settings = {
      shortcuts: [
        {
          ...defaults[0],
          keystroke: apple ? 'alt+mod+k' : 'mod+shift+k',
          enabled: false,
        },
        ...defaults.slice(1),
      ],
    };
    expect(status(app)).toEqual({
      results: [{ status: 'fulfilled' }, { status: 'fulfilled' }],
      settings: { ...settings, appearance: defaultAppearance, profiles: [] },
    });
    expect(JSON.parse(app.storage()['vadu.config'])).toEqual(
      config(settings.shortcuts),
    );
    await app.press('id:check-keys');
    expect(status(app)).toEqual({
      unique: true,
      navigationExcluded: true,
      lastFunctionKey: true,
    });
  });

  if (platform !== 'macos') {
    for (const keystroke of ['ctrl+q', 'alt+f4', 'f11']) {
      test(`${platform} 拒绝保留键 ${keystroke}`, async () => {
        const storage = {
          'vadu.config': JSON.stringify(
            config([{ ...defaults[0], keystroke }, ...defaults.slice(1)]),
          ),
        };
        const app = await open('fixtures/Settings.tsx', { platform, storage });
        await app.press('id:read');
        expect(status(app)).toEqual({ code: 'INVALID_CONFIG' });
        expect(app.storage()).toEqual(storage);
      });
    }
  }
}

test('局内快捷键在设置接口也拒绝改键、重置和开关', async () => {
  const storage = { 'vadu.config': JSON.stringify(config()) };
  for (const [target, first] of [
    ['open-settings', 'alt+k'],
    ['pin-translate', null],
  ]) {
    const app = await open('fixtures/Settings.tsx', {
      platform: 'macos',
      storage,
      host: { params: { target, first } },
    });
    await app.press('id:update');
    expect(status(app).results).toEqual([
      { status: 'rejected', code: 'INVALID_CONFIG' },
      { status: 'rejected', code: 'INVALID_CONFIG' },
    ]);
    expect(app.storage()).toEqual(storage);
  }
});

test('旧版键位按已开启读取，修改时仅补齐开关并保留自定义局内键位', async () => {
  const old = [
    { id: 'toggle-translate', keystroke: 'alt+m' },
    { id: 'open-settings', keystroke: 'alt+j' },
    { id: 'pin-translate', keystroke: 'mod+p' },
  ];
  const storage = { 'vadu.config': JSON.stringify(config(old)) };
  const app = await open('fixtures/Settings.tsx', {
    platform: 'macos',
    storage,
  });
  await app.press('id:read');
  const bindings = old.map((binding) => ({ ...binding, enabled: true }));
  expect(status(app).settings.shortcuts).toEqual(bindings);
  expect(app.storage()).toEqual(storage);
  await app.press('id:update-modules');
  expect(JSON.parse(app.storage()['vadu.config']).settings.shortcuts).toEqual([
    { ...bindings[0], enabled: false },
    ...bindings.slice(1),
  ]);
});

test('首次读取写入失败可重试，初始化成功后只读已有配置', async () => {
  let saved: string | null = null;
  let writes = 0;
  const app = await open('fixtures/Settings.tsx', {
    platform: 'macos',
    modules: {
      nsh: {
        'Storage.getItem': () => saved,
        'Storage.setItem': (_key: string, value: string) => {
          if (++writes === 1) throw new Error('unavailable');
          saved = value;
        },
      },
    },
  });
  await app.press('id:read');
  expect(status(app)).toEqual({ code: 'INTERNAL' });
  expect(saved).toBeNull();
  await app.press('id:read');
  await app.press('id:read');
  expect(JSON.parse(saved!)).toEqual(config());
  expect(writes).toBe(2);
});

test('读取已有配置不写盘，修改快捷键保留服务商和独立凭据', async () => {
  const expected = provider('one', '测试', { protocol: 'responses' });
  const storage = {
    ...providerStorage(expected),
    'vadu.secret.one': JSON.stringify({
      base_url: expected.baseUrl,
      key: 'test-key',
    }),
  };
  const app = await open('fixtures/Settings.tsx', {
    platform: 'macos',
    storage,
  });
  await app.press('id:read');
  expect(status(app).settings.profiles).toEqual([expected]);
  expect(app.storage()).toEqual(storage);
  await app.press('id:update');
  const persisted = JSON.parse(app.storage()['vadu.config']);
  expect(persisted.settings.appearance).toEqual(defaultAppearance);
  expect(persisted.profiles).toEqual([expected]);
  expect(app.storage()['vadu.secret.one']).toBe(storage['vadu.secret.one']);
});

test('外观、快捷键与服务商并发保存，一份配置保留每项修改，密钥独立', async () => {
  const app = await open('fixtures/Settings.tsx', { platform: 'macos' });
  await app.press('id:update-modules');
  const appearance = { ...defaultAppearance, mode: 'dark', accent: 'blue' };
  const shortcuts = [{ ...defaults[0], enabled: false }, ...defaults.slice(1)];
  const profiles = [provider('one', '测试')];
  expect(status(app).settings).toEqual({ appearance, shortcuts, profiles });
  const storage = app.storage();
  expect(JSON.parse(storage['vadu.config'])).toEqual({
    settings: { appearance, shortcuts },
    profiles,
  });
  expect(JSON.parse(storage['vadu.secret.one'])).toEqual({
    base_url: profiles[0].baseUrl,
    key: 'test-key',
  });
});

test('校验失败不阻塞后续保存队列', async () => {
  const app = await open('fixtures/Settings.tsx', {
    platform: 'macos',
    host: { params: { first: 'mod+p' } },
  });
  await app.press('id:update');
  expect(status(app).results).toEqual([
    { status: 'rejected', code: 'SHORTCUT_CONFLICT' },
    { status: 'fulfilled' },
  ]);
  expect(JSON.parse(app.storage()['vadu.config'])).toEqual(
    config([{ ...defaults[0], enabled: false }, ...defaults.slice(1)]),
  );
});

test('意外读取异常显示安全提示，禁用编辑且不覆盖数据', async () => {
  const storage = { unrelated: 'retained' };
  const app = await open('../App.tsx', {
    platform: 'macos',
    storage,
    modules: {
      nsh: {
        'Storage.getItem': () => {
          throw new Error('private failure detail');
        },
      },
    },
  });
  await app.press('id:settings-shortcuts');
  expect(app.shows('text:无法访问配置，请稍后重试。')).toBe(true);
  expect(app.enabled('id:shortcut-toggle-translate-input')).toBe(false);
  expect(app.storage()).toEqual(storage);
});

test('意外写入失败不修改原值，后续保存仍读取最新文档', async () => {
  let saved: string | null = null;
  let writes = 0;
  const app = await open('fixtures/Settings.tsx', {
    platform: 'macos',
    modules: {
      nsh: {
        'Storage.getItem': () => saved,
        'Storage.setItem': (_key: string, value: string) => {
          if (writes++ === 0) throw new Error('private failure detail');
          saved = value;
        },
      },
    },
  });
  await app.press('id:update');
  expect(status(app)).toEqual({
    results: [
      { status: 'rejected', code: 'INTERNAL' },
      { status: 'fulfilled' },
    ],
    settings: {
      appearance: defaultAppearance,
      shortcuts: [{ ...defaults[0], enabled: false }, ...defaults.slice(1)],
      profiles: [],
    },
  });
  expect(JSON.parse(saved!)).toEqual(
    config([{ ...defaults[0], enabled: false }, ...defaults.slice(1)]),
  );
});
