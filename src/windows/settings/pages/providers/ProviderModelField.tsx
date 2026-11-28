import { Activity, Layers, Minus, RefreshCw, X } from 'lucide';
import { cleanup, computed, effect, signal, Text, View } from 'nsh';
import { currentWindow } from 'nsh/desktop';

import {
  Button,
  buttonGlyph,
  IconButton,
  iconButtonGlyph,
} from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Command } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select';
import { Icon } from '@/lib/ui/icons';

import {
  checkModel,
  listModels,
  listModelsDraft,
} from '../../../../api/models';
import { providerConnectionsSupported } from '../../../../feature/settings';
import {
  isValidModelId,
  type ProviderProfile,
} from '../../../../feature/settings/providers/config';
import { hintClass, providerHeadingClass } from './providerStyles';

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
  changeModel: (model: string[]) => void;
}) {
  const models = signal<string[]>([]);
  const modelPickerOpen = signal(false);
  const manualModel = signal('');
  const modelCheckOpen = signal(false);
  const checkSelection = signal<string | null>(null);
  const checking = signal(false);
  const checkStatus = signal('');
  const availableModels = computed(() => [
    ...new Set([...models(), ...draft().model]),
  ]);
  const checkModelId = computed(
    () => checkSelection() ?? draft().model[0] ?? models()[0] ?? null,
  );
  const canAddModel = () =>
    !busy() &&
    isValidModelId(manualModel().trim()) &&
    !draft().model.includes(manualModel().trim());
  const canFetchModels = computed(
    () =>
      providerConnectionsSupported &&
      draft().protocol === 'chat-completions' &&
      !!draft().baseUrl.trim() &&
      (!!connection() || !!draftKey()?.trim()),
  );
  const canCheckModels = () => connection()?.protocol === 'chat-completions';

  const window = currentWindow();
  let networkRequest: AbortController | undefined;
  const abort = () => networkRequest?.abort();
  effect(() => {
    if (window.state()?.visible === false) {
      abort();
      modelCheckOpen.set(false);
    }
  });
  window.on('close', abort);
  cleanup(abort);

  function resetModels() {
    modelCheckOpen.set(false);
    modelPickerOpen.set(false);
    manualModel.set('');
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
    if (!open) {
      manualModel.set('');
      abort();
    } else if (canFetchModels() && models().length === 0) {
      fetchModels();
    }
  }

  function fetchModels() {
    if (busy() || !canFetchModels()) return;
    const profile = connection();
    const forCheck = modelCheckOpen();
    const key = forCheck ? '' : (draftKey()?.trim() ?? '');
    const address = draft().baseUrl.trim();
    const action = withNetworkRequest(async (signal) => {
      const found =
        profile && !key
          ? await listModels(profile.id, signal)
          : await listModelsDraft(address, key, signal);
      if (signal.aborted) return;
      models.set(found);
      if (!forCheck) {
        showToast(
          found.length
            ? `已获取 ${found.length} 个模型。`
            : '模型列表为空，可以手动输入模型 ID。',
        );
      }
    });
    if (profile) void run(action, forCheck ? checkStatus.set : showToast);
    else confirmAddress(address, action);
  }

  function addModel() {
    if (!canAddModel()) return;
    changeModel([...draft().model, manualModel().trim()]);
    manualModel.set('');
  }

  function openModelCheck() {
    if (busy() || !canCheckModels()) return;
    checkSelection.set(null);
    checkStatus.set('');
    modelCheckOpen.set(true);
    if (models().length === 0) fetchModels();
  }

  function closeModelCheck() {
    modelCheckOpen.set(false);
    abort();
  }

  function testModel() {
    const profile = connection();
    const model = checkModelId();
    if (busy() || profile?.protocol !== 'chat-completions' || model === null)
      return;
    void run(
      withNetworkRequest(async (signal) => {
        checking.set(true);
        try {
          checkStatus.set(`正在检测：${model}`);
          await checkModel(profile.id, model, signal);
          if (!signal.aborted) checkStatus.set(`模型 ${model} 可以正常对话。`);
        } finally {
          checking.set(false);
        }
      }),
      checkStatus.set,
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
              accessibilityLabel="测试模型"
              variant="secondary"
              icon={Activity}
              disabled={busy() || !canCheckModels()}
              onPress={openModelCheck}
            >
              测试
            </Button>
            <Button
              testID="provider-model-list"
              accessibilityLabel="选择模型"
              variant="secondary"
              disabled={busy()}
              onPress={() => changeModelPicker(true)}
            >
              <Icon icon={Layers} {...buttonGlyph('secondary')} />
              选择模型
            </Button>
            <Drawer
              open={modelPickerOpen()}
              onOpenChange={({ open }) => changeModelPicker(open)}
            >
              <DrawerContent side="right" accessibilityLabel="管理模型">
                <DrawerHeader>
                  <DrawerTitle>选择模型</DrawerTitle>
                  <DrawerDescription>点击模型切换启用状态</DrawerDescription>
                </DrawerHeader>
                <Command
                  class="min-h-0 flex-1"
                  accessibilityLabel="模型列表"
                  searchAccessibilityLabel="搜索模型"
                  placeholder="搜索模型…"
                  autoFocus
                  loading={busy()}
                  items={availableModels().map((id) => ({
                    id,
                    label: id,
                    checked: draft().model.includes(id),
                    disabled: busy(),
                  }))}
                  listStyle={{ flex: 1, minHeight: 0 }}
                  searchSuffix={
                    <IconButton
                      accessibilityLabel="刷新模型列表"
                      disabled={busy() || !canFetchModels()}
                      onPress={fetchModels}
                    >
                      <Icon icon={RefreshCw} {...iconButtonGlyph()} />
                    </IconButton>
                  }
                  empty={
                    <Text class="px-3 py-2 text-sm text-muted-foreground">
                      {availableModels().length ? '没有匹配的模型' : '暂无模型'}
                    </Text>
                  }
                  footer={
                    <If when={busy() && models().length === 0}>
                      <Text class="px-3 py-2 text-sm text-muted-foreground">
                        正在获取模型…
                      </Text>
                    </If>
                  }
                  onCancel={() => changeModelPicker(false)}
                  onSelect={({ id }) => {
                    const selected = draft().model;
                    changeModel(
                      selected.includes(id)
                        ? selected.filter((model) => model !== id)
                        : [...selected, id],
                    );
                  }}
                />
                <View class="flex-row items-center gap-2">
                  <Input
                    class="min-w-0 flex-1"
                    accessibilityLabel="手动输入模型 ID"
                    placeholder="输入模型 ID"
                    maxLength={300}
                    readonly={busy()}
                    value={manualModel()}
                    onChange={({ value }) => manualModel.set(value)}
                    onSubmit={addModel}
                  />
                  <Button
                    accessibilityLabel="添加模型"
                    variant="secondary"
                    disabled={!canAddModel()}
                    onPress={addModel}
                  >
                    添加模型
                  </Button>
                </View>
                <DrawerFooter>
                  <Button
                    accessibilityLabel="完成选择"
                    onPress={() => changeModelPicker(false)}
                  >
                    {`完成(已选${draft().model.length}个)`}
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </View>
        </View>
        <Dialog
          open={modelCheckOpen()}
          onOpenChange={({ open }) => {
            if (!open) closeModelCheck();
          }}
        >
          <DialogContent
            testID="provider-health-dialog"
            accessibilityLabel="模型检测"
            width={400}
          >
            <View class="flex-row items-center justify-between gap-2">
              <DialogTitle>模型检测</DialogTitle>
              <IconButton
                icon={X}
                size="sm"
                accessibilityLabel="关闭模型检测"
                onPress={closeModelCheck}
              />
            </View>
            <View class="gap-1.5">
              <Text class={providerHeadingClass}>选择模型</Text>
              <Select
                value={checkModelId()}
                placeholder="暂无可检测的模型"
                disabled={busy() || availableModels().length === 0}
                onChange={({ value }) => {
                  checkSelection.set(value);
                  checkStatus.set('');
                }}
              >
                <SelectTrigger
                  testID="provider-health-model"
                  accessibilityLabel="选择要检测的模型"
                  style={{ width: '100%' }}
                />
                <SelectContent
                  items={availableModels().map((id) => ({
                    value: id,
                    title: id,
                  }))}
                  cover={false}
                />
              </Select>
            </View>
            <If when={checkStatus() !== '' || (busy() && !checking())}>
              <Text class={hintClass} accessibilityLiveRegion="polite">
                {busy() && !checking() ? '正在获取模型…' : checkStatus()}
              </Text>
            </If>
            <DialogFooter>
              <Button
                accessibilityLabel="取消"
                variant="secondary"
                onPress={closeModelCheck}
              >
                取消
              </Button>
              <Button
                accessibilityLabel="开始"
                busy={checking()}
                disabled={(busy() && !checking()) || checkModelId() === null}
                onPress={testModel}
              >
                开始
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Card>
          <CardContent>
            <ItemGroup testID="provider-model" accessibilityLabel="已选模型">
              <Each of={draft().model}>
                {(model) => (
                  <Item size="sm" variant="outline">
                    <ItemContent>
                      <ItemTitle>{model()}</ItemTitle>
                    </ItemContent>
                    <IconButton
                      icon={Minus}
                      size="sm"
                      accessibilityLabel={`移除模型 ${model()}`}
                      disabled={busy()}
                      onPress={() =>
                        changeModel(
                          draft().model.filter((id) => id !== model()),
                        )
                      }
                    />
                  </Item>
                )}
              </Each>
              <If when={draft().model.length === 0}>
                <Text class={hintClass}>未选择模型</Text>
              </If>
            </ItemGroup>
          </CardContent>
        </Card>
      </View>
    );
  }
  return { ModelField, resetModels };
}
