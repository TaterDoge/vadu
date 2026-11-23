import { Clipboard, type InputRef, signal, Text, View } from 'nsh';
import { Input } from 'nsh/base';

import { IconButton } from '../../../components/IconButton';
import { lucideCopy, lucideEraser, lucideVolume2 } from '../../../icons';

export function TranslateInput(props: {
  inputRef: (node: InputRef) => void;
  value: string;
  readonly: boolean;
  onChange: (value: string) => void;
}) {
  let input: InputRef | undefined;
  const copyFailed = signal(false);
  const hasText = () => props.value.trim().length > 0;
  const toolClass = () => (hasText() ? 'hover:bg-foreground/5' : 'opacity-40');

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
      class="min-h-0 overflow-hidden rounded-xl bg-muted p-1"
      style={{ flex: 3 }}
    >
      <Input
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
        style={{ caretColor: 'blue' }}
        class="min-h-0 flex-1 bg-transparent px-1 py-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground"
      />
      <View class="h-6 shrink-0 flex-row items-center gap-1">
        <IconButton label="朗读原文" icon={lucideVolume2} class={toolClass()} />
        <IconButton
          label="复制原文"
          icon={lucideCopy}
          class={toolClass()}
          disabled={!hasText()}
          onPress={copySource}
        />
        <View class="flex-1">
          <If when={copyFailed()}>
            <Text role="alert" class="text-xs text-destructive">
              复制原文失败
            </Text>
          </If>
        </View>
        <IconButton
          label="清空原文"
          icon={lucideEraser}
          class={props.readonly ? 'opacity-40' : toolClass()}
          disabled={props.readonly || !hasText()}
          onPress={clearSource}
        />
      </View>
    </View>
  );
}
