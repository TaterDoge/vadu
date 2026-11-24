import { mount, signal, Text, View } from 'nsh';
import '../../src/feature/settings/appearance/theme';

import { Button } from 'nsh/base';

import { Kbd, KbdGroup } from '../../src/components/ui/Kbd';

function KbdFixture() {
  const alternate = signal(false);
  const keySize = signal('');

  return (
    <View class="flex-1 gap-4 p-4">
      <Kbd testID="standalone-key">Esc</Kbd>
      <KbdGroup
        testID={alternate() ? 'alternate-group' : 'default-group'}
        accessible
        accessibilityLabel={alternate() ? 'Option + P' : 'Command + M'}
      >
        <Kbd>{alternate() ? '⌥' : '⌘'}</Kbd>
        <Kbd
          class={alternate() ? 'h-8 min-w-8' : undefined}
          onLayout={({ bounds }) =>
            keySize.set(
              Math.round(bounds.size.width) +
                'x' +
                Math.round(bounds.size.height),
            )
          }
        >
          {alternate() ? 'P' : 'M'}
        </Kbd>
      </KbdGroup>
      <Text>{'键帽尺寸 ' + keySize()}</Text>
      <Button
        testID="change-keys"
        onPress={() => alternate.update((value) => !value)}
      >
        <Text>切换按键</Text>
      </Button>
    </View>
  );
}

mount(KbdFixture);
