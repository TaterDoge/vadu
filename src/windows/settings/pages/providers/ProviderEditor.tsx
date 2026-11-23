import {
  cleanup,
  computed,
  effect,
  Overlay,
  safeArea,
  Scroll,
  type Signal,
  signal,
  Text,
  token,
  View,
} from 'nsh';
import {
  Button,
  Command,
  Dialog,
  Editor,
  Input,
  Popover,
  Select,
  Switch,
  Toast,
  type ToastEntry,
  ToastManager,
  ToastStack,
} from 'nsh/base';
import { currentWindow } from 'nsh/desktop';
import { Profiles, type ProviderProfile, Secrets } from 'vadu/native';

import { IconButton } from '../../../../components/IconButton';
import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Icon } from '../../../../components/ui/Icon';
import { inputFrameClass } from '../../../../components/ui/inputStyles';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideEye,
  lucideEyeOff,
  lucideLayers,
  lucideRefreshCw,
} from '../../../../icons';
import {
  providerConnectionsSupported,
  Settings,
  SettingsError,
} from '../../../../settings';

type ProviderFields = Omit<ProviderProfile, 'id'>;
type Draft = ProviderFields & { id?: string };
type Confirmation = {
  title: string;
  description: string;
  button: string;
  action: () => Promise<void>;
};

const defaultTemperature = '0.3';
const emptyFields: ProviderFields = {
  name: '',
  protocol: 'chat-completions',
  baseUrl: '',
  model: '',
  enabled: true,
  temperature: defaultTemperature,
  providerOptions: '',
  headers: '',
};

const protocols = [
  { value: 'chat-completions', title: 'Chat Completions (/chat/completions)' },
  { value: 'responses', title: 'Responses (/responses)' },
  { value: 'anthropic-messages', title: 'Anthropic Messages (/v1/messages)' },
] satisfies Array<{ value: ProviderFields['protocol']; title: string }>;

export const providerHeadingClass = 'text-sm font-semibold text-foreground';
export const providerButtonClass = `${buttonFrameClass} min-h-8 flex-row items-center justify-center rounded-lg px-2.5`;
export const providerOptionsClass = `${buttonFrameClass} min-h-8 justify-center rounded-md border-transparent px-2.5 focus:bg-accent selected:bg-secondary`;
const inputClass = `${inputFrameClass} h-8 min-w-0 rounded-lg bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground`;
const hintClass = 'text-xs leading-4 text-muted-foreground';
const editorClass = `${inputFrameClass} h-24 min-w-0 rounded-lg bg-background`;

export function ProviderEditor(props: {
  profileId: string;
  busy: Signal<boolean>;
  onCreated: () => void;
  onDeleted: () => void;
}) {
  const busy = props.busy;
  const saved = computed(() =>
    Settings.current()?.profiles.find((p) => p.id === props.profileId),
  );
  const draft = signal<Draft>(saved() ?? emptyFields);
  const error = signal('');
  const draftKey = signal<string | null>(null);
  const savedKey = signal('');
  const apiKey = computed(() => draftKey() ?? savedKey());
  const keyVisible = signal(false);
  const keyStatus = signal('');
  const models = signal<string[]>([]);
  const modelPickerOpen = signal(false);
  const advancedOpen = signal(false);
  const confirmation = signal<Confirmation | null>(null);
  const connection = computed(() => {
    const profile = saved();
    const value = draft();
    return providerConnectionsSupported &&
      profile &&
      value.baseUrl.trim() === profile.baseUrl &&
      value.protocol === profile.protocol
      ? profile
      : null;
  });
  // 未保存时也能用已确认的地址和本次输入的密钥获取模型。
  const canFetchModels = computed(() => {
    const value = draft();
    if (
      !providerConnectionsSupported ||
      value.protocol !== 'chat-completions' ||
      !value.baseUrl.trim()
    )
      return false;
    return apiKey().trim() !== '' || connection() !== null;
  });
  const toastManager = new ToastManager();
  const toasts = signal<ToastEntry[]>([]);
  let toastTimer: ReturnType<typeof setInterval> | undefined;
  let toastExpanded = false;
  let mounted = true;
  let keyStatusVersion = 0;
  cleanup(() => {
    mounted = false;
    draftKey.set(null);
    savedKey.set('');
    if (toastTimer !== undefined) clearInterval(toastTimer);
    toastManager.dispose();
  });

  function syncToasts() {
    toasts.set(toastManager.visible(1));
  }

  function showToast(message: string) {
    toastManager.push('provider', message, { timeout: 3000 });
    syncToasts();
    if (toastTimer !== undefined) return;
    toastTimer = setInterval(() => {
      if (toastManager.advance(toastExpanded).changed) syncToasts();
      if (toastManager.isEmpty()) {
        clearInterval(toastTimer);
        toastTimer = undefined;
      }
    }, 50);
  }

  const window = currentWindow();
  const windowActive = computed(() => {
    const state = window.state();
    return !state || (state.visible && state.focused);
  });

  effect(() => {
    const profile = windowActive() ? connection() : null;
    keyVisible.set(false);
    savedKey.set('');
    keyStatus.set(profile ? '正在读取本地存储…' : '');
    if (!profile) return;
    const version = ++keyStatusVersion;
    void Secrets.reveal(profile.id)
      .then(({ key, error }) => {
        if (!mounted || version !== keyStatusVersion) return;
        savedKey.set(key ?? '');
        keyStatus.set(
          error?.message ?? (key ? '已保存 API Key' : '未设置 API Key'),
        );
      })
      .catch(() => {
        if (mounted && version === keyStatusVersion)
          keyStatus.set('无法读取本地存储。');
      });
    cleanup(() => {
      keyStatusVersion++;
    });
  });

  function errorMessage(cause: unknown) {
    return cause instanceof SettingsError
      ? cause.message
      : '操作失败，请重试。';
  }

  async function run(
    action: () => Promise<void>,
    onError?: (message: string) => void,
  ) {
    if (busy()) return;
    busy.set(true);
    if (!onError) error.set('');
    try {
      await action();
    } catch (cause) {
      if (mounted) (onError ?? error.set)(errorMessage(cause));
    } finally {
      busy.set(false);
    }
  }

  function patchDraft(patch: Partial<ProviderFields>) {
    const value = draft();
    if (busy()) return;
    if (
      (patch.baseUrl !== undefined && patch.baseUrl !== value.baseUrl) ||
      (patch.protocol !== undefined && patch.protocol !== value.protocol)
    ) {
      // 切换连接时，清除在原地址上编辑的密钥。
      if (connection()) draftKey.set(null);
      modelPickerOpen.set(false);
      models.set([]);
    }
    draft.set({ ...value, ...patch });
    error.set('');
  }

  function requestSave() {
    const value = draft();
    if (busy()) return;
    try {
      const create = value.id === undefined;
      const { profile, origin } = Settings.checkProfile({
        id: props.profileId,
        name: value.name.trim(),
        protocol: value.protocol,
        baseUrl: value.baseUrl.trim(),
        model: value.model.trim(),
        enabled: value.enabled,
        temperature: value.temperature.trim() || defaultTemperature,
        providerOptions: value.providerOptions.trim(),
        headers: value.headers.trim(),
      });
      const action = async () => {
        const key = draftKey()?.trim() ?? '';
        keyVisible.set(false);
        draftKey.set(null);
        const { keyError } = await Settings.saveProfile(profile, create, key);
        if (!mounted) return;
        if (create) props.onCreated();
        draft.set(profile);
        if (keyError) {
          error.set(`服务商配置已保存，API Key 保存失败。${keyError}`);
          return;
        }
        if (key) {
          keyStatusVersion++;
          models.set([]);
          if (windowActive()) savedKey.set(key);
          keyStatus.set('已保存 API Key');
        }
        showToast('服务商已保存。');
      };
      if (profile.baseUrl !== saved()?.baseUrl) {
        confirmation.set({
          title: '允许连接服务商？',
          description: `地址 ${profile.baseUrl}\n授权来源 ${origin}。模型请求和翻译会发送到该地址。${origin.startsWith('http:') ? 'HTTP 不加密，原文和 API Key 可能被网络中间方读取。' : ''}`,
          button: '确认地址并保存',
          action,
        });
      } else {
        void run(action);
      }
    } catch (cause) {
      error.set(errorMessage(cause));
    }
  }

  function changeModelPicker(open: boolean) {
    if (open && (busy() || !canFetchModels())) return;
    modelPickerOpen.set(open);
    if (open && models().length === 0) fetchModels();
  }

  function fetchModels() {
    const value = draft();
    if (value.protocol !== 'chat-completions' || busy()) return;
    const profile = connection();
    const key = draftKey()?.trim() ?? '';
    if (!profile && !key) return;
    const address = value.baseUrl.trim();
    const action = async () => {
      const { models: found, error } =
        profile && !key
          ? await Profiles.listModels(profile.id)
          : await Profiles.listModelsDraft(address, key);
      if (!found)
        throw new SettingsError(
          error?.code ?? 'NETWORK',
          error?.message ?? '无法获取模型列表。',
        );
      if (!mounted) return;
      models.set(found);
      showToast(
        found.length
          ? `已获取 ${found.length} 个模型。`
          : '模型列表为空，可以手动输入模型 ID。',
      );
    };
    if (profile) {
      void run(action, showToast);
      return;
    }
    confirmation.set({
      title: '允许连接服务商？',
      description: `地址 ${address}\n模型请求和翻译会发送到该地址。${address.toLowerCase().startsWith('http:') ? 'HTTP 不加密，原文和 API Key 可能被网络中间方读取。' : ''}`,
      button: '确认地址并获取模型',
      action,
    });
  }

  function checkModel() {
    const profile = connection();
    const model = draft().model.trim();
    if (profile?.protocol !== 'chat-completions' || !model) return;
    void run(async () => {
      const error = await Profiles.checkModel(profile.id, model);
      if (error) throw new SettingsError(error.code, error.message);
      if (mounted) showToast(`模型 ${model} 可以正常对话。`);
    }, showToast);
  }

  function requestDelete() {
    const profile = saved();
    if (!profile || busy()) return;
    confirmation.set({
      title: '删除服务商？',
      description: `删除「${profile.name}」及其 API Key。`,
      button: '确认删除',
      action: async () => {
        await Settings.removeProfile(profile.id);
        if (mounted) props.onDeleted();
      },
    });
  }

  function confirm() {
    const selected = confirmation();
    if (!selected) return;
    confirmation.set(null);
    void run(selected.action);
  }

  function changeKey(value: string) {
    if (busy()) return;
    draftKey.set(value);
    if (!value) keyVisible.set(false);
  }

  const checkDisabled = () =>
    !connection() ||
    busy() ||
    draft().protocol !== 'chat-completions' ||
    !draft().model.trim();
  const actionClass = `${providerButtonClass} gap-1.5 border-border bg-background hover:bg-accent disabled:opacity-50`;

  return (
    <View class="gap-2.5">
      <If when={error() !== ''}>
        <Text role="alert" class="text-xs text-destructive">
          {error()}
        </Text>
      </If>
      <View class="gap-1.5">
        <View class="flex-row items-center justify-between gap-2">
          <Text class={providerHeadingClass}>名称</Text>
          <Switch
            testID="provider-enabled"
            accessibilityLabel="启用服务商"
            disabled={busy()}
            checked={draft().enabled}
            onChange={({ checked }) => patchDraft({ enabled: checked })}
            class={`${buttonFrameClass} h-8 shrink-0 justify-center rounded-lg border-transparent px-1`}
            trackClass="h-5 w-8 justify-center rounded-full bg-muted-foreground px-0.5 checked:bg-foreground"
            thumbClass="h-4 w-4 rounded-full bg-background checked:translate-x-3"
          />
        </View>
        <Input
          testID="provider-name"
          accessibilityLabel="名称（必填）"
          maxLength={100}
          readonly={busy()}
          value={draft().name}
          onChange={({ value }) => patchDraft({ name: value })}
          class={inputClass}
        />
      </View>
      <View class="gap-1.5">
        <Text class={providerHeadingClass}>API 协议</Text>
        <Select
          testID="provider-protocol"
          accessibilityLabel="API 协议"
          items={protocols}
          value={draft().protocol}
          onChange={({ value }) => {
            const protocol = protocols.find((item) => item.value === value);
            if (protocol) patchDraft({ protocol: protocol.value });
          }}
          cover={false}
          disabled={busy()}
          popupClass="rounded-lg border border-border bg-popover p-1 text-popover-foreground"
          itemClass={providerOptionsClass}
          trigger={
            <View
              class={`${buttonFrameClass} h-8 min-w-0 flex-row items-center justify-between gap-2 rounded-lg border-input bg-background px-2.5`}
            >
              <Text
                class="min-w-0 shrink text-sm text-foreground"
                style={{ numberOfLines: 1 }}
              >
                {
                  protocols.find(({ value }) => value === draft().protocol)
                    ?.title
                }
              </Text>
              <Icon
                icon={lucideChevronDown}
                size={12}
                color={token('muted-foreground')}
              />
            </View>
          }
        />
        <If when={draft().protocol !== 'chat-completions'}>
          <Text class={hintClass}>该 API 协议尚未接入，可保存配置。</Text>
        </If>
      </View>
      <View class="gap-1.5">
        <Text class={providerHeadingClass}>
          接口地址（Base URL）<Text class="text-destructive"> *</Text>
        </Text>
        <Input
          testID="provider-base-url"
          accessibilityLabel="接口地址（Base URL，必填）"
          placeholder="https://api.openai.com/v1"
          maxLength={2000}
          readonly={busy()}
          value={draft().baseUrl}
          onChange={({ value }) => patchDraft({ baseUrl: value })}
          class={inputClass}
        />
        <Text class={hintClass}>填写含版本路径的接口根地址。</Text>
      </View>
      <View class="gap-1.5">
        <Text class={providerHeadingClass}>API Key</Text>
        <View
          class={`${inputFrameClass} h-8 min-w-0 flex-row items-center gap-1 rounded-lg bg-background pr-1`}
        >
          <Input
            testID="provider-api-key"
            accessibilityLabel="API Key"
            masked={!keyVisible()}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={2048}
            value={apiKey()}
            onChange={({ value }) => changeKey(value)}
            disabled={!providerConnectionsSupported || busy()}
            class="h-full min-w-0 flex-1 pl-2.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <IconButton
            label={keyVisible() ? '隐藏密钥' : '显示密钥'}
            icon={keyVisible() ? lucideEyeOff : lucideEye}
            disabled={!providerConnectionsSupported || busy() || !apiKey()}
            onPress={() => keyVisible.set(!keyVisible())}
            class="shrink-0 disabled:opacity-50"
          />
        </View>
        <Text class={hintClass}>
          {providerConnectionsSupported
            ? keyStatus() || 'API Key 随服务商保存，留空保持已有 Key。'
            : '当前平台不支持服务商连接。'}
        </Text>
      </View>
      <View class="gap-1.5">
        <View class="flex-row items-center justify-between gap-2">
          <Text class={`${providerHeadingClass} shrink-0`}>模型</Text>
          <View class="min-w-0 flex-row flex-wrap justify-end gap-1.5">
            <Button
              accessibilityLabel="健康检测"
              disabled={checkDisabled()}
              onPress={checkModel}
              class={actionClass}
            >
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
                  patchDraft({ model: id });
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
          onChange={({ value }) => patchDraft({ model: value })}
          placeholder="输入模型 ID"
          class={inputClass}
        />
      </View>
      <View
        role="button"
        focusable
        accessibilityLabel="高级选项"
        accessibilityState={{ expanded: advancedOpen() }}
        onPress={() => advancedOpen.set(!advancedOpen())}
        class={`${buttonFrameClass} min-h-8 flex-row items-center gap-2 self-start rounded-lg border-transparent px-1 hover:bg-accent`}
      >
        <Icon
          icon={advancedOpen() ? lucideChevronDown : lucideChevronRight}
          size={12}
          color={token('muted-foreground')}
        />
        <Text class="text-sm font-medium text-foreground">高级选项</Text>
      </View>
      <If when={advancedOpen()}>
        <View class="gap-2.5">
          <View class="gap-1.5">
            <Text class={providerHeadingClass}>温度</Text>
            <Input
              accessibilityLabel="温度"
              keyboardType="decimal-pad"
              readonly={busy()}
              value={draft().temperature}
              onChange={({ value }) => patchDraft({ temperature: value })}
              class={`${inputClass} w-36`}
            />
            <Text class={hintClass}>输入 0 到 1，留空后保存可恢复默认值。</Text>
          </View>
          <View class="gap-1.5">
            <Text class={providerHeadingClass}>服务商选项</Text>
            <Editor
              accessibilityLabel="服务商选项"
              language="json"
              softWrap
              scrollBeyondLastLine={false}
              placeholder={'{"enable_thinking": false}'}
              readOnly={busy()}
              value={draft().providerOptions}
              onChange={({ value }) => patchDraft({ providerOptions: value })}
              class={editorClass}
            />
            <Text class={hintClass}>
              按服务商文档填写 JSON 对象，例如模型的思考参数。
            </Text>
          </View>
          <View class="gap-1.5">
            <Text class={providerHeadingClass}>请求头</Text>
            <Editor
              accessibilityLabel="请求头"
              language="json"
              softWrap
              scrollBeyondLastLine={false}
              placeholder={'{"X-Client": "vadu"}'}
              readOnly={busy()}
              value={draft().headers}
              onChange={({ value }) => patchDraft({ headers: value })}
              class={editorClass}
            />
            <Text class={hintClass}>
              在 JSON 对象中填写请求头，值用字符串。请勿填写密钥或令牌。
            </Text>
          </View>
        </View>
      </If>
      <View class="flex-row justify-between gap-2">
        <Button
          accessibilityLabel="保存"
          disabled={busy()}
          onPress={requestSave}
          class={`${providerButtonClass} border-transparent bg-foreground hover:opacity-90`}
        >
          <Text class="text-sm font-semibold text-background">保存</Text>
        </Button>
        <If when={draft().id !== undefined}>
          <Button
            accessibilityLabel="删除"
            disabled={busy()}
            onPress={requestDelete}
            class={
              providerButtonClass +
              ' border-transparent bg-destructive/10 hover:bg-destructive/20'
            }
          >
            <Text class="text-sm font-semibold text-destructive">删除</Text>
          </Button>
        </If>
      </View>
      <Overlay
        class="inset-x-0 bottom-0 items-center p-4"
        style={{
          paddingBottom: safeArea().bottom + 16,
          pointerEvents: 'box-none',
        }}
      >
        <ToastStack
          closeOnEscape={false}
          style={{ width: 340, maxWidth: '100%' }}
          placement="bottomRight"
          onExpandedChange={({ expanded }) => {
            toastExpanded = expanded;
          }}
        >
          <Each of={toasts()} key={(toast: ToastEntry) => toast.id}>
            {(toast) => (
              <Toast
                testID="provider-toast"
                transitionStatus={toast().status}
                accessibilityLabel={String(toast().value)}
                onDismissRequest={() => {
                  if (toastManager.dismiss(toast().id)) syncToasts();
                }}
                class="rounded-lg border border-border bg-card px-4 py-3 transition-all duration-200 ease-out"
                startingClass="opacity-0 translate-y-4"
                endingClass="opacity-0 scale-95"
                swipingClass="transition-none"
              >
                <Text class="text-sm text-card-foreground">
                  {String(toast().value)}
                </Text>
              </Toast>
            )}
          </Each>
        </ToastStack>
      </Overlay>
      <Dialog
        testID="provider-confirm-dialog"
        open={confirmation() !== null}
        role="alertdialog"
        accessibilityLabel={confirmation()?.title ?? '确认操作'}
        accessibilityDescription={confirmation()?.description}
        animation="fade"
        closeOnBackdropPress={false}
        onOpenChange={({ open }) => {
          if (!open) confirmation.set(null);
        }}
        backdropClass="bg-background/75"
        class="m-auto w-80 max-w-[90%] gap-3 rounded-xl border border-border bg-popover p-4 shadow-lg"
      >
        <Text class={providerHeadingClass}>{confirmation()?.title}</Text>
        <Scroll class="max-h-40">
          <Text class="text-sm leading-5 text-muted-foreground">
            {confirmation()?.description}
          </Text>
        </Scroll>
        <View class="flex-row flex-wrap justify-end gap-2">
          <Button
            accessibilityLabel="取消"
            onPress={() => confirmation.set(null)}
            class={`${providerButtonClass} border-border hover:bg-accent`}
          >
            <Text class={providerHeadingClass}>取消</Text>
          </Button>
          <Button
            accessibilityLabel={confirmation()?.button ?? '确认'}
            onPress={confirm}
            class={`${providerButtonClass} border-transparent bg-foreground hover:opacity-90`}
          >
            <Text class="text-sm font-semibold text-background">
              {confirmation()?.button}
            </Text>
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
