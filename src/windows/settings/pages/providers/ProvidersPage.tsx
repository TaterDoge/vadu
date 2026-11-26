import { randomUUID } from 'crypto';

import { AudioLines, ScanText, Server } from 'lucide';
import { cleanup, computed, Scroll, signal, View } from 'nsh';

import {
  Empty,
  EMPTY_ICON,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icon } from '@/lib/ui/icons';
import { colors } from '@/lib/ui/theme';

import { Settings } from '../../../../feature/settings';
import { ProviderEditor } from './ProviderEditor';
import { ProviderList } from './ProviderList';

const capabilities = ['翻译', '识别', '语音'] as const;
export type Capability = (typeof capabilities)[number];
const capabilityIcons = { 翻译: Server, 识别: ScanText, 语音: AudioLines };

export function ProvidersPage() {
  const capability = signal<Capability>('翻译');
  const query = signal('');
  const filter = signal('all');
  const selectedId = signal('');
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

  void Settings.read().then(
    ({ profiles }) => {
      if (mounted && !selectedId()) selectedId.set(profiles[0]?.id ?? '');
    },
    () => {},
  );

  function select(id: string) {
    selectedId.set(id);
  }

  function selectCapability(value: Capability) {
    if (value === capability()) return;
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
        <ProviderList
          providers={visibleProviders}
          capability={capability}
          compact={compact}
          query={query}
          filter={filter}
          selectedId={selectedId}
          onSelect={select}
          onAdd={() => select(randomUUID())}
        />
        <Scroll
          scrollbar={false}
          testID="provider-editor-scroll"
          class="min-h-0 min-w-0 flex-1 p-1"
          contentClass="grow"
        >
          <If when={!selectedId()}>
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
          {/* 按 ID 挂载，切换时清理编辑状态，排序时保留草稿。 */}
          <Each of={selectedId() ? [selectedId()] : []}>
            {(id) => (
              <ProviderEditor
                profileId={id()}
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
