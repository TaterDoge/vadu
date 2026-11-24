import { signal, Storage } from 'nsh';

import {
  type AppearanceSettings,
  decodeAppearance,
  defaultAppearance,
} from './appearance/config';
import { decodeProfiles, type ProviderProfile } from './providers/config';
import {
  decodeShortcuts,
  defaultShortcuts,
  type ShortcutBinding,
} from './shortcuts/config';
import {
  hasFields,
  invalidConfig,
  isRecord,
  SettingsError,
} from './validation';

const CONFIG_KEY = 'vadu.config';

export type AppSettings = {
  appearance: AppearanceSettings;
  shortcuts: ShortcutBinding[];
  profiles: ProviderProfile[];
};

function decode(saved: string | null): AppSettings {
  if (saved === null) {
    return {
      appearance: { ...defaultAppearance },
      shortcuts: defaultShortcuts(),
      profiles: [],
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    throw invalidConfig();
  }
  if (
    !hasFields(value, ['settings', 'profiles']) ||
    !hasFields(value.settings, ['appearance', 'shortcuts'])
  ) {
    throw invalidConfig();
  }
  return {
    appearance: decodeAppearance(value.settings.appearance),
    shortcuts: decodeShortcuts(value.settings.shortcuts),
    profiles: decodeProfiles(value.profiles),
  };
}

const current = signal<AppSettings | null>(null);
export const currentSettings = () => current();

async function persist(settings: AppSettings) {
  const { appearance, shortcuts, profiles } = settings;
  try {
    await Storage.setItem(
      CONFIG_KEY,
      JSON.stringify({ settings: { appearance, shortcuts }, profiles }),
    );
  } catch (error) {
    if (isRecord(error) && error.code === 'ERR_NSH_QUOTA_EXCEEDED') {
      throw new SettingsError('STORAGE_FULL', '配置存储空间不足，修改未保存。');
    }
    throw error;
  }
  current.set(settings);
}

// 配置和独立凭据共用队列，提交配置后密钥操作仍在同一轮内完成。
let queue: Promise<unknown> = Promise.resolve();

export function withSettings<T>(
  action: (
    settings: AppSettings,
    commit: () => Promise<void>,
    missing: boolean,
  ) => T | Promise<T>,
): Promise<T> {
  const result = queue.then(async () => {
    const saved = await Storage.getItem(CONFIG_KEY);
    const settings = decode(saved);
    return action(settings, () => persist(settings), saved === null);
  });
  queue = result.catch(() => {});
  return result;
}

export function readSettings() {
  return withSettings(async (settings, commit, missing) => {
    if (missing) await commit();
    else current.set(settings);
    return settings;
  });
}

export function updateSettings(
  change: (settings: AppSettings) => void | Promise<void>,
) {
  return withSettings(async (settings, commit) => {
    await change(settings);
    await commit();
    return settings;
  });
}
