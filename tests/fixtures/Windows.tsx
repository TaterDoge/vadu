import { host, mount, Text, View } from 'nsh';
import { Button } from 'nsh/base';
import { Window } from 'nsh/desktop';

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
        <Text>打开翻译窗口</Text>
      </Button>
      <Button
        testID="hide-translate"
        onPress={() => Window.get('translate')?.hide()}
      >
        <Text>隐藏翻译窗口</Text>
      </Button>
    </View>
  );
}

mount(Windows);
