import { keymap, platform } from 'nsh';

import { hasFields, invalidConfig, SettingsError } from '../validation';

export const GLOBAL_SHORTCUT_ID = 'toggle-translate';

export type ShortcutBinding = {
  id: string;
  keystroke: string | null;
  enabled: boolean;
};

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: GLOBAL_SHORTCUT_ID, keystroke: null, enabled: true },
  { id: 'open-settings', keystroke: 'mod+,', enabled: true },
  { id: 'pin-translate', keystroke: 'mod+p', enabled: true },
];

export function defaultShortcuts(): ShortcutBinding[] {
  return DEFAULT_SHORTCUTS.map((binding) => ({ ...binding }));
}

export function decodeShortcuts(value: unknown): ShortcutBinding[] {
  if (!Array.isArray(value)) throw invalidConfig();
  // 旧版绑定一律启用。只接受完整的旧格式，混合缺字段的配置仍报错。
  const previousFormat = value.every(
    (item: unknown) =>
      hasFields(item, ['id', 'keystroke']) &&
      typeof item.keystroke === 'string',
  );
  const bindings = previousFormat
    ? value.map((item) => ({ ...item, enabled: true }))
    : value;
  const shortcuts = bindings.map((binding: unknown) => {
    if (
      !hasFields(binding, ['id', 'keystroke', 'enabled']) ||
      typeof binding.id !== 'string' ||
      typeof binding.enabled !== 'boolean' ||
      (typeof binding.keystroke !== 'string' &&
        !(binding.id === GLOBAL_SHORTCUT_ID && binding.keystroke === null))
    ) {
      throw invalidConfig();
    }
    return {
      id: binding.id,
      keystroke: binding.keystroke,
      enabled: binding.enabled,
    };
  });
  validateShortcuts(shortcuts);
  return shortcuts;
}

function commandModifier() {
  // 由 NSH 判断 Apple / 浏览器键盘约定，不从显示文本反推整组按键。
  return keymap.label('mod+k') === keymap.label('cmd+k') ? 'cmd' : 'ctrl';
}

// shortcut: 保留键规则对齐 NSH 0.6.0，升级 SDK 时同步核对。
function isReserved(keystroke: string) {
  switch (platform.os) {
    case 'macos':
    case 'ios':
      return ['cmd+q', 'cmd+h', 'alt+cmd+h', 'cmd+m', 'ctrl+cmd+f'].includes(
        keystroke,
      );
    case 'windows':
    case 'linux':
    case 'android':
      return ['ctrl+q', 'alt+f4', 'f11'].includes(keystroke);
    default:
      return false;
  }
}

function parseShortcut(text: string) {
  const invalid = () =>
    new SettingsError(
      'INVALID_CONFIG',
      '请按 Command / Ctrl / Alt 与其他键的组合，或 F1–F24。',
    );
  if (text.length > 128) throw invalid();
  try {
    keymap.label(text);
  } catch {
    throw invalid();
  }

  const parts = text.toLowerCase().split('+');
  const key = parts.pop()!;
  const command = commandModifier();
  const aliases: Record<string, string> = {
    control: 'ctrl',
    option: 'alt',
    opt: 'alt',
    command: 'cmd',
    meta: 'cmd',
    super: 'cmd',
    win: 'cmd',
    mod: command,
    cmdorctrl: command,
    commandorcontrol: command,
  };
  const modifiers = parts.map((part) => aliases[part] ?? part);
  if (
    !modifiers.some((part) => ['ctrl', 'alt', 'cmd'].includes(part)) &&
    !/^f\d+$/.test(key)
  ) {
    throw invalid();
  }
  const keyAliases: Record<string, string> = {
    return: 'enter',
    esc: 'escape',
    del: 'delete',
    arrowup: 'up',
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    plus: '=',
    minus: '-',
  };
  const canonical = [
    ...['ctrl', 'alt', 'shift', 'cmd'].filter((part) =>
      modifiers.includes(part),
    ),
    keyAliases[key] ?? key,
  ].join('+');
  if (isReserved(canonical)) {
    throw new SettingsError(
      'INVALID_CONFIG',
      '此组合键由系统保留，请选择其他快捷键。',
    );
  }
  return canonical;
}

export function validateShortcuts(shortcuts: ShortcutBinding[]) {
  if (
    shortcuts.length !== DEFAULT_SHORTCUTS.length ||
    DEFAULT_SHORTCUTS.some(
      ({ id }) => !shortcuts.some((binding) => binding.id === id),
    )
  ) {
    throw new SettingsError(
      'INVALID_CONFIG',
      '快捷键配置不完整或包含未知动作，原配置已保留。',
    );
  }
  const strokes: string[] = [];
  for (const { keystroke, enabled } of shortcuts) {
    if (keystroke === null) continue;
    const stroke = parseShortcut(keystroke);
    if (enabled) strokes.push(stroke);
  }
  if (new Set(strokes).size !== strokes.length) {
    throw new SettingsError(
      'SHORTCUT_CONFLICT',
      '此快捷键已用于其他动作，请选择其他组合。',
    );
  }
}

export function portableShortcut(keystroke: string) {
  const command = commandModifier();
  return parseShortcut(keystroke)
    .split('+')
    .map((part) => (part === command ? 'mod' : part))
    .join('+');
}

export function captureShortcutKeys() {
  const keys = [
    ..."abcdefghijklmnopqrstuvwxyz0123456789`-=[]\\;',./",
    'space',
    'enter',
    'escape',
    'tab',
    'backspace',
    'delete',
    'insert',
    'up',
    'down',
    'left',
    'right',
    'home',
    'end',
    'pageup',
    'pagedown',
    ...Array.from({ length: 24 }, (_, index) => `f${index + 1}`),
  ];
  const result: string[] = [];
  for (let mask = 0; mask < 16; mask++) {
    const modifiers = ['ctrl', 'alt', 'shift', 'cmd'].filter(
      (_, index) => mask & (1 << index),
    );
    for (const key of keys) {
      const stroke = [...modifiers, key].join('+');
      if (
        !['escape', 'tab', 'shift+tab'].includes(stroke) &&
        !isReserved(stroke)
      ) {
        result.push(stroke);
      }
    }
  }
  return result;
}
