import type { FormEvent, ReactNode } from "react";
import { AlertDialog } from "@animate-ui/react/primitives/base-ui/alert-dialog";
import { Alert, AlertDescription } from "@renderer/components/ui/alert";
import { Button } from "@renderer/components/ui/button";
import {
  Panel as CollapsiblePanel,
  Root as CollapsibleRoot,
  Trigger as CollapsibleTrigger,
} from "@renderer/components/ui/collapsible";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@renderer/components/ui/field";
import { Input } from "@renderer/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@renderer/components/ui/item";
import { JsonInput } from "@renderer/components/ui/json-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { Switch } from "@renderer/components/ui/switch";
import { ALERT_ICON } from "@renderer/lib/icons";
import type { ConfigField, ConfigSchema, PluginDescriptor } from "@shared/ipc";

import { ModelPicker } from "../model-picker";
import { type EditorState, mergeJsonFields } from "../provider-editor";

type FieldProps = {
  controlId: string;
  disabled: boolean;
  field: ConfigField;
  jsonText: string;
  onSecretChange: (value: string) => void;
  onChange: (value: unknown) => void;
  saved: boolean;
  secretValue: string;
  value: unknown;
};

function FieldControl({
  controlId,
  disabled,
  field,
  jsonText,
  onSecretChange,
  onChange,
  saved,
  secretValue,
  value,
}: FieldProps): ReactNode {
  switch (field.type) {
    case "string":
      if (field.enum) {
        return (
          <Select
            disabled={disabled}
            onValueChange={(next) => {
              if (next !== null) {
                onChange(next);
              }
            }}
            value={String(value ?? "")}
          >
            <SelectTrigger className="w-full" id={controlId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.enum.map((option, index) => (
                <SelectItem key={option} value={option}>
                  {field.enumLabels?.[index] ?? option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      return (
        <Input
          disabled={disabled}
          id={controlId}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          value={String(value ?? "")}
        />
      );
    case "number":
      return (
        <Input
          disabled={disabled}
          id={controlId}
          inputMode="decimal"
          max={field.maximum}
          min={field.minimum}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw === "" ? undefined : Number(raw));
          }}
          step={field.step}
          type="number"
          value={typeof value === "number" && !Number.isNaN(value) ? value : ""}
        />
      );
    case "boolean":
      return (
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>{field.title}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch
              aria-label={field.title}
              checked={value === true}
              disabled={disabled}
              onCheckedChange={onChange}
            />
          </ItemActions>
        </Item>
      );
    case "secret":
      return (
        <>
          <Input
            disabled={disabled}
            id={controlId}
            onChange={(event) => onSecretChange(event.target.value)}
            placeholder={
              saved ? "已设置（留空则不修改）" : (field.placeholder ?? "未设置")
            }
            type="password"
            value={secretValue}
          />
          <FieldDescription className="text-xs">
            密钥加密后落盘，不会写入配置、日志或界面；提交后清空输入框。
          </FieldDescription>
        </>
      );
    case "json":
      return (
        <JsonInput
          disabled={disabled}
          height={96}
          onChange={onSecretChange}
          value={jsonText}
        />
      );
    default:
      return null;
  }
}

type FieldRowProps = {
  disabled: boolean;
  editor: EditorState;
  field: ConfigField;
  keyName: string;
  onPatch: (patch: Partial<EditorState>) => void;
  saved: boolean;
};

function FieldRow({
  disabled,
  editor,
  field,
  keyName,
  onPatch,
  saved,
}: FieldRowProps): ReactNode {
  if (field.type === "boolean") {
    return (
      <FieldControl
        controlId=""
        disabled={disabled}
        field={field}
        jsonText=""
        onChange={(value) =>
          onPatch({ config: { ...editor.config, [keyName]: value } })
        }
        onSecretChange={() => undefined}
        saved={saved}
        secretValue=""
        value={editor.config[keyName]}
      />
    );
  }
  const controlId = `field-${keyName}`;
  const handleSecretChange = (value: string): void => {
    if (field.type === "json") {
      onPatch({ jsonText: { ...editor.jsonText, [keyName]: value } });
    } else {
      onPatch({ secrets: { ...editor.secrets, [keyName]: value } });
    }
  };
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={controlId}>
        {field.title}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </FieldLabel>
      <FieldControl
        controlId={controlId}
        disabled={disabled}
        field={field}
        jsonText={field.type === "json" ? (editor.jsonText[keyName] ?? "") : ""}
        onChange={(value) =>
          onPatch({ config: { ...editor.config, [keyName]: value } })
        }
        onSecretChange={handleSecretChange}
        saved={saved}
        secretValue={
          field.type === "secret" ? (editor.secrets[keyName] ?? "") : ""
        }
        value={editor.config[keyName]}
      />
      {field.description ? (
        <FieldDescription className="text-xs">
          {field.description}
        </FieldDescription>
      ) : null}
    </Field>
  );
}

type EditorFormProps = {
  dirty: boolean;
  editor: EditorState;
  error: string | null;
  hasSavedKey: boolean;
  info: string | null;
  isNew: boolean;
  onCancelDiscard: () => void;
  onConfirmDiscard: () => void;
  onDelete: () => void;
  onPatch: (patch: Partial<EditorState>) => void;
  onSave: (event?: FormEvent) => void;
  pending: boolean;
  plugin: PluginDescriptor | null;
  saving: boolean;
  schema: ConfigSchema | undefined;
  secretAvailable: boolean;
  selectedId: string | null;
  secretHas: Record<string, boolean>;
  showPluginName: boolean;
};

function EditorForm({
  dirty,
  editor,
  error,
  hasSavedKey,
  info,
  isNew,
  onCancelDiscard,
  onConfirmDiscard,
  onDelete,
  onPatch,
  onSave,
  pending,
  plugin,
  saving,
  schema,
  secretAvailable,
  selectedId,
  secretHas,
  showPluginName,
}: EditorFormProps): ReactNode {
  const fieldEntries = Object.entries(schema?.properties ?? {});
  const basicFields = fieldEntries.filter(
    ([, field]) => field["x-advanced"] !== true
  );
  const advancedFields = fieldEntries.filter(
    ([, field]) => field["x-advanced"] === true
  );
  const deleteControls: ReactNode = isNew ? null : (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        render={
          <Button disabled={saving} type="button" variant="destructive" />
        }
      >
        删除
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/20 supports-backdrop-filter:backdrop-blur-xs" />
        <AlertDialog.Popup className="fixed inset-0 z-50 m-auto flex h-fit w-[calc(100%-2rem)] max-w-md flex-col gap-4 rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg outline-none">
          <div className="flex flex-col gap-2">
            <AlertDialog.Title className="font-heading font-medium text-base">
              删除服务商？
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground text-sm">
              删除后无法恢复，确定要删除「{editor.name}」吗？
            </AlertDialog.Description>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialog.Close
              render={<Button type="button" variant="outline" />}
            >
              取消
            </AlertDialog.Close>
            <AlertDialog.Close
              disabled={saving}
              onClick={onDelete}
              render={<Button type="button" variant="destructive" />}
            >
              确认删除
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
  return (
    <form className="flex flex-col gap-4" onSubmit={onSave}>
      {pending ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
          <span className="text-muted-foreground text-sm">有未保存的更改</span>
          <div className="flex gap-2">
            <Button onClick={onConfirmDiscard} size="sm" type="button">
              放弃并切换
            </Button>
            <Button
              onClick={onCancelDiscard}
              size="sm"
              type="button"
              variant="outline"
            >
              取消
            </Button>
          </div>
        </div>
      ) : null}
      {secretAvailable ? null : (
        <Alert>
          <span aria-hidden="true" className={ALERT_ICON} />
          <AlertDescription>
            当前系统无安全密钥环，API Key
            仅本次会话有效，重启后需重新填写（不会写入磁盘）。
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-sm">
          {isNew ? "新增自定义 OpenAI" : "编辑服务商"}
        </h3>
        {dirty ? (
          <span className="text-muted-foreground text-xs">未保存</span>
        ) : null}
      </div>
      {showPluginName && plugin ? (
        <p className="-mt-2 text-muted-foreground text-xs">{plugin.name}</p>
      ) : null}
      <Field className="gap-1.5">
        <FieldLabel htmlFor="profile-name">名称</FieldLabel>
        <Input
          disabled={saving}
          id="profile-name"
          onChange={(event) => onPatch({ name: event.target.value })}
          value={editor.name}
        />
      </Field>
      {basicFields.map(([key, field]) => {
        if (
          key === "model" &&
          field.type === "string" &&
          !field.enum &&
          plugin?.capabilities.models
        ) {
          return (
            <ModelPicker
              config={mergeJsonFields(editor, schema)}
              description={field.description}
              disabled={saving}
              hasSavedKey={hasSavedKey}
              key={key}
              model={String(editor.config.model ?? "")}
              onModelChange={(model) =>
                onPatch({ config: { ...editor.config, model } })
              }
              placeholder={field.placeholder}
              pluginId={plugin.id}
              profileId={selectedId ?? ""}
              required={
                field.required === true || schema?.required?.includes(key)
              }
              title={field.title}
            />
          );
        }
        return (
          <FieldRow
            disabled={saving}
            editor={editor}
            field={field}
            key={key}
            keyName={key}
            onPatch={onPatch}
            saved={secretHas[key] === true}
          />
        );
      })}
      {advancedFields.length > 0 ? (
        <CollapsibleRoot className="flex flex-col gap-4">
          <CollapsibleTrigger className="group">
            <span
              aria-hidden="true"
              className="icon-[lucide--chevron-down] size-4 transition-transform group-data-panel-open:rotate-180 motion-reduce:transition-none"
            />
            <span>高级选项</span>
          </CollapsibleTrigger>
          <CollapsiblePanel>
            {advancedFields.map(([key, field]) => (
              <FieldRow
                disabled={saving}
                editor={editor}
                field={field}
                key={key}
                keyName={key}
                onPatch={onPatch}
                saved={secretHas[key] === true}
              />
            ))}
          </CollapsiblePanel>
        </CollapsibleRoot>
      ) : null}
      {error ? (
        <Alert className="grid-cols-[auto_1fr] gap-x-2" variant="destructive">
          <span aria-hidden="true" className={ALERT_ICON} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {info ? (
        <Alert className="grid-cols-[auto_1fr] gap-x-2">
          <span aria-hidden="true" className={ALERT_ICON} />
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button disabled={saving || editor.name.trim() === ""} type="submit">
          {saving ? "保存中…" : "保存"}
        </Button>
        {deleteControls}
      </div>
    </form>
  );
}

export { EditorForm };
