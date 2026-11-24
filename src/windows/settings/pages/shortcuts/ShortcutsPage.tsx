import {
  cleanup,
  effect,
  keymap,
  lifecycle,
  signal,
  Text,
  View,
  type ViewRef,
} from 'nsh';
import { Button, Switch } from 'nsh/base';

import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Icon } from '../../../../components/ui/Icon';
import { Item } from '../../../../components/ui/Item';
import { Kbd, KbdGroup } from '../../../../components/ui/Kbd';
import { createPageToast } from '../../../../components/ui/PageToast';
import {
  type AppSettings,
  captureShortcutKeys,
  GLOBAL_SHORTCUT_ID,
  Settings,
  SettingsError,
} from '../../../../feature/settings';
import {
  shortcutRecording,
  translateShortcutStatus,
} from '../../../../feature/settings/shortcuts/runtime';
import { lucideInfo, lucideRotateCcw } from '../../../../icons';
import { shortcutGroups } from './constants';

export function ShortcutsPage() {
  const settings = signal<AppSettings | null>(null);
  const recording = signal<string | null>(null);
  const pending = signal(false);
  const { showToast, dismissPersistent, ToastOutlet } =
    createPageToast('shortcut');
  let cancelledByBlur: string | null = null;
  let recordingField: ViewRef | undefined;
  const captureKeys = captureShortcutKeys();
  let disposed = false;
  cleanup(() => {
    disposed = true;
    shortcutRecording.set(false);
  });

  async function apply(
    action: () => Promise<AppSettings>,
    reportError: (text: string) => void = (text) => showToast(text, true),
  ) {
    if (pending() || disposed) return false;
    pending.set(true);
    try {
      const next = await action();
      if (disposed) return false;
      settings.set(next);
      return true;
    } catch (error) {
      if (!disposed) {
        reportError(
          error instanceof SettingsError
            ? error.message
            : '无法访问配置，请稍后重试。',
        );
      }
      return false;
    } finally {
      if (!disposed) pending.set(false);
    }
  }

  void apply(Settings.read);

  function isRecording(id: string) {
    return recording() === id;
  }

  function bindingFor(id: string) {
    return settings()?.shortcuts.find((item) => item.id === id);
  }

  function shortcutLabel(id: string) {
    if (isRecording(id)) return '请按下快捷键…';
    const binding = bindingFor(id);
    if (!binding) return '不可用';
    return binding.keystroke === null
      ? '点击录入'
      : keymap.label(binding.keystroke);
  }

  function shortcutKeys(id: string) {
    return shortcutLabel(id).match(/[⌃⌥⇧⌘]|[^⌃⌥⇧⌘+]+/g) ?? [];
  }

  function clearBlurCancellation() {
    cancelledByBlur = null;
  }

  function cancel() {
    clearBlurCancellation();
    recording.set(null);
    shortcutRecording.set(false);
    recordingField = undefined;
    dismissPersistent();
  }

  function toggleRecording(id: string, field: ViewRef | undefined) {
    if (pending()) {
      clearBlurCancellation();
      return;
    }
    const shouldCancel = isRecording(id) || cancelledByBlur === id;
    cancel();
    if (shouldCancel) return;
    recordingField = field;
    field?.focus();
    shortcutRecording.set(true);
    recording.set(id);
  }

  function handleRecordingBlur(id: string) {
    if (!isRecording(id)) return;
    cancel();
    // macOS 先失焦再派发点击，避免同次点击重新开始录制。
    cancelledByBlur = id;
  }

  async function save(id: string, keystroke: string) {
    if (await apply(() => Settings.setShortcut(id, keystroke))) {
      if (recording() === id) {
        const field = recordingField;
        // 先结束录入再失焦，避免 blur 取消逻辑吞掉下一次点击。
        cancel();
        field?.blur();
      }
    }
  }

  async function resetShortcut(id: string) {
    dismissPersistent();
    if (await apply(() => Settings.resetShortcut(id), showToast)) {
      cancel();
      showToast('快捷键已恢复默认。');
    }
  }

  effect(() => {
    const id = recording();
    if (!id) return;

    const stopCapture = keymap.bind(
      Object.fromEntries(
        captureKeys.map((key) => [
          key,
          () => {
            void save(id, key);
          },
        ]),
      ),
      { when: 'always' },
    );
    const stopEscape = keymap.bind('escape', cancel, { when: 'always' });
    const stopTab = keymap.bind(
      { tab: cancel, 'shift+tab': cancel },
      { when: 'always', passThrough: true },
    );
    return () => {
      stopCapture();
      stopEscape();
      stopTab();
    };
  });

  effect(() => {
    if (lifecycle() !== 'active') {
      clearBlurCancellation();
      if (recording()) cancel();
    }
  });

  return (
    <View testID="settings-shortcuts-page" class="gap-6">
      <ToastOutlet />
      <Each of={shortcutGroups}>
        {(group) => (
          <View class="gap-4">
            <Text
              role="header"
              accessibilityLevel={2}
              class="text-sm font-semibold text-foreground"
            >
              {group().title}
            </Text>
            <Each of={group().items}>
              {(shortcut) => {
                let field: ViewRef | undefined;
                const isGlobal = () => shortcut().id === GLOBAL_SHORTCUT_ID;
                const showPrompt = () =>
                  isRecording(shortcut().id) ||
                  bindingFor(shortcut().id)?.keystroke === null;
                const enabled = () =>
                  bindingFor(shortcut().id)?.enabled ?? false;

                return (
                  <>
                    <Item
                      testID={'shortcut-' + shortcut().id}
                      title={shortcut().title}
                      description={shortcut().description}
                      media={<Icon icon={shortcut().icon} size={20} />}
                      actions={
                        <>
                          <KbdGroup
                            ref={(node) => {
                              field = node;
                            }}
                            testID={'shortcut-' + shortcut().id + '-input'}
                            accessible
                            role="button"
                            disabled={!isGlobal() || !settings()}
                            accessibilityLabel={
                              shortcut().title +
                              '快捷键 ' +
                              (isRecording(shortcut().id)
                                ? '正在录入，再次点击或按 Esc 取消'
                                : shortcutLabel(shortcut().id))
                            }
                            accessibilityState={{
                              selected: isRecording(shortcut().id),
                            }}
                            class={`${buttonFrameClass} rounded-lg border-transparent p-1 disabled:opacity-40`}
                            classList={{ 'bg-accent': showPrompt() }}
                            onMouseEnter={clearBlurCancellation}
                            onFocus={clearBlurCancellation}
                            onPress={() =>
                              toggleRecording(shortcut().id, field)
                            }
                            onBlur={() => handleRecordingBlur(shortcut().id)}
                          >
                            <If
                              when={showPrompt()}
                              else={
                                <Each of={shortcutKeys(shortcut().id)}>
                                  {(key) => <Kbd>{key()}</Kbd>}
                                </Each>
                              }
                            >
                              <Kbd class="min-w-24">
                                {shortcutLabel(shortcut().id)}
                              </Kbd>
                            </If>
                          </KbdGroup>
                          <If when={isGlobal()}>
                            <Button
                              disabled={!settings() || pending()}
                              onPress={() => resetShortcut(shortcut().id)}
                              accessibilityLabel={
                                '重置' + shortcut().title + '快捷键'
                              }
                              class={`${buttonFrameClass} h-8 w-8 items-center justify-center rounded-lg border-transparent disabled:opacity-40`}
                            >
                              <Icon icon={lucideRotateCcw} />
                            </Button>
                          </If>
                          <Text
                            testID={'shortcut-' + shortcut().id + '-status'}
                            class="max-w-48 text-xs leading-5 text-muted-foreground"
                          >
                            {isGlobal()
                              ? translateShortcutStatus()
                              : enabled()
                                ? '已启用'
                                : '未启用'}
                          </Text>
                          <Switch
                            testID={'shortcut-' + shortcut().id + '-enabled'}
                            accessibilityLabel={
                              '启用' + shortcut().title + '快捷键'
                            }
                            checked={enabled()}
                            disabled={!isGlobal() || !settings() || pending()}
                            onChange={({ checked }) => {
                              cancel();
                              void apply(
                                () =>
                                  Settings.setShortcutEnabled(
                                    shortcut().id,
                                    checked,
                                  ),
                                showToast,
                              );
                            }}
                            class={`${buttonFrameClass} h-8 shrink-0 justify-center rounded-lg border-transparent px-1 disabled:opacity-40`}
                            trackClass="h-5 w-8 justify-center rounded-full bg-muted-foreground px-0.5 checked:bg-foreground"
                            thumbClass="h-4 w-4 rounded-full bg-background checked:translate-x-3"
                          />
                        </>
                      }
                    />
                    <If when={isRecording(shortcut().id)}>
                      <View
                        testID={'shortcut-' + shortcut().id + '-tips'}
                        class="flex-row items-start gap-2 rounded-xl border border-border bg-card p-3"
                      >
                        <Icon icon={lucideInfo} size={20} />
                        <Text class="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
                          需要包含 ⌘ / Ctrl / Alt
                          等修饰键，主键可用字母、数字、方向键或标点键等；F1–F24
                          也可单独使用。
                        </Text>
                      </View>
                    </If>
                  </>
                );
              }}
            </Each>
          </View>
        )}
      </Each>
    </View>
  );
}
