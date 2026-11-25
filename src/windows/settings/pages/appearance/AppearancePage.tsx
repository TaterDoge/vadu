import { cleanup, signal, Text, token, View } from 'nsh';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { buttonLabel, buttonLook } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Radio, RadioGroup } from '@/components/ui/radio-group';

import { Settings, SettingsError } from '../../../../feature/settings';
import {
  accents,
  appearances,
  type AppearanceSettings,
  themeStyles,
} from '../../../../feature/settings/appearance/config';
import { themePreferences } from '../../../../feature/settings/appearance/theme';

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
        <Alert variant="destructive">
          <AlertTitle>{error()}</AlertTitle>
        </Alert>
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
                variant="tile"
                indicator={false}
                style={{ minWidth: 96, flex: 1 }}
              >
                {option().label}
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
                variant="tile"
                indicator={false}
                style={{ minWidth: 80, flex: 1, justifyContent: 'flex-start' }}
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
                variant="tile"
                indicator={false}
                style={{ minWidth: 150, flex: 1, justifyContent: 'flex-start' }}
              >
                <View>
                  <Text class="text-sm font-semibold text-foreground">
                    {option().label}
                  </Text>
                  <Text class="text-xs text-muted-foreground">
                    {option().description}
                  </Text>
                </View>
              </Radio>
            )}
          </Each>
        </RadioGroup>
      </View>
      <Card>
        <CardHeader>
          <CardTitle testID="theme-preview-title" style={{ fontSize: 20 }}>
            Aa 0123456789 · 你好
          </CardTitle>
          <CardDescription>字体、强调色与控件样式预览</CardDescription>
        </CardHeader>
        <CardContent
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <View style={buttonLook('default').style}>
            <Text
              testID="theme-preview-primary"
              style={[buttonLabel('default'), { fontSize: 14 }]}
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
        </CardContent>
      </Card>
    </View>
  );
}
