import { Activity, Layers, RefreshCw } from 'lucide';
import { cleanup, computed, effect, signal, Text, View } from 'nsh';
import { currentWindow } from 'nsh/desktop';

import {
  Button,
  buttonGlyph,
  IconButton,
  iconButtonGlyph,
} from '@/components/ui/button';
import { Command } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Icon } from '@/lib/ui/icons';

import {
  checkModel,
  listModels,
  listModelsDraft,
} from '../../../../api/models';
import { providerConnectionsSupported } from '../../../../feature/settings';
import type { ProviderProfile } from '../../../../feature/settings/providers/config';
import { providerHeadingClass } from './providerStyles';

export function createProviderModelField({
  draft,
  connection,
  draftKey,
  busy,
  run,
  showToast,
  confirmAddress,
  changeModel,
}: {
  draft: () => Pick<ProviderProfile, 'model' | 'protocol' | 'baseUrl'>;
  connection: () => ProviderProfile | null;
  draftKey: () => string | null;
  busy: () => boolean;
  run: (
    action: () => Promise<void>,
    onError?: (message: string) => void,
  ) => Promise<void>;
  showToast: (message: string) => void;
  confirmAddress: (address: string, action: () => Promise<void>) => void;
  changeModel: (model: string) => void;
}) {
  const models = signal<string[]>([]);
  const checkingModel = signal(false);
  const modelPickerOpen = signal(false);
  const canFetchModels = computed(
    () =>
      providerConnectionsSupported &&
      draft().protocol === 'chat-completions' &&
      !!draft().baseUrl.trim() &&
      (!!connection() || !!draftKey()?.trim()),
  );
  const checkDisabled = () =>
    busy() ||
    connection()?.protocol !== 'chat-completions' ||
    !draft().model.trim();

  const window = currentWindow();
  let networkRequest: AbortController | undefined;
  const abort = () => networkRequest?.abort();
  effect(() => {
    if (window.state()?.visible === false) abort();
  });
  window.on('close', abort);
  cleanup(abort);

  function resetModels() {
    modelPickerOpen.set(false);
    models.set([]);
  }

  function withNetworkRequest(action: (signal: AbortSignal) => Promise<void>) {
    return async () => {
      const controller = new AbortController();
      networkRequest = controller;
      try {
        await action(controller.signal);
      } catch (cause) {
        if (!controller.signal.aborted) throw cause;
      } finally {
        networkRequest = undefined;
      }
    };
  }

  function changeModelPicker(open: boolean) {
    modelPickerOpen.set(open);
    if (open && models().length === 0) fetchModels();
  }

  function fetchModels() {
    const profile = connection();
    const key = draftKey()?.trim() ?? '';
    const address = draft().baseUrl.trim();
    const action = withNetworkRequest(async (signal) => {
      const found =
        profile && !key
          ? await listModels(profile.id, signal)
          : await listModelsDraft(address, key, signal);
      if (signal.aborted) return;
      models.set(found);
      showToast(
        found.length
          ? `已获取 ${found.length} 个模型。`
          : '模型列表为空，可以手动输入模型 ID。',
      );
    });
    if (profile) void run(action, showToast);
    else confirmAddress(address, action);
  }

  function checkCurrentModel() {
    const profile = connection();
    if (!profile) return;
    const model = draft().model.trim();
    void run(
      withNetworkRequest(async (signal) => {
        checkingModel.set(true);
        try {
          await checkModel(profile.id, model, signal);
          if (!signal.aborted) showToast(`模型 ${model} 可以正常对话。`);
        } finally {
          checkingModel.set(false);
        }
      }),
      showToast,
    );
  }

  function ModelField() {
    return (
      <View class="gap-1.5">
        <View class="flex-row items-center justify-between gap-2">
          <Text class={`${providerHeadingClass} shrink-0`}>模型</Text>
          <View class="min-w-0 flex-row flex-wrap justify-end gap-1.5">
            <Button
              testID="provider-health-check"
              accessibilityLabel={checkingModel() ? '正在检测模型' : '健康检测'}
              variant="secondary"
              busy={checkingModel()}
              disabled={checkDisabled() && !checkingModel()}
              onPress={checkCurrentModel}
            >
              <If when={!checkingModel()}>
                <Icon icon={Activity} {...buttonGlyph('secondary')} />
              </If>
              健康检测
            </Button>
            <Popover
              open={modelPickerOpen()}
              onOpenChange={({ open }) => changeModelPicker(open)}
            >
              <PopoverTrigger>
                <Button
                  testID="provider-model-list"
                  accessibilityLabel="选择模型"
                  variant="secondary"
                  disabled={!canFetchModels() || busy()}
                >
                  <Icon icon={Layers} {...buttonGlyph('secondary')} />
                  选择模型
                </Button>
              </PopoverTrigger>
              <PopoverContent
                placement="top"
                align="end"
                offset={4}
                margin={8}
                width={320}
                compact
              >
                <Command
                  class="min-h-0 shrink"
                  accessibilityLabel="模型列表"
                  searchAccessibilityLabel="搜索模型"
                  placeholder="搜索模型…"
                  autoFocus
                  loading={busy()}
                  items={models().map((id) => ({
                    id,
                    label: id,
                    checked: id === draft().model,
                    disabled: busy(),
                  }))}
                  listStyle={{ maxHeight: 288 }}
                  searchSuffix={
                    <IconButton
                      accessibilityLabel="刷新模型列表"
                      disabled={busy()}
                      onPress={fetchModels}
                    >
                      <Icon icon={RefreshCw} {...iconButtonGlyph()} />
                    </IconButton>
                  }
                  empty={
                    <Text class="px-3 py-2 text-sm text-muted-foreground">
                      {models().length ? '没有匹配的模型' : '暂无模型'}
                    </Text>
                  }
                  footer={
                    <If when={busy() && models().length === 0}>
                      <Text class="px-3 py-2 text-sm text-muted-foreground">
                        正在获取模型…
                      </Text>
                    </If>
                  }
                  onSelect={({ id }) => {
                    changeModel(id);
                    changeModelPicker(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </View>
        </View>
        <Input
          testID="provider-model"
          accessibilityLabel="模型 ID"
          maxLength={300}
          readonly={busy()}
          value={draft().model}
          onChange={({ value }) => changeModel(value)}
          placeholder="输入模型 ID"
        />
      </View>
    );
  }
  return { ModelField, resetModels };
}
