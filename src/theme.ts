import { setColorScheme, setTheme, signal } from 'nsh';
import { Scrollbar } from 'nsh/base';

import GeistMono from '../assets/fonts/geist-mono/GeistMono.ttf';
import JetBrainsMono from '../assets/fonts/jetbrains-mono/JetBrainsMono.ttf';
import baseTheme from '../theme.json';

export const appearances = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const;

export const accents = [
  { value: 'neutral', label: '中性', token: 'accent-neutral' },
  { value: 'blue', label: '蓝色', token: 'accent-blue' },
  { value: 'emerald', label: '翠绿', token: 'accent-emerald' },
  { value: 'amber', label: '琥珀', token: 'accent-amber' },
  { value: 'rose', label: '玫红', token: 'accent-rose' },
  { value: 'violet', label: '紫色', token: 'accent-violet' },
] as const;

export const themeStyles = [
  { value: 'nova', label: 'Nova', description: 'Geist Mono' },
  {
    value: 'lyra',
    label: 'Lyra',
    description: 'JetBrains Mono',
  },
] as const;

type ThemePreferences = {
  appearance: (typeof appearances)[number]['value'];
  accent: (typeof accents)[number]['value'];
  style: (typeof themeStyles)[number]['value'];
};

// shortcut: 偏好仅保留本次运行，外观接入 src/settings.ts 后再持久化。
const preferences = signal<ThemePreferences>({
  appearance: 'system',
  accent: 'neutral',
  style: 'nova',
});

export const themePreferences = () => preferences();

export function setThemePreferences(next: ThemePreferences) {
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
  setColorScheme(next.appearance);
  preferences.set(next);
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
