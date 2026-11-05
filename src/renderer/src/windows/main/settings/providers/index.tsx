import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog } from "@animate-ui/react/primitives/base-ui/dialog";
import { Button } from "@renderer/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@renderer/components/ui/tabs";
import type { PluginDescriptor, PluginKind, Profile } from "@shared/ipc";

import { OcrForm, TranslatorForm, TtsForm } from "./components/providers-form";
import { LeftPanel } from "./components/providers-list";
import { KIND_ADD, KIND_LABEL, KIND_ORDER } from "./kinds";
import {
  EMPTY_EDITOR,
  type EditorState,
  type FilterState,
  buildConfigPayload,
  buildSavePayload,
  editorFromProfile,
  isDirty,
  mergeSecretRetry,
  secretFieldNames,
} from "./provider-editor";

type PendingSwitch = { kind: PluginKind } | { id: string } | { create: true };

/** 新增 dialog 的编辑态：baseline 用于判断关闭时是否需要确认 */
type Creating = { baseline: EditorState; editor: EditorState };

function kindOfPlugin(
  plugins: PluginDescriptor[],
  pluginId: string
): PluginKind | undefined {
  return plugins.find((entry) => entry.id === pluginId)?.kind;
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
    dispatch.setPlugins(pluginsResult.data);
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
    dispatch.setProfiles(profilesResult.data);
    const translatorIds = new Set(
      pluginsResult.data
        .filter((entry) => entry.kind === "translator")
        .map((entry) => entry.id)
    );
    // 默认只选翻译 kind 的最新 profile：末尾可能已经是语音/识别 profile
    const latest =
      profilesResult.data
        .filter((entry) => translatorIds.has(entry.pluginId))
        .at(-1) ?? null;
    if (!latest) {
      return;
    }
    const latestPlugin =
      pluginsResult.data.find((entry) => entry.id === latest.pluginId) ?? null;
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

type SaveApi = {
  existing: Profile | null;
  /** 保存成功后的额外收尾（新增 dialog 用它关闭自己） */
  onSaved?: () => void;
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
      api.onSaved?.();
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
  // 开关切换独立于保存：共用 saving 会让详情表单按钮闪成「保存中…」
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSwitch | null>(null);
  const [creating, setCreating] = useState<Creating | null>(null);
  // 关闭新增 dialog 时存在未保存内容，等用户确认丢弃
  const [closePending, setClosePending] = useState(false);
  const [kind, setKind] = useState<PluginKind>("translator");
  const [ready, setReady] = useState(false);
  const secretHasSeqRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const profilesRef = useRef<Profile[]>([]);
  const pluginsRef = useRef<PluginDescriptor[]>([]);
  profilesRef.current = profiles;
  pluginsRef.current = plugins;
  const creatingDirty =
    creating !== null && isDirty(creating.editor, creating.baseline);

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

  const firstPluginOfKind = (target: PluginKind): PluginDescriptor | null =>
    plugins.find((entry) => entry.kind === target) ?? null;

  const openCreate = (): void => {
    const next = editorFromProfile(null, firstPluginOfKind(kind));
    // 清空搜索/过滤，保存后新服务商一定能出现在列表里
    setQuery("");
    setFilter("all");
    setCreating({ baseline: next, editor: next });
    setClosePending(false);
    setError(null);
    setInfo(null);
    setPending(null);
  };

  const startNew = (): void => {
    // 面板里的未保存修改会被新增后的选中结果覆盖，先让用户确认
    if (editor && isDirty(editor, baseline)) {
      setPending({ create: true });
      return;
    }
    openCreate();
  };

  const switchTo = (id: string): void => {
    if (saving || id === selectedId) {
      return;
    }
    const profile =
      profilesRef.current.find((entry) => entry.id === id) ?? null;
    if (!profile) {
      return;
    }
    const plugin =
      pluginsRef.current.find((entry) => entry.id === profile.pluginId) ?? null;
    const next = editorFromProfile(profile, plugin);
    setSelectedId(id);
    setBaseline(next);
    setEditor(next);
    setError(null);
    setInfo(null);
    setPending(null);
    if (plugin) {
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
      setPending({ id });
      return;
    }
    switchTo(id);
  };

  const applyKindChange = (nextKind: PluginKind): void => {
    setError(null);
    setInfo(null);
    setPending(null);
    setKind(nextKind);
    const latest = profilesRef.current
      .filter(
        (entry) => kindOfPlugin(pluginsRef.current, entry.pluginId) === nextKind
      )
      .at(-1);
    if (!latest) {
      // 该 kind 没有 profile：空面板，新增走 dialog
      setSelectedId(null);
      setBaseline(EMPTY_EDITOR);
      setEditor(null);
      return;
    }
    switchTo(latest.id);
  };

  const requestKindChange = (nextKind: PluginKind): void => {
    if (saving || nextKind === kind) {
      return;
    }
    if (editor && isDirty(editor, baseline)) {
      setPending({ kind: nextKind });
      return;
    }
    applyKindChange(nextKind);
  };

  const confirmDiscard = (): void => {
    if (pending === null) {
      return;
    }
    const target = pending;
    setPending(null);
    if ("kind" in target) {
      applyKindChange(target.kind);
    } else if ("create" in target) {
      openCreate();
    } else {
      switchTo(target.id);
    }
  };

  const cancelDiscard = (): void => {
    setPending(null);
  };

  const closeCreate = (): void => {
    setCreating(null);
    setClosePending(false);
  };

  const requestCloseCreate = (): void => {
    if (saving) {
      return;
    }
    // 有未保存内容时先进确认态，不直接丢掉 dialog 里的输入
    if (creatingDirty) {
      setClosePending(true);
      return;
    }
    closeCreate();
  };

  const patchCreating = (patch: Partial<EditorState>): void => {
    setCreating((current) =>
      current
        ? { ...current, editor: { ...current.editor, ...patch } }
        : current
    );
  };

  const updateEditor = (patch: Partial<EditorState>): void => {
    setEditor((current) => (current ? { ...current, ...patch } : current));
  };

  const toggleEnabled = async (
    profile: Profile,
    enabled: boolean
  ): Promise<void> => {
    if (saving || togglingId !== null) {
      return;
    }
    setTogglingId(profile.id);
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
      setTogglingId(null);
    }
  };

  const onSave = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault();
    if (!(editor && !saving && selectedId !== null)) {
      return;
    }
    await performSave(editor, {
      existing:
        profilesRef.current.find((entry) => entry.id === selectedId) ?? null,
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

  const onCreateSave = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault();
    if (!(creating && !saving)) {
      return;
    }
    await performSave(creating.editor, {
      existing: null,
      onSaved: closeCreate,
      plugin:
        pluginsRef.current.find(
          (entry) => entry.id === creating.editor.pluginId
        ) ?? null,
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

  const onReorder = async (ordered: Profile[]): Promise<void> => {
    // 当前 kind 的新顺序只覆盖全量展示序中该 kind 的位置，跨 kind 相对位置保持不变
    const merged = displayProfiles.map((entry) => {
      if (kindOfPlugin(pluginsRef.current, entry.pluginId) !== kind) {
        return entry;
      }
      return ordered.shift() ?? entry;
    });
    // 展示序是存储序的反转，落盘必须再反转回去
    const orderedIds = [...merged].reverse().map((entry) => entry.id);
    setError(null);
    try {
      const result = await window.vadu.config.reorderProfiles(orderedIds);
      if (result.ok) {
        setProfiles(result.data);
      } else {
        setError(result.error.message ?? result.error.code);
      }
    } catch (reason) {
      setError(String(reason));
    }
  };

  const onDelete = async (): Promise<void> => {
    if (!editor || saving || selectedId === null) {
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const result = await window.vadu.config.deleteProfile(selectedId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const listResult = await window.vadu.config.listProfiles();
      if (!listResult.ok) {
        setError(listResult.error.message ?? listResult.error.code);
        return;
      }
      const next = listResult.data;
      setProfiles(next);
      setPending(null);
      setInfo("已删除");
      // 删除后回退限制在同一 kind；这里只能用刚拿到的新列表，refs 里的快照还是删前的
      const fallback =
        next
          .filter(
            (entry) => kindOfPlugin(pluginsRef.current, entry.pluginId) === kind
          )
          .at(-1) ?? null;
      if (fallback) {
        const fallbackPlugin =
          pluginsRef.current.find((entry) => entry.id === fallback.pluginId) ??
          null;
        const nextEditor = editorFromProfile(fallback, fallbackPlugin);
        setSelectedId(fallback.id);
        setBaseline(nextEditor);
        setEditor(nextEditor);
        loadSecretHas(
          fallback.id,
          secretFieldNames(fallbackPlugin?.configSchema),
          secretHasSeqRef,
          setSecretHas
        ).catch(() => undefined);
      } else {
        setSelectedId(null);
        setBaseline(EMPTY_EDITOR);
        setEditor(null);
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const visiblePlugins = useMemo(
    () => plugins.filter((entry) => entry.kind === kind),
    [kind, plugins]
  );

  const visibleProfiles = useMemo(
    () =>
      displayProfiles.filter(
        (entry) => kindOfPlugin(plugins, entry.pluginId) === kind
      ),
    [displayProfiles, kind, plugins]
  );

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pluginNames = new Map(
      visiblePlugins.map((entry) => [entry.id, entry.name])
    );
    return visibleProfiles.filter((profile) => {
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
        visiblePlugins.length > 1
          ? (pluginNames.get(profile.pluginId) ?? "")
          : "";
      const haystack =
        `${profile.name} ${pluginName} ${String(profile.config.baseURL ?? "")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, query, visiblePlugins, visibleProfiles]);

  const selectedProfile =
    selectedId === null
      ? null
      : (profiles.find((entry) => entry.id === selectedId) ?? null);
  const selectedPlugin = selectedProfile
    ? (plugins.find((entry) => entry.id === selectedProfile.pluginId) ?? null)
    : null;
  const creatingPlugin = creating
    ? (plugins.find((entry) => entry.id === creating.editor.pluginId) ?? null)
    : null;
  const schema = selectedPlugin?.configSchema;
  const dirty = editor !== null && isDirty(editor, baseline);

  const FORM_FOR_KIND: Record<PluginKind, typeof TranslatorForm> = {
    ocr: OcrForm,
    translator: TranslatorForm,
    tts: TtsForm,
  };
  const FormForKind = FORM_FOR_KIND[kind];

  return (
    <>
      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        onValueChange={(value) => {
          if (value !== null) {
            requestKindChange(value as PluginKind);
          }
        }}
        value={kind}
      >
        <TabsList className="self-start">
          {KIND_ORDER.map((entry) => (
            <TabsTrigger key={entry} value={entry}>
              {KIND_LABEL[entry]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent className="min-h-0" value={kind}>
          <div className="grid h-full min-h-0 grid-cols-1 items-start gap-6 md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:items-stretch">
            <LeftPanel
              addDisabled={!ready || firstPluginOfKind(kind) === null}
              filter={filter}
              filtered={filteredProfiles}
              hasPlugins={visiblePlugins.length > 0}
              kind={kind}
              kindCount={visibleProfiles.length}
              listRef={listRef}
              onAdd={startNew}
              onFilterChange={setFilter}
              onQueryChange={setQuery}
              onReorder={onReorder}
              onSelect={requestSelection}
              onToggleEnabled={toggleEnabled}
              query={query}
              saving={saving}
              selectedId={selectedId}
              togglingId={togglingId}
            />
            <section className="min-h-0 min-w-0 md:overflow-y-auto md:px-2">
              {editor === null ? (
                <p className="text-muted-foreground text-sm">
                  从左侧选择服务商进行配置，或点击「{KIND_ADD[kind]}」。
                </p>
              ) : (
                <FormForKind
                  dirty={dirty}
                  editor={editor}
                  error={error}
                  info={info}
                  isNew={false}
                  key={selectedId}
                  onCancelDiscard={cancelDiscard}
                  onConfirmDiscard={confirmDiscard}
                  onDelete={onDelete}
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
        </TabsContent>
      </Tabs>
      <Dialog.Root
        onOpenChange={(open) => {
          if (!open) {
            requestCloseCreate();
          }
        }}
        open={creating !== null}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 supports-backdrop-filter:backdrop-blur-xs" />
          <Dialog.Popup
            aria-label={KIND_ADD[kind]}
            className="fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col overflow-y-auto rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg outline-none"
          >
            <Dialog.Close
              render={
                <Button
                  className="absolute top-3 right-3"
                  disabled={saving}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <span aria-hidden="true" className="icon-[lucide--x] size-4" />
              <span className="sr-only">取消新增</span>
            </Dialog.Close>
            {creating ? (
              <FormForKind
                dirty={creatingDirty}
                editor={creating.editor}
                error={error}
                info={info}
                isNew
                onCancelDiscard={() => setClosePending(false)}
                onConfirmDiscard={closeCreate}
                onDelete={() => undefined}
                onPatch={patchCreating}
                onSave={onCreateSave}
                pending={closePending}
                plugin={creatingPlugin}
                saving={saving}
                schema={creatingPlugin?.configSchema}
                secretAvailable={secretAvailable}
                secretHas={{}}
                selectedId={null}
                showPluginName={plugins.length > 1}
              />
            ) : null}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export { ProvidersPage };
