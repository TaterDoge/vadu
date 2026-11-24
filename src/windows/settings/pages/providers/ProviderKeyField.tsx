import {
  cleanup,
  computed,
  effect,
  type Signal,
  signal,
  Text,
  View,
} from 'nsh';
import { Input } from 'nsh/base';
import { currentWindow } from 'nsh/desktop';

import { IconButton } from '../../../../components/IconButton';
import { inputFrameClass } from '../../../../components/ui/inputStyles';
import {
  providerConnectionsSupported,
  Settings,
  SettingsError,
} from '../../../../feature/settings';
import type { ProviderProfile } from '../../../../feature/settings/providers/config';
import { lucideEye, lucideEyeOff } from '../../../../icons';
import { hintClass, providerHeadingClass } from './providerStyles';

export function ProviderKeyField(props: {
  connection: ProviderProfile | null;
  busy: boolean;
  draftKey: string | null;
  onChange: (value: string) => void;
  keyVisible: Signal<boolean>;
}) {
  const { keyVisible } = props;
  const savedKey = signal('');
  const keyStatus = signal('');
  const apiKey = () => props.draftKey ?? savedKey();
  const window = currentWindow();
  const windowActive = computed(() => {
    const state = window.state();
    return !state || (state.visible && state.focused);
  });

  effect(() => {
    const profile = windowActive() ? props.connection : null;
    keyVisible.set(false);
    savedKey.set('');
    keyStatus.set(profile ? '正在读取本地存储…' : '');
    if (!profile) return;
    let current = true;
    void Settings.readProfileKey(profile.id, profile.baseUrl)
      .then((key) => {
        if (!current) return;
        savedKey.set(key ?? '');
        keyStatus.set(key ? '已保存 API Key' : '未设置 API Key');
      })
      .catch((cause) => {
        if (current)
          keyStatus.set(
            cause instanceof SettingsError
              ? cause.message
              : '无法读取本地存储。',
          );
      });
    cleanup(() => {
      current = false;
    });
  });

  cleanup(() => savedKey.set(''));

  function changeKey(value: string) {
    props.onChange(value);
    if (!value) keyVisible.set(false);
  }

  return (
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
          disabled={!providerConnectionsSupported || props.busy}
          class="h-full min-w-0 flex-1 pl-2.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <IconButton
          label={keyVisible() ? '隐藏密钥' : '显示密钥'}
          icon={keyVisible() ? lucideEyeOff : lucideEye}
          disabled={!providerConnectionsSupported || props.busy || !apiKey()}
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
  );
}
