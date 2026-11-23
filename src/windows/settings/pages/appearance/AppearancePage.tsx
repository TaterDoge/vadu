import { Text, token, View } from 'nsh';
import { Radio, RadioGroup } from 'nsh/base';

import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Kbd, KbdGroup } from '../../../../components/ui/Kbd';
import {
  accents,
  appearances,
  setThemePreferences,
  themePreferences,
  themeStyles,
} from '../../../../theme';

const choiceClass = `${buttonFrameClass} group min-w-24 flex-1 gap-1 rounded-md border-border px-3 py-2 checked:border-primary checked:bg-secondary hover:bg-accent`;

export function AppearancePage() {
  return (
    <View testID="settings-appearance-page" class="gap-6">
      <Text class="text-xs leading-5 text-muted-foreground">
        即时应用于所有窗口；当前选择仅在本次运行期间生效。
      </Text>
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
                checked={themePreferences().appearance === option().value}
                onChange={() =>
                  setThemePreferences({
                    ...themePreferences(),
                    appearance: option().value,
                  })
                }
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
                checked={themePreferences().accent === option().value}
                onChange={() =>
                  setThemePreferences({
                    ...themePreferences(),
                    accent: option().value,
                  })
                }
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
                checked={themePreferences().style === option().value}
                onChange={() =>
                  setThemePreferences({
                    ...themePreferences(),
                    style: option().value,
                  })
                }
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
