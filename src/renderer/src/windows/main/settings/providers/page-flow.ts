// 页面的数据流程：启动加载、保存、密钥状态刷新。与组件分开，失败路径才能单独推敲。
import type { Dispatch, SetStateAction } from "react";
import type { PluginDescriptor, PluginKind, Profile } from "@shared/ipc";

import {
  type EditorState,
  buildConfigPayload,
  buildSavePayload,
  editorFromProfile,
  mergeSecretRetry,
  secretFieldNames,
} from "./provider-editor";

type SecretHas = Record<string, Record<string, boolean>>;

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
  setSecretHas: Dispatch<SetStateAction<SecretHas>>
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

type BootDispatch = {
  setError: (message: string) => void;
  setSecretAvailable: (available: boolean) => void;
  setPlugins: (plugins: PluginDescriptor[]) => void;
  setProfiles: (profiles: Profile[]) => void;
  setSelectedId: (id: string) => void;
  setBaseline: (editor: EditorState) => void;
  setEditor: (editor: EditorState) => void;
  setReady: (ready: boolean) => void;
  setSecretHas: Dispatch<SetStateAction<SecretHas>>;
};

async function bootProviders(
  aliveRef: { current: boolean },
  dispatch: BootDispatch,
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
  setSecretHas: Dispatch<SetStateAction<SecretHas>>;
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

export type { SaveApi };
export { bootProviders, kindOfPlugin, loadSecretHas, performSave };
