import type { ProviderProfile } from '../../src/feature/settings/providers/config';
import { settingsDocument } from './settings-config';

export function provider(
  id: string,
  name: string,
  fields: Partial<ProviderProfile> = {},
): ProviderProfile {
  return {
    id,
    name,
    protocol: 'chat-completions',
    baseUrl: 'https://example.com/v1',
    model: 'demo-model',
    enabled: true,
    temperature: 0.3,
    providerOptions: '',
    headers: '',
    ...fields,
  };
}

export function providerStorage(...profiles: ProviderProfile[]) {
  return {
    'vadu.config': JSON.stringify({
      ...settingsDocument(),
      profiles,
    }),
  };
}
