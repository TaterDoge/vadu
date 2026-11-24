import {
  cleanup,
  computed,
  Scroll,
  type Signal,
  signal,
  Text,
  token,
  View,
} from 'nsh';
import { Button, Dialog, Input, Select, Switch } from 'nsh/base';

import { ProviderRequestError } from '../../../../api/request';
import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Icon } from '../../../../components/ui/Icon';
import { createPageToast } from '../../../../components/ui/PageToast';
import {
  providerConnectionsSupported,
  Settings,
  SettingsError,
} from '../../../../feature/settings';
import {
  defaultProfileFields,
  type ProviderProfile,
} from '../../../../feature/settings/providers/config';
import { lucideChevronDown } from '../../../../icons';
import { ProviderAdvancedFields } from './ProviderAdvancedFields';
import { ProviderKeyField } from './ProviderKeyField';
import { createProviderModelField } from './ProviderModelField';
import {
  hintClass,
  inputClass,
  providerButtonClass,
  providerHeadingClass,
  providerOptionsClass,
} from './providerStyles';

type ProviderFields = Omit<ProviderProfile, 'id'>;
type Draft = ProviderFields & { id?: string };
type Confirmation = {
  title: string;
  description: string;
  button: string;
  action: () => Promise<void>;
};

const protocols = [
  { value: 'chat-completions', title: 'Chat Completions (/chat/completions)' },
  { value: 'responses', title: 'Responses (/responses)' },
  { value: 'anthropic-messages', title: 'Anthropic Messages (/v1/messages)' },
] satisfies Array<{ value: ProviderFields['protocol']; title: string }>;

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
  const draft = signal<Draft>(saved() ?? defaultProfileFields);
  const error = signal('');
  const draftKey = signal<{ value: string; baseUrl: string } | null>(null);
  const keyVisible = signal(false);
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
  const { showToast, ToastOutlet } = createPageToast('provider');
  let mounted = true;
  cleanup(() => {
    mounted = false;
    draftKey.set(null);
  });

  const { ModelField, resetModels } = createProviderModelField({
    draft,
    connection,
    draftKey: () => draftKey()?.value ?? null,
    busy,
    run,
    showToast,
    confirmAddress: (address, action) =>
      confirmAddress(address, '确认地址并获取模型', action),
    changeModel: (model) => patchDraft({ model }),
  });

  function errorMessage(cause: unknown) {
    return cause instanceof SettingsError ||
      cause instanceof ProviderRequestError
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

  function confirmAddress(
    address: string,
    button: string,
    action: () => Promise<void>,
    origin?: string,
  ) {
    // 允许新建时先填密钥再输入地址，首次确认的地址成为该草稿密钥的边界。
    const key = draftKey();
    if (key && !key.baseUrl) draftKey.set({ ...key, baseUrl: address });
    const warning = address.toLowerCase().startsWith('http:')
      ? 'HTTP 不加密，原文和 API Key 可能被网络中间方读取。'
      : '';
    confirmation.set({
      title: '允许连接服务商？',
      description: `地址 ${address}\n${origin ? `授权来源 ${origin}。` : ''}模型请求和翻译会发送到该地址。${warning}`,
      button,
      action,
    });
  }

  function patchDraft(patch: Partial<ProviderFields>) {
    const value = draft();
    if (busy()) return;
    if (
      (patch.baseUrl !== undefined && patch.baseUrl !== value.baseUrl) ||
      (patch.protocol !== undefined && patch.protocol !== value.protocol)
    ) {
      if (draftKey()?.baseUrl || saved()) {
        draftKey.set(null);
        keyVisible.set(false);
      }
      resetModels();
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
        temperature:
          value.temperature.trim() || defaultProfileFields.temperature,
        providerOptions: value.providerOptions.trim(),
        headers: value.headers.trim(),
      });
      const action = async () => {
        const key = draftKey()?.value.trim() ?? '';
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
        if (key) resetModels();
        showToast('服务商已保存。');
      };
      if (profile.baseUrl !== saved()?.baseUrl) {
        confirmAddress(profile.baseUrl, '确认地址并保存', action, origin);
      } else {
        void run(action);
      }
    } catch (cause) {
      error.set(errorMessage(cause));
    }
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
      <ProviderKeyField
        connection={connection()}
        busy={busy()}
        draftKey={draftKey()?.value ?? null}
        onChange={(value) =>
          draftKey.set({ value, baseUrl: draft().baseUrl.trim() })
        }
        keyVisible={keyVisible}
      />
      <ModelField />
      <ProviderAdvancedFields
        value={draft()}
        busy={busy()}
        onChange={patchDraft}
      />
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
      <ToastOutlet />
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
