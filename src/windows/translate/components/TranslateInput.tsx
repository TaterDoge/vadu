import { Copy, Eraser, Volume2 } from 'lucide';
import { Clipboard, type InputRef, signal, Text, View } from 'nsh';

import { IconButton, iconButtonGlyph } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/lib/ui/icons';
import { alpha, colors } from '@/lib/ui/theme';

// Gallery 的默认悬停色与原文面板同色。
const sourceToolHoverStyle = () => ({
  backgroundColor: alpha(colors.foreground, 0.05),
});

export function TranslateInput(props: {
  inputRef: (node: InputRef) => void;
  value: string;
  readonly: boolean;
  onChange: (value: string) => void;
}) {
  let input: InputRef | undefined;
  const copyFailed = signal(false);
  const hasText = () => props.value.trim().length > 0;

  async function copySource() {
    try {
      await Clipboard.writeText(props.value);
      copyFailed.set(false);
    } catch {
      copyFailed.set(true);
    }
  }

  function clearSource() {
    props.onChange('');
    copyFailed.set(false);
    input?.focus();
  }

  return (
    <View
      testID="translation-source-panel"
      class="rounded-md border border-transparent bg-muted"
      style={{ flex: 3, minHeight: 0 }}
      focusWithinStyle={{ borderColor: colors.border }}
    >
      <Input
        variant="ghost"
        // 原文编辑区与工具栏共用外层焦点边框。
        focusWithinStyle={{ borderColor: 'transparent', outlineWidth: 0 }}
        ref={(node) => {
          input = node;
          props.inputRef(node);
        }}
        value={props.value}
        onChange={({ value }) => props.onChange(value)}
        readonly={props.readonly}
        maxLength={50_000}
        testID="translation-source-input"
        accessibilityLabel="原文"
        multiline
        placeholder="输入要翻译的文本…"
        autoFocus
        style={{ flex: 1, minHeight: 0 }}
      />
      <View class="mx-1 mb-1 shrink-0 flex-row items-center gap-1">
        <IconButton size="sm" accessibilityLabel="朗读原文" disabled>
          <Icon icon={Volume2} {...iconButtonGlyph({ size: 'sm' })} />
        </IconButton>
        <IconButton
          size="sm"
          accessibilityLabel="复制原文"
          hoverStyle={sourceToolHoverStyle()}
          disabled={!hasText()}
          onPress={copySource}
        >
          <Icon icon={Copy} {...iconButtonGlyph({ size: 'sm' })} />
        </IconButton>
        <View class="flex-1">
          <If when={copyFailed()}>
            <Text role="alert" class="text-xs text-destructive">
              复制原文失败
            </Text>
          </If>
        </View>
        <IconButton
          size="sm"
          accessibilityLabel="清空原文"
          hoverStyle={sourceToolHoverStyle()}
          disabled={props.readonly || !hasText()}
          onPress={clearSource}
        >
          <Icon icon={Eraser} {...iconButtonGlyph({ size: 'sm' })} />
        </IconButton>
      </View>
    </View>
  );
}
