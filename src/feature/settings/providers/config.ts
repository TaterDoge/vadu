import { hasFields, invalidConfig, isRecord } from '../validation';

export type ProviderProfile = {
  id: string;
  name: string;
  protocol: 'chat-completions' | 'responses' | 'anthropic-messages';
  baseUrl: string;
  model: string;
  enabled: boolean;
  temperature: string;
  providerOptions: string;
  headers: string;
};

export function normalizeBaseUrl(raw: string) {
  const badAddress = () =>
    invalidConfig(
      '请输入有效的 HTTP 或 HTTPS 接口地址，不能包含凭据、查询参数或片段。',
    );
  if (
    raw.length > 4000 ||
    [...raw].length > 2000 ||
    /[\p{White_Space}\p{Cc}\\?#]/u.test(raw) ||
    !/^https?:\/\/[^/@]+(?:\/|$)/i.test(raw)
  ) {
    throw badAddress();
  }
  const url = URL.parse(raw);
  if (!url?.hostname) throw badAddress();
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}

export function isValidApiKey(key: string) {
  return key.length > 0 && key.length <= 2048 && !/[^!-~]/.test(key);
}

export const defaultProfileFields: Omit<ProviderProfile, 'id'> = {
  name: '',
  protocol: 'chat-completions',
  baseUrl: '',
  model: '',
  enabled: true,
  temperature: '0.3',
  providerOptions: '',
  headers: '',
};

const profileFields = ['id', ...Object.keys(defaultProfileFields)];

function jsonObject(text: string, message: string) {
  if (text === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalidConfig(message);
  }
  if (!isRecord(parsed)) throw invalidConfig(message);
  return parsed;
}

function isCredentialField(name: string) {
  return (
    [
      'authorization',
      'proxy-authorization',
      'cookie',
      'set-cookie',
      'api-key',
      'api_key',
      'apikey',
      'access_token',
    ].includes(name) ||
    name.endsWith('-api-key') ||
    name.endsWith('-token')
  );
}

const badOptions = '服务商选项须为有效的 JSON 对象。';

function containsCredentials(value: unknown, depth = 1): boolean {
  const nested = Array.isArray(value) || isRecord(value);
  // 保留旧版 JSON 嵌套上限，避免损坏配置使校验耗尽调用栈。
  if (
    (nested && depth >= 128) ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    throw invalidConfig(badOptions);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsCredentials(item, depth + 1));
  }
  return (
    isRecord(value) &&
    Object.entries(value).some(
      ([name, item]) =>
        isCredentialField(name.toLowerCase()) ||
        containsCredentials(item, depth + 1),
    )
  );
}

const managedHeaders = new Set([
  'host',
  'connection',
  'upgrade',
  'content-length',
  'transfer-encoding',
  'te',
  'trailer',
  'expect',
  'keep-alive',
  'proxy-connection',
  'content-type',
  'accept',
  'accept-encoding',
]);

function checkHeaders(text: string) {
  const seen = new Set<string>();
  const fields = jsonObject(text, '请求头须为有效的 JSON 对象。');
  for (const [name, value] of Object.entries(fields)) {
    if (
      !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) ||
      typeof value !== 'string' ||
      /[\x00-\x08\x0a-\x1f\x7f]/.test(value)
    ) {
      throw invalidConfig('请求头名称须符合 HTTP 格式，值须为单行字符串。');
    }
    const lower = name.toLowerCase();
    if (isCredentialField(lower))
      throw invalidConfig('请求头不能包含认证或凭据字段。');
    if (managedHeaders.has(lower))
      throw invalidConfig('请求头不能覆盖连接或消息格式。');
    if (seen.has(lower)) throw invalidConfig('请求头名称重复。');
    seen.add(lower);
  }
}

export function checkProfile(value: unknown) {
  if (!hasFields(value, profileFields)) {
    throw invalidConfig('服务商配置格式无效。');
  }
  const {
    id,
    name,
    protocol,
    baseUrl,
    model,
    enabled,
    temperature,
    providerOptions,
    headers,
  } = value;
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    (protocol !== 'chat-completions' &&
      protocol !== 'responses' &&
      protocol !== 'anthropic-messages') ||
    typeof baseUrl !== 'string' ||
    typeof model !== 'string' ||
    typeof enabled !== 'boolean' ||
    typeof temperature !== 'string' ||
    typeof providerOptions !== 'string' ||
    typeof headers !== 'string'
  ) {
    throw invalidConfig('服务商配置格式无效。');
  }
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw invalidConfig('服务商 ID 无效。');
  if (/^\p{White_Space}*$/u.test(name) || !baseUrl) {
    throw invalidConfig('请填写名称和接口地址。');
  }
  if ([...name].length > 100 || [...model].length > 300) {
    throw invalidConfig('名称或模型 ID 过长。');
  }
  const url = normalizeBaseUrl(baseUrl);
  const degrees = Number(temperature);
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(temperature) ||
    degrees < 0 ||
    degrees > 1
  ) {
    throw invalidConfig('温度须为 0 到 1 之间的数字。');
  }
  const encoder = new TextEncoder();
  if (
    encoder.encode(headers).length > 16_384 ||
    encoder.encode(providerOptions).length > 32_768
  ) {
    throw invalidConfig('高级选项过长。');
  }
  const options = jsonObject(providerOptions, badOptions);
  if (
    ['model', 'messages', 'stream', 'temperature', 'n'].some((name) =>
      Object.hasOwn(options, name),
    )
  ) {
    throw invalidConfig('服务商选项不能覆盖模型、消息、温度或流式参数。');
  }
  if (containsCredentials(options)) {
    throw invalidConfig('服务商选项不能包含认证或凭据字段。');
  }
  checkHeaders(headers);
  const profile: ProviderProfile = {
    id,
    name,
    protocol,
    baseUrl: url.href,
    model,
    enabled,
    temperature,
    providerOptions,
    headers,
  };
  return { profile, origin: url.origin };
}

export function decodeProfiles(value: unknown): ProviderProfile[] {
  if (!Array.isArray(value)) throw invalidConfig();
  const profiles: ProviderProfile[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) throw invalidConfig();
    const { profile } = checkProfile(item);
    if (ids.has(profile.id) || profile.baseUrl !== item.baseUrl)
      throw invalidConfig();
    ids.add(profile.id);
    profiles.push(profile);
  }
  return profiles;
}
