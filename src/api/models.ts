import {
  isValidApiKey,
  isValidModelId,
  normalizeBaseUrl,
} from '../feature/settings/providers/config';
import {
  completion,
  type Connection,
  providerEndpoint,
  requireDesktop,
  savedConnection,
} from './chat-completions';
import {
  invalidResponse,
  isRecord,
  ProviderRequestError,
  request,
} from './request';

async function models(connection: Connection, signal?: AbortSignal) {
  const body = await request({
    ...providerEndpoint(connection, 'models'),
    signal,
  });
  if (!isRecord(body) || !Array.isArray(body.data)) throw invalidResponse();
  const ids = new Set<string>();
  for (const model of body.data) {
    if (!isRecord(model) || typeof model.id !== 'string')
      throw invalidResponse();
    if (isValidModelId(model.id)) ids.add(model.id.trim());
  }
  return [...ids].sort().slice(0, 500);
}

export async function listModels(profileId: string, signal?: AbortSignal) {
  return models(await savedConnection(profileId, signal), signal);
}

export async function listModelsDraft(
  address: string,
  key: string,
  signal?: AbortSignal,
) {
  requireDesktop();
  key = key.trim();
  if (!isValidApiKey(key)) {
    throw new ProviderRequestError(
      'INVALID_CONFIG',
      '请输入不含空白的有效 API Key。',
    );
  }
  const baseUrl = normalizeBaseUrl(address.trim()).href;
  return models({ baseUrl, headers: '', key }, signal);
}

export async function checkModel(
  profileId: string,
  model: string,
  signal?: AbortSignal,
) {
  model = model.trim();
  if (!isValidModelId(model)) {
    throw new ProviderRequestError('INVALID_CONFIG', '请选择有效的模型 ID。');
  }
  const profile = await savedConnection(profileId, signal);
  const payload = completion(profile, {
    model,
    stream: false,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
  });
  const body = await request({
    ...providerEndpoint(profile, 'chat/completions'),
    body: payload,
    signal,
  });
  if (!isRecord(body) || !Array.isArray(body.choices) || !body.choices.length) {
    throw invalidResponse();
  }
}
