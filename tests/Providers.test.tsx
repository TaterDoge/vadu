import { expect, open, type OpenOptions, test } from 'nsh/test';

import { provider, providerStorage } from './fixtures/provider-config';

const list = 'id:providers-list-scroll';
const name = 'id:provider-name';
const address = 'id:provider-base-url';
const model = 'id:provider-model';
const modelList = 'id:provider-model-list';
const modelSearch = 'label:搜索模型';
const modelRefresh = 'label:刷新模型列表';
const keyInput = 'id:provider-api-key';
const toast = 'id:provider-toast';
const filter = 'label:按启用状态筛选';
const advanced = 'label:高级选项';
const temperature = 'label:温度';
const providerOptions = 'label:服务商选项';
const headers = 'label:请求头';
const category = 'id:settings-providers';
const seeded = providerStorage(provider('1', 'test'), provider('2', 'aaa'));

async function openProviders(options: OpenOptions = {}) {
  const app = await open('../App.tsx', {
    platform: 'macos',
    width: 960,
    height: 620,
    storage: seeded,
    ...options,
  });
  await app.press(category);
  return app;
}

test('服务商可选择、搜索与切换分类，识别和语音标明尚未接入', async () => {
  const app = await openProviders();
  expect(app.shows(`${list} >> label:test，已启用`)).toBe(true);
  expect(app.value(name)).toBe('test');
  await app.press('label:aaa，已启用');
  expect(app.value(name)).toBe('aaa');
  await app.type('label:搜索服务商', '  TESt  ');
  expect(app.shows('label:test，已启用')).toBe(true);
  expect(app.shows('label:aaa，已启用')).toBe(false);

  await app.press('label:识别');
  expect(app.shows(list)).toBe(false);
  expect(app.shows('text:识别服务尚未接入')).toBe(true);
  await app.press('label:语音');
  expect(app.shows('text:语音服务尚未接入')).toBe(true);
  await app.press('label:翻译');
  expect(app.shows(`${list} >> label:aaa，已启用`)).toBe(true);
});

test('连续新增各自使用独立草稿，创建和删除后同步列表选中项', async () => {
  const app = await openProviders({ height: 900 });
  const add = 'label:新增翻译服务商';
  await app.type('label:搜索服务商', 'aaa');
  await app.press(add);
  await app.type(name, '临时草稿');
  await app.press(advanced);
  await app.press(add);
  expect(app.value(name)).toBe('');
  expect(app.shows(temperature)).toBe(false);

  await app.type(name, '新服务商');
  await app.type(address, 'https://new.example/v1');
  await app.press('label:保存');
  await app.press('label:确认地址并保存');
  expect(app.value('label:搜索服务商')).toBe('');
  expect(app.value(name)).toBe('新服务商');
  expect(app.shows(`${list} >> label:新服务商，已启用`)).toBe(true);
  await app.press('label:删除');
  await app.press('label:确认删除');
  expect(app.value(name)).toBe('test');
  expect(app.shows(`${list} >> label:新服务商，已启用`)).toBe(false);
  await app.press('label:aaa，已启用');
  expect(app.value(name)).toBe('aaa');
});

test('新输入的 API Key 可切换显示，切换服务商后恢复隐藏', async () => {
  const app = await openProviders();
  const showKey = 'label:显示密钥';
  const hideKey = 'label:隐藏密钥';
  const key = 'fake-test-key';
  expect(app.enabled(showKey)).toBe(false);

  await app.type(keyInput, key);
  await app.press(showKey);
  expect(app.shows(hideKey)).toBe(true);
  expect(app.value(keyInput)).toBe(key);
  await app.press(hideKey);
  expect(app.shows(showKey)).toBe(true);
  expect(app.value(keyInput)).toBe(key);

  await app.press(showKey);
  await app.press('label:aaa，已启用');
  expect(app.value(keyInput)).toBe('');
  expect(app.shows(showKey)).toBe(true);
  expect(app.enabled(showKey)).toBe(false);
});

test('已保存的 API Key 以实际值切换遮罩，切换服务商或隐藏窗口后收起', async () => {
  const key = 'fake-saved-key';
  const credential = JSON.stringify({
    base_url: 'https://example.com/v1',
    key,
  });
  const app = await open('./fixtures/Windows.tsx', {
    platform: 'macos',
    width: 960,
    height: 800,
    storage: { ...seeded, 'vadu.secret.1': credential },
    host: {},
  });
  const showKey = 'label:显示密钥';
  const hideKey = 'label:隐藏密钥';
  await app.press(category);
  await app.waitUntil(() => app.enabled(showKey));
  expect(app.shows('label:清除密钥')).toBe(false);
  expect(app.value(keyInput)).toBe(key);

  await app.press(showKey);
  expect(app.value(keyInput)).toBe(key);
  await app.press(hideKey);
  expect(app.value(keyInput)).toBe(key);

  await app.press(showKey);
  await app.press('label:aaa，已启用');
  expect(app.value(keyInput)).toBe('');
  expect(app.enabled(showKey)).toBe(false);
  await app.press('label:test，已启用');
  await app.waitUntil(() => app.enabled(showKey));
  await app.press(showKey);
  await app.window('main').pressClose();
  await app.host.send('open-settings');
  await app.waitUntil(() => app.enabled(showKey));
  expect(app.value(keyInput)).toBe(key);

  await app.press(showKey);
  await app.press('label:保存');
  expect(app.shows('text:服务商已保存。')).toBe(true);
  expect(app.value(keyInput)).toBe(key);
  expect(app.enabled(showKey)).toBe(true);
  expect(app.storage()['vadu.secret.1']).toBe(credential);
  expect(app.storage()['vadu.config']).not.toContain(key);
});

test('编辑接口地址后，迟到的旧凭据不能填回输入框', async () => {
  const app = await open('./fixtures/DelayedProviderKey.tsx', {
    platform: 'macos',
    width: 960,
    height: 800,
    host: {},
    clock: {},
    storage: {
      ...seeded,
      'vadu.secret.1': JSON.stringify({
        base_url: 'https://example.com/v1',
        key: 'fake-late-key',
      }),
    },
  });
  await app.waitFor('text:正在读取本地存储…');
  await app.clear(address);
  await app.type(address, 'https://different.example/v1');
  await app.host.send('release-key');
  expect(app.value(keyInput)).toBe('');
  expect(app.enabled('label:显示密钥')).toBe(false);
  expect(app.enabled(modelList)).toBe(false);
});

for (const action of ['查询模型', '保存配置'] as const) {
  test(`改回已保存地址后${action}只使用该地址的凭据`, async () => {
    const savedAddress = 'https://example.com/v1';
    const savedKey = 'fake-saved-a';
    const credential = JSON.stringify({
      base_url: savedAddress,
      key: savedKey,
    });
    const app = await openProviders({
      height: 900,
      clock: {},
      storage: { ...seeded, 'vadu.secret.1': credential },
      network: {
        [`${savedAddress}/models`]: { body: { data: [{ id: 'model-a' }] } },
      },
    });
    await app.clear(address);
    await app.type(address, 'https://other.example/v1');
    await app.type(keyInput, 'fake-draft-b');
    await app.clear(address);
    await app.type(address, savedAddress);

    if (action === '查询模型') {
      await app.press(modelList);
      await app.waitFor('label:model-a');
      expect(app.requests()).toHaveLength(1);
      expect(app.requests()[0]).toMatchObject({
        url: `${savedAddress}/models`,
        headers: { authorization: `Bearer ${savedKey}` },
      });
    } else {
      await app.press('label:保存');
      await app.waitFor(`${toast} >> text:服务商已保存。`);
      expect(app.storage()['vadu.secret.1']).toBe(credential);
    }
  });
}

test('首次保存允许空模型，地址需确认，启停与删除写入配置', async () => {
  const height = 800;
  const key = 'fake-first-save-key';
  const app = await openProviders({ height, storage: {} });
  const initialStorage = app.storage();
  expect(app.shows('text:暂无服务商')).toBe(true);
  await app.press('label:新增翻译服务商');
  await app.press('label:保存');
  expect(app.shows('text:请填写名称和接口地址。')).toBe(true);
  expect(app.enabled(modelList)).toBe(false);

  await app.type(name, ' 新服务商 ');
  await app.type(keyInput, key);
  await app.type(address, 'http://127.0.0.1:9876/v1/');
  await app.press('label:保存');
  const dialog = 'id:provider-confirm-dialog';
  expect(app.shows(dialog)).toBe(true);
  expect(app.texts().join(' ')).toContain('HTTP 不加密');
  await app.press('label:取消');
  expect(app.storage()).toEqual(initialStorage);
  await app.press('label:保存');
  await app.press('label:确认地址并保存');
  expect(app.value(keyInput)).toBe(key);
  expect(app.value(name)).toBe('新服务商');
  expect(app.value(model)).toBe('');
  expect(app.enabled(modelList)).toBe(true);
  expect(app.shows(`${list} >> label:新服务商，已启用`)).toBe(true);

  await app.press('id:provider-enabled');
  await app.press('label:保存');
  await app.press(filter);
  await app.press('text:仅已启用');
  expect(app.shows(list)).toBe(false);
  expect(app.shows('text:没有匹配的服务商')).toBe(true);
  await app.press(filter);
  await app.press('text:仅已停用');
  expect(app.shows('label:新服务商，已停用')).toBe(true);

  const storage = app.storage();
  const [{ id }] = JSON.parse(storage['vadu.config']).profiles;
  const credential = `vadu.secret.${id}`;
  expect(JSON.parse(storage[credential])).toEqual({
    base_url: 'http://127.0.0.1:9876/v1',
    key,
  });
  expect(storage['vadu.config']).not.toContain(key);
  const reopened = await openProviders({ height, storage });
  expect(reopened.shows('label:新服务商，已停用')).toBe(true);
  expect(reopened.value(address)).toBe('http://127.0.0.1:9876/v1');
  await reopened.press('label:删除');
  expect(reopened.shows(dialog)).toBe(true);
  await reopened.keyboard.press('escape');
  expect(reopened.shows(dialog)).toBe(false);
  expect(reopened.storage()).toEqual(storage);
  await reopened.press('label:删除');
  await reopened.press('label:确认删除');
  expect(reopened.shows('text:暂无服务商')).toBe(true);
  expect(Object.hasOwn(reopened.storage(), credential)).toBe(false);
  expect(JSON.parse(reopened.storage()['vadu.config']).profiles).toEqual([]);
});

test('未保存的服务商可先用输入的地址和密钥获取模型', async () => {
  const key = 'fake-draft-key';
  const app = await openProviders({
    height: 900,
    storage: {},
    network: {
      'https://draft.example/v1/models': {
        body: { data: [{ id: 'draft-model' }] },
      },
    },
  });
  const initialStorage = app.storage();
  await app.press('label:新增翻译服务商');
  await app.type(address, 'https://draft.example/v1');
  expect(app.enabled(modelList)).toBe(false);
  await app.type(keyInput, key);
  expect(app.enabled(modelList)).toBe(true);

  await app.press(modelList);
  const dialog = 'id:provider-confirm-dialog';
  expect(app.shows(dialog)).toBe(true);
  expect(app.texts().join(' ')).toContain('https://draft.example/v1');
  expect(app.requests()).toEqual([]);
  await app.press('label:确认地址并获取模型');
  await app.waitUntil(() => app.shows(`${toast} >> text:已获取 1 个模型。`));
  await app.press(modelList);
  await app.press('label:draft-model');
  expect(app.value(model)).toBe('draft-model');
  // 获取模型不写入配置或凭据。
  expect(app.storage()).toEqual(initialStorage);
  expect(app.requests()).toHaveLength(1);
  expect(app.requests()[0]).toMatchObject({
    method: 'GET',
    url: 'https://draft.example/v1/models',
    headers: { authorization: `Bearer ${key}` },
  });

  await app.type(name, '新服务商');
  await app.press('label:保存');
  await app.press('label:确认地址并保存');
  const [{ id, model: savedModel }] = JSON.parse(
    app.storage()['vadu.config'],
  ).profiles;
  expect(savedModel).toBe('draft-model');
  expect(JSON.parse(app.storage()[`vadu.secret.${id}`])).toEqual({
    base_url: 'https://draft.example/v1',
    key,
  });
  expect(app.storage()['vadu.config']).not.toContain(key);
});

test('先填的草稿密钥可用于首次确认的地址，改址后须重新输入', async () => {
  const app = await openProviders({
    storage: {},
    height: 900,
    clock: {},
    network: { 'https://draft.example/v1/models': { body: { data: [] } } },
  });
  const initialStorage = app.storage();
  await app.press('label:新增翻译服务商');
  await app.type(keyInput, 'fake-unbound-key');
  await app.type(address, 'https://draft.example/v1');
  await app.press(modelList);
  await app.press('label:确认地址并获取模型');
  await app.waitFor(`${toast} >> text:模型列表为空，可以手动输入模型 ID。`);
  expect(app.requests()[0].headers.authorization).toBe(
    'Bearer fake-unbound-key',
  );
  await app.clear(address);
  await app.type(address, 'https://other.example/v1');
  expect(app.value(keyInput)).toBe('');
  expect(app.enabled(modelList)).toBe(false);
  expect(app.requests()).toHaveLength(1);
  expect(app.storage()).toEqual(initialStorage);
});

test('API 协议可切换并随服务商保存，未接入协议不发请求', async () => {
  const selector = 'id:provider-protocol';
  const app = await openProviders({ height: 940 });
  expect(
    app.shows(`${selector} >> text:Chat Completions (/chat/completions)`),
  ).toBe(true);
  await app.press(selector);
  await app.press('text:Responses (/responses)');
  expect(app.enabled(modelList)).toBe(false);
  await app.press('label:保存');
  expect(JSON.parse(app.storage()['vadu.config']).profiles[0].protocol).toBe(
    'responses',
  );

  await app.press(selector);
  await app.press('text:Anthropic Messages (/v1/messages)');
  await app.press('label:保存');
  const reopened = await openProviders({ height: 940, storage: app.storage() });
  expect(
    reopened.shows(`${selector} >> text:Anthropic Messages (/v1/messages)`),
  ).toBe(true);
  expect(reopened.shows('text:该 API 协议尚未接入，可保存配置。')).toBe(true);
  expect(reopened.enabled('label:健康检测')).toBe(false);
  expect(reopened.enabled(modelList)).toBe(false);
});

test('健康检测当前模型，模型列表和密钥只使用已保存的 Profile', async () => {
  const baseUrl = 'https://example.com/proxy/v1';
  const key = 'fake-test-key';
  const dots = 'id:health-check-dots';
  const check = 'label:健康检测';
  let checkingDuringRequest = false;
  let checks = 0;
  let lists = 0;
  const app = await openProviders({
    height: 900,
    reducedMotion: false,
    clock: {},
    storage: providerStorage(
      provider('1', 'test', {
        baseUrl,
        providerOptions: '{"max_tokens":1}',
        headers: '{"X-Profile":"test"}',
      }),
    ),
    network: {
      [`POST ${baseUrl}/chat/completions`]: () => {
        checkingDuringRequest = app.shows(`label:正在检测模型 >> ${dots}`);
        return ++checks === 1
          ? { body: { choices: [{ message: { content: 'OK' } }] } }
          : { status: 503, body: 'fake upstream details' };
      },
      [`${baseUrl}/models`]: () => {
        ++lists;
        if (lists === 2) return { error: 'fake upstream details' };
        const ids =
          lists === 1 ? ['model-b', 'model-a', 'model-b', ''] : ['model-c'];
        return { body: { data: ids.map((id) => ({ id })) } };
      },
    },
  });
  expect(app.shows('label:保存密钥')).toBe(false);
  await app.type(keyInput, key);
  await app.press('label:保存');
  expect(app.value(keyInput)).toBe(key);
  expect(app.storage()['vadu.config']).not.toContain(key);

  await app.press(check);
  expect(checkingDuringRequest).toBe(true);
  await app.waitFor(check);
  expect(app.enabled(check)).toBe(true);
  expect(app.shows(dots)).toBe(false);
  expect(app.shows(`${toast} >> text:模型 demo-model 可以正常对话。`)).toBe(
    true,
  );
  expect(app.requests()[0]).toMatchObject({
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${key}`, 'x-profile': 'test' },
  });
  expect(JSON.parse(app.requests()[0].body!)).toEqual({
    model: 'demo-model',
    temperature: 0.3,
    max_tokens: 1,
    stream: false,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
  });

  expect(app.shows(modelSearch)).toBe(false);
  await app.press(modelList);
  await app.waitFor('label:model-b');
  expect(app.shows(`${toast} >> text:已获取 2 个模型。`)).toBe(true);
  expect(app.requests()[1]).toMatchObject({
    method: 'GET',
    url: `${baseUrl}/models`,
    headers: { authorization: `Bearer ${key}`, 'x-profile': 'test' },
  });
  await app.type(modelSearch, 'MODEL-B');
  expect(app.shows('label:model-a')).toBe(false);
  await app.keyboard.press('enter');
  expect(app.shows(modelSearch)).toBe(false);
  expect(app.value(model)).toBe('model-b');
  await app.press(check);
  await app.waitFor(`${toast} >> text:服务商暂时不可用，请稍后重试。`);
  expect(app.shows(dots)).toBe(false);
  expect(app.enabled(check)).toBe(true);
  expect(JSON.parse(app.requests()[2].body!).model).toBe('model-b');
  expect(JSON.parse(app.storage()['vadu.config']).profiles[0].model).toBe(
    'demo-model',
  );
  await app.press('label:保存');
  expect(JSON.parse(app.storage()['vadu.config']).profiles[0].model).toBe(
    'model-b',
  );

  await app.press(modelList);
  expect(app.shows('label:model-b')).toBe(true);
  expect(lists).toBe(1);
  await app.press(modelRefresh);
  await app.waitFor(`${toast} >> text:无法完成服务商请求，请检查地址和网络。`);
  expect(app.texts().join(' ')).not.toContain('fake upstream details');
  expect(app.shows('label:model-b')).toBe(true);
  await app.press(modelRefresh);
  await app.waitFor('label:model-c');
  expect(app.shows('label:model-b')).toBe(false);
  await app.keyboard.press('escape');
  expect(app.shows(modelSearch)).toBe(false);
  expect(app.value(model)).toBe('model-b');

  await app.clear(address);
  await app.type(address, 'https://different.example/v1');
  expect(app.enabled(keyInput)).toBe(true);
  expect(app.enabled(modelList)).toBe(false);
  expect(lists).toBe(3);
  expect(JSON.parse(app.storage()['vadu.secret.1'])).toEqual({
    base_url: baseUrl,
    key,
  });
});

test('模型查询不发送旧地址密钥，并限制响应大小和等待时间', async () => {
  const baseUrl = 'https://new.example/v1';
  const models = { data: [{ id: 'demo-model' }] };
  let requests = 0;
  const app = await openProviders({
    height: 900,
    clock: {},
    storage: {
      ...providerStorage(provider('1', 'test', { baseUrl })),
      'vadu.secret.1': JSON.stringify({
        base_url: 'https://old.example/v1',
        key: 'fake-old-key',
      }),
    },
    network: {
      [`${baseUrl}/models`]: () =>
        ++requests === 1
          ? { body: JSON.stringify(models) + ' '.repeat(1024 * 1024) }
          : { body: models, delay: 30_000 },
    },
  });
  await app.press(modelList);
  await app.waitFor(`${toast} >> text:服务商返回的响应格式无效或不完整。`);
  expect(app.requests()[0].headers.authorization).toBeUndefined();
  expect(app.shows('label:demo-model')).toBe(false);

  await app.press(modelRefresh);
  await app.wait(25_000);
  await app.waitFor(`${toast} >> text:服务商响应超时，请重试。`);
  expect(app.requests()).toHaveLength(2);
  expect(app.shows('label:demo-model')).toBe(false);
});

test('隐藏设置窗口中止模型检测，恢复后可立即重试且旧结果不覆盖提示', async () => {
  let attempts = 0;
  const app = await open('./fixtures/Windows.tsx', {
    platform: 'macos',
    width: 960,
    height: 800,
    storage: seeded,
    host: {},
    clock: {},
    network: {
      'POST https://example.com/v1/chat/completions': () =>
        ++attempts === 1
          ? { delay: 2000, status: 503 }
          : { body: { choices: [{}] } },
    },
  });
  await app.press(category);
  await app.press('label:健康检测');
  await app.waitUntil(() => app.requests().length === 1);
  await app.window('main').pressClose();
  await app.host.send('open-settings');
  await app.waitFor('label:健康检测', { timeout: 500 });
  await app.press('label:健康检测');
  const success = `${toast} >> text:模型 demo-model 可以正常对话。`;
  await app.waitFor(success);
  await app.wait(2000);
  expect(app.shows(success)).toBe(true);
  expect(app.requests()).toHaveLength(2);
});

test('凭据写入失败时保存普通配置并提示重新输入密钥', async () => {
  let saved = seeded['vadu.config'];
  const app = await openProviders({
    height: 900,
    modules: {
      nsh: {
        'Storage.getItem': (key: string) =>
          key === 'vadu.config' ? saved : null,
        'Storage.setItem': (key: string, value: string) => {
          if (key !== 'vadu.config') throw new Error('private failure detail');
          saved = value;
        },
      },
    },
  });
  const key = 'fake-rejected-key';
  await app.type(name, ' 已修改');
  await app.type(keyInput, key);
  await app.press('label:保存');
  expect(
    app.shows(
      'text:服务商配置已保存，API Key 保存失败。无法写入本地存储，请重试。',
    ),
  ).toBe(true);
  expect(app.value(keyInput)).toBe('');
  expect(app.shows(toast)).toBe(false);
  expect(JSON.parse(saved).profiles[0].name).toBe('test 已修改');
  expect(saved).not.toContain(key);
});

test('损坏的密钥提示重新输入并保留存储内容', async () => {
  const storage = {
    ...seeded,
    'vadu.secret.1': JSON.stringify({
      base_url: 'https://example.com/v1',
      key: 'key with spaces',
    }),
  };
  const app = await openProviders({ height: 900, storage });
  await app.waitUntil(() => app.shows('text:API Key 数据损坏，请重新输入。'));
  expect(app.value(keyInput)).toBe('');
  expect(app.storage()).toEqual(storage);
});

test('高级选项可折叠，保存后随服务商恢复', async () => {
  const app = await openProviders({ height: 940 });
  const optionsJson = '{\n  "enable_thinking": false\n}';
  const headersJson = '{\n  "X-Client": "vadu"\n}';
  for (const field of [temperature, providerOptions, headers]) {
    expect(app.shows(field)).toBe(false);
  }
  await app.press(advanced);
  expect(app.texts()).toContain(optionsJson);
  expect(app.texts()).toContain(headersJson);
  expect(app.value(temperature)).toBe('0.3');
  await app.clear(temperature);
  await app.type(temperature, '0');
  await app.paste(providerOptions, { text: optionsJson });
  await app.paste(headers, { text: headersJson });

  await app.press(advanced);
  expect(app.shows(providerOptions)).toBe(false);
  await app.press(advanced);
  expect(app.value(providerOptions)).toBe(optionsJson);
  await app.press('label:保存');

  await app.press('label:aaa，已启用');
  await app.press(advanced);
  expect(app.value(temperature)).toBe('0.3');
  expect(app.value(providerOptions)).toBe('');
  expect(app.value(headers)).toBe('');
  await app.press('label:test，已启用');
  await app.press(advanced);
  expect(app.value(temperature)).toBe('0');
  expect(app.value(providerOptions)).toBe(optionsJson);
  expect(app.value(headers)).toBe(headersJson);
  await app.clear(temperature);
  await app.type(temperature, '1');
  await app.press('label:保存');
  expect(app.shows('text:温度须为 0 到 1 之间的数字。')).toBe(false);
  await app.clear(temperature);
  await app.press('label:保存');
  expect(app.value(temperature)).toBe('0.3');
  expect(
    JSON.parse(app.storage()['vadu.config']).profiles[0].providerOptions,
  ).toBe(optionsJson);
});

test('高级选项格式不合法时保留草稿并拒绝保存', async () => {
  const app = await openProviders({ height: 940 });
  const cases = [
    [temperature, '1.1', '温度须为 0 到 1 之间的数字。'],
    [temperature, '-0.1', '温度须为 0 到 1 之间的数字。'],
    [providerOptions, '{', '服务商选项须为有效的 JSON 对象。'],
    [providerOptions, '[]', '服务商选项须为有效的 JSON 对象。'],
    [
      headers,
      '{"X-Client": 42}',
      '请求头名称须符合 HTTP 格式，值须为单行字符串。',
    ],
    [headers, '{"authorization": "demo"}', '请求头不能包含认证或凭据字段。'],
  ];
  for (const [field, value, message] of cases) {
    await app.type(name, ' 草稿');
    await app.press(advanced);
    if (field === temperature) await app.clear(field);
    await app.paste(field, { text: value });
    await app.press('label:保存');
    expect(app.shows(`text:${message}`)).toBe(true);
    expect(app.value(field)).toBe(value);
    expect(app.value(name)).toBe('test 草稿');
    await app.press('label:aaa，已启用');
    await app.press('label:test，已启用');
    expect(app.value(name)).toBe('test');
  }
  expect(app.storage()).toEqual(seeded);
});

test('服务商可用手柄排序，拖动保留编辑草稿', async () => {
  const app = await openProviders();
  const order = () =>
    app.texts().filter((text) => text === 'test' || text === 'aaa');
  expect(order()).toEqual(['test', 'aaa']);
  await app.type(name, ' 草稿');

  await app.drag('id:provider-row-2', { x: 0, y: -44 });
  await app.drag('id:provider-grip-2', { x: 0, y: -10 });
  expect(order()).toEqual(['test', 'aaa']);
  expect(app.value(name)).toBe('test 草稿');
  await app.drag('id:provider-grip-2', { x: 0, y: -44 });
  expect(order()).toEqual(['aaa', 'test']);
  expect(app.value(name)).toBe('test 草稿');

  await app.press('id:settings-general');
  await app.press(category);
  expect(order()).toEqual(['aaa', 'test']);
});

test('筛选后拖拽排序保留隐藏服务商的位置', async () => {
  const app = await openProviders({
    height: 800,
    storage: providerStorage(
      provider('1', 'test'),
      provider('2', 'aaa'),
      provider('3', 'test-plus'),
    ),
  });
  const search = 'label:搜索服务商';
  await app.type(search, 'test');
  await app.drag('id:provider-grip-3', { x: 0, y: -44 });
  await app.clear(search);
  expect(
    app.texts().filter((text) => ['test', 'aaa', 'test-plus'].includes(text)),
  ).toEqual(['test-plus', 'aaa', 'test']);
});

test('服务商深浅配色可读，缩小窗口后列表滚动不影响搜索和新增', async () => {
  const app = await openProviders({ colorScheme: 'light' });
  expect(app.spanStyle('text:名称').color).toBe('#0a0a0aff');
  await app.setColorScheme('dark');
  expect(app.spanStyle('text:名称').color).toBe('#fafafaff');

  const search = 'label:搜索服务商';
  const add = 'label:新增翻译服务商';
  expect(app.shows(`${list} >> id:provider-row-1`)).toBe(true);
  for (const control of [search, filter, add]) {
    expect(app.shows(`${list} >> ${control}`)).toBe(false);
  }

  await app.setViewport(600, 300);
  await app.scroll(list, 500);
  await app.type(search, 'aaa');
  expect(app.shows(`${list} >> id:provider-row-2`)).toBe(true);
  expect(app.shows(`${list} >> id:provider-row-1`)).toBe(false);
  await app.press(add);
  const editor = 'id:provider-editor-scroll';
  await app.scroll(editor, 700);
  await app.press('label:保存');
  await app.scroll(editor, -700);
  expect(app.shows('text:请填写名称和接口地址。')).toBe(true);
});

test('API Key 写入 NSH Storage 独立键，不进入普通配置', async () => {
  const key = 'fake-test-key';
  const app = await open('../App.tsx', {
    platform: 'macos',
    width: 960,
    height: 800,
    storage: providerStorage(provider('1', 'test')),
  });
  await app.press(category);
  await app.waitUntil(() => app.shows('text:未设置 API Key'));
  await app.type(keyInput, key);
  await app.press('label:保存');
  expect(app.shows('text:服务商已保存。')).toBe(true);
  await app.waitUntil(() => app.shows('text:已保存 API Key'));
  const stored = app.storage();
  expect(JSON.parse(stored['vadu.secret.1']).key).toBe(key);
  expect(stored['vadu.config']).not.toContain(key);
  expect(app.value(keyInput)).toBe(key);
  await app.press('label:显示密钥');
  expect(app.value(keyInput)).toBe(key);
  await app.press('label:隐藏密钥');
  expect(app.value(keyInput)).toBe(key);
  await app.clear(keyInput);
  await app.press('label:保存');
  expect(app.value(keyInput)).toBe(key);
  await app.clear(address);
  expect(app.value(keyInput)).toBe('');
  expect(app.enabled('label:显示密钥')).toBe(false);
});
