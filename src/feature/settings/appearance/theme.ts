import { computed, effect, setColorScheme } from 'nsh';

import GeistMono from '@/assets/fonts/geist-mono/GeistMono.ttf';
import JetBrainsMono from '@/assets/fonts/jetbrains-mono/JetBrainsMono.ttf';
import { Scrollbar } from '@/components/ui/scrollbar';
import semantics from '@/lib/ui/semantics.json';
import { selectTheme, type Semantics } from '@/lib/ui/theme';
import baseTheme from '@/theme.json';

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
  const font = next.style === 'lyra' ? JetBrainsMono : GeistMono;
  const palette = (scheme: 'light' | 'dark') => {
    const base = baseTheme.cssVars[scheme];
    if (next.accent === 'neutral') return base;
    return {
      ...base,
      // 切换强调色后，默认色样仍显示预设颜色。
      'accent-neutral': base.primary,
      'brand-tint': 'color-mix(in srgb, var(--brand) 14%, transparent)',
      primary: `var(--accent-${next.accent})`,
      'primary-foreground':
        next.accent === 'amber'
          ? 'var(--accent-amber-foreground)'
          : 'var(--accent-color-foreground)',
    };
  };

  selectTheme({
    id: 'default',
    label: baseTheme.name,
    theme: {
      ...baseTheme,
      cssVars: {
        theme: {
          ...baseTheme.cssVars.theme,
          'font-sans': font,
          'font-mono': font,
        },
        light: palette('light'),
        dark: palette('dark'),
      },
    },
    semantics: semantics as Semantics,
  });
  setColorScheme(next.mode);
}

Scrollbar.setTheme();
