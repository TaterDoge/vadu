import { randomUUID } from 'crypto';

import {
  AudioLines,
  Funnel,
  GripVertical,
  Inbox,
  ScanText,
  Server,
} from 'lucide';
import { cleanup, computed, Scroll, signal, Text, View } from 'nsh';
import { Select } from 'nsh/base';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonLook, IconButton } from '@/components/ui/button';
import {
  Empty,
  EMPTY_ICON,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icon } from '@/lib/ui/icons';
import { listboxProps, OptionRow } from '@/lib/ui/listbox';
import { colors } from '@/lib/ui/theme';

import { Settings, SettingsError } from '../../../../feature/settings';
import type { ProviderProfile } from '../../../../feature/settings/providers/config';
import { ProviderEditor } from './ProviderEditor';

const capabilities = ['翻译', '识别', '语音'] as const;
type Capability = (typeof capabilities)[number];
const capabilityIcons = { 翻译: Server, 识别: ScanText, 语音: AudioLines };
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
      class="min-h-0 min-w-0 flex-1 gap-3 p-1"
    >
      <Tabs value={capability()} style={{ alignSelf: 'center', flexShrink: 0 }}>
        <TabsList accessibilityLabel="服务商类别">
          <Each of={capabilities}>
            {(item) => (
              <TabsTrigger
                accessibilityLabel={item()}
                value={item()}
                disabled={busy()}
                onPress={() => selectCapability(item())}
              >
                {item()}
              </TabsTrigger>
            )}
          </Each>
        </TabsList>
      </Tabs>
      <View
        class="min-h-0 min-w-0 flex-1 gap-2"
        classList={{ 'flex-row': !compact() }}
        onLayout={({ bounds }) => compact.set(bounds.size.width < 440)}
      >
        <View
          class={
            compact()
              ? 'min-h-36 flex-1 gap-1 p-1'
              : 'min-h-0 w-48 shrink-0 gap-1 p-1'
          }
        >
          <InputGroup class="shrink-0" accessibilityLabel="服务商搜索与筛选">
            <InputGroupInput
              accessibilityLabel="搜索服务商"
              value={query()}
              onChange={({ value }) => query.set(value)}
              placeholder="搜索服务商"
              class="min-w-0"
            />
            <InputGroupAddon align="inline-end" style={{ paddingEnd: 1 }}>
              <Select
                {...listboxProps({ minWidth: 112 })}
                items={filters}
                value={filter()}
                onChange={({ value }) => filter.set(value ?? 'all')}
                align="end"
                cover={false}
                trigger={
                  <IconButton
                    accessibilityLabel="按启用状态筛选"
                    icon={Funnel}
                    selected={filter() !== 'all'}
                  />
                }
                renderItem={(item) => <OptionRow item={item} />}
              />
            </InputGroupAddon>
          </InputGroup>
          <If
            when={visibleProviders().length > 0}
            else={
              <Empty
                testID="providers-list-empty"
                style={{ padding: 8, gap: 4 }}
              >
                <Icon icon={Inbox} size={18} tint={colors.mutedForeground} />
                <EmptyDescription>
                  {capability() === '翻译' &&
                  (query().trim() || filter() !== 'all')
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
              <Each of={visibleProviders()} key={(p) => p.id}>
                {(item, index) => (
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
                    focusVisibleStyle={buttonLook('ghost').focusVisibleStyle}
                    onLayout={({ bounds }) => {
                      // 行在无内边距的内容容器内，第二行的 y 就是排序步长。
                      if (index() === 1) rowStep = bounds.origin.y;
                    }}
                    class="h-9 flex-row items-center gap-2 rounded-lg pr-2 pl-1 hover:bg-accent"
                    classList={{
                      'bg-muted': selectedId() === item().id,
                      'shadow-md': preview()?.from === index(),
                    }}
                    style={{
                      backgroundColor:
                        preview()?.from === index()
                          ? colors.background
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
                        icon={GripVertical}
                        size={14}
                        tint={colors.mutedForeground}
                      />
                    </View>
                    <Icon icon={Server} size={16} tint={colors.foreground} />
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
                          : 'bg-destructive')
                      }
                    />
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
              variant="secondary"
              style={{ flexShrink: 0 }}
            >
              新增翻译服务商
            </Button>
          </If>
        </View>
        <Scroll
          scrollbar={false}
          testID="provider-editor-scroll"
          class="min-h-0 min-w-0 flex-1 p-1"
          contentClass="grow"
        >
          <If when={error()}>
            <Alert variant="destructive">
              <AlertDescription>{error()}</AlertDescription>
            </Alert>
          </If>
          <If when={!selectedId() && !error()}>
            <If
              when={!busy()}
              else={
                <Text class="text-sm text-muted-foreground">
                  正在读取服务商…
                </Text>
              }
            >
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon
                      icon={capabilityIcons[capability()]}
                      size={EMPTY_ICON}
                      tint={colors.foreground}
                    />
                  </EmptyMedia>
                  <EmptyTitle>
                    {capability() === '翻译'
                      ? '选择或新增服务商'
                      : `${capability()}服务尚未接入`}
                  </EmptyTitle>
                  <EmptyDescription>
                    {capability() === '翻译'
                      ? '在这里配置接口地址、模型和 API Key。'
                      : '切换到「翻译」可管理翻译服务商。'}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </If>
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
