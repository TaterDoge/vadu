import { colorScheme, mount, Text, token, View } from 'nsh';
import { Button } from 'nsh/base';

import { themePreferences } from '../../src/theme';
import { SettingsWindow } from '../../src/windows/settings/SettingsWindow';
import { openTranslateWindow } from '../../src/windows/translate/TranslateWindow';

function ThemeFixture() {
  return (
    <View class="flex-1">
      <SettingsWindow />
      <Button testID="open-translate" onPress={openTranslateWindow}>
        <Text>打开翻译窗口</Text>
      </Button>
      <Text class="h-4 text-xs">
        {'主题状态 ' +
          JSON.stringify({
            ...themePreferences(),
            scheme: colorScheme(),
            font: token('font-sans'),
            keyFont: token('font-key'),
            primary: token('primary'),
            primaryForeground: token('primary-foreground'),
            sidebarPrimary: token('sidebar-primary'),
            sidebarForeground: token('sidebar-primary-foreground'),
            border: token('border'),
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
