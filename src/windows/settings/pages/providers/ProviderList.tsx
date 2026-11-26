import { Funnel, GripVertical, Inbox, Server } from 'lucide';
import { computed, Scroll, type Signal, signal, Text, View } from 'nsh';
import { Select } from 'nsh/base';

import { Button, buttonLook, IconButton } from '@/components/ui/button';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Icon } from '@/lib/ui/icons';
import { listboxProps, OptionRow } from '@/lib/ui/listbox';
import { colors } from '@/lib/ui/theme';

import { Settings } from '../../../../feature/settings';
import type { ProviderProfile } from '../../../../feature/settings/providers/config';
import type { Capability } from './ProvidersPage';

const filters = [
  { value: 'all', title: '全部状态' },
  { value: 'enabled', title: '仅已启用' },
  { value: 'disabled', title: '仅已停用' },
];

export function ProviderList(props: {
  providers: () => ProviderProfile[];
  capability: () => Capability;
  compact: () => boolean;
  query: Signal<string>;
  filter: Signal<string>;
  selectedId: Signal<string>;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const scrollY = signal(0);
  const pointerY = signal(0);
  const drag = signal<{
    rows: ProviderProfile[];
    from: number;
    startY: number;
    step: number;
  } | null>(null);
  let rowStep = 0;
  const preview = computed(() => {
    const current = drag();
    if (!current || current.rows !== props.providers()) return null;
    const { rows, from, startY, step } = current;
    const delta = pointerY() + scrollY() - startY;
    const offset = Math.max(
      -from * step,
      Math.min((rows.length - 1 - from) * step, delta),
    );
    return { from, to: Math.round(from + offset / step), offset, step };
  });

  function moveProvider(from: number, to: number) {
    const rows = props.providers();
    if (from === to || !rows[from] || !rows[to]) return;
    const sorted = rows.slice();
    const [moved] = sorted.splice(from, 1);
    sorted.splice(to, 0, moved);
    // 排序失败时列表仍按已保存顺序显示，不另设提示。
    void Settings.orderProfiles(sorted.map(({ id }) => id)).catch(() => {});
  }

  function startDrag(from: number, pageY: number) {
    pointerY.set(pageY);
    drag.set({
      rows: props.providers(),
      from,
      startY: pageY + scrollY(),
      step: rowStep,
    });
    return true;
  }

  function dropProvider(pageY: number) {
    pointerY.set(pageY);
    const target = preview();
    drag.set(null);
    if (target) moveProvider(target.from, target.to);
  }

  function rowOffset(index: number) {
    const target = preview();
    if (!target) return 0;
    const { from, to, offset, step } = target;
    if (index === from) return offset;
    if (from < index && index <= to) return -step;
    if (to <= index && index < from) return step;
    return 0;
  }

  return (
    <View
      class={
        props.compact()
          ? 'min-h-36 flex-1 gap-1 p-1'
          : 'min-h-0 w-48 shrink-0 gap-1 p-1'
      }
    >
      <InputGroup class="shrink-0" accessibilityLabel="服务商搜索与筛选">
        <InputGroupInput
          accessibilityLabel="搜索服务商"
          value={props.query()}
          onChange={({ value }) => props.query.set(value)}
          placeholder="搜索服务商"
          class="min-w-0"
        />
        <InputGroupAddon align="inline-end" style={{ paddingEnd: 1 }}>
          <Select
            {...listboxProps({ minWidth: 112 })}
            items={filters}
            value={props.filter()}
            onChange={({ value }) => props.filter.set(value ?? 'all')}
            align="end"
            cover={false}
            trigger={
              <IconButton
                accessibilityLabel="按启用状态筛选"
                icon={Funnel}
                selected={props.filter() !== 'all'}
              />
            }
            renderItem={(item) => <OptionRow item={item} />}
          />
        </InputGroupAddon>
      </InputGroup>
      <If
        when={props.providers().length > 0}
        else={
          <Empty testID="providers-list-empty" style={{ padding: 8, gap: 4 }}>
            <Icon icon={Inbox} size={18} tint={colors.mutedForeground} />
            <EmptyDescription>
              {props.capability() === '翻译' &&
              (props.query().trim() || props.filter() !== 'all')
                ? '没有匹配的服务商'
                : '暂无服务商'}
            </EmptyDescription>
          </Empty>
        }
      >
        <Scroll
          scrollbar={false}
          testID="providers-list-scroll"
          class="-mx-1 min-h-0 flex-1 p-1"
          contentClass="gap-2"
          onScroll={({ offset }) => scrollY.set(offset.y)}
        >
          <Each of={props.providers()} key={(p) => p.id}>
            {(item, index) => (
              <View
                testID={`provider-row-${item().id}`}
                role="button"
                focusable
                accessibilityLabel={
                  item().name + (item().enabled ? '，已启用' : '，已停用')
                }
                accessibilityState={{
                  selected: props.selectedId() === item().id,
                }}
                accessibilityActions={[
                  ...(index() > 0 ? [{ name: 'move-up', label: '上移' }] : []),
                  ...(index() + 1 < props.providers().length
                    ? [{ name: 'move-down', label: '下移' }]
                    : []),
                ]}
                onAccessibilityAction={({ actionName }) => {
                  if (actionName === 'move-up')
                    moveProvider(index(), index() - 1);
                  if (actionName === 'move-down')
                    moveProvider(index(), index() + 1);
                }}
                onPress={() => props.onSelect(item().id)}
                focusVisibleStyle={buttonLook('ghost').focusVisibleStyle}
                onLayout={({ bounds }) => {
                  // 行在无内边距的内容容器内，第二行的 y 就是排序步长。
                  if (index() === 1) rowStep = bounds.origin.y;
                }}
                class="h-9 flex-row items-center gap-2 rounded-lg pr-2 pl-1 hover:bg-accent"
                classList={{
                  'bg-muted': props.selectedId() === item().id,
                  'shadow-md': preview()?.from === index(),
                }}
                style={{
                  backgroundColor:
                    preview()?.from === index() ? colors.background : undefined,
                  zIndex: preview()?.from === index() ? 1 : 0,
                  transform: [{ translateY: rowOffset(index()) }],
                }}
              >
                <View
                  testID={`provider-grip-${item().id}`}
                  class="h-full w-5 shrink-0 items-center justify-center"
                  style={{
                    cursor: preview()?.from === index() ? 'grabbing' : 'grab',
                  }}
                  classList={{ 'opacity-0': props.providers().length < 2 }}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  onStartShouldSetResponder={() =>
                    props.providers().length > 1 && rowStep > 0
                  }
                  onResponderGrant={({ pageY }) => startDrag(index(), pageY)}
                  onResponderMove={({ pageY }) => pointerY.set(pageY)}
                  onResponderRelease={({ pageY }) => dropProvider(pageY)}
                  onResponderTerminate={() => drag.set(null)}
                >
                  <Icon
                    icon={GripVertical}
                    size={14}
                    tint={colors.mutedForeground}
                  />
                </View>
                <Icon icon={Server} size={16} tint={colors.foreground} />
                <Text
                  class="min-w-0 flex-1 text-xs text-foreground"
                  classList={{
                    'font-semibold': props.selectedId() === item().id,
                  }}
                  style={{ numberOfLines: 1, textOverflow: 'ellipsis' }}
                >
                  {item().name}
                </Text>
                <View
                  class={
                    'h-2 w-2 shrink-0 rounded-full ' +
                    (item().enabled ? 'bg-accent-emerald' : 'bg-destructive')
                  }
                />
              </View>
            )}
          </Each>
        </Scroll>
      </If>
      <If when={props.capability() === '翻译'}>
        <Button
          accessibilityLabel="新增翻译服务商"
          onPress={props.onAdd}
          variant="secondary"
          style={{ flexShrink: 0 }}
        >
          新增翻译服务商
        </Button>
      </If>
    </View>
  );
}
