import { signal, Text, token, View } from 'nsh';
import { Editor, Input } from 'nsh/base';

import { buttonFrameClass } from '../../../../components/ui/buttonStyles';
import { Icon } from '../../../../components/ui/Icon';
import { inputFrameClass } from '../../../../components/ui/inputStyles';
import type { ProviderProfile } from '../../../../feature/settings/providers/config';
import { lucideChevronDown, lucideChevronRight } from '../../../../icons';
import { hintClass, inputClass, providerHeadingClass } from './providerStyles';

type AdvancedFields = Pick<
  ProviderProfile,
  'temperature' | 'providerOptions' | 'headers'
>;
const editorClass = `${inputFrameClass} h-24 min-w-0 rounded-lg bg-background`;

export function ProviderAdvancedFields(props: {
  value: AdvancedFields;
  busy: boolean;
  onChange: (patch: Partial<AdvancedFields>) => void;
}) {
  const advancedOpen = signal(false);
  return (
    <>
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
              readonly={props.busy}
              value={props.value.temperature}
              onChange={({ value }) => props.onChange({ temperature: value })}
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
              placeholder={'{\n  "enable_thinking": false\n}'}
              readOnly={props.busy}
              value={props.value.providerOptions}
              onChange={({ value }) =>
                props.onChange({ providerOptions: value })
              }
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
              placeholder={'{\n  "X-Client": "vadu"\n}'}
              readOnly={props.busy}
              value={props.value.headers}
              onChange={({ value }) => props.onChange({ headers: value })}
              class={editorClass}
            />
            <Text class={hintClass}>
              在 JSON 对象中填写请求头，值用字符串。请勿填写密钥或令牌。
            </Text>
          </View>
        </View>
      </If>
    </>
  );
}
