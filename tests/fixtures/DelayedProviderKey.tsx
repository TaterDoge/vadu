import { cleanup, host, mount } from 'nsh';

import { Settings } from '../../src/feature/settings';
import { ProvidersPage } from '../../src/windows/settings/pages/providers/ProvidersPage';

function DelayedProviderKey() {
  const readKey = Settings.readProfileKey;
  const release = new Promise<void>((resolve) =>
    host.on('release-key', () => resolve()),
  );
  Settings.readProfileKey = async (id, baseUrl) => {
    const key = await readKey(id, baseUrl);
    await release;
    return key;
  };
  cleanup(() => {
    Settings.readProfileKey = readKey;
  });
  return <ProvidersPage />;
}

mount(DelayedProviderKey);
