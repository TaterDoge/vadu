import { host, keymap, mount, signal, Text, View } from 'nsh';

import { Button } from '@/components/ui/button';

import {
  captureShortcutKeys,
  Settings,
  SettingsError,
} from '../../src/feature/settings';
import { provider } from './provider-config';

function SettingsFixture() {
  const status = signal('{}');

  async function read() {
    try {
      status.set(JSON.stringify({ settings: await Settings.read() }));
    } catch (error) {
      status.set(
        JSON.stringify({
          code: error instanceof SettingsError ? error.code : 'INTERNAL',
        }),
      );
    }
  }

  async function update() {
    const { first, target } = host.params;
    const id = typeof target === 'string' ? target : 'toggle-translate';
    const updates = [
      first === null
        ? Settings.resetShortcut(id)
        : Settings.setShortcut(
            id,
            typeof first === 'string' ? first : 'Command+Alt+K',
          ),
      Settings.setShortcutEnabled(id, false),
    ];
    const latest = Settings.read();
    const results = await Promise.allSettled(updates);
    const settings = await latest;
    status.set(
      JSON.stringify({
        results: results.map((result) =>
          result.status === 'fulfilled'
            ? { status: result.status }
            : {
                status: result.status,
                code:
                  result.reason instanceof SettingsError
                    ? result.reason.code
                    : 'INTERNAL',
              },
        ),
        settings,
      }),
    );
  }

  async function updateModules() {
    await Promise.all([
      Settings.setAppearance({ mode: 'dark' }),
      Settings.setShortcutEnabled('toggle-translate', false),
      Settings.saveProfile(provider('one', '测试'), true, 'test-key'),
      Settings.setAppearance({ accent: 'blue' }),
    ]);
    await read();
  }

  function checkCaptureKeys() {
    const keys = captureShortcutKeys();
    try {
      const stop = keymap.bind(
        Object.fromEntries(keys.map((key) => [key, () => {}])),
      );
      stop();
      status.set(
        JSON.stringify({
          unique: new Set(keys).size === keys.length,
          navigationExcluded: ['escape', 'tab', 'shift+tab'].every(
            (key) => !keys.includes(key),
          ),
          lastFunctionKey: keys.includes('ctrl+alt+shift+cmd+f24'),
        }),
      );
    } catch {
      status.set(JSON.stringify({ error: '键表包含无效或系统保留组合' }));
    }
  }

  return (
    <View>
      <Button testID="read" onPress={read}>
        读取配置
      </Button>
      <Button testID="update" onPress={update}>
        同时保存两项
      </Button>
      <Button testID="update-modules" onPress={updateModules}>
        并发保存不同模块
      </Button>
      <Button testID="check-keys" onPress={checkCaptureKeys}>
        校验键表
      </Button>
      <Text>{`配置状态 ${status()}`}</Text>
    </View>
  );
}

mount(SettingsFixture);
