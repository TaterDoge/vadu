import { computed, effect, setColorScheme } from 'nsh';

import GeistMono from '@/assets/fonts/geist-mono/GeistMono.ttf';
import JetBrainsMono from '@/assets/fonts/jetbrains-mono/JetBrainsMono.ttf';
import { Scrollbar } from '@/components/ui/scrollbar';
import { presetTheme } from '@/lib/ui/preset';
import { defineTheme } from '@/lib/ui/schema';
import { selectTheme } from '@/lib/ui/theme';
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
    if (next.accent === 'neutral') return { brand: base.brand };
    return {
      brand: base.brand,
      primary: base[`accent-${next.accent}`],
      'primary-foreground':
        next.accent === 'amber'
          ? baseTheme.cssVars.theme['accent-amber-foreground']
          : base['accent-color-foreground'],
    };
  };

  const selected = defineTheme({
    id: presetTheme.id,
    label: presetTheme.label,
    extends: presetTheme.spec,
    tokens: {
      font: { sans: font, mono: font },
      light: palette('light'),
      dark: palette('dark'),
    },
  });
  const { cssVars } = selected.theme;
  selectTheme({
    ...selected,
    theme: {
      ...selected.theme,
      // Theme v5 只导出语义 token，应用的色样和键帽字体从构建主题补回。
      cssVars: {
        theme: { ...baseTheme.cssVars.theme, ...cssVars.theme },
        light: { ...baseTheme.cssVars.light, ...cssVars.light },
        dark: { ...baseTheme.cssVars.dark, ...cssVars.dark },
      },
    },
  });
  setColorScheme(next.mode);
}

Scrollbar.setTheme();
