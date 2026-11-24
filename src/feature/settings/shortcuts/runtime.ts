import { cleanup, computed, effect, keymap, platform, signal } from 'nsh';
import { GlobalShortcut, Window } from 'nsh/desktop';

import {
  openTranslateWindow,
  toggleTranslatePin,
} from '../../../windows/translate/TranslateWindow';
import { type AppSettings, currentSettings } from '../store';
import { SettingsError } from '../validation';
import { GLOBAL_SHORTCUT_ID } from './config';

const shortcutActions = [
  {
    id: GLOBAL_SHORTCUT_ID,
    scope: 'global',
    run: openTranslateWindow,
  },
  {
    id: 'open-settings',
    scope: 'translate',
    run: () => Window.get('main')?.focus(),
  },
  {
    id: 'pin-translate',
    scope: 'translate',
    run: toggleTranslatePin,
  },
  {
    id: 'hide-translate',
    scope: 'translate',
    keystroke: 'cmd+w',
    run: () => Window.get('translate')?.hide(),
  },
] as const;

export const shortcutRecording = signal(false);
export const translateShortcutStatus = signal('正在读取快捷键配置…');

export function setupShortcuts(loaded: Promise<AppSettings>) {
  let disposed = false;
  cleanup(() => {
    disposed = true;
  });
  void loaded.catch((error) => {
    if (!disposed) {
      translateShortcutStatus.set(
        error instanceof SettingsError
          ? error.message
          : '无法读取快捷键配置，未启用。',
      );
    }
  });

  for (const action of shortcutActions) {
    const keystroke = computed(() => {
      const bindings = currentSettings()?.shortcuts;
      if (!bindings) return;
      if (action.id === 'hide-translate') {
        if (platform.os !== 'macos') return;
        // 用户已分配的组合优先，包括 mod+w 等别名。
        const label = keymap.label(action.keystroke);
        if (
          bindings.some(
            ({ enabled, keystroke }) =>
              enabled &&
              keystroke !== null &&
              keymap.label(keystroke) === label,
          )
        ) {
          return;
        }
        return action.keystroke;
      }
      const binding = bindings.find(({ id }) => id === action.id);
      if (binding?.enabled) return binding.keystroke;
    });

    effect(() => {
      const shortcut = keystroke();
      const recording = shortcutRecording();
      if (!shortcut) {
        if (action.scope === 'global' && currentSettings()) {
          translateShortcutStatus.set(shortcut === null ? '未绑定' : '已关闭');
        }
        return;
      }
      if (recording) {
        if (action.scope === 'global') {
          translateShortcutStatus.set('录入期间已暂停');
        }
        return;
      }
      if (action.scope !== 'global') {
        const state = Window.get(action.scope)?.state();
        // keymap 绑定共享应用 engine，失焦时解绑，避免截获其他窗口的按键。
        if (!state?.visible || !state.focused) return;
        return keymap.bind(shortcut, action.run, { when: 'always' });
      }

      let active = true;
      translateShortcutStatus.set('正在注册…');
      cleanup(() => {
        active = false;
        GlobalShortcut.unregister(shortcut);
      });
      void (async () => {
        try {
          const registered = await GlobalShortcut.register(shortcut, () => {
            if (active) action.run();
          });
          if (active) {
            translateShortcutStatus.set(
              registered
                ? '已启用'
                : '注册失败：组合键可能已被占用，或当前平台不支持。请更换组合键。',
            );
          }
        } catch {
          if (active) {
            translateShortcutStatus.set('注册失败，请重新录入快捷键后重试。');
          }
        }
      })();
    });
  }
}
