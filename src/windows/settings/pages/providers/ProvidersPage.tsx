import { randomUUID } from 'crypto';

import { cleanup, computed, Scroll, signal, Text, token, View } from 'nsh';
import { Button, Input, Select, Tab, Tabs } from 'nsh/base';
import type { ProviderProfile } from 'vadu/native';

import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Icon } from '../../../../components/ui/Icon';
import { inputFrameClass } from '../../../../components/ui/inputStyles';
import {
  lucideFunnel,
  lucideGripVertical,
  lucideServer,
} from '../../../../icons';
import { Settings, SettingsError } from '../../../../settings';
import {
  providerButtonClass,
  ProviderEditor,
  providerHeadingClass,
  providerOptionsClass,
} from './ProviderEditor';

const capabilities = ['翻译', '识别', '语音'] as const;
type Capability = (typeof capabilities)[number];
const filters = [
  { value: 'all', title: '全部状态' },
  { value: 'enabled', title: '仅已启用' },
  { value: 'disabled', title: '仅已停用' },
];

export function ProvidersPage() {
  const capability = signal<Capability>('翻译');
  const query = signal('');
  const filter = signal('all');
  const selectedId = signal('');
  const error = signal('');
  const busy = signal(false);
  const compact = signal(false);
  const providers = () => Settings.current()?.profiles ?? [];
  const visibleProviders = computed(() => {
    if (capability() !== '翻译') return [];
    const name = query().trim().toLowerCase();
    const status = filter();
    return providers().filter(
      (p) =>
        p.name.toLowerCase().includes(name) &&
        (status === 'all' || p.enabled === (status === 'enabled')),
    );
  });
  let mounted = true;
  cleanup(() => {
    mounted = false;
  });

  async function updateList(action: () => Promise<void>) {
    if (busy()) return;
    busy.set(true);
    error.set('');
    try {
      await action();
    } catch (cause) {
      if (mounted)
        error.set(
          cause instanceof SettingsError ? cause.message : '操作失败，请重试。',
        );
    } finally {
      if (mounted) busy.set(false);
    }
  }

  void updateList(async () => {
    const { profiles } = await Settings.read();
    if (mounted) selectedId.set(profiles[0]?.id ?? '');
  });

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
    if (!current || current.rows !== visibleProviders()) return null;
    const { rows, from, startY, step } = current;
    const delta = pointerY() + scrollY() - startY;
    const offset = Math.max(
      -from * step,
      Math.min((rows.length - 1 - from) * step, delta),
    );
    return { from, to: Math.round(from + offset / step), offset, step };
  });

  function moveProvider(from: number, to: number) {
    const rows = visibleProviders();
    if (from === to || !rows[from] || !rows[to]) return;
    const sorted = rows.slice();
    const [moved] = sorted.splice(from, 1);
    sorted.splice(to, 0, moved);
    void updateList(async () => {
      await Settings.orderProfiles(sorted.map(({ id }) => id));
    });
  }

  function startDrag(from: number, pageY: number) {
    pointerY.set(pageY);
    drag.set({
      rows: visibleProviders(),
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

  function select(id: string) {
    error.set('');
    selectedId.set(id);
  }

  function selectCapability(value: Capability) {
    if (busy() || value === capability()) return;
    capability.set(value);
    query.set('');
    filter.set('all');
    select(visibleProviders()[0]?.id ?? '');
  }

  return (
    <View
      testID="settings-providers-page"
      class="min-h-0 min-w-0 flex-1 gap-3 px-4 py-2"
    >
      <Tabs
        accessibilityLabel="服务商类别"
        class="shrink-0 flex-row self-center rounded-xl bg-muted p-1"
      >
        <Each of={capabilities}>
          {(item) => (
            <Tab
              accessibilityLabel={item()}
              selected={capability() === item()}
              onPress={() => selectCapability(item())}
              class={`${buttonFrameClass} selected:bg-background items-center rounded-lg border-transparent px-2 py-0.5`}
            >
              <Text
                classList={{
                  'font-semibold text-foreground': capability() === item(),
                  'text-muted-foreground': capability() !== item(),
                }}
                class="text-sm leading-5"
              >
                {item()}
              </Text>
            </Tab>
          )}
        </Each>
      </Tabs>
      <View
        class={
          compact()
            ? 'min-h-0 min-w-0 flex-1 gap-3'
            : 'min-h-0 min-w-0 flex-1 flex-row gap-6'
        }
        onLayout={({ bounds }) => compact.set(bounds.size.width < 440)}
      >
        <View
          class={
            compact() ? 'min-h-36 flex-1 gap-2' : 'min-h-0 w-48 shrink-0 gap-2'
          }
        >
          <View
            class={`${inputFrameClass} h-8 shrink-0 flex-row items-center gap-1 rounded-lg px-1.5`}
          >
            <Input
              accessibilityLabel="搜索服务商"
              value={query()}
              onChange={({ value }) => query.set(value)}
              placeholder="搜索服务商"
              class="h-7 min-w-0 flex-1 px-1 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <Select
              accessibilityLabel="按启用状态筛选"
              items={filters}
              value={filter()}
              onChange={({ value }) => filter.set(value ?? 'all')}
              align="end"
              cover={false}
              popupClass="min-w-28 rounded-lg border border-border bg-popover p-1 text-popover-foreground"
              itemClass={providerOptionsClass}
              trigger={
                <View
                  class={`${buttonFrameClass} h-6 w-6 shrink-0 items-center justify-center rounded-md border-transparent hover:bg-accent`}
                  classList={{ 'bg-accent': filter() !== 'all' }}
                >
                  <Icon icon={lucideFunnel} color={token('muted-foreground')} />
                </View>
              }
            />
          </View>
          <If
            when={visibleProviders().length > 0}
            else={
              <Text class="min-h-0 flex-1 text-xs leading-4 text-muted-foreground">
                {capability() !== '翻译'
                  ? `${capability()}服务尚未接入`
                  : query().trim() || filter() !== 'all'
                    ? '没有匹配的服务商'
                    : '暂无服务商'}
              </Text>
            }
          >
            <Scroll
              testID="providers-list-scroll"
              class="min-h-0 flex-1"
              contentClass="gap-2"
              onScroll={({ offset }) => scrollY.set(offset.y)}
            >
              <Each of={visibleProviders()} key={(p) => p.id}>
                {(item, index) => (
                  <View
                    onLayout={({ bounds }) => {
                      // 列表从 y=0 开始，第二行的坐标包含行高和间距。
                      if (index() === 1) rowStep = bounds.origin.y;
                    }}
                    class="h-9 flex-row items-center rounded-lg pl-1 hover:bg-accent"
                    classList={{
                      'bg-muted': selectedId() === item().id,
                      'shadow-md': preview()?.from === index(),
                    }}
                    style={{
                      backgroundColor:
                        preview()?.from === index()
                          ? token('background')
                          : undefined,
                      zIndex: preview()?.from === index() ? 1 : 0,
                      transform: [{ translateY: rowOffset(index()) }],
                    }}
                  >
                    <View
                      testID={`provider-grip-${item().id}`}
                      class="h-full w-5 shrink-0 items-center justify-center"
                      style={{
                        cursor:
                          preview()?.from === index() ? 'grabbing' : 'grab',
                      }}
                      classList={{ 'opacity-0': visibleProviders().length < 2 }}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      onStartShouldSetResponder={() =>
                        !busy() && visibleProviders().length > 1 && rowStep > 0
                      }
                      onResponderGrant={({ pageY }) =>
                        startDrag(index(), pageY)
                      }
                      onResponderMove={({ pageY }) => pointerY.set(pageY)}
                      onResponderRelease={({ pageY }) => dropProvider(pageY)}
                      onResponderTerminate={() => drag.set(null)}
                    >
                      <Icon
                        icon={lucideGripVertical}
                        size={14}
                        color={token('muted-foreground')}
                      />
                    </View>
                    <View
                      testID={`provider-row-${item().id}`}
                      role="button"
                      focusable
                      accessibilityLabel={
                        item().name + (item().enabled ? '，已启用' : '，已停用')
                      }
                      accessibilityState={{
                        selected: selectedId() === item().id,
                      }}
                      accessibilityActions={[
                        ...(index() > 0
                          ? [{ name: 'move-up', label: '上移' }]
                          : []),
                        ...(index() + 1 < visibleProviders().length
                          ? [{ name: 'move-down', label: '下移' }]
                          : []),
                      ]}
                      onAccessibilityAction={({ actionName }) => {
                        if (actionName === 'move-up')
                          moveProvider(index(), index() - 1);
                        if (actionName === 'move-down')
                          moveProvider(index(), index() + 1);
                      }}
                      onPress={() => {
                        if (!busy()) select(item().id);
                      }}
                      class="h-full min-w-0 flex-1 flex-row items-center gap-2 rounded-lg px-2 focus-visible:bg-border"
                    >
                      <Icon icon={lucideServer} />
                      <Text
                        class="min-w-0 flex-1 text-xs text-foreground"
                        classList={{
                          'font-semibold': selectedId() === item().id,
                        }}
                        style={{ numberOfLines: 1, textOverflow: 'ellipsis' }}
                      >
                        {item().name}
                      </Text>
                      <View
                        class={
                          'h-2 w-2 shrink-0 rounded-full ' +
                          (item().enabled
                            ? 'bg-accent-emerald'
                            : 'border border-muted-foreground')
                        }
                      />
                    </View>
                  </View>
                )}
              </Each>
            </Scroll>
          </If>
          <If when={capability() === '翻译'}>
            <Button
              accessibilityLabel="新增翻译服务商"
              disabled={busy()}
              onPress={() => select(randomUUID())}
              class={`${providerButtonClass} shrink-0 border-border hover:bg-accent`}
            >
              <Text class={providerHeadingClass}>新增翻译服务商</Text>
            </Button>
          </If>
        </View>
        <Scroll testID="provider-editor-scroll" class="min-h-0 min-w-0 flex-1">
          <If when={error()}>
            <Text role="alert" class="text-xs text-destructive">
              {error()}
            </Text>
          </If>
          <If when={!selectedId() && !error()}>
            <Text class="text-sm text-muted-foreground">
              {busy()
                ? '正在读取服务商…'
                : capability() === '翻译'
                  ? '选择或新增服务商'
                  : ''}
            </Text>
          </If>
          {/* 按 ID 挂载，切换时清理编辑状态，排序时保留草稿。 */}
          <Each of={selectedId() ? [selectedId()] : []}>
            {(id) => (
              <ProviderEditor
                profileId={id()}
                busy={busy}
                onCreated={() => {
                  query.set('');
                  filter.set('all');
                }}
                onDeleted={() => select(visibleProviders()[0]?.id ?? '')}
              />
            )}
          </Each>
        </Scroll>
      </View>
    </View>
  );
}
