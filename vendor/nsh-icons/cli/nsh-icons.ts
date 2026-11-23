#!/usr/bin/env node
// supernsh-icons: puts icons from any Iconify set into an NSH app, as SVG data
// (TS or Rust) or as an icon font. Runs on Node 24 (type stripping) or Bun.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { resolveAll } from "../src/iconify.ts";
import { DEMO_FONT_IDS, dataModule, dataIndex, demoIndex, demoSet, type DemoSet } from "./gallery.ts";
import { buildFont, glyphModule, iconModule, idsIn, type Lang, parseId, type Picked, pick } from "./generate.ts";
import { bundledManifest, listSets, loadSet } from "./sources.ts";

const USAGE = `supernsh-icons: icons from every Iconify set, for NSH apps

  supernsh-icons add <set:name>... [--out src/icons.ts] [--lang ts|rust]
      Writes the icons as data, adding them to what --out already lists.
  supernsh-icons font <set:name>... --out assets/icons.ttf [--map src/icon-font.ts]
                 [--family NshIcons] [--lang ts|rust]
      Builds an icon font of filled, one-color icons and its glyph map.
  supernsh-icons gallery [--out examples/gallery] [--sets lucide,ph] [--data-only]
      Writes the icon explorer demo's data: the set index it commits, each
      set's bodies as their own module, and the demo's font showcase.
  supernsh-icons search <text> --set <prefix>
      Lists the icons of a set whose names contain the text.
  supernsh-icons sets
      Lists every set: prefix, icons, license, and whether the Rust crate bundles it.

Ids are Iconify's: lucide:heart, ph:star-fill, mdi:home. Browse them at https://icon-sets.iconify.design.`;

/** Loads each set once and resolves the ids in it. */
async function pickAll(ids: string[]): Promise<Picked[]> {
  const bySet = new Map<string, string[]>();
  for (const id of new Set(ids)) {
    const [set, name] = parseId(id);
    bySet.set(set, [...(bySet.get(set) ?? []), name]);
  }
  const picked: Picked[] = [];
  for (const [prefix, names] of bySet) {
    const { set, source } = await loadSet(prefix);
    for (const name of names) picked.push(pick(set, name, source));
  }
  return picked;
}

async function write(path: string, data: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/** `./x` style, as an import needs. */
function importPath(from: string, to: string): string {
  const path = relative(dirname(from), to).split("\\").join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      map: { type: "string" },
      lang: { type: "string", default: "ts" },
      family: { type: "string", default: "NshIcons" },
      set: { type: "string" },
      sets: { type: "string" },
      "data-only": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    console.log(USAGE);
    return command || values.help ? 0 : 1;
  }
  const lang = values.lang as Lang;
  if (lang !== "ts" && lang !== "rust") throw new Error(`--lang is ts or rust, not ${values.lang}`);
  const ext = lang === "ts" ? "ts" : "rs";

  switch (command) {
    case "add": {
      const out = resolve(values.out ?? `src/icons.${ext}`);
      const existing = existsSync(out) ? idsIn(await readFile(out, "utf8")) : [];
      if (!rest.length && !existing.length) throw new Error("name at least one icon: supernsh-icons add lucide:heart");
      const icons = await pickAll([...existing, ...rest]);
      await write(out, iconModule(icons, lang));
      console.log(`${relative(process.cwd(), out)}: ${icons.length} icons`);
      return 0;
    }
    case "font": {
      if (!values.out) throw new Error("--out names the font file, such as assets/icons.ttf");
      const out = resolve(values.out);
      const map = resolve(values.map ?? `src/icon-font.${ext}`);
      const existing = existsSync(map) ? idsIn(await readFile(map, "utf8")) : [];
      const icons = await pickAll([...existing, ...rest]);
      if (!icons.length) throw new Error("name at least one icon: supernsh-icons font ph:star-fill --out assets/icons.ttf");
      await write(out, await buildFont(icons, values.family!));
      await write(map, glyphModule(icons, values.family!, importPath(map, out), lang));
      console.log(`${relative(process.cwd(), out)} and ${relative(process.cwd(), map)}: ${icons.length} glyphs`);
      return 0;
    }
    case "gallery": {
      const out = resolve(values.out ?? ".");
      const { version, entries } = await bundledManifest();
      const bundled = entries.filter((e) => e.bundled).sort((a, b) => (a.prefix < b.prefix ? -1 : 1));
      const wanted = values.sets ? values.sets.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      if (wanted) {
        const known = new Set(bundled.map((e) => e.prefix));
        const missing = wanted.filter((prefix) => !known.has(prefix));
        if (missing.length) throw new Error(`the crate does not bundle ${missing.join(", ")}`);
      }
      const demo: DemoSet[] = [];
      for (const entry of wanted ? bundled.filter((e) => wanted.includes(e.prefix)) : bundled) {
        const { set } = await loadSet(entry.prefix);
        const resolved = resolveAll(set);
        demo.push(demoSet(entry, set, resolved.map((icon) => icon.name)));
        await write(
          resolve(out, "src/data", `${entry.prefix}.ts`),
          dataModule(entry.prefix, entry.name, entry.license, version, resolved.map((icon) => [icon.body, icon.viewBox] as [string, [number, number, number, number]])),
        );
      }
      await write(resolve(out, "src/data/index.ts"), dataIndex(demo.map((set) => set.entry.prefix)));
      await write(resolve(out, "src/demo-index.ts"), demoIndex(demo, version));
      // The demo builds run this with --data-only: the font artifacts are
      // committed, and data alone needs no font libraries installed.
      if (values["data-only"]) return 0;
      const fontOut = resolve(out, "assets/icons.ttf");
      const map = resolve(out, "src/icon-font.ts");
      const icons = await pickAll(DEMO_FONT_IDS);
      await write(fontOut, await buildFont(icons, values.family!));
      // The demo is a TSX app, so its glyph map is always TS.
      await write(map, glyphModule(icons, values.family!, importPath(map, fontOut), "ts"));
      console.log(`${relative(process.cwd(), out)}: ${demo.length} sets, ${demo.reduce((total, set) => total + set.names.length, 0)} icons, ${icons.length} glyphs`);
      return 0;
    }
    case "search": {
      if (!values.set || !rest.length) throw new Error("supernsh-icons search <text> --set <prefix>");
      const { set } = await loadSet(values.set);
      const text = rest.join("-").toLowerCase();
      const found = resolveAll(set).filter((i) => i.name.includes(text));
      for (const icon of found) console.log(`${values.set}:${icon.name}`);
      return found.length ? 0 : 1;
    }
    case "sets": {
      for (const s of await listSets()) {
        console.log(`${s.prefix.padEnd(28)} ${String(s.total).padStart(6)}  ${s.license.padEnd(16)} ${s.bundled ? "bundled" : ""}  ${s.name}`);
      }
      return 0;
    }
    default:
      throw new Error(`no command \`${command}\`\n\n${USAGE}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("nsh-icons.ts")) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: Error) => {
      console.error(`supernsh-icons: ${error.message}`);
      process.exit(1);
    },
  );
}
