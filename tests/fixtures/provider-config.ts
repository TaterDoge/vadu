import type { ProviderProfile } from 'vadu/native';

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
    temperature: '0.3',
    providerOptions: '',
    headers: '',
    ...fields,
  };
}

export function providerStorage(...profiles: ProviderProfile[]) {
  return {
    'vadu.config': JSON.stringify({
      schemaVersion: 3,
      settings: {
        shortcuts: [
          { id: 'toggle-translate', keystroke: 'mod+shift+m' },
          { id: 'open-settings', keystroke: 'mod+,' },
          { id: 'pin-translate', keystroke: 'mod+p' },
        ],
      },
      profiles,
    }),
  };
}
