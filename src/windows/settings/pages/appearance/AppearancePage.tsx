import { cleanup, signal, Text, token, View } from 'nsh';
import { Radio, RadioGroup } from 'nsh/base';

import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Kbd, KbdGroup } from '../../../../components/ui/Kbd';
import { Settings, SettingsError } from '../../../../feature/settings';
import {
  accents,
  appearances,
  type AppearanceSettings,
  themeStyles,
} from '../../../../feature/settings/appearance/config';
import { themePreferences } from '../../../../feature/settings/appearance/theme';

const choiceClass = `${buttonFrameClass} group min-w-24 flex-1 gap-1 rounded-md border-border px-3 py-2 checked:border-primary checked:bg-secondary hover:bg-accent`;

export function AppearancePage() {
  const ready = signal(false);
  const error = signal('');
  let mounted = true;
  cleanup(() => {
    mounted = false;
  });

  function report(cause: unknown) {
    if (mounted)
      error.set(
        cause instanceof SettingsError
          ? cause.message
          : '无法访问配置，请稍后重试。',
      );
  }

  void Settings.read().then(() => {
    if (mounted) ready.set(true);
  }, report);
  async function save(patch: Partial<AppearanceSettings>) {
    try {
      await Settings.setAppearance(patch);
      if (mounted) error.set('');
    } catch (cause) {
      report(cause);
    }
  }

  return (
    <View testID="settings-appearance-page" class="gap-6">
      <Text class="text-xs leading-5 text-muted-foreground">
        外观设置应用于所有窗口，下次启动时恢复。
      </Text>
      <If when={error()}>
        <Text role="alert" class="text-xs text-destructive">
          {error()}
        </Text>
      </If>
      <View role="group" accessibilityLabel="显示模式" class="gap-3">
        <Text
          role="header"
          accessibilityLevel={2}
          class="text-sm font-semibold text-foreground"
        >
          显示模式
        </Text>
        <RadioGroup class="flex-row flex-wrap gap-2">
          <Each of={appearances}>
            {(option) => (
              <Radio
                testID={'appearance-' + option().value}
                accessibilityLabel={option().label}
                disabled={!ready()}
                checked={themePreferences().mode === option().value}
                onChange={() => save({ mode: option().value })}
                class={
                  choiceClass + ' flex-row items-center justify-center gap-2'
                }
              >
                <View class="h-2 w-2 rounded-full bg-transparent group-checked:bg-primary" />
                <Text class="text-sm text-foreground">{option().label}</Text>
              </Radio>
            )}
          </Each>
        </RadioGroup>
      </View>
      <View role="group" accessibilityLabel="主题色" class="gap-3">
        <Text
          role="header"
          accessibilityLevel={2}
          class="text-sm font-semibold text-foreground"
        >
          主题色
        </Text>
        <RadioGroup class="flex-row flex-wrap gap-2">
          <Each of={accents}>
            {(option) => (
              <Radio
                testID={'accent-' + option().value}
                accessibilityLabel={option().label}
                disabled={!ready()}
                checked={themePreferences().accent === option().value}
                onChange={() => save({ accent: option().value })}
                class={choiceClass + ' min-w-20 flex-row items-center gap-2'}
              >
                <View
                  class="h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: token(option().token) }}
                />
                <Text class="text-sm text-foreground">{option().label}</Text>
              </Radio>
            )}
          </Each>
        </RadioGroup>
      </View>
      <View role="group" accessibilityLabel="界面风格" class="gap-3">
        <Text
          role="header"
          accessibilityLevel={2}
          class="text-sm font-semibold text-foreground"
        >
          界面风格
        </Text>
        <RadioGroup class="flex-row flex-wrap gap-2">
          <Each of={themeStyles}>
            {(option) => (
              <Radio
                testID={'style-' + option().value}
                accessibilityLabel={option().label}
                disabled={!ready()}
                checked={themePreferences().style === option().value}
                onChange={() => save({ style: option().value })}
                class={choiceClass + ' min-w-48'}
              >
                <Text class="text-sm font-semibold text-foreground">
                  {option().label}
                </Text>
                <Text class="text-xs leading-5 text-muted-foreground">
                  {option().description}
                </Text>
              </Radio>
            )}
          </Each>
        </RadioGroup>
      </View>
      <View class="gap-3 rounded-lg border border-border bg-card p-4">
        <Text
          testID="theme-preview-title"
          class="text-xl leading-6 font-semibold text-card-foreground"
        >
          Aa 0123456789 · 你好
        </Text>
        <Text class="text-sm leading-5 text-muted-foreground">
          字体与强调色随主题切换，字号与圆角使用 NSH 内置尺寸。
        </Text>
        <View class="flex-row flex-wrap items-center gap-3">
          <View class="rounded-md bg-primary px-3 py-2">
            <Text
              testID="theme-preview-primary"
              class="text-sm font-medium text-primary-foreground"
            >
              强调色预览
            </Text>
          </View>
          <KbdGroup
            accessible
            accessibilityLabel="快捷键符号预览 Command Option Control Shift K"
          >
            <Kbd>⌘</Kbd>
            <Kbd>⌥</Kbd>
            <Kbd>⌃</Kbd>
            <Kbd>⇧</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </View>
      </View>
    </View>
  );
}
