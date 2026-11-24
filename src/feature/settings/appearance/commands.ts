import { updateSettings } from '../store';
import { type AppearanceSettings, decodeAppearance } from './config';

export function setAppearance(patch: Partial<AppearanceSettings>) {
  return updateSettings((settings) => {
    settings.appearance = decodeAppearance({
      ...settings.appearance,
      ...patch,
    });
  });
}
