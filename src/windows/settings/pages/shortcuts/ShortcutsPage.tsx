import {
  cleanup,
  effect,
  keymap,
  lifecycle,
  Overlay,
  safeArea,
  signal,
  Text,
  View,
  type ViewRef,
} from 'nsh';
import {
  Button,
  Toast,
  type ToastEntry,
  ToastManager,
  ToastStack,
} from 'nsh/base';

import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Icon } from '../../../../components/ui/Icon';
import { Item } from '../../../../components/ui/Item';
import { Kbd, KbdGroup } from '../../../../components/ui/Kbd';
import { lucideInfo, lucideRotateCcw } from '../../../../icons';
import {
  type AppSettings,
  captureShortcutKeys,
  Settings,
  SettingsError,
} from '../../../../settings';
import {
  shortcutRecording,
  translateShortcutStatus,
} from '../../../../shortcuts';
import { shortcutGroups } from './constants';

export function ShortcutsPage() {
  const settings = signal<AppSettings | null>(null);
  const recording = signal<string | null>(null);
  const pending = signal(false);
  const toastManager = new ToastManager();
  const toasts = signal<ToastEntry[]>([]);
  let toastTimer: ReturnType<typeof setInterval> | undefined;
  let toastExpanded = false;
  let persistentToast = false;
  let cancelledByBlur: string | null = null;
  let recordingField: ViewRef | undefined;
  const captureKeys = captureShortcutKeys();
  let disposed = false;
  cleanup(() => {
    disposed = true;
    shortcutRecording.set(false);
    if (toastTimer !== undefined) clearInterval(toastTimer);
    toastManager.dispose();
  });

  function syncToast() {
    toasts.set(toastManager.visible(1));
  }

  function startToastTimer() {
    if (toastTimer !== undefined) return;
    toastTimer = setInterval(() => {
      if (toastManager.advance(toastExpanded).changed) syncToast();
      if (
        toastManager.isEmpty() ||
        (persistentToast &&
          toasts().every((toast) => toast.status === 'present'))
      ) {
        clearInterval(toastTimer);
        toastTimer = undefined;
      }
    }, 50);
  }

  function showToast(text: string, persistent = false) {
    persistentToast = persistent;
    toastManager.push('shortcut', text, { timeout: persistent ? null : 3000 });
    syncToast();
    startToastTimer();
  }

  function dismissToast() {
    if (!toastManager.dismiss('shortcut')) return;
    persistentToast = false;
    syncToast();
    startToastTimer();
  }

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

  function shortcutLabel(id: string) {
    const binding = settings()?.shortcuts.find((item) => item.id === id);
    return binding ? keymap.label(binding.keystroke) : '不可用';
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
    if (persistentToast) dismissToast();
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
    if (persistentToast) dismissToast();
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
      <Overlay
        class="inset-x-0 bottom-0 items-center p-4"
        style={{ paddingBottom: safeArea().bottom + 16 }}
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
                testID="shortcut-toast"
                transitionStatus={toast().status}
                accessibilityLabel={String(toast().value)}
                onDismissRequest={dismissToast}
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
                            disabled={!settings()}
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
                            classList={{
                              'bg-accent': isRecording(shortcut().id),
                            }}
                            onMouseEnter={clearBlurCancellation}
                            onFocus={clearBlurCancellation}
                            onPress={() =>
                              toggleRecording(shortcut().id, field)
                            }
                            onBlur={() => handleRecordingBlur(shortcut().id)}
                          >
                            <If
                              when={isRecording(shortcut().id)}
                              else={
                                <Each of={shortcutKeys(shortcut().id)}>
                                  {(key) => <Kbd>{key()}</Kbd>}
                                </Each>
                              }
                            >
                              <Kbd>请按下快捷键…</Kbd>
                            </If>
                          </KbdGroup>
                          <If when={shortcut().resettable}>
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
                            {shortcut().id === 'toggle-translate'
                              ? translateShortcutStatus()
                              : settings()
                                ? '已启用'
                                : '未启用'}
                          </Text>
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
