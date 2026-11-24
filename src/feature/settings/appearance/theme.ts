import { computed, effect, setColorScheme, setTheme } from 'nsh';
import { Scrollbar } from 'nsh/base';

import GeistMono from '../../../../assets/fonts/geist-mono/GeistMono.ttf';
import JetBrainsMono from '../../../../assets/fonts/jetbrains-mono/JetBrainsMono.ttf';
import baseTheme from '../../../../theme.json';
import { currentSettings } from '../store';
import { type AppearanceSettings, defaultAppearance } from './config';

export const themePreferences = () =>
  currentSettings()?.appearance ?? defaultAppearance;

export function setupTheme() {
  const preferences = computed(themePreferences, {
    equals: (a, b) =>
      a.mode === b.mode && a.accent === b.accent && a.style === b.style,
  });
  effect(() => applyTheme(preferences()));
}

function applyTheme(next: AppearanceSettings) {
  const common: Record<string, string | number> = {
    ...baseTheme.cssVars.theme,
  };
  const font = next.style === 'lyra' ? JetBrainsMono : GeistMono;
  common['font-sans'] = font;
  common['font-mono'] = font;
  common['font-heading'] = font;

  const colors = (scheme: 'light' | 'dark') => {
    if (next.accent === 'neutral') return baseTheme.cssVars[scheme];
    const primary = `var(--accent-${next.accent})`;
    const foreground =
      next.accent === 'amber'
        ? 'var(--accent-amber-foreground)'
        : 'var(--accent-color-foreground)';
    return {
      ...baseTheme.cssVars[scheme],
      primary,
      'primary-foreground': foreground,
      ring: primary,
      'sidebar-primary': primary,
      'sidebar-primary-foreground': foreground,
    };
  };

  setTheme({
    cssVars: { theme: common, light: colors('light'), dark: colors('dark') },
  });
  setColorScheme(next.mode);
}

Scrollbar.setTheme({
  vertical: {
    class: 'absolute inset-y-0 right-0 w-1.5',
    thumbClass: 'rounded-full bg-foreground/20 hover:bg-foreground/35',
  },
  horizontal: {
    class: 'absolute inset-x-0 bottom-0 h-1.5',
    thumbClass: 'rounded-full bg-foreground/20 hover:bg-foreground/35',
  },
});
