// Where a set's Iconify JSON comes from: the repo's bundled data when the
// CLI runs from a checkout, else the set's own npm package, cached.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { IconifySet } from "../src/iconify.ts";
import { untgz } from "./tar.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const bundledDir = join(here, "../../../crates/nsh-icons/data");

export interface Loaded {
  set: IconifySet;
  /** Where it came from, written into generated files. */
  source: string;
}

/** One entry of the bundled `manifest.json`, as `tools/fetch-data.ts` writes it. */
export interface ManifestEntry {
  prefix: string;
  name: string;
  total: number;
  license: string;
  licenseUrl: string;
  author: string;
  multicolor: boolean;
  category: string;
  /** The license asks for attribution, or limits commercial use. */
  restrictive: boolean;
  bundled: boolean;
}

/** The pinned `@iconify/json` version and its manifest; nothing outside a checkout. */
export async function bundledManifest(): Promise<{ version: string; entries: ManifestEntry[] }> {
  const version = (await readFile(join(bundledDir, "VERSION"), "utf8")).trim();
  const entries: ManifestEntry[] = JSON.parse(await readFile(join(bundledDir, "manifest.json"), "utf8"));
  return { version, entries };
}

export interface Fetcher {
  (url: string): Promise<Uint8Array>;
}

const fetchBytes: Fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

function cacheDir(): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "supernsh-icons");
}

/** The set with this prefix, from the bundled data or npm. */
export async function loadSet(prefix: string, fetcher: Fetcher = fetchBytes): Promise<Loaded> {
  if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error(`\`${prefix}\` is not an Iconify prefix`);
  const bundled = join(bundledDir, "sets", `${prefix}.json.gz`);
  if (existsSync(bundled)) {
    const version = (await readFile(join(bundledDir, "VERSION"), "utf8")).trim();
    return { set: JSON.parse(gunzipSync(await readFile(bundled)).toString("utf8")), source: `@iconify/json ${version}` };
  }
  const meta = JSON.parse(new TextDecoder().decode(await fetcher(`https://registry.npmjs.org/@iconify-json/${prefix}/latest`)));
  const version: string = meta.version;
  const cached = join(cacheDir(), `${prefix}@${version}.json`);
  if (existsSync(cached)) return { set: JSON.parse(await readFile(cached, "utf8")), source: `@iconify-json/${prefix} ${version}` };
  const files = untgz(await fetcher(meta.dist.tarball));
  const json = files.get("package/icons.json");
  if (!json) throw new Error(`@iconify-json/${prefix} ${version} has no icons.json`);
  await mkdir(dirname(cached), { recursive: true });
  await writeFile(cached, json);
  return { set: JSON.parse(new TextDecoder().decode(json)), source: `@iconify-json/${prefix} ${version}` };
}

/** Every Iconify set: the bundled manifest, else Iconify's own list. */
export async function listSets(fetcher: Fetcher = fetchBytes): Promise<ManifestEntry[]> {
  const manifest = join(bundledDir, "manifest.json");
  if (existsSync(manifest)) return JSON.parse(await readFile(manifest, "utf8"));
  const collections = JSON.parse(new TextDecoder().decode(await fetcher("https://raw.githubusercontent.com/iconify/icon-sets/master/collections.json")));
  return Object.entries(collections as Record<string, { name: string; total?: number; license?: { spdx?: string; title?: string }; hidden?: boolean }>)
    .filter(([, c]) => !c.hidden)
    .map(([prefix, c]) => ({
      prefix,
      name: c.name,
      total: c.total ?? 0,
      license: c.license?.spdx ?? c.license?.title ?? "unknown",
      licenseUrl: "",
      author: "",
      multicolor: false,
      category: "",
      restrictive: false,
      bundled: false,
    }));
}
