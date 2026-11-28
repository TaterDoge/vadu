import { Pin, Settings as SettingsIcon } from 'lucide';
import {
  cleanup,
  computed,
  effect,
  type InputRef,
  Scroll,
  signal,
  Text,
  untracked,
  View,
} from 'nsh';
import { currentWindow, Window } from 'nsh/desktop';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, IconButton, iconButtonGlyph } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select';
import { TitleBar } from '@/components/ui/title-bar';
import { Icon } from '@/lib/ui/icons';

import {
  providerConnectionsSupported,
  Settings,
  SettingsError,
} from '../../feature/settings';
import '../../feature/settings/appearance/theme';
import { translationLanguages } from '../../translation-languages';
import { TranslateInput } from './components/TranslateInput';
import { createTranslationSession } from './translation-session';

const pinned = signal(false);

export function toggleTranslatePin() {
  pinned.set(!pinned());
}

export function TranslateWindow() {
  let inputRef: InputRef | undefined;
  const window = currentWindow();
  const source = signal('');
  const target = signal(translationLanguages[0].value);
  const selection = signal<string | null>(null);
  const { result, error, cancelled, pending, submit, cancel } =
    createTranslationSession();
  const configError = signal('');
  const modelChoices = computed(() =>
    (Settings.current()?.profiles ?? [])
      .filter(
        ({ enabled, protocol }) => enabled && protocol === 'chat-completions',
      )
      .flatMap(({ id, name, model }) =>
        model.map((modelId) => ({
          value: JSON.stringify([id, modelId]),
          title: `${name} · ${modelId}`,
          profileId: id,
          model: modelId,
        })),
      ),
  );
  const chosen = computed(() =>
    modelChoices().find(({ value }) => value === selection()),
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
      <TitleBar
        testID="translation-toolbar"
        style={{
          justifyContent: 'space-between',
          backgroundColor: 'transparent',
          borderBottomColor: ' transparent',
        }}
      >
        <IconButton
          accessibilityLabel={pinned() ? '取消固定窗口' : '固定窗口'}
          selected={pinned()}
          onPress={toggleTranslatePin}
        >
          <Icon icon={Pin} {...iconButtonGlyph({ selected: pinned() })} />
        </IconButton>
        <IconButton
          accessibilityLabel="打开设置"
          onPress={() => Window.get('main')?.focus()}
        >
          <Icon icon={SettingsIcon} {...iconButtonGlyph()} />
        </IconButton>
      </TitleBar>
      <View class="min-h-0 flex-1 gap-2 px-2 pb-4">
        <TranslateInput
          inputRef={(node) => {
            inputRef = node;
          }}
          value={source()}
          readonly={pending()}
          onChange={source.set}
        />
        <View class="shrink-0 flex-row items-center gap-2">
          <Select
            value={target()}
            onChange={({ value }) => {
              if (value !== null) target.set(value);
            }}
            disabled={pending()}
          >
            <SelectTrigger
              testID="translation-language"
              accessibilityLabel="目标语言"
              style={{ width: 120, minWidth: 0, flexShrink: 0 }}
            />
            <SelectContent items={translationLanguages} cover={false} />
          </Select>
          <Select
            value={chosen()?.value ?? null}
            onChange={({ value }) => selection.set(value)}
            disabled={
              !providerConnectionsSupported ||
              modelChoices().length === 0 ||
              pending()
            }
            placeholder="选择服务商"
          >
            <SelectTrigger
              testID="translation-provider"
              accessibilityLabel="翻译服务商"
              style={{ flex: 1, minWidth: 0 }}
            />
            <SelectContent items={modelChoices()} cover={false} />
          </Select>
          <Button
            testID="translation-submit"
            disabled={
              !pending() &&
              (!providerConnectionsSupported || !chosen() || !source().trim())
            }
            accessibilityLabel={pending() ? '取消翻译' : '翻译'}
            onPress={() => {
              const choice = chosen();
              if (pending()) cancel();
              else if (choice)
                submit(choice.profileId, choice.model, target(), source());
            }}
            style={{ width: 96, flexShrink: 0 }}
          >
            {pending() ? '取消翻译' : '翻译'}
          </Button>
        </View>
        <Card
          testID="translation-result"
          role="region"
          accessibilityLabel="翻译结果"
          style={{ flex: 2, minHeight: 0, padding: 10, gap: 4 }}
        >
          <If when={error() || configError()}>
            <Alert variant="destructive" style={{ padding: 4 }}>
              <AlertDescription>{error() || configError()}</AlertDescription>
            </Alert>
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
              (!modelChoices().length && !configError())
            }
          >
            <Text class="text-xs text-muted-foreground">
              {providerConnectionsSupported
                ? '请在设置中启用服务商并保存模型。'
                : '当前平台不支持服务商连接。'}
            </Text>
          </If>
        </Card>
      </View>
    </View>
  );
}

export function openTranslateWindow() {
  const currentWindow = Window.get('translate');
  if (currentWindow) {
    currentWindow.focus();
    return;
  }
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
