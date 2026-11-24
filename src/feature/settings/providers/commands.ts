import { platform, Storage } from 'nsh';

import { updateSettings, withSettings } from '../store';
import { hasFields, isRecord, SettingsError } from '../validation';
import { checkProfile, isValidApiKey, type ProviderProfile } from './config';

export const providerConnectionsSupported = [
  'macos',
  'windows',
  'linux',
].includes(platform.os);

export function readProfile(id: string) {
  return withSettings(({ profiles }) =>
    profiles.find((profile) => profile.id === id),
  );
}

function secretStorageKey(id: string) {
  return `vadu.secret.${id}`;
}

export function readProfileKey(id: string, baseUrl: string) {
  if (!providerConnectionsSupported) {
    return Promise.reject(
      new SettingsError('PERMISSION_DENIED', '当前平台不支持服务商连接。'),
    );
  }
  // 地址校验与密钥读取之间不能插入服务商保存或删除。
  return withSettings(async ({ profiles }) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) {
      throw new SettingsError('INVALID_CONFIG', '服务商配置不存在或已损坏。');
    }
    if (baseUrl !== profile.baseUrl) {
      throw new SettingsError(
        'INVALID_CONFIG',
        '接口地址已变更，请重新打开服务商后再试。',
      );
    }

    const data = await Storage.getItem(secretStorageKey(id));
    if (data === null) return null;
    const damaged = () =>
      new SettingsError('INVALID_CONFIG', 'API Key 数据损坏，请重新输入。');
    let secret: unknown;
    try {
      secret = JSON.parse(data);
    } catch {
      throw damaged();
    }
    if (
      !hasFields(secret, ['base_url', 'key']) ||
      typeof secret.base_url !== 'string' ||
      typeof secret.key !== 'string' ||
      !isValidApiKey(secret.key)
    ) {
      throw damaged();
    }
    return secret.base_url === baseUrl ? secret.key : null;
  });
}

export function saveProfile(
  value: ProviderProfile,
  create: boolean,
  key: string,
) {
  return withSettings(async ({ profiles }, commit) => {
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
    await commit();
    if (!key) return { keyError: null };
    if (!providerConnectionsSupported) {
      return { keyError: '当前平台不支持服务商连接。' };
    }
    if (!isValidApiKey(key)) {
      return { keyError: '请输入不含空白的有效 API Key。' };
    }
    try {
      await Storage.setItem(
        secretStorageKey(profile.id),
        JSON.stringify({ base_url: profile.baseUrl, key }),
      );
      return { keyError: null };
    } catch (error) {
      return {
        keyError:
          isRecord(error) && error.code === 'ERR_NSH_QUOTA_EXCEEDED'
            ? '本地存储空间不足，API Key 未保存。'
            : '无法写入本地存储，请重试。',
      };
    }
  });
}

export function removeProfile(id: string) {
  return updateSettings(async (settings) => {
    if (!settings.profiles.some((profile) => profile.id === id)) {
      throw new SettingsError('INVALID_CONFIG', '服务商配置已不存在。');
    }
    if (providerConnectionsSupported) {
      await Storage.removeItem(secretStorageKey(id));
    }
    settings.profiles = settings.profiles.filter(
      (profile) => profile.id !== id,
    );
  });
}

export function orderProfiles(ids: string[]) {
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
