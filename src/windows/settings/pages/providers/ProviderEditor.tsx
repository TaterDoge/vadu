import { Image, Text, token, View } from 'nsh';
import {
  Button,
  Command,
  Editor,
  Input,
  Popover,
  Select,
  Switch,
} from 'nsh/base';
import type { ProviderProfile } from 'vadu/native';

import { IconButton } from '../../../../components/IconButton';
import chevronDownIcon from '../../../translate/icons/chevron-down.svg';
import layersIcon from '../../../translate/icons/layers.svg';
import refreshIcon from '../shortcuts/reset.svg';
import eyeOffIcon from './eye-off.svg';
import eyeIcon from './eye.svg';

export type ProviderFields = Omit<ProviderProfile, 'id'>;

const protocols = [
  { value: 'chat-completions', title: 'Chat Completions (/chat/completions)' },
  { value: 'responses', title: 'Responses (/responses)' },
  { value: 'anthropic-messages', title: 'Anthropic Messages (/v1/messages)' },
] satisfies Array<{ value: ProviderFields['protocol']; title: string }>;

export const providerHeadingClass = 'text-sm font-semibold text-foreground';
export const providerButtonClass =
  'min-h-8 flex-row items-center justify-center rounded-lg border px-2.5 focus-visible:border-foreground';
export const providerOptionsClass =
  'min-h-8 justify-center rounded-md px-2.5 focus:bg-accent selected:bg-secondary';
const inputClass =
  'h-8 min-w-0 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-foreground';
const hintClass = 'text-xs leading-4 text-muted-foreground';
const editorClass =
  'h-24 min-w-0 rounded-lg border border-border bg-background focus-within:border-foreground';

export function ProviderEditor(props: {
  title: string;
  value: ProviderFields;
  error: string;
  busy: boolean;
  connectionReady: boolean;
  canFetchModels: boolean;
  keyInputSupported: boolean;
  apiKey: string;
  revealedKey: string;
  keyVisible: boolean;
  keyStatus: string;
  keyConfigured: boolean;
  models: string[];
  modelPickerOpen: boolean;
  onModelPickerOpenChange: (open: boolean) => void;
  onKeyChange: (value: string) => void;
  onToggleKey: () => void;
  onCheckModel: () => void;
  onFetchModels: (choose: boolean) => void;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  onChange: (patch: Partial<ProviderFields>) => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const modelsDisabled = () => !props.canFetchModels || props.busy;
  const checkDisabled = () =>
    !props.connectionReady ||
    props.busy ||
    props.value.protocol !== 'chat-completions' ||
    !props.value.model.trim();
  const actionClass = `${providerButtonClass} gap-1.5 border-border bg-background hover:bg-accent disabled:opacity-50`;

  return (
    <View class="gap-2.5">
      <Text role="header" class={providerHeadingClass}>
        {props.title}
      </Text>
      <If when={props.error !== ''}>
        <Text role="alert" class="text-xs text-destructive">
          {props.error}
        </Text>
      </If>
      <View class="gap-1.5">
        <Text class={providerHeadingClass}>名称</Text>
        <View class="flex-row items-center gap-2">
          <Input
            testID="provider-name"
            accessibilityLabel="名称（必填）"
            maxLength={100}
            readonly={props.busy}
            value={props.value.name}
            onChange={({ value }) => props.onChange({ name: value })}
            class={`${inputClass} flex-1`}
          />
          <Switch
            testID="provider-enabled"
            accessibilityLabel="启用服务商"
            disabled={props.busy}
            checked={props.value.enabled}
            onChange={({ checked }) => props.onChange({ enabled: checked })}
            class="h-8 shrink-0 justify-center rounded-lg border border-transparent px-1 focus-visible:border-foreground"
            trackClass="h-5 w-8 justify-center rounded-full bg-muted-foreground px-0.5 checked:bg-foreground"
            thumbClass="h-4 w-4 rounded-full bg-background checked:translate-x-3"
          />
        </View>
      </View>
      <View class="gap-1.5">
        <Text class={providerHeadingClass}>API 协议</Text>
        <Select
          testID="provider-protocol"
          accessibilityLabel="API 协议"
          items={protocols}
          value={props.value.protocol}
          onChange={({ value }) => {
            const protocol = protocols.find((item) => item.value === value);
            if (protocol) props.onChange({ protocol: protocol.value });
          }}
          cover={false}
          disabled={props.busy}
          popupClass="rounded-lg border border-border bg-popover p-1 text-popover-foreground"
          itemClass={providerOptionsClass}
          trigger={
            <View
              class={`${inputClass} flex-row items-center justify-between gap-2`}
            >
              <Text
                class="min-w-0 shrink text-sm text-foreground"
                style={{ numberOfLines: 1 }}
              >
                {
                  protocols.find(({ value }) => value === props.value.protocol)
                    ?.title
                }
              </Text>
              <Image
                src={chevronDownIcon}
                class="h-3 w-3 shrink-0"
                style={{ tintColor: token('muted-foreground') }}
                accessibilityElementsHidden
              />
            </View>
          }
        />
        <If when={props.value.protocol !== 'chat-completions'}>
          <Text class={hintClass}>该 API 协议尚未接入，可保存配置。</Text>
        </If>
      </View>
      <View class="gap-1.5">
        <Text class={providerHeadingClass}>
          接口地址（Base URL）<Text class="text-destructive"> *</Text>
        </Text>
        <Input
          testID="provider-base-url"
          accessibilityLabel="接口地址（Base URL，必填）"
          placeholder="https://api.openai.com/v1"
          maxLength={2000}
          readonly={props.busy}
          value={props.value.baseUrl}
          onChange={({ value }) => props.onChange({ baseUrl: value })}
          class={inputClass}
        />
        <Text class={hintClass}>填写含版本路径的接口根地址。</Text>
      </View>
      <View class="gap-1.5">
        <Text class={providerHeadingClass}>API Key</Text>
        <View class="h-8 min-w-0 flex-row items-center gap-1 rounded-lg border border-border bg-background pr-1 focus-within:border-foreground">
          <Input
            testID="provider-api-key"
            accessibilityLabel="API Key"
            placeholder="输入新密钥，随配置保存"
            masked={!props.keyVisible}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={2048}
            value={props.revealedKey || props.apiKey}
            readonly={props.revealedKey !== ''}
            onChange={({ value }) => props.onKeyChange(value)}
            disabled={!props.keyInputSupported || props.busy}
            class="h-full min-w-0 flex-1 pl-2.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <IconButton
            label={props.keyVisible ? '隐藏密钥' : '显示密钥'}
            icon={props.keyVisible ? eyeOffIcon : eyeIcon}
            disabled={
              !props.keyVisible &&
              (!props.keyInputSupported ||
                props.busy ||
                (!props.apiKey && !props.keyConfigured))
            }
            onPress={props.onToggleKey}
            class="shrink-0 disabled:opacity-50"
          />
        </View>
        <Text class={hintClass}>
          {props.keyInputSupported
            ? props.keyStatus || 'API Key 随服务商保存，留空保持已有 Key。'
            : '当前平台不支持服务商连接。'}
        </Text>
      </View>
      <View class="gap-1.5">
        <View class="flex-row items-center justify-between gap-2">
          <Text class={`${providerHeadingClass} shrink-0`}>模型</Text>
          <View class="min-w-0 flex-row flex-wrap justify-end gap-1.5">
            <Button
              accessibilityLabel="健康检测"
              disabled={checkDisabled()}
              onPress={props.onCheckModel}
              class={actionClass}
            >
              <Text class={providerHeadingClass}>健康检测</Text>
            </Button>
            <Popover
              open={props.modelPickerOpen}
              onOpenChange={({ open }) => props.onModelPickerOpenChange(open)}
              placement="top"
              align="end"
              offset={4}
              margin={8}
              popupClass="w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-md"
              trigger={
                <Button
                  testID="provider-model-list"
                  accessibilityLabel="选择模型"
                  disabled={modelsDisabled()}
                  class={actionClass}
                >
                  <Image
                    src={layersIcon}
                    class="size-4"
                    style={{ tintColor: token('foreground') }}
                    accessibilityElementsHidden
                  />
                  <Text class={providerHeadingClass}>选择模型</Text>
                </Button>
              }
            >
              <Command
                class="min-h-0 shrink"
                accessibilityLabel="模型列表"
                searchAccessibilityLabel="搜索模型"
                placeholder="搜索模型…"
                autoFocus
                loading={props.busy}
                items={props.models.map((id) => ({
                  id,
                  label: id,
                  checked: id === props.value.model,
                  disabled: props.busy,
                }))}
                searchBarClass="shrink-0 flex-row items-center gap-1.5 border-b border-border p-2"
                searchClass={inputClass + ' flex-1'}
                listClass="max-h-72 p-1"
                itemClass="min-h-9 justify-center rounded-md px-3 py-1.5 text-sm text-popover-foreground checked:bg-secondary focus:bg-accent"
                searchSuffix={
                  <Button
                    accessibilityLabel="刷新模型列表"
                    disabled={props.busy}
                    onPress={() => props.onFetchModels(true)}
                    class="size-8 shrink-0 items-center justify-center rounded-md border border-transparent hover:bg-accent focus-visible:border-foreground disabled:opacity-50"
                  >
                    <Image
                      src={refreshIcon}
                      class="size-4"
                      style={{ tintColor: token('foreground') }}
                      accessibilityElementsHidden
                    />
                  </Button>
                }
                empty={
                  <Text class="px-3 py-2 text-sm text-muted-foreground">
                    {props.models.length ? '没有匹配的模型' : '暂无模型'}
                  </Text>
                }
                footer={
                  <If when={props.busy && props.models.length === 0}>
                    <Text class="px-3 py-2 text-sm text-muted-foreground">
                      正在获取模型…
                    </Text>
                  </If>
                }
                onSelect={({ id }) => {
                  props.onChange({ model: id });
                  props.onModelPickerOpenChange(false);
                }}
              />
            </Popover>
          </View>
        </View>
        <Input
          testID="provider-model"
          accessibilityLabel="模型 ID"
          maxLength={300}
          readonly={props.busy}
          value={props.value.model}
          onChange={({ value }) => props.onChange({ model: value })}
          placeholder="输入模型 ID"
          class={inputClass}
        />
      </View>
      <View
        role="button"
        focusable
        accessibilityLabel="高级选项"
        accessibilityState={{ expanded: props.advancedOpen }}
        onPress={props.onToggleAdvanced}
        class="min-h-8 flex-row items-center gap-2 self-start rounded-lg border border-transparent px-1 hover:bg-accent focus-visible:border-foreground"
      >
        <Image
          src={chevronDownIcon}
          class="h-3 w-3"
          classList={{ '-rotate-90': !props.advancedOpen }}
          style={{ tintColor: token('muted-foreground') }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text class="text-sm font-medium text-foreground">高级选项</Text>
      </View>
      <If when={props.advancedOpen}>
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
              placeholder={'{"enable_thinking": false}'}
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
              placeholder={'{"X-Client": "vadu"}'}
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
      <View class="flex-row justify-between gap-2">
        <Button
          accessibilityLabel="保存"
          disabled={props.busy}
          onPress={props.onSave}
          class={
            providerButtonClass +
            ' border-transparent bg-foreground hover:opacity-90 focus-visible:border-background'
          }
        >
          <Text class="text-sm font-semibold text-background">保存</Text>
        </Button>
        <If when={props.onDelete !== undefined}>
          <Button
            accessibilityLabel="删除"
            disabled={props.busy}
            onPress={props.onDelete}
            class={
              providerButtonClass +
              ' border-transparent bg-destructive/10 hover:bg-destructive/20'
            }
          >
            <Text class="text-sm font-semibold text-destructive">删除</Text>
          </Button>
        </If>
      </View>
    </View>
  );
}
