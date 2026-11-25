import { host, mount, View } from 'nsh';
import { Window } from 'nsh/desktop';

import { Button } from '@/components/ui/button';

import { SettingsWindow } from '../../src/windows/settings/SettingsWindow';
import { openTranslateWindow } from '../../src/windows/translate/TranslateWindow';

function Windows() {
  host.on('open-settings', () => Window.get('main')?.focus());
  host.on('minimize-settings', () => Window.get('main')?.minimize());
  host.on('open-translate', openTranslateWindow);
  host.on('hide-translate', () => Window.get('translate')?.hide());
  return (
    <View class="flex-1">
      <SettingsWindow />
      <Button testID="open-translate" onPress={openTranslateWindow}>
        打开翻译窗口
      </Button>
      <Button
        testID="hide-translate"
        onPress={() => Window.get('translate')?.hide()}
      >
        隐藏翻译窗口
      </Button>
    </View>
  );
}

mount(Windows);
