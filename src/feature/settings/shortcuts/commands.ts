import { type AppSettings, updateSettings } from '../store';
import { invalidConfig, SettingsError } from '../validation';
import {
  GLOBAL_SHORTCUT_ID,
  portableShortcut,
  validateShortcuts,
} from './config';

function editableBinding(settings: AppSettings, id: string) {
  const binding = settings.shortcuts.find((item) => item.id === id);
  if (!binding) throw new SettingsError('INVALID_CONFIG', '未知快捷键动作。');
  if (id !== GLOBAL_SHORTCUT_ID) {
    throw new SettingsError('INVALID_CONFIG', '局内快捷键为只读。');
  }
  return binding;
}

export function setShortcut(id: string, keystroke: string | null) {
  return updateSettings((settings) => {
    const binding = editableBinding(settings, id);
    binding.keystroke = keystroke === null ? null : portableShortcut(keystroke);
    validateShortcuts(settings.shortcuts);
  });
}

export function resetShortcut(id: string) {
  return setShortcut(id, null);
}

export function setShortcutEnabled(id: string, enabled: boolean) {
  return updateSettings((settings) => {
    if (typeof enabled !== 'boolean') throw invalidConfig();
    editableBinding(settings, id).enabled = enabled;
    validateShortcuts(settings.shortcuts);
  });
}
