import { Text, View } from 'nsh';

import { useSidebar } from '@/components/ui/sidebar';

export function Logo() {
  const sidebar = useSidebar();
  return (
    <View
      class="flex-row items-center gap-3 pt-10 pb-8"
      style={{
        justifyContent: sidebar.open ? 'flex-start' : 'center',
        paddingHorizontal: sidebar.open ? 20 : 0,
      }}
    >
      <View
        class="h-8 w-8 items-center justify-center rounded-xl bg-primary"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text class="text-lg font-bold text-primary-foreground">v</Text>
      </View>
      <If when={sidebar.state === 'expanded'}>
        <View>
          <Text class="text-base font-semibold text-foreground">vadu</Text>
          <Text class="text-xs text-muted-foreground">管理面板</Text>
        </View>
      </If>
    </View>
  );
}
