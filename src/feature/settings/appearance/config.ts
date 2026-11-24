import { hasFields, invalidConfig } from '../validation';

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

export type AppearanceSettings = {
  mode: (typeof appearances)[number]['value'];
  accent: (typeof accents)[number]['value'];
  style: (typeof themeStyles)[number]['value'];
};

export const defaultAppearance: AppearanceSettings = {
  mode: 'system',
  accent: 'neutral',
  style: 'nova',
};

function choice<T extends string>(
  value: unknown,
  options: readonly { value: T }[],
): T {
  const option = options.find((item) => item.value === value);
  if (!option) throw invalidConfig('外观配置含有不支持的选项，原配置已保留。');
  return option.value;
}

export function decodeAppearance(value: unknown): AppearanceSettings {
  if (!hasFields(value, ['mode', 'accent', 'style'])) throw invalidConfig();
  return {
    mode: choice(value.mode, appearances),
    accent: choice(value.accent, accents),
    style: choice(value.style, themeStyles),
  };
}
