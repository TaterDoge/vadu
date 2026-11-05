import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { NEW_PROFILE_ID } from "./model-picker";
import {
  EMPTY_EDITOR,
  type EditorState,
  type FilterState,
  buildConfigPayload,
  buildSavePayload,
  draftLabel,
  editorFromProfile,
  ensureDraftVisible,
  isDirty,
  mergeSecretRetry,
  secretFieldNames,
} from "./provider-editor";

type PendingSwitch = { kind: PluginKind } | { id: string };

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
  const [pending, setPending] = useState<PendingSwitch | null>(null);
  const [kind, setKind] = useState<PluginKind>("translator");
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

  const firstPluginOfKind = (target: PluginKind): PluginDescriptor | null =>
    plugins.find((entry) => entry.kind === target) ?? null;

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
      : firstPluginOfKind(kind);
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
      setPending({ id });
      return;
    }
    switchTo(id);
  };

  const applyKindChange = (nextKind: PluginKind): void => {
    const cleared = ensureDraftVisible();
    setQuery(cleared.query);
    setFilter(cleared.filter);
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
      // 该 kind 没有 profile：直接进草稿态，让用户立即可新建
      const nextEditor = editorFromProfile(null, firstPluginOfKind(nextKind));
      setSelectedId(NEW_PROFILE_ID);
      setBaseline(nextEditor);
      setEditor(nextEditor);
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
    } else {
      switchTo(target.id);
    }
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
    if (
      !editor ||
      saving ||
      selectedId === null ||
      selectedId === NEW_PROFILE_ID
    ) {
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
        const cleared = ensureDraftVisible();
        const nextEditor = editorFromProfile(null, firstPluginOfKind(kind));
        setQuery(cleared.query);
        setFilter(cleared.filter);
        setSelectedId(NEW_PROFILE_ID);
        setBaseline(nextEditor);
        setEditor(nextEditor);
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
    selectedId === null || selectedId === NEW_PROFILE_ID
      ? null
      : (profiles.find((entry) => entry.id === selectedId) ?? null);
  const selectedPlugin = selectedProfile
    ? (plugins.find((entry) => entry.id === selectedProfile.pluginId) ?? null)
    : firstPluginOfKind(kind);
  const schema = selectedPlugin?.configSchema;
  const isNew = selectedId === NEW_PROFILE_ID;
  const dirty = editor !== null && isDirty(editor, baseline);

  const FORM_FOR_KIND: Record<PluginKind, typeof TranslatorForm> = {
    ocr: OcrForm,
    translator: TranslatorForm,
    tts: TtsForm,
  };
  const FormForKind = FORM_FOR_KIND[kind];

  return (
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
            draftName={isNew && editor ? draftLabel(editor.name) : null}
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
            onSelectDraft={startNew}
            onToggleEnabled={toggleEnabled}
            query={query}
            saving={saving}
            selectedId={selectedId}
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
                isNew={isNew}
                key={selectedId ?? "new"}
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
  );
}

export { ProvidersPage };
