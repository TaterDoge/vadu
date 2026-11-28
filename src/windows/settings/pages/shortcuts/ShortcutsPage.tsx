import { RotateCcw } from 'lucide';
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

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  buttonLook,
  IconButton,
  iconButtonGlyph,
} from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { Icon } from '@/lib/ui/icons';
import { colors } from '@/lib/ui/theme';

import {
  type AppSettings,
  captureShortcutKeys,
  GLOBAL_SHORTCUT_ID,
  Settings,
  SettingsError,
} from '../../../../feature/settings';
import { shortcutRecording } from '../../../../feature/settings/shortcuts/runtime';
import { shortcutGroups } from './constants';

export function ShortcutsPage() {
  const settings = signal<AppSettings | null>(null);
  const recording = signal<string | null>(null);
  const pending = signal(false);
  const toastId = 'shortcut-toast';
  let persistentToast = false;
  function showToast(text: string, persistent = false) {
    persistentToast = persistent;
    toast(text, { id: toastId, duration: persistent ? Infinity : 3000 });
  }
  function dismissPersistent() {
    if (!persistentToast) return;
    persistentToast = false;
    toast.dismiss(toastId);
  }
  let cancelledByBlur: string | null = null;
  let recordingField: ViewRef | undefined;
  const captureKeys = captureShortcutKeys();
  let disposed = false;
  cleanup(() => {
    disposed = true;
    shortcutRecording.set(false);
    toast.dismiss(toastId);
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
    if (isRecording(id)) return '请按下快捷键';
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

  function cancel(releaseFocus = true) {
    const field = recordingField;
    clearBlurCancellation();
    recording.set(null);
    shortcutRecording.set(false);
    recordingField = undefined;
    // 先结束录入再失焦，避免 blur 取消逻辑吞掉下一次点击。
    if (releaseFocus) field?.blur();
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
    cancel(false);
    // macOS 先失焦再派发点击，避免同次点击重新开始录制。
    cancelledByBlur = id;
  }

  async function save(id: string, keystroke: string) {
    if (await apply(() => Settings.setShortcut(id, keystroke))) {
      if (recording() === id) cancel();
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
    const stopEscape = keymap.bind('escape', () => cancel(), {
      when: 'always',
    });
    const stopTab = keymap.bind(
      { tab: () => cancel(false), 'shift+tab': () => cancel(false) },
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
                const recordingButton = buttonLook('ghost', { size: 'lg' });

                return (
                  <>
                    <Item
                      testID={'shortcut-' + shortcut().id}
                      variant="outline"
                      style={{ flexWrap: 'wrap' }}
                    >
                      <ItemMedia variant="icon">
                        <Icon
                          icon={shortcut().icon}
                          size={18}
                          tint={colors.foreground}
                        />
                      </ItemMedia>
                      <ItemContent style={{ flexBasis: 128 }}>
                        <ItemTitle style={{ fontSize: 14 }}>
                          {shortcut().title}
                        </ItemTitle>
                        <ItemDescription>
                          {shortcut().description}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions style={{ flexWrap: 'wrap' }}>
                        {/* 原生 View 提供录入所需的失焦事件。 */}
                        <View
                          role="button"
                          focusable
                          accessible
                          ref={(node) => {
                            field = node;
                          }}
                          testID={'shortcut-' + shortcut().id + '-input'}
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
                          style={[
                            recordingButton.style,
                            {
                              paddingHorizontal: 4,
                              backgroundColor: showPrompt()
                                ? colors.muted
                                : undefined,
                            },
                          ]}
                          hoverStyle={
                            showPrompt() ? null : recordingButton.hoverStyle
                          }
                          activeStyle={
                            showPrompt() ? null : recordingButton.activeStyle
                          }
                          focusVisibleStyle={recordingButton.focusVisibleStyle}
                          disabledStyle={recordingButton.disabledStyle}
                          onMouseEnter={clearBlurCancellation}
                          onFocus={clearBlurCancellation}
                          onPress={() => toggleRecording(shortcut().id, field)}
                          onBlur={() => handleRecordingBlur(shortcut().id)}
                        >
                          <If
                            when={showPrompt()}
                            else={
                              <KbdGroup>
                                <Each of={shortcutKeys(shortcut().id)}>
                                  {(key) => <Kbd>{key()}</Kbd>}
                                </Each>
                              </KbdGroup>
                            }
                          >
                            <Text class="px-2 text-xs font-medium text-muted-foreground">
                              {shortcutLabel(shortcut().id)}
                            </Text>
                          </If>
                        </View>
                        <If when={isGlobal()}>
                          <IconButton
                            disabled={!settings() || pending()}
                            onPress={() => resetShortcut(shortcut().id)}
                            accessibilityLabel={
                              '重置' + shortcut().title + '快捷键'
                            }
                          >
                            <Icon icon={RotateCcw} {...iconButtonGlyph()} />
                          </IconButton>
                        </If>
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
                          size="sm"
                        />
                      </ItemActions>
                    </Item>
                    <If when={isRecording(shortcut().id)}>
                      <Alert testID={'shortcut-' + shortcut().id + '-tips'}>
                        <AlertDescription>
                          需要包含 ⌘ / Ctrl / Alt
                          等修饰键，主键可用字母、数字、方向键或标点键等；
                        </AlertDescription>
                      </Alert>
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
