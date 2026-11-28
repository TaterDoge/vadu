import { expect, open, type OpenOptions, test } from 'nsh/test';

import { provider, providerStorage } from './fixtures/provider-config';

const list = 'id:providers-list-scroll';
const emptyList = 'id:providers-list-empty';
const name = 'id:provider-name';
const address = 'id:provider-base-url';
const model = 'id:provider-model';
const modelList = 'id:provider-model-list';
const modelSearch = 'label:搜索模型';
const modelRefresh = 'label:刷新模型列表';
const modelDrawer = 'label:管理模型';
const modelDone = 'label:完成选择';
const modelCheck = 'id:provider-health-check';
const checkDialog = 'id:provider-health-dialog';
const checkSelect = 'id:provider-health-model';
const startCheck = `${checkDialog} >> label:开始`;
const cancelCheck = `${checkDialog} >> label:取消`;
const manualModel = 'label:手动输入模型 ID';
const addModel = 'label:添加模型';
const keyInput = 'id:provider-api-key';
const toast = 'id:provider-toast';
const filter = 'label:按启用状态筛选';
const advanced = 'label:高级选项';
const temperature = 'label:温度';
const providerOptions = 'label:服务商选项';
const headers = 'label:请求头';
const category = 'id:settings-providers';
const compactViewportWidth = 500;
const seeded = providerStorage(provider('1', 'test'), provider('2', 'aaa'));

async function openProviders(options: OpenOptions = {}) {
  const app = await open('../App.tsx', {
    platform: 'macos',
    width: 960,
    height: 620,
    storage: seeded,
    ...options,
  });
  await app.setViewport(options.width ?? 960, options.height ?? 620);
  await app.press(category);
  return app;
}

test('服务商可选择、用搜索框内的图标筛选与切换分类，识别和语音标明尚未接入', async () => {
  const app = await openProviders();
  const searchBar = 'label:服务商搜索与筛选';
  const bar = app.layout(searchBar)!;
  const button = app.layout(filter)!;
  const rightInset = bar.x + bar.width - (button.x + button.width);
  expect(rightInset).toBe(button.y - bar.y);
  expect(app.shows(`${list} >> label:test，已启用`)).toBe(true);
  expect(app.value(name)).toBe('test');
  await app.press('label:aaa，已启用');
  expect(app.value(name)).toBe('aaa');
  await app.type(`${searchBar} >> label:搜索服务商`, '  TESt  ');
  expect(app.shows('text:全部状态')).toBe(false);
  await app.press(`${searchBar} >> ${filter}`);
  await app.press('text:仅已停用');
  expect(app.shows(`${emptyList} >> text:没有匹配的服务商`)).toBe(true);
  expect(app.value(name)).toBe('aaa');
  expect(app.shows('text:仅已停用')).toBe(false);
  await app.press(filter);
  await app.press('text:仅已启用');
  expect(app.shows('label:test，已启用')).toBe(true);
  expect(app.shows('label:aaa，已启用')).toBe(false);

  for (const tab of ['识别', '语音']) {
    await app.press(`label:${tab}`);
    expect(app.shows(`${emptyList} >> text:暂无服务商`)).toBe(true);
    expect(
      app.shows(`id:provider-editor-scroll >> text:${tab}服务尚未接入`),
    ).toBe(true);
    expect(app.shows('label:新增翻译服务商')).toBe(false);
  }
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
  await app.host.send('hide-settings');
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
  await app.press(modelList);
  expect(app.enabled(modelRefresh)).toBe(false);
  expect(app.requests()).toEqual([]);
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
  expect(app.shows(`${emptyList} >> text:暂无服务商`)).toBe(true);
  expect(app.shows('id:provider-editor-scroll >> text:选择或新增服务商')).toBe(
    true,
  );
  await app.press('label:新增翻译服务商');
  await app.press('label:保存');
  expect(app.shows('text:请填写名称和接口地址。')).toBe(true);
  await app.press(modelList);
  expect(app.enabled(modelRefresh)).toBe(false);
  await app.press(modelDone);

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
  expect(app.shows(`${model} >> text:未选择模型`)).toBe(true);
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
        body: { data: [{ id: 'draft-model' }, { id: 'other-model' }] },
      },
    },
  });
  const initialStorage = app.storage();
  await app.press('label:新增翻译服务商');
  await app.type(address, 'https://draft.example/v1');
  await app.press(modelList);
  expect(app.enabled(modelRefresh)).toBe(false);
  expect(app.requests()).toEqual([]);
  await app.press(modelDone);
  await app.type(keyInput, key);

  await app.press(modelList);
  const dialog = 'id:provider-confirm-dialog';
  expect(app.shows(dialog)).toBe(true);
  expect(app.texts().join(' ')).toContain('https://draft.example/v1');
  expect(app.requests()).toEqual([]);
  await app.press('label:确认地址并获取模型');
  await app.waitFor(`${toast} >> text:已获取 2 个模型。`);
  await app.waitFor('label:draft-model');
  await app.press('label:draft-model');
  expect(app.shows(modelDrawer)).toBe(true);
  expect(app.shows('text:完成(已选1个)')).toBe(true);
  await app.press('label:other-model');
  expect(app.shows('text:完成(已选2个)')).toBe(true);
  await app.press(modelDone);
  expect(app.shows(modelDrawer)).toBe(false);
  expect(app.shows(`${model} >> text:draft-model`)).toBe(true);
  expect(app.shows(`${model} >> text:other-model`)).toBe(true);
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
  expect(savedModel).toEqual(['draft-model', 'other-model']);
  expect(JSON.parse(app.storage()[`vadu.secret.${id}`])).toEqual({
    base_url: 'https://draft.example/v1',
    key,
  });
  expect(app.storage()['vadu.config']).not.toContain(key);
});

test('右侧模型抽屉支持多选、取消勾选和手动添加，保存后恢复', async () => {
  const network = {
    'https://example.com/v1/models': {
      body: { data: [{ id: 'model-a' }, { id: 'model-b' }] },
    },
  };
  const app = await openProviders({
    storage: providerStorage(provider('one', '测试', { model: [] })),
    network,
  });
  await app.press(modelList);
  await app.waitFor('label:model-b');
  const search = app.layout(modelSearch)!;
  expect(search.x).toBeGreaterThan(480);
  expect(app.shows(modelDone)).toBe(true);
  await app.press('label:model-a');
  await app.press('label:model-b');
  expect(app.accessibility('label:model-a')?.checked).toBe('true');
  expect(app.accessibility('label:model-b')?.checked).toBe('true');
  await app.press('label:model-a');
  expect(app.accessibility('label:model-a')?.checked).not.toBe('true');
  await app.type(manualModel, 'custom-model');
  await app.press(addModel);
  expect(app.accessibility('label:custom-model')?.checked).toBe('true');
  await app.type(manualModel, 'custom-model');
  expect(app.enabled(addModel)).toBe(false);
  await app.press(modelDone);
  expect(app.shows(`${model} >> text:model-b`)).toBe(true);
  expect(app.shows(`${model} >> text:custom-model`)).toBe(true);
  await app.press('label:保存');
  const storage = app.storage();
  expect(JSON.parse(storage['vadu.config']).profiles[0].model).toEqual([
    'model-b',
    'custom-model',
  ]);

  const reopened = await openProviders({ storage, network });
  await reopened.press(modelList);
  await reopened.waitFor('label:model-b');
  expect(reopened.accessibility('label:model-b')?.checked).toBe('true');
  expect(reopened.accessibility('label:custom-model')?.checked).toBe('true');
  await reopened.setViewport(600, 400);
  expect(reopened.shows(modelSearch)).toBe(true);
  expect(reopened.shows(modelDone)).toBe(true);
  await reopened.press(modelDone);
  expect(reopened.shows(`${model} >> text:model-b`)).toBe(true);
  expect(reopened.shows(`${model} >> text:custom-model`)).toBe(true);
});

test('已选模型可逐项移除，保存后写入配置', async () => {
  const storage = providerStorage(
    provider('1', 'test', { model: ['model-a', 'model-b'] }),
  );
  const app = await openProviders({ height: 800, storage });
  const first = `${model} >> text:model-a`;
  const second = `${model} >> text:model-b`;
  const removeFirst = `${model} >> label:移除模型 model-a`;
  expect(app.layout(removeFirst)!.x).toBeGreaterThan(app.layout(first)!.x);
  expect(app.layout(second)!.y).toBeGreaterThan(app.layout(first)!.y);
  await app.press(removeFirst);
  expect(app.shows(first)).toBe(false);
  expect(app.shows(second)).toBe(true);
  expect(app.storage()).toEqual(storage);

  await app.press('label:保存');
  expect(JSON.parse(app.storage()['vadu.config']).profiles[0].model).toEqual([
    'model-b',
  ]);
  await app.press(`${model} >> label:移除模型 model-b`);
  expect(app.shows(`${model} >> text:未选择模型`)).toBe(true);
  expect(app.enabled(modelCheck)).toBe(true);
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
  await app.press(modelDone);
  await app.clear(address);
  await app.type(address, 'https://other.example/v1');
  expect(app.value(keyInput)).toBe('');
  await app.press(modelList);
  expect(app.enabled(modelRefresh)).toBe(false);
  await app.press(modelDone);
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
  await app.press(modelList);
  expect(app.enabled(modelRefresh)).toBe(false);
  await app.press(modelDone);
  expect(app.requests()).toEqual([]);
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
  expect(reopened.enabled(modelCheck)).toBe(false);
  await reopened.press(modelList);
  expect(reopened.enabled(modelRefresh)).toBe(false);
  expect(reopened.requests()).toEqual([]);
});

test('检测弹窗可选择未启用的已获取模型并使用已保存的连接和密钥', async () => {
  const baseUrl = 'https://example.com/proxy/v1';
  const key = 'fake-test-key';
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
      [`POST ${baseUrl}/chat/completions`]: () =>
        ++checks === 1
          ? { delay: 1000, body: { choices: [{ message: { content: 'OK' } }] } }
          : { status: 503, body: 'fake upstream details' },
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

  await app.clear(keyInput);
  await app.type(keyInput, 'fake-unsaved-key');
  await app.press(modelCheck);
  expect(app.shows(checkDialog)).toBe(true);
  await app.waitUntil(() => app.enabled(checkSelect));
  expect(app.requests()).toHaveLength(1);
  expect(app.requests()[0]).toMatchObject({
    method: 'GET',
    url: `${baseUrl}/models`,
    headers: { authorization: `Bearer ${key}`, 'x-profile': 'test' },
  });
  expect(app.shows(`${checkSelect} >> text:demo-model`)).toBe(true);
  await app.press(checkSelect);
  await app.press('text:model-b');
  await app.press(startCheck);
  await app.waitFor(`${checkDialog} >> text:正在检测：model-b`);
  expect(app.enabled(checkSelect)).toBe(false);
  expect(app.enabled(cancelCheck)).toBe(true);
  await app.waitFor(`${checkDialog} >> text:模型 model-b 可以正常对话。`);
  expect(app.enabled(startCheck)).toBe(true);
  expect(app.requests()[1]).toMatchObject({
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${key}`, 'x-profile': 'test' },
  });
  expect(JSON.parse(app.requests()[1].body!)).toEqual({
    model: 'model-b',
    temperature: 0.3,
    max_tokens: 1,
    stream: false,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
  });

  await app.press(cancelCheck);
  expect(app.shows(checkDialog)).toBe(false);
  expect(app.shows(`${model} >> text:demo-model`)).toBe(true);
  expect(app.shows(`${model} >> text:model-b`)).toBe(false);
  await app.clear(keyInput);
  await app.press(modelList);
  await app.waitFor('label:model-b');
  expect(lists).toBe(1);
  await app.press('label:demo-model');
  await app.type(modelSearch, 'MODEL-B');
  expect(app.shows('label:model-a')).toBe(false);
  await app.keyboard.press('enter');
  expect(app.shows(modelSearch)).toBe(true);
  await app.press(modelDone);
  expect(app.shows(modelSearch)).toBe(false);
  expect(app.shows(`${model} >> text:model-b`)).toBe(true);
  await app.press(modelCheck);
  expect(app.shows(`${checkSelect} >> text:model-b`)).toBe(true);
  await app.press(startCheck);
  await app.waitFor(`${checkDialog} >> text:服务商暂时不可用，请稍后重试。`);
  expect(app.texts().join(' ')).not.toContain('fake upstream details');
  expect(app.enabled(startCheck)).toBe(true);
  expect(JSON.parse(app.requests()[2].body!).model).toBe('model-b');
  await app.press('label:关闭模型检测');
  expect(app.shows(checkDialog)).toBe(false);
  expect(JSON.parse(app.storage()['vadu.config']).profiles[0].model).toEqual([
    'demo-model',
  ]);
  await app.press('label:保存');
  expect(JSON.parse(app.storage()['vadu.config']).profiles[0].model).toEqual([
    'model-b',
  ]);

  await app.press(modelList);
  expect(app.shows('label:model-b')).toBe(true);
  expect(lists).toBe(1);
  await app.press(modelRefresh);
  await app.waitFor(`${toast} >> text:无法完成服务商请求，请检查地址和网络。`);
  expect(app.texts().join(' ')).not.toContain('fake upstream details');
  expect(app.shows('label:model-b')).toBe(true);
  await app.press(modelRefresh);
  await app.waitFor('label:model-c');
  // 上游不再返回的已选模型也能继续管理。
  expect(app.shows('label:model-b')).toBe(true);
  await app.keyboard.press('escape');
  expect(app.shows(modelSearch)).toBe(false);
  expect(app.shows(`${model} >> text:model-b`)).toBe(true);

  await app.clear(address);
  await app.type(address, 'https://different.example/v1');
  expect(app.enabled(keyInput)).toBe(true);
  await app.press(modelList);
  expect(app.enabled(modelRefresh)).toBe(false);
  expect(lists).toBe(3);
  expect(JSON.parse(app.storage()['vadu.secret.1'])).toEqual({
    base_url: baseUrl,
    key,
  });
});

test('未启用模型时也能检测选中的单个模型', async () => {
  const storage = providerStorage(provider('1', 'test', { model: [] }));
  const baseUrl = 'https://example.com/v1';
  const app = await openProviders({
    storage,
    height: 400,
    network: {
      [`${baseUrl}/models`]: {
        body: { data: [{ id: 'model-a' }, { id: 'model-b' }] },
      },
      [`POST ${baseUrl}/chat/completions`]: { body: { choices: [{}] } },
    },
  });
  await app.press(modelCheck);
  await app.waitUntil(() => app.enabled(startCheck));
  expect(app.shows(`${checkDialog} >> label:检测所有模型`)).toBe(false);
  await app.press(checkSelect);
  await app.press('text:model-b');
  await app.press(startCheck);
  await app.waitFor(`${checkDialog} >> text:模型 model-b 可以正常对话。`);
  expect(app.requests()).toHaveLength(2);
  expect(JSON.parse(app.requests()[1].body!).model).toBe('model-b');
  await app.keyboard.press('escape');
  expect(app.shows(checkDialog)).toBe(false);
  expect(app.storage()).toEqual(storage);
});

test('模型查询不发送旧地址密钥，并限制响应大小和等待时间', async () => {
  const baseUrl = 'https://new.example/v1';
  const models = { data: [{ id: 'demo-model' }] };
  let requests = 0;
  const app = await openProviders({
    height: 900,
    clock: {},
    storage: {
      ...providerStorage(provider('1', 'test', { baseUrl, model: [] })),
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

test('取消弹窗或隐藏设置窗口中止模型检测，恢复后可立即重试', async () => {
  let attempts = 0;
  const app = await open('./fixtures/Windows.tsx', {
    platform: 'macos',
    width: 960,
    height: 800,
    storage: seeded,
    host: {},
    clock: {},
    network: {
      'https://example.com/v1/models': {
        body: { data: [{ id: 'demo-model' }, { id: 'other-model' }] },
      },
      'POST https://example.com/v1/chat/completions': () =>
        ++attempts < 3
          ? { delay: 2000, status: 503 }
          : { body: { choices: [{}] } },
    },
  });
  await app.press(category);
  await app.press(modelCheck);
  await app.waitUntil(() => app.enabled(startCheck));
  await app.press(startCheck);
  await app.waitUntil(() => attempts === 1);
  await app.press(cancelCheck);
  expect(app.shows(checkDialog)).toBe(false);
  await app.waitUntil(() => app.enabled(modelCheck), { timeout: 500 });

  await app.press(modelCheck);
  await app.press(startCheck);
  await app.waitUntil(() => attempts === 2);
  const main = app.window('main');
  await app.host.send('hide-settings');
  expect(main.state()).toMatchObject({ visible: false });
  await app.host.send('open-settings');
  expect(main.state()).toMatchObject({ visible: true });
  await app.waitFor(modelCheck, { timeout: 500 });
  expect(app.shows(checkDialog)).toBe(false);
  expect(app.enabled(modelCheck)).toBe(true);
  await app.press(modelCheck);
  await app.press(startCheck);
  const success = `${checkDialog} >> text:模型 demo-model 可以正常对话。`;
  await app.waitFor(success);
  await app.wait(2000);
  expect(app.shows(success)).toBe(true);
  expect(app.requests()).toHaveLength(4);
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
  await app.waitFor(
    `${toast} >> text:服务商配置已保存，API Key 保存失败。无法写入本地存储，请重试。`,
  );
  expect(app.shows('text:服务商已保存。')).toBe(false);
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
  expect(JSON.parse(app.storage()['vadu.config']).profiles[0].temperature).toBe(
    0,
  );

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
  expect(JSON.parse(app.storage()['vadu.config']).profiles[0].temperature).toBe(
    1,
  );
  await app.clear(temperature);
  await app.press('label:保存');
  expect(app.value(temperature)).toBe('0.3');
  const saved = JSON.parse(app.storage()['vadu.config']).profiles[0];
  expect(saved.temperature).toBe(0.3);
  expect(saved.providerOptions).toBe(optionsJson);
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

test('Tab 逐行聚焦服务商，Enter 和 Space 选择整行', async () => {
  const app = await openProviders();
  expect(app.shows('id:provider-row-2 >> id:provider-grip-2')).toBe(true);
  await app.type('label:搜索服务商', ' ');
  await app.keyboard.press('tab'); // 筛选按钮
  await app.keyboard.press('tab'); // 第一个服务商
  await app.keyboard.press('tab'); // 第二个服务商
  expect(app.value(name)).toBe('test');
  await app.keyboard.press('enter');
  expect(app.value(name)).toBe('aaa');
  await app.keyboard.press('shift+tab');
  await app.keyboard.press('space');
  expect(app.value(name)).toBe('test');
});

test('服务商列表与详情的滚动区为焦点环留白，宽窄布局保持对齐', async () => {
  const app = await openProviders();
  for (const width of [960, 600, compactViewportWidth]) {
    await app.setViewport(width, 620);
    const row = app.layout('id:provider-row-1')!;
    const search = app.layout('label:服务商搜索与筛选')!;
    const field = app.layout(name)!;
    const editor = app.layout('id:provider-editor-scroll')!;
    expect(row.x).toBe(search.x);
    expect(row.width).toBe(search.width);
    for (const [control, scroll] of [
      [row, app.layout(list)!],
      [field, editor],
      [app.layout(advanced)!, editor],
    ]) {
      expect(control.x - scroll.x).toBe(4);
      expect(scroll.x + scroll.width - (control.x + control.width)).toBe(4);
    }
    if (width === compactViewportWidth) expect(field.x).toBe(row.x);
    else expect(field.x - (row.x + row.width)).toBe(16);
  }
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
  expect(app.spanStyle('text:名称').color).toBe('#101319ff');
  await app.setColorScheme('dark');
  expect(app.spanStyle('text:名称').color).toBe('#eeeff1ff');

  const search = 'label:搜索服务商';
  const add = 'label:新增翻译服务商';
  expect(app.shows(`${list} >> id:provider-row-1`)).toBe(true);
  for (const control of [search, filter, add]) {
    expect(app.shows(`${list} >> ${control}`)).toBe(false);
  }

  await app.setViewport(compactViewportWidth, 300);
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
