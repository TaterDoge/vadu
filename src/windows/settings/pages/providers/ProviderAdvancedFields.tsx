import { Text, View } from 'nsh';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Editor } from '@/components/ui/editor';
import { NumberInput } from '@/components/ui/number-input';

import type { ProviderProfile } from '../../../../feature/settings/providers/config';
import { hintClass, providerHeadingClass } from './providerStyles';

export type AdvancedFields = Pick<
  ProviderProfile,
  'providerOptions' | 'headers'
> & {
  temperature: number | null;
};
const editorClass = 'h-24 min-w-0';

export function ProviderAdvancedFields(props: {
  value: AdvancedFields;
  busy: boolean;
  onChange: (patch: Partial<AdvancedFields>) => void;
}) {
  return (
    <Collapsible>
      {/* 表单没有列表行的额外边距，触发器与输入框同宽才能完整显示焦点环。 */}
      <CollapsibleTrigger
        first
        accessibilityLabel="高级选项"
        style={{ marginHorizontal: 0 }}
      >
        高级选项
      </CollapsibleTrigger>
      <CollapsibleContent>
        <View class="gap-2.5">
          <View class="gap-1.5">
            <Text class={providerHeadingClass}>温度</Text>
            <NumberInput
              class="ml-0.5"
              accessibilityLabel="温度"
              step={0.1}
              readonly={props.busy}
              value={props.value.temperature}
              onChange={({ value }) => props.onChange({ temperature: value })}
              style={{ width: 144 }}
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
      </CollapsibleContent>
    </Collapsible>
  );
}
