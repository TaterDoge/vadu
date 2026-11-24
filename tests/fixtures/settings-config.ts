export const defaultAppearance = {
  mode: 'system',
  accent: 'neutral',
  style: 'nova',
};

export const defaultShortcuts = [
  { id: 'toggle-translate', keystroke: null, enabled: true },
  { id: 'open-settings', keystroke: 'mod+,', enabled: true },
  { id: 'pin-translate', keystroke: 'mod+p', enabled: true },
];

export function settingsDocument(shortcuts: unknown[] = defaultShortcuts) {
  return {
    settings: { shortcuts, appearance: defaultAppearance },
    profiles: [],
  };
}
