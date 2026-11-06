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

import { FORM_FOR_KIND } from "./components/providers-form";
import { LeftPanel } from "./components/providers-list";
import { KIND_ADD, KIND_LABEL, KIND_ORDER } from "./kinds";
import { type Creating, NewProfileDialog } from "./new-profile-dialog";
import {
  bootProviders,
  kindOfPlugin,
  loadSecretHas,
  performSave,
} from "./page-flow";
import {
  EMPTY_EDITOR,
  type EditorState,
  type FilterState,
  editorFromProfile,
  isDirty,
  secretFieldNames,
} from "./provider-editor";

type PendingSwitch = { kind: PluginKind } | { id: string } | { create: true };

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
          <div className="grid h-full min-h-0 grid-cols-1 items-start gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:items-stretch">
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
              query={query}
              saving={saving}
              selectedId={selectedId}
            />
            <section className="md:scrollbar-gutter-stable min-h-0 min-w-0 md:overflow-y-auto md:overflow-x-clip md:px-2">
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
                />
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
      <NewProfileDialog
        creating={creating}
        dirty={creatingDirty}
        error={error}
        info={info}
        kind={kind}
        onCancelDiscard={() => setClosePending(false)}
        onConfirmDiscard={closeCreate}
        onPatch={patchCreating}
        onRequestClose={requestCloseCreate}
        onSave={onCreateSave}
        pending={closePending}
        plugin={creatingPlugin}
        saving={saving}
        secretAvailable={secretAvailable}
      />
    </>
  );
}

export { ProvidersPage };
