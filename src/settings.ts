import { keymap, platform, signal, Storage } from 'nsh';
import { Profiles, type ProviderProfile, Secrets } from 'vadu/native';

const CONFIG_KEY = 'vadu.config';
const SCHEMA_VERSION = 3;
export const providerConnectionsSupported = [
  'macos',
  'windows',
  'linux',
].includes(platform.os);
const DEFAULT_SHORTCUTS = [
  { id: 'toggle-translate', keystroke: 'mod+shift+m' },
  { id: 'open-settings', keystroke: 'mod+,' },
  { id: 'pin-translate', keystroke: 'mod+p' },
];

export type ShortcutBinding = {
  id: string;
  keystroke: string;
};

export type AppSettings = {
  shortcuts: ShortcutBinding[];
  profiles: ProviderProfile[];
};

export class SettingsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasFields(
  value: unknown,
  fields: string[],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
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

function validate(settings: AppSettings) {
  if (
    settings.shortcuts.length !== DEFAULT_SHORTCUTS.length ||
    DEFAULT_SHORTCUTS.some(
      ({ id }) =>
        settings.shortcuts.filter((binding) => binding.id === id).length !== 1,
    )
  ) {
    throw new SettingsError(
      'INVALID_CONFIG',
      '快捷键配置不完整或包含未知动作，原配置已保留。',
    );
  }
  const strokes = settings.shortcuts.map(({ keystroke }) =>
    parseShortcut(keystroke),
  );
  if (new Set(strokes).size !== strokes.length) {
    throw new SettingsError(
      'SHORTCUT_CONFLICT',
      '此快捷键已用于其他动作，请选择其他组合。',
    );
  }
}

function checkProfile(value: unknown) {
  const { profile, origin, error } = Profiles.check(value);
  if (!profile || !origin) {
    throw new SettingsError(
      error?.code ?? 'INVALID_CONFIG',
      error?.message ?? '服务商配置无效。',
    );
  }
  return { profile, origin };
}

function decode(saved: string | null): AppSettings {
  if (saved === null) {
    return {
      shortcuts: DEFAULT_SHORTCUTS.map((binding) => ({ ...binding })),
      profiles: [],
    };
  }
  const invalid = () =>
    new SettingsError(
      'INVALID_CONFIG',
      '配置格式损坏或不受支持，原配置已保留，未覆盖。',
    );
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    throw invalid();
  }
  if (!isRecord(value) || !Object.hasOwn(value, 'schemaVersion'))
    throw invalid();
  const version = value.schemaVersion;
  if (version !== 1 && version !== 2 && version !== SCHEMA_VERSION) {
    throw new SettingsError(
      'UNSUPPORTED_VERSION',
      '配置版本不受支持，请使用对应版本的应用；原配置未覆盖。',
    );
  }
  if (
    !hasFields(
      value,
      version === 1
        ? ['schemaVersion', 'settings']
        : ['schemaVersion', 'settings', 'profiles'],
    )
  ) {
    throw invalid();
  }
  if (
    !hasFields(value.settings, ['shortcuts']) ||
    !Array.isArray(value.settings.shortcuts)
  ) {
    throw invalid();
  }
  const shortcuts = value.settings.shortcuts.map((binding: unknown) => {
    if (
      !hasFields(binding, ['id', 'keystroke']) ||
      typeof binding.id !== 'string' ||
      typeof binding.keystroke !== 'string'
    ) {
      throw invalid();
    }
    return { id: binding.id, keystroke: binding.keystroke };
  });
  const profiles: ProviderProfile[] = [];
  if (version !== 1) {
    if (!Array.isArray(value.profiles)) throw invalid();
    const ids = new Set<string>();
    for (const item of value.profiles) {
      if (
        !isRecord(item) ||
        (version === 2 && Object.hasOwn(item, 'protocol'))
      ) {
        throw invalid();
      }
      const { profile } = checkProfile(
        version === 2 ? { ...item, protocol: 'chat-completions' } : item,
      );
      if (ids.has(profile.id) || profile.baseUrl !== item.baseUrl)
        throw invalid();
      ids.add(profile.id);
      profiles.push(profile);
    }
  }
  const settings = { shortcuts, profiles };
  validate(settings);
  return settings;
}

async function loadSettings() {
  return decode(await Storage.getItem(CONFIG_KEY));
}

// 配置和凭据变更共用队列，切页后也不会与同一 Profile 的删除交错。
let writes: Promise<unknown> = Promise.resolve();
const current = signal<AppSettings | null>(null);

async function read(): Promise<AppSettings> {
  await writes;
  const settings = await loadSettings();
  current.set(settings);
  return settings;
}

function enqueueWrite<T>(action: () => Promise<T>): Promise<T> {
  const update = writes.then(action);
  writes = update.catch(() => {});
  return update;
}

async function persistSettings(settings: AppSettings): Promise<void> {
  const { profiles, shortcuts } = settings;
  try {
    await Storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        settings: { shortcuts },
        profiles,
      }),
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ERR_NSH_QUOTA_EXCEEDED'
    ) {
      throw new SettingsError('STORAGE_FULL', '配置存储空间不足，修改未保存。');
    }
    throw error;
  }
  current.set(settings);
}

function updateSettings(
  change: (settings: AppSettings) => void | Promise<void>,
): Promise<AppSettings> {
  return enqueueWrite(async () => {
    const settings = await loadSettings();
    await change(settings);
    await persistSettings(settings);
    return settings;
  });
}

function setShortcut(id: string, keystroke: string): Promise<AppSettings> {
  return updateSettings((settings) => {
    const binding = settings.shortcuts.find((item) => item.id === id);
    if (!binding) throw new SettingsError('INVALID_CONFIG', '未知快捷键动作。');
    const command = commandModifier();
    binding.keystroke = parseShortcut(keystroke)
      .split('+')
      .map((part) => (part === command ? 'mod' : part))
      .join('+');
    validate(settings);
  });
}

function saveProfile(value: ProviderProfile, create: boolean, key: string) {
  return enqueueWrite(async () => {
    const settings = await loadSettings();
    const { profiles } = settings;
    const { profile } = checkProfile(value);
    const index = profiles.findIndex(({ id }) => id === profile.id);
    if (create !== (index === -1)) {
      throw new SettingsError(
        'INVALID_CONFIG',
        '服务商配置已变更，请重新打开后再保存。',
      );
    }
    if (create) profiles.push(profile);
    else profiles[index] = profile;

    // 凭据绑定已保存的地址。普通配置写入失败时，保留原凭据。
    await persistSettings(settings);
    if (!key) return { keyError: null };
    try {
      const error = await Secrets.set(profile.id, profile.baseUrl, key);
      return { keyError: error?.message ?? null };
    } catch {
      return { keyError: '无法写入本地存储，请重试。' };
    }
  });
}

async function clearKey(id: string): Promise<void> {
  const error = await Secrets.clear(id);
  if (error) throw new SettingsError(error.code, error.message);
}

function removeProfile(id: string): Promise<AppSettings> {
  return updateSettings(async (settings) => {
    if (!settings.profiles.some((profile) => profile.id === id)) {
      throw new SettingsError('INVALID_CONFIG', '服务商配置已不存在。');
    }
    if (providerConnectionsSupported) await clearKey(id);
    settings.profiles = settings.profiles.filter(
      (profile) => profile.id !== id,
    );
  });
}

function orderProfiles(ids: string[]): Promise<AppSettings> {
  return updateSettings((settings) => {
    const byId = new Map(
      settings.profiles.map((profile) => [profile.id, profile]),
    );
    const visible = new Set(ids);
    if (visible.size !== ids.length || ids.some((id) => !byId.has(id))) {
      throw new SettingsError(
        'INVALID_CONFIG',
        '服务商列表已变更，请重试排序。',
      );
    }
    // 只替换本次参与排序的位置，保留筛选隐藏的条目。
    let index = 0;
    settings.profiles = settings.profiles.map((profile) =>
      visible.has(profile.id) ? byId.get(ids[index++])! : profile,
    );
  });
}

function resetShortcut(id: string): Promise<AppSettings> {
  const binding = DEFAULT_SHORTCUTS.find((item) => item.id === id);
  if (!binding) {
    return Promise.reject(
      new SettingsError('INVALID_CONFIG', '未知快捷键动作。'),
    );
  }
  return setShortcut(id, binding.keystroke);
}

export const Settings = {
  read,
  setShortcut,
  resetShortcut,
  checkProfile,
  saveProfile,
  removeProfile,
  orderProfiles,
  current: () => current(),
};

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
