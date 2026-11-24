import { cleanup, computed, effect, signal, Text, View } from 'nsh';
import { Button, Command, Input, Popover } from 'nsh/base';
import { currentWindow } from 'nsh/desktop';

import {
  checkModel,
  listModels,
  listModelsDraft,
} from '../../../../api/models';
import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Icon } from '../../../../components/ui/Icon';
import { providerConnectionsSupported } from '../../../../feature/settings';
import type { ProviderProfile } from '../../../../feature/settings/providers/config';
import {
  lucideActivity,
  lucideLayers,
  lucideRefreshCw,
} from '../../../../icons';
import { HealthCheckSpinner } from './HealthCheckSpinner';
import {
  inputClass,
  providerButtonClass,
  providerHeadingClass,
} from './providerStyles';

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
  const actionClass = `${providerButtonClass} gap-1.5 border-border bg-background hover:bg-accent disabled:opacity-50`;
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
              accessibilityLabel={checkingModel() ? '正在检测模型' : '健康检测'}
              disabled={checkDisabled()}
              onPress={checkCurrentModel}
              class={actionClass}
            >
              <If when={checkingModel()} else={<Icon icon={lucideActivity} />}>
                <HealthCheckSpinner />
              </If>
              <Text class={providerHeadingClass}>健康检测</Text>
            </Button>
            <Popover
              open={modelPickerOpen()}
              onOpenChange={({ open }) => changeModelPicker(open)}
              placement="top"
              align="end"
              offset={4}
              margin={8}
              popupClass="w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-md"
              trigger={
                <Button
                  testID="provider-model-list"
                  accessibilityLabel="选择模型"
                  disabled={!canFetchModels() || busy()}
                  class={actionClass}
                >
                  <Icon icon={lucideLayers} />
                  <Text class={providerHeadingClass}>选择模型</Text>
                </Button>
              }
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
                searchBarClass="shrink-0 flex-row items-center gap-1.5 border-b border-border p-2"
                searchClass={inputClass + ' flex-1'}
                listClass="max-h-72 p-1"
                itemClass={`${buttonFrameClass} min-h-9 justify-center rounded-md border-transparent px-3 py-1.5 text-sm text-popover-foreground checked:bg-secondary focus:bg-accent`}
                searchSuffix={
                  <Button
                    accessibilityLabel="刷新模型列表"
                    disabled={busy()}
                    onPress={fetchModels}
                    class={`${buttonFrameClass} size-8 shrink-0 items-center justify-center rounded-md border-transparent hover:bg-accent disabled:opacity-50`}
                  >
                    <Icon icon={lucideRefreshCw} />
                  </Button>
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
          class={inputClass}
        />
      </View>
    );
  }
  return { ModelField, resetModels };
}
