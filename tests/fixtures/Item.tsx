import { mount, signal, Text, View } from 'nsh';

import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import '../../src/feature/settings/appearance/theme';

function ItemFixture() {
  const details = signal(true);
  const count = signal(0);
  const enabled = signal(false);

  return (
    <View class="flex-1 gap-4 p-4">
      <Item
        testID={details() ? 'full-item' : 'compact-item'}
        variant="outline"
        style={{ flexWrap: 'wrap' }}
      >
        <If when={details()}>
          <ItemMedia>
            <Text>图标</Text>
          </ItemMedia>
        </If>
        <ItemContent style={{ flexBasis: 128 }}>
          <ItemTitle>{'提醒 ' + count()}</ItemTitle>
          <If when={details()}>
            <ItemDescription>
              这是一段较长的设置说明，在窄窗口中应换行显示，不能挤出操作区。
            </ItemDescription>
          </If>
        </ItemContent>
        <If when={details()}>
          <ItemActions style={{ flexWrap: 'wrap' }}>
            <Button
              testID="increment"
              onPress={() => count.update((value) => value + 1)}
            >
              增加
            </Button>
            <Switch
              testID="toggle"
              accessibilityLabel="启用提醒"
              checked={enabled()}
              onChange={({ checked }) => enabled.set(checked)}
            />
            <Button testID="disabled-action" disabled>
              不可用
            </Button>
          </ItemActions>
        </If>
      </Item>
      <Item testID="plain-item">
        <ItemContent>
          <ItemTitle>无附加内容</ItemTitle>
        </ItemContent>
      </Item>
      <Button
        testID="toggle-details"
        onPress={() => details.update((value) => !value)}
      >
        切换附加内容
      </Button>
      <Text>{enabled() ? '提醒已开启' : '提醒已关闭'}</Text>
    </View>
  );
}

mount(ItemFixture);
