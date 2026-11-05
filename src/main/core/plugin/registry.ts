/**
 * 插件表：只扫描内置插件根目录，校验 manifest、动态 import()，失败隔离。
 * 第三方插件安装/扫描属于后续里程碑，未确认的用户插件绝不执行。
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { app } from "electron";

import type { PluginDescriptor } from "../../../shared/ipc";
import type {
  OcrPlugin,
  PluginRuntime,
  TranslatorPlugin,
  TtsPlugin,
  VaduPlugin,
} from "../../../shared/plugin";
import { hasSecret } from "../config/secrets";
import { readProfiles } from "../config/store";
import { type PluginManifest, validateManifest } from "./manifest";

export type PluginCreateFn = (runtime: PluginRuntime) => VaduPlugin;

type NarrowedPlugin<T> = {
  create: (runtime: PluginRuntime) => T;
  descriptor: PluginDescriptor;
  manifest: PluginManifest;
};

export type LoadedPlugin = {
  descriptor: PluginDescriptor;
  manifest: PluginManifest;
  create: PluginCreateFn;
};

/** electron-builder 保留 out 目录，开发与打包产物使用同一相对路径。 */
function builtinRoot(): string {
  const appRoot = app.getAppPath();
  const base = join(appRoot, "out/main/plugins");
  return base.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`);
}

function pluginDirs(root: string): string[] {
  try {
    return readdirSync(root)
      .map((name) => join(root, name))
      .filter((dir) => statSync(dir).isDirectory());
  } catch {
    return [];
  }
}

function readManifest(dir: string): PluginManifest | null {
  try {
    const raw: unknown = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8")
    );
    const result = validateManifest(raw);
    return result.ok ? result.manifest : null;
  } catch {
    return null;
  }
}

async function loadPlugin(
  dir: string,
  main: string
): Promise<PluginCreateFn | null> {
  const entry = resolve(dir, main);
  // main 只允许落在插件目录内，防目录穿越
  if (!entry.startsWith(resolve(dir))) {
    return null;
  }
  const mod = await import(pathToFileURL(entry).toString());
  const create =
    mod?.createPlugin ?? mod?.default?.createPlugin ?? mod?.default;
  return typeof create === "function" ? (create as PluginCreateFn) : null;
}

function buildDescriptor(manifest: PluginManifest): PluginDescriptor {
  const descriptor: PluginDescriptor = {
    capabilities: manifest.capabilities,
    configSchema: manifest.config,
    description: manifest.description,
    id: manifest.id,
    kind: manifest.kind,
    name: manifest.name,
    origin: "builtin",
    permissions: manifest.permissions,
    presets: manifest.presets,
    secretsSet: {},
    status: "ready",
    version: manifest.version,
  };
  const profilesOfPlugin = readProfiles().filter(
    (profile) => profile.pluginId === manifest.id
  );
  for (const [name, field] of Object.entries(
    manifest.config?.properties ?? {}
  )) {
    if (field.type === "secret") {
      descriptor.secretsSet[name] = profilesOfPlugin.some((profile) =>
        hasSecret(profile.id, name)
      );
    }
  }
  return descriptor;
}

export class PluginRegistry {
  private readonly loaded = new Map<string, LoadedPlugin>();

  async discover(): Promise<void> {
    const jobs: { dir: string; manifest: PluginManifest }[] = [];
    for (const dir of pluginDirs(builtinRoot())) {
      const manifest = readManifest(dir);
      if (manifest) {
        jobs.push({ dir, manifest });
      }
    }

    await Promise.all(
      jobs.map(async ({ dir, manifest }) => {
        const descriptor = buildDescriptor(manifest);
        try {
          const create = await loadPlugin(dir, manifest.main);
          if (create) {
            this.loaded.set(manifest.id, { create, descriptor, manifest });
            return true;
          }
          descriptor.status = "error";
          descriptor.errorMessage = "插件入口未导出 createPlugin";
        } catch (error) {
          descriptor.status = "error";
          descriptor.errorMessage =
            error instanceof Error ? error.message : String(error);
        }
        return this.loaded.delete(manifest.id);
      })
    );
  }

  list(): PluginDescriptor[] {
    return [...this.loaded.values()].map((entry) => entry.descriptor);
  }

  get(pluginId: string): LoadedPlugin | undefined {
    return this.loaded.get(pluginId);
  }

  getTranslator(
    pluginId: string
  ): NarrowedPlugin<TranslatorPlugin> | undefined {
    const loaded = this.loaded.get(pluginId);
    if (loaded?.descriptor.kind !== "translator") {
      return undefined;
    }
    return {
      create: loaded.create as (runtime: PluginRuntime) => TranslatorPlugin,
      descriptor: loaded.descriptor,
      manifest: loaded.manifest,
    };
  }

  getOcr(pluginId: string): NarrowedPlugin<OcrPlugin> | undefined {
    const loaded = this.loaded.get(pluginId);
    if (loaded?.descriptor.kind !== "ocr") {
      return undefined;
    }
    return {
      create: loaded.create as (runtime: PluginRuntime) => OcrPlugin,
      descriptor: loaded.descriptor,
      manifest: loaded.manifest,
    };
  }

  getTts(pluginId: string): NarrowedPlugin<TtsPlugin> | undefined {
    const loaded = this.loaded.get(pluginId);
    if (loaded?.descriptor.kind !== "tts") {
      return undefined;
    }
    return {
      create: loaded.create as (runtime: PluginRuntime) => TtsPlugin,
      descriptor: loaded.descriptor,
      manifest: loaded.manifest,
    };
  }

  isReady(pluginId: string): boolean {
    return this.loaded.get(pluginId)?.descriptor.status === "ready";
  }
}

export const registry = new PluginRegistry();
