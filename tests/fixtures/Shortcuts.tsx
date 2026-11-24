import { host, mount, signal, Text, View } from 'nsh';
import { GlobalShortcut, Window } from 'nsh/desktop';

import { Settings } from '../../src/feature/settings';
import {
  shortcutRecording,
  translateShortcutStatus,
} from '../../src/feature/settings/shortcuts/runtime';
import { SettingsWindow } from '../../src/windows/settings/SettingsWindow';

function ShortcutsFixture() {
  const windowOptions = signal('{}');
  const windowUpdates = signal('{}');
  const observedWindows = new WeakSet();
  const openWindow = Window.open;
  Window.open = (component, options) => {
    windowOptions.set(JSON.stringify(options));
    windowUpdates.set('{}');
    const window = openWindow(component, options);
    if (!observedWindows.has(window)) {
      observedWindows.add(window);
      const setWindow = window.set.bind(window);
      window.set = (attributes) => {
        windowUpdates.set(JSON.stringify(attributes));
        setWindow(attributes);
      };
    }
    return window;
  };
  const mounted = signal(true);
  const events = signal<string[]>([]);
  const log: string[] = [];
  const registrations: {
    keystroke: string;
    onPress: () => void;
    active: boolean;
  }[] = [];
  let resolveFirst: ((registered: boolean) => void) | undefined;

  function record(event: string) {
    log.push(event);
    events.set([...log]);
  }

  GlobalShortcut.register = (keystroke, onPress) => {
    registrations.push({ keystroke, onPress, active: true });
    record(`register:${keystroke}`);
    if (registrations.length === 1) {
      switch (host.params.registration) {
        case 'occupied':
          return Promise.resolve(false);
        case 'reject':
          return Promise.reject(new Error('registration failed'));
        case 'throw':
          throw new Error('registration failed');
        case 'delayed':
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
      }
    }
    return Promise.resolve(true);
  };
  GlobalShortcut.unregister = (keystroke) => {
    for (const registration of registrations) {
      if (registration.keystroke === keystroke) registration.active = false;
    }
    record(`unregister:${keystroke}`);
  };

  host.on<string>('press-shortcut', (keystroke) => {
    registrations
      .findLast(
        (registration) =>
          registration.active && registration.keystroke === keystroke,
      )
      ?.onPress();
  });
  host.on('press-stale-shortcut', () => registrations[0]?.onPress());
  host.on<boolean>('resolve-first', (registered) => resolveFirst?.(registered));
  host.on('unmount-settings', () => mounted.set(false));
  host.on('mount-settings', () => mounted.set(true));
  host.on<boolean>('set-recording', (recording) =>
    shortcutRecording.set(recording),
  );
  host.on('close-translate', () => Window.get('translate')?.close());
  host.on('minimize-translate', () => Window.get('translate')?.minimize());
  host.on('focus-settings', () => Window.get('main')?.focus());
  host.on('hide-settings', () => Window.get('main')?.hide());
  host.on('update-appearance', () => {
    void Settings.setAppearance({ mode: 'dark' });
  });

  return (
    <View class="flex-1">
      <If when={mounted()}>
        <SettingsWindow />
      </If>
      <Text>{`窗口参数 ${windowOptions()}`}</Text>
      <Text>{`窗口更新 ${windowUpdates()}`}</Text>
      <Text>{`注册记录 ${JSON.stringify(events())}`}</Text>
      <Text>{`快捷键状态 ${translateShortcutStatus()}`}</Text>
    </View>
  );
}

mount(ShortcutsFixture);
