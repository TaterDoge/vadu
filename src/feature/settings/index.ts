import { setAppearance } from './appearance/commands';
import {
  orderProfiles,
  readProfile,
  readProfileKey,
  removeProfile,
  saveProfile,
} from './providers/commands';
import { checkProfile } from './providers/config';
import {
  resetShortcut,
  setShortcut,
  setShortcutEnabled,
} from './shortcuts/commands';
import { currentSettings, readSettings } from './store';

export { providerConnectionsSupported } from './providers/commands';
export {
  captureShortcutKeys,
  GLOBAL_SHORTCUT_ID,
  type ShortcutBinding,
} from './shortcuts/config';
export type { AppSettings } from './store';
export { SettingsError } from './validation';

export const Settings = {
  read: readSettings,
  current: currentSettings,
  setAppearance,
  setShortcut,
  resetShortcut,
  setShortcutEnabled,
  checkProfile,
  readProfile,
  readProfileKey,
  saveProfile,
  removeProfile,
  orderProfiles,
};
