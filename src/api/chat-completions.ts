import { providerConnectionsSupported, Settings } from '../feature/settings';
import type { ProviderProfile } from '../feature/settings/providers/config';
import { ProviderRequestError } from './request';

export type Connection = Pick<ProviderProfile, 'baseUrl' | 'headers'> & {
  key: string | null;
};
type Payload = {
  stream: boolean;
  model: string;
  temperature: number;
  messages: { role: string; content: string }[];
};

export function requireDesktop() {
  if (!providerConnectionsSupported) {
    throw new ProviderRequestError(
      'PERMISSION_DENIED',
      '当前平台不支持服务商连接。',
    );
  }
}

export async function savedConnection(profileId: string, signal?: AbortSignal) {
  requireDesktop();
  const profile = await Settings.readProfile(profileId);
  signal?.throwIfAborted();
  if (!profile) {
    throw new ProviderRequestError(
      'INVALID_CONFIG',
      '服务商配置不存在或已损坏。',
    );
  }
  if (profile.protocol !== 'chat-completions') {
    throw new ProviderRequestError(
      'UNSUPPORTED_PROTOCOL',
      '该 API 协议尚未接入。',
    );
  }
  // 密钥读取时再次比对请求地址，避免保存新地址后把新密钥交给旧请求。
  const key = await Settings.readProfileKey(profile.id, profile.baseUrl);
  signal?.throwIfAborted();
  return { ...profile, key };
}

export function providerEndpoint(
  { baseUrl, headers, key }: Connection,
  path: string,
) {
  const requestHeaders: Record<string, string> = JSON.parse(headers || '{}');
  if (key) requestHeaders.Authorization = `Bearer ${key}`;
  return {
    url: `${baseUrl.replace(/\/$/, '')}/${path}`,
    headers: requestHeaders,
  };
}

export function completion(
  profile: ProviderProfile,
  fields: Pick<Payload, 'model' | 'stream' | 'messages'>,
): Payload {
  return {
    ...JSON.parse(profile.providerOptions || '{}'),
    temperature: profile.temperature,
    ...fields,
  };
}
