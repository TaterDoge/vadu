import {
  cleanup,
  computed,
  effect,
  type InputRef,
  Scroll,
  signal,
  Text,
  token,
  untracked,
  View,
} from 'nsh';
import { Button, Select } from 'nsh/base';
import { currentWindow, Window } from 'nsh/desktop';

import { IconButton } from '../../components/IconButton';
import { buttonFrameClass } from '../../components/ui/buttonStyles';
import {
  providerConnectionsSupported,
  Settings,
  SettingsError,
} from '../../feature/settings';
import '../../feature/settings/appearance/theme';
import { Icon } from '../../components/ui/Icon';
import { lucideChevronDown, lucidePin, lucideSettings } from '../../icons';
import { translationLanguages } from '../../translation-languages';
import { TranslateInput } from './components/TranslateInput';
import { createTranslationSession } from './translation-session';

const pinned = signal(false);
const pickerPopup =
  'rounded-lg border border-border bg-popover p-1 text-popover-foreground';
const pickerItem = `${buttonFrameClass} min-h-8 rounded-md border-transparent px-2 focus:bg-accent selected:bg-accent`;

function PickerLabel(props: { title: string; muted?: boolean }) {
  return (
    <View
      class={`${buttonFrameClass} h-8 min-w-0 flex-row items-center justify-between gap-1 rounded-lg border-border bg-background px-2`}
    >
      <Text
        class={`min-w-0 shrink text-sm leading-5 ${props.muted ? 'text-muted-foreground' : 'text-foreground'}`}
        style={{ numberOfLines: 1, textOverflow: 'ellipsis' }}
      >
        {props.title}
      </Text>
      <Icon
        icon={lucideChevronDown}
        size={12}
        color={token('muted-foreground')}
      />
    </View>
  );
}

export function toggleTranslatePin() {
  pinned.set(!pinned());
}

export function TranslateWindow() {
  let inputRef: InputRef | undefined;
  const window = currentWindow();
  const source = signal('');
  const target = signal(translationLanguages[0].value);
  const profileId = signal<string | null>(null);
  const { result, error, cancelled, pending, submit, cancel } =
    createTranslationSession();
  const configError = signal('');
  const profiles = computed(
    () =>
      Settings.current()?.profiles.filter(
        ({ enabled, model, protocol }) =>
          enabled && model.trim() && protocol === 'chat-completions',
      ) ?? [],
  );
  const chosen = computed(() =>
    profiles().find(({ id }) => id === profileId()),
  );
  let mounted = true;

  void Settings.read().catch((cause) => {
    if (mounted) {
      configError.set(
        cause instanceof SettingsError
          ? cause.message
          : '无法读取翻译服务商配置。',
      );
    }
  });

  effect(() => window.set({ level: pinned() ? 'aboveDock' : 'normal' }));
  effect(() => {
    if (window.state()?.visible === false) untracked(cancel);
  });
  window.on('close', cancel);
  cleanup(() => {
    mounted = false;
    pinned.set(false);
  });

  window.on('focusChange', ({ focused }) => {
    if (focused) {
      inputRef?.focus();
    } else if (!pinned()) {
      window.hide();
    }
  });

  return (
    <View
      testID="translation-workspace"
      role="region"
      accessibilityLabel="翻译工作台"
      class="min-w-0 flex-1 overflow-hidden rounded-xl bg-background text-foreground"
    >
      <View
        testID="translation-toolbar"
        class="h-8 shrink-0 flex-row items-center justify-between px-3"
        desktop={{ windowDrag: true }}
      >
        <IconButton
          label={pinned() ? '取消固定窗口' : '固定窗口'}
          icon={lucidePin}
          selected={pinned()}
          onPress={toggleTranslatePin}
        />
        <IconButton
          label="打开设置"
          icon={lucideSettings}
          onPress={() => Window.get('main')?.focus()}
        />
      </View>
      <View class="min-h-0 flex-1 gap-2 px-2 pb-4">
        <TranslateInput
          inputRef={(node) => {
            inputRef = node;
          }}
          value={source()}
          readonly={pending()}
          onChange={source.set}
        />
        <View class="h-8 shrink-0 flex-row gap-2">
          <Select
            testID="translation-language"
            accessibilityLabel="目标语言"
            value={target()}
            items={translationLanguages}
            onChange={({ value }) => {
              if (value !== null) target.set(value);
            }}
            disabled={pending()}
            cover={false}
            class="w-24 shrink-0"
            popupClass={pickerPopup}
            itemClass={pickerItem}
            trigger={
              <PickerLabel
                title={
                  translationLanguages.find(({ value }) => value === target())
                    ?.title ?? '目标语言'
                }
              />
            }
          />
          <Select
            testID="translation-provider"
            accessibilityLabel="翻译服务商"
            value={chosen()?.id ?? null}
            items={profiles().map(({ id, name, model }) => ({
              value: id,
              title: `${name} · ${model}`,
            }))}
            onChange={({ value }) => profileId.set(value)}
            disabled={
              !providerConnectionsSupported ||
              profiles().length === 0 ||
              pending()
            }
            cover={false}
            class="min-w-0 flex-1"
            popupClass={pickerPopup}
            itemClass={pickerItem}
            trigger={
              <PickerLabel
                title={chosen()?.name ?? '选择服务商'}
                muted={!chosen()}
              />
            }
          />
          <Button
            testID="translation-submit"
            disabled={
              !pending() &&
              (!providerConnectionsSupported || !chosen() || !source().trim())
            }
            accessibilityLabel={pending() ? '取消翻译' : '翻译'}
            onPress={() => {
              const profile = chosen();
              if (pending()) cancel();
              else if (profile) submit(profile.id, target(), source());
            }}
            class={`${buttonFrameClass} w-24 shrink-0 items-center justify-center rounded-lg border-transparent bg-foreground disabled:opacity-50`}
          >
            <Text class="text-sm leading-5 font-semibold text-background">
              {pending() ? '取消翻译' : '翻译'}
            </Text>
          </Button>
        </View>
        <View
          testID="translation-result"
          role="region"
          accessibilityLabel="翻译结果"
          class="min-h-0 gap-1 rounded-xl bg-muted p-3"
          style={{ flex: 2 }}
        >
          <If when={error() || configError()}>
            <Text role="alert" class="text-xs text-destructive">
              {error() || configError()}
            </Text>
          </If>
          <If when={cancelled()}>
            <Text class="text-xs text-muted-foreground">已取消翻译</Text>
          </If>
          <Scroll class="min-h-0 flex-1">
            <View selectable>
              <Text
                class={`text-sm leading-5 ${result() ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {result() || (pending() ? '正在翻译…' : '翻译结果')}
              </Text>
            </View>
          </Scroll>
          <If
            when={
              !providerConnectionsSupported ||
              (!profiles().length && !configError())
            }
          >
            <Text class="text-xs text-muted-foreground">
              {providerConnectionsSupported
                ? '请在设置中启用服务商并保存模型。'
                : '当前平台不支持服务商连接。'}
            </Text>
          </If>
        </View>
      </View>
    </View>
  );
}

export function openTranslateWindow() {
  const window = Window.open(TranslateWindow, {
    id: 'translate',
    frame: 'none',
    transparent: true,
    backdrop: 'none',
    workspaces: 'all',
    defaultSize: { width: 480, height: 320 },
    minSize: { width: 480, height: 320 },
    sizeToContent: false,
    defaultPosition: 'center',
    shadow: true,
  });
  window.focus();
  return window;
}
