import { colorScheme, mount, Text, token, View } from 'nsh';
import { Window } from 'nsh/desktop';

import { Button } from '@/components/ui/button';
import { currentTheme, focusRing, press, surface } from '@/lib/ui/theme';

import { themePreferences } from '../../src/feature/settings/appearance/theme';
import { SettingsWindow } from '../../src/windows/settings/SettingsWindow';
import { openTranslateWindow } from '../../src/windows/translate/TranslateWindow';

function ThemeFixture() {
  return (
    <View class="flex-1">
      <SettingsWindow />
      <View class="flex-row gap-2">
        <Button testID="open-translate" onPress={openTranslateWindow}>
          打开翻译窗口
        </Button>
        <Button
          testID="close-translate"
          onPress={() => Window.get('translate')?.close()}
        >
          关闭翻译窗口
        </Button>
      </View>
      <Text class="h-4 text-xs">
        {'主题状态 ' +
          JSON.stringify({
            ...themePreferences(),
            scheme: colorScheme(),
            theme: currentTheme(),
            pressScale: press.scale,
            font: token('font-sans'),
            keyFont: token('font-key'),
            primary: token('primary'),
            brand: token('brand'),
            primaryForeground: token('primary-foreground'),
            accentSurface: surface('accent').style.backgroundColor,
            border: token('border'),
            ring: token('ring'),
            focus: focusRing(),
            neutral: token('accent-neutral'),
            blue: token('accent-blue'),
            emerald: token('accent-emerald'),
            amber: token('accent-amber'),
            rose: token('accent-rose'),
            violet: token('accent-violet'),
          })}
      </Text>
    </View>
  );
}

mount(ThemeFixture);
