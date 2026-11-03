import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AlertDescription } from "@renderer/components/ui/alert";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { Input } from "@renderer/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@renderer/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { Switch } from "@renderer/components/ui/switch";
import { Textarea } from "@renderer/components/ui/textarea";
import { ALERT_ICON } from "@renderer/lib/icons";
import type {
  ConfigField,
  ConfigSchema,
  PluginDescriptor,
  Profile,
} from "@shared/ipc";
import { cn } from "cn";

import { ModelPicker, NEW_PROFILE_ID } from "./model-picker";
import {
  type FilterState,
  draftLabel,
  ensureDraftVisible,
  mergeSecretRetry,
  requiredSecretNames,
} from "./provider-editor";

const PLUGIN_ID = "vadu.ai";

type DefaultValue = string | number | boolean | Record<string, unknown>;

type EditorState = {
  name: string;
  pluginId: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  jsonText: Record<string, string>;
};

const EMPTY_EDITOR: EditorState = {
  config: {},
  jsonText: {},
  name: "",
  pluginId: "",
  secrets: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultFor(field: ConfigField): DefaultValue | undefined {
  switch (field.type) {
    case "string":
      return typeof field.default === "string" ? field.default : "";
    case "number":
      return typeof field.default === "number" ? field.default : undefined;
    case "boolean":
      return typeof field.default === "boolean" ? field.default : undefined;
    case "json":
      return isRecord(field.default) ? field.default : undefined;
    default:
      return undefined;
  }
}

function jsonDefault(field: ConfigField): string {
  const fallback =
    field.type === "json" && isRecord(field.default) ? field.default : null;
  return fallback ? JSON.stringify(fallback, null, 2) : "";
}

function editorFromProfile(
  profile: Profile | null,
  plugin: PluginDescriptor | null
): EditorState {
  const schema = plugin?.configSchema;
  const config: Record<string, unknown> = {};
  const jsonText: Record<string, string> = {};
  for (const [key, field] of Object.entries(schema?.properties ?? {})) {
    if (field.type === "secret") {
      continue;
    }
    if (field.type === "json") {
      const saved = profile?.config[key];
      jsonText[key] = isRecord(saved)
        ? JSON.stringify(saved, null, 2)
        : jsonDefault(field);
      continue;
    }
    const saved = profile?.config[key];
    if (saved === undefined) {
      const fallback = defaultFor(field);
      if (fallback !== undefined) {
        config[key] = fallback;
      }
    } else {
      config[key] = saved;
    }
  }
  return {
    config,
    jsonText,
    name: profile?.name ?? "",
    pluginId: plugin?.id ?? "",
    secrets: {},
  };
}

function secretFieldNames(schema: ConfigSchema | undefined): string[] {
  return Object.entries(schema?.properties ?? {})
    .filter(([, field]) => field.type === "secret")
    .map(([key]) => key);
}

function isDirty(editor: EditorState, baseline: EditorState): boolean {
  if (editor.name !== baseline.name) {
    return true;
  }
  const keys = new Set([
    ...Object.keys(baseline.config),
    ...Object.keys(editor.config),
    ...Object.keys(baseline.jsonText),
    ...Object.keys(editor.jsonText),
  ]);
  for (const key of keys) {
    if (editor.config[key] !== baseline.config[key]) {
      return true;
    }
    if (editor.jsonText[key] !== baseline.jsonText[key]) {
      return true;
    }
  }
  return Object.values(editor.secrets).some((value) => value !== "");
}

function buildConfigPayload(
  editor: EditorState,
  schema: ConfigSchema | undefined
): { config: Record<string, unknown>; error?: string } {
  const config: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema?.properties ?? {})) {
    if (field.type === "secret") {
      continue;
    }
    if (field.type === "json") {
      const text = editor.jsonText[key] ?? "";
      if (text.trim() === "") {
        continue;
      }
      try {
        config[key] = JSON.parse(text) as unknown;
      } catch {
        return { config, error: `${field.title ?? key} 不是合法 JSON` };
      }
      continue;
    }
    const value = editor.config[key];
    if (
      value === undefined ||
      (typeof value === "number" && Number.isNaN(value))
    ) {
      continue;
    }
    config[key] = value;
  }
  return { config };
}

async function saveProfileWithSecrets(
  payload: Profile,
  secrets: Record<string, string>
): Promise<{ error?: string; profile?: Profile }> {
  let saved: Awaited<ReturnType<typeof window.vadu.config.saveProfile>>;
  try {
    saved = await window.vadu.config.saveProfile(payload);
  } catch (reason) {
    return { error: String(reason) };
  }
  if (!saved.ok) {
    return { error: saved.error.message };
  }
  const pending = Object.entries(secrets).filter(([, value]) => value !== "");
  if (pending.length === 0) {
    return { profile: saved.data };
  }
  try {
    const outcomes = await Promise.all(
      pending.map(async ([name, value]) => {
        const result = await window.vadu.secrets.set(
          saved.data.id,
          name,
          value
        );
        return {
          error: result.ok ? undefined : result.error.message,
          name,
          ok: result.ok,
        };
      })
    );
    const failed = outcomes.find((entry) => !entry.ok);
    if (failed) {
      return { error: failed.error, profile: saved.data };
    }
  } catch (reason) {
    return { error: String(reason), profile: saved.data };
  }
  return { profile: saved.data };
}

type RowProps = {
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
  profile: Profile;
  saving: boolean;
  selected: boolean;
  subtitle?: string;
};

function ProviderRow({
  onSelect,
  onToggle,
  profile,
  saving,
  selected,
  subtitle,
}: RowProps): ReactNode {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors motion-reduce:transition-none",
        selected
          ? "border-border bg-muted"
          : "border-transparent hover:bg-muted"
      )}
    >
      <Button
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 px-0 text-left"
        onClick={onSelect}
        size="xs"
        variant="ghost"
      >
        <span className="w-full truncate font-normal text-[0.6875rem] text-muted-foreground">
          {profile.name}
        </span>
        {subtitle ? (
          <span className="w-full truncate text-[0.6875rem] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </Button>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[0.6875rem]",
          profile.enabled
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {profile.enabled ? "已启用" : "未启用"}
      </span>
      <Switch
        aria-label={`启用 ${profile.name}`}
        checked={profile.enabled}
        disabled={saving}
        onCheckedChange={onToggle}
        size="sm"
      />
    </div>
  );
}

type DraftRowProps = {
  name: string;
  onSelect: () => void;
  selected: boolean;
};

function DraftRow({ name, onSelect, selected }: DraftRowProps): ReactNode {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors motion-reduce:transition-none",
        selected
          ? "border-border bg-muted"
          : "border-transparent hover:bg-muted"
      )}
    >
      <Button
        aria-current={selected ? "true" : undefined}
        className="flex-1 justify-start px-0 text-left"
        onClick={onSelect}
        size="xs"
        variant="ghost"
      >
        <span className="truncate">{name}</span>
      </Button>
      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
        草稿
      </span>
    </div>
  );
}

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
            onChange(raw === "" ? "" : Number(raw));
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
        <div className="flex flex-col gap-1.5">
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
          <span className="text-muted-foreground text-xs">
            密钥加密后落盘，不会写入配置、日志或界面；提交后清空输入框。
          </span>
        </div>
      );
    case "json":
      return (
        <Textarea
          className="h-24 font-mono"
          disabled={disabled}
          id={controlId}
          onChange={(event) => onSecretChange(event.target.value)}
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
    <div className="flex flex-col gap-1.5">
      <label className="font-medium text-sm" htmlFor={controlId}>
        {field.title}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </label>
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
        <p className="text-muted-foreground text-xs">{field.description}</p>
      ) : null}
    </div>
  );
}

type LeftPanelProps = {
  addDisabled: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  draftName: string | null;
  filter: FilterState;
  filtered: Profile[];
  hasPlugins: boolean;
  onAdd: () => void;
  onFilterChange: (filter: FilterState) => void;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onSelectDraft: () => void;
  onToggleEnabled: (profile: Profile, enabled: boolean) => void;
  profiles: Profile[];
  query: string;
  resolvePluginName: (profile: Profile) => string | undefined;
  saving: boolean;
  selectedId: string | null;
};

function LeftPanel({
  addDisabled,
  draftName,
  listRef,
  filter,
  filtered,
  hasPlugins,
  onAdd,
  onFilterChange,
  onQueryChange,
  onSelect,
  onSelectDraft,
  onToggleEnabled,
  profiles: allProfiles,
  query,
  resolvePluginName,
  saving,
  selectedId,
}: LeftPanelProps): ReactNode {
  return (
    <aside className="flex min-h-0 flex-col gap-3 md:sticky md:top-0 md:self-stretch">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-sm">服务商</h2>
        <span className="text-muted-foreground text-xs">
          {allProfiles.length}
        </span>
      </div>
      <div className="relative">
        <Input
          aria-label="搜索服务商"
          className="pr-8"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索服务商"
          value={query}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="按启用状态过滤"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                size="icon-xs"
                title="按启用状态过滤"
                variant="ghost"
              />
            }
          >
            <span
              aria-hidden="true"
              className={cn(
                "icon-[lucide--filter] size-3.5",
                filter === "all" ? "text-muted-foreground" : "text-primary"
              )}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              onValueChange={(value) => onFilterChange(value as FilterState)}
              value={filter}
            >
              <DropdownMenuLabel>按启用状态过滤</DropdownMenuLabel>
              {(
                [
                  ["all", "全部"],
                  ["enabled", "已启用"],
                  ["disabled", "未启用"],
                ] as [FilterState, string][]
              ).map(([value, label]) => (
                <DropdownMenuRadioItem
                  className="text-nowrap"
                  key={value}
                  value={value}
                >
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        className="-mx-1 flex flex-1 flex-col gap-1 overflow-y-auto px-1"
        ref={listRef}
      >
        {draftName ? (
          <DraftRow
            name={draftName}
            onSelect={onSelectDraft}
            selected={selectedId === NEW_PROFILE_ID}
          />
        ) : null}
        {hasPlugins ? null : (
          <p className="text-muted-foreground text-sm">
            没有可用的翻译插件，请检查应用安装状态。
          </p>
        )}
        {hasPlugins
          ? filtered.map((profile) => (
              <ProviderRow
                key={profile.id}
                onSelect={() => onSelect(profile.id)}
                onToggle={(enabled) => onToggleEnabled(profile, enabled)}
                profile={profile}
                saving={saving}
                selected={selectedId === profile.id}
                subtitle={resolvePluginName(profile)}
              />
            ))
          : null}
        {hasPlugins && !draftName && filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">没有匹配的服务商。</p>
        ) : null}
      </div>
      <Button
        className="w-full"
        disabled={addDisabled || saving}
        onClick={onAdd}
        variant="outline"
      >
        新增自定义 OpenAI
      </Button>
    </aside>
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
      <div className="flex flex-col gap-1.5">
        <label className="font-medium text-sm" htmlFor="profile-name">
          名称
        </label>
        <Input
          disabled={saving}
          id="profile-name"
          onChange={(event) => onPatch({ name: event.target.value })}
          value={editor.name}
        />
      </div>
      {Object.entries(schema?.properties ?? {}).map(([key, field]) => (
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
      {plugin?.capabilities.models ? (
        <ModelPicker
          config={editor.config}
          disabled={saving}
          hasSavedKey={hasSavedKey}
          model={String(editor.config.model ?? "")}
          onModelChange={(model) =>
            onPatch({ config: { ...editor.config, model } })
          }
          pluginId={plugin.id}
          profileId={selectedId ?? ""}
        />
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
      <div className="flex items-center gap-2">
        <Button disabled={saving || editor.name.trim() === ""} type="submit">
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </form>
  );
}

async function loadSecretHas(
  profileId: string,
  secretNames: string[],
  seqRef: { current: number },
  setSecretHas: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, boolean>>>
  >
): Promise<void> {
  seqRef.current += 1;
  const seq = seqRef.current;
  const entries = await Promise.all(
    secretNames.map(async (name) => {
      try {
        const result = await window.vadu.secrets.has(profileId, name);
        return [name, result.ok ? result.data : false] as const;
      } catch {
        return [name, false] as const;
      }
    })
  );
  if (seq !== seqRef.current) {
    return;
  }
  setSecretHas((current) => ({
    ...current,
    [profileId]: Object.fromEntries(entries),
  }));
}

async function bootProviders(
  aliveRef: { current: boolean },
  dispatch: {
    setError: (message: string) => void;
    setSecretAvailable: (available: boolean) => void;
    setPlugins: (plugins: PluginDescriptor[]) => void;
    setProfiles: (profiles: Profile[]) => void;
    setSelectedId: (id: string) => void;
    setBaseline: (editor: EditorState) => void;
    setEditor: (editor: EditorState) => void;
    setReady: (ready: boolean) => void;
    setSecretHas: React.Dispatch<
      React.SetStateAction<Record<string, Record<string, boolean>>>
    >;
  },
  seqRef: { current: number }
): Promise<void> {
  try {
    const [pluginsResult, storageResult] = await Promise.all([
      window.vadu.plugins.list(),
      window.vadu.app.getSecretStorage(),
    ]);
    if (!aliveRef.current) {
      return;
    }
    if (storageResult.ok) {
      dispatch.setSecretAvailable(storageResult.data.available);
    } else {
      dispatch.setError(
        storageResult.error.message ?? storageResult.error.code
      );
    }
    if (!pluginsResult.ok) {
      dispatch.setError(
        pluginsResult.error.message ?? pluginsResult.error.code
      );
      return;
    }
    const translators = pluginsResult.data.filter(
      (entry) => entry.kind === "translator"
    );
    dispatch.setPlugins(translators);
    const profilesResult = await window.vadu.config.listProfiles();
    if (!aliveRef.current) {
      return;
    }
    if (!profilesResult.ok) {
      dispatch.setError(
        profilesResult.error.message ?? profilesResult.error.code
      );
      return;
    }
    const latest = profilesResult.data.at(-1);
    dispatch.setProfiles(profilesResult.data);
    if (!latest) {
      return;
    }
    const latestPlugin =
      translators.find((entry) => entry.id === latest.pluginId) ?? null;
    const next = editorFromProfile(latest, latestPlugin);
    dispatch.setSelectedId(latest.id);
    dispatch.setBaseline(next);
    dispatch.setEditor(next);
    await loadSecretHas(
      latest.id,
      secretFieldNames(latestPlugin?.configSchema),
      seqRef,
      dispatch.setSecretHas
    );
  } catch (reason) {
    if (aliveRef.current) {
      dispatch.setError(String(reason));
    }
  } finally {
    // 初始化无论成败都结束：成功后放开新增入口，失败由错误条显式反馈
    dispatch.setReady(true);
  }
}

function buildSavePayload(
  editor: EditorState,
  existing: Profile | null,
  config: Record<string, unknown>
): Profile {
  return {
    allowedOrigins: [],
    config,
    createdAt: existing?.createdAt ?? Date.now(),
    enabled: existing?.enabled ?? true,
    id: existing?.id ?? "",
    name: editor.name.trim(),
    pluginId: editor.pluginId,
  };
}

type SaveApi = {
  existing: Profile | null;
  plugin: PluginDescriptor | null;
  readPlugins: () => PluginDescriptor[];
  setBaseline: (editor: EditorState) => void;
  setEditor: (editor: EditorState) => void;
  setError: (message: string) => void;
  setInfo: (message: string) => void;
  setProfiles: (profiles: Profile[]) => void;
  setSelectedId: (id: string) => void;
  setSaving: (saving: boolean) => void;
  setSecretHas: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, boolean>>>
  >;
  seqRef: { current: number };
};

async function performSave(editor: EditorState, api: SaveApi): Promise<void> {
  const built = buildConfigPayload(editor, api.plugin?.configSchema);
  if (built.error) {
    api.setError(built.error);
    return;
  }
  const payload = buildSavePayload(editor, api.existing, built.config);
  api.setSaving(true);
  api.setError("");
  api.setInfo("");
  try {
    const outcome = await saveProfileWithSecrets(payload, editor.secrets);
    if (outcome.profile) {
      const savedPlugin =
        api
          .readPlugins()
          .find((entry) => entry.id === outcome.profile?.pluginId) ?? null;
      const savedEditor = editorFromProfile(outcome.profile, savedPlugin);
      const next = outcome.error
        ? mergeSecretRetry(editor, savedEditor)
        : savedEditor;
      api.setBaseline(next);
      api.setEditor(next);
      api.setSelectedId(outcome.profile.id);
      loadSecretHas(
        outcome.profile.id,
        secretFieldNames(savedPlugin?.configSchema),
        api.seqRef,
        api.setSecretHas
      ).catch(() => undefined);
    }
    const listResult = await window.vadu.config.listProfiles();
    if (listResult.ok) {
      api.setProfiles(listResult.data);
    }
    if (outcome.error) {
      api.setError(outcome.error);
    } else {
      api.setInfo("已保存");
    }
  } catch (reason) {
    api.setError(String(reason));
  } finally {
    api.setSaving(false);
  }
}

function ProvidersPage(): ReactNode {
  const [plugins, setPlugins] = useState<PluginDescriptor[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [baseline, setBaseline] = useState<EditorState>(EMPTY_EDITOR);
  const [secretHas, setSecretHas] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterState>("all");
  const [secretAvailable, setSecretAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const secretHasSeqRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const profilesRef = useRef<Profile[]>([]);
  const pluginsRef = useRef<PluginDescriptor[]>([]);
  profilesRef.current = profiles;
  pluginsRef.current = plugins;

  useEffect(() => {
    if (selectedId === NEW_PROFILE_ID) {
      listRef.current?.scrollTo({ top: 0 });
    }
  }, [selectedId]);

  useEffect(() => {
    const aliveRef = { current: true };
    bootProviders(
      aliveRef,
      {
        setBaseline,
        setEditor,
        setError,
        setPlugins,
        setProfiles,
        setReady,
        setSecretAvailable,
        setSecretHas,
        setSelectedId,
      },
      secretHasSeqRef
    );
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const vaduAi = plugins.find((entry) => entry.id === PLUGIN_ID) ?? null;

  const startNew = (): void => {
    const cleared = ensureDraftVisible();
    setQuery(cleared.query);
    setFilter(cleared.filter);
    requestSelection(NEW_PROFILE_ID);
  };

  const switchTo = (id: string): void => {
    if (saving || id === selectedId) {
      return;
    }
    const profile =
      id === NEW_PROFILE_ID
        ? null
        : (profilesRef.current.find((entry) => entry.id === id) ?? null);
    if (!profile && id !== NEW_PROFILE_ID) {
      return;
    }
    const plugin = profile
      ? (pluginsRef.current.find((entry) => entry.id === profile.pluginId) ??
        null)
      : vaduAi;
    const next = editorFromProfile(profile, plugin);
    setSelectedId(id);
    setBaseline(next);
    setEditor(next);
    setError(null);
    setInfo(null);
    setPending(null);
    if (profile && plugin) {
      loadSecretHas(
        profile.id,
        secretFieldNames(plugin.configSchema),
        secretHasSeqRef,
        setSecretHas
      ).catch(() => undefined);
    }
  };

  const requestSelection = (id: string): void => {
    if (saving || id === selectedId) {
      return;
    }
    if (editor && isDirty(editor, baseline)) {
      setPending(id);
      return;
    }
    switchTo(id);
  };

  const confirmDiscard = (): void => {
    if (pending === null) {
      return;
    }
    const id = pending;
    setPending(null);
    switchTo(id);
  };

  const cancelDiscard = (): void => {
    setPending(null);
  };

  const updateEditor = (patch: Partial<EditorState>): void => {
    setEditor((current) => (current ? { ...current, ...patch } : current));
  };

  const toggleEnabled = async (
    profile: Profile,
    enabled: boolean
  ): Promise<void> => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await window.vadu.config.saveProfile({
        ...profile,
        enabled,
      });
      if (result.ok) {
        setProfiles((current) =>
          current.map((entry) =>
            entry.id === result.data.id ? result.data : entry
          )
        );
      } else {
        setError(result.error.message);
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const onSave = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault();
    if (!editor || saving) {
      return;
    }
    const existing =
      selectedId === NEW_PROFILE_ID
        ? null
        : (profilesRef.current.find((entry) => entry.id === selectedId) ??
          null);
    await performSave(editor, {
      existing,
      plugin:
        pluginsRef.current.find((entry) => entry.id === editor.pluginId) ??
        null,
      readPlugins: () => pluginsRef.current,
      seqRef: secretHasSeqRef,
      setBaseline,
      setEditor,
      setError,
      setInfo,
      setProfiles,
      setSaving,
      setSecretHas,
      setSelectedId,
    });
  };

  const displayProfiles = useMemo(() => [...profiles].reverse(), [profiles]);

  const resolvePluginName = (profile: Profile): string | undefined => {
    if (plugins.length <= 1) {
      return undefined;
    }
    return plugins.find((entry) => entry.id === profile.pluginId)?.name;
  };

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pluginNames = new Map(plugins.map((entry) => [entry.id, entry.name]));
    return displayProfiles.filter((profile) => {
      if (filter === "enabled" && !profile.enabled) {
        return false;
      }
      if (filter === "disabled" && profile.enabled) {
        return false;
      }
      if (q === "") {
        return true;
      }
      const pluginName =
        plugins.length > 1 ? (pluginNames.get(profile.pluginId) ?? "") : "";
      const haystack =
        `${profile.name} ${pluginName} ${String(profile.config.baseURL ?? "")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [displayProfiles, filter, plugins, query]);

  const selectedProfile =
    selectedId === null || selectedId === NEW_PROFILE_ID
      ? null
      : (profiles.find((entry) => entry.id === selectedId) ?? null);
  const selectedPlugin = selectedProfile
    ? (plugins.find((entry) => entry.id === selectedProfile.pluginId) ?? null)
    : vaduAi;
  const schema = selectedPlugin?.configSchema;
  // 门控只看 schema 声明的必填 secret；无必填密钥的插件不受限制
  const hasSavedKey = requiredSecretNames(schema).every(
    (name) => selectedId !== null && secretHas[selectedId]?.[name] === true
  );
  const isNew = selectedId === NEW_PROFILE_ID;
  const dirty = editor !== null && isDirty(editor, baseline);

  return (
    <div className="grid min-h-0 grid-cols-1 items-start gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <LeftPanel
        addDisabled={!ready || vaduAi === null}
        draftName={isNew && editor ? draftLabel(editor.name) : null}
        filter={filter}
        filtered={filteredProfiles}
        hasPlugins={plugins.length > 0}
        listRef={listRef}
        onAdd={startNew}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        onSelect={requestSelection}
        onSelectDraft={startNew}
        onToggleEnabled={toggleEnabled}
        profiles={profiles}
        query={query}
        resolvePluginName={resolvePluginName}
        saving={saving}
        selectedId={selectedId}
      />
      <section className="min-w-0">
        {editor === null ? (
          <p className="text-muted-foreground text-sm">
            从左侧选择服务商进行配置，或点击「新增自定义 OpenAI」。
          </p>
        ) : (
          <EditorForm
            dirty={dirty}
            editor={editor}
            error={error}
            hasSavedKey={hasSavedKey}
            info={info}
            isNew={isNew}
            onCancelDiscard={cancelDiscard}
            onConfirmDiscard={confirmDiscard}
            onPatch={updateEditor}
            onSave={onSave}
            pending={pending !== null}
            plugin={selectedPlugin}
            saving={saving}
            schema={schema}
            secretAvailable={secretAvailable}
            secretHas={secretHas[selectedId ?? ""] ?? {}}
            selectedId={selectedId}
            showPluginName={plugins.length > 1}
          />
        )}
      </section>
    </div>
  );
}

export { ProvidersPage };
