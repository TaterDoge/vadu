// Iconify JSON to resolved icons: the same steps as the Rust generator
// (`crates/nsh-icons-codegen`), held to it by the shared `fixtures/`.

/** Alias chains deeper than this are treated as a loop. */
const MAX_ALIAS_DEPTH = 36;

/** One icon, ready to draw. */
export interface Resolved {
  name: string;
  body: string;
  /** `[left, top, width, height]`. */
  viewBox: [number, number, number, number];
}

interface Layer {
  body?: string;
  parent?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  rotate?: number;
  hFlip?: boolean;
  vFlip?: boolean;
  hidden?: boolean;
}

export interface IconifySet {
  prefix: string;
  info?: { name?: string; author?: { name?: string }; license?: { title?: string; spdx?: string }; palette?: boolean; samples?: string[] };
  icons: Record<string, Layer>;
  aliases?: Record<string, Layer>;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

/** Every icon and alias that is not hidden, sorted by name. */
export function resolveAll(set: IconifySet): Resolved[] {
  const out: Resolved[] = [];
  for (const [name, icon] of Object.entries(set.icons)) {
    if (!icon.hidden) out.push(resolve(set, name, icon, []));
  }
  for (const name of Object.keys(set.aliases ?? {})) {
    const resolved = resolveName(set, name);
    if (resolved) out.push(resolved);
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** One icon or alias by name; `undefined` when the set has no such name or hides it. */
export function resolveName(set: IconifySet, name: string): Resolved | undefined {
  const icon = set.icons[name];
  if (icon) return icon.hidden ? undefined : resolve(set, name, icon, []);
  const alias = set.aliases?.[name];
  if (!alias || alias.hidden) return undefined;
  const chain = [alias];
  let parent = alias.parent;
  for (;;) {
    if (parent === undefined) throw new Error(`alias \`${name}\` has no parent`);
    const found = set.icons[parent];
    if (found) return resolve(set, name, found, chain.reverse());
    const next = set.aliases?.[parent];
    if (!next) throw new Error(`alias \`${name}\` names \`${parent}\`, which the set does not have`);
    if (chain.length >= MAX_ALIAS_DEPTH) throw new Error(`alias \`${name}\` loops or nests too deep`);
    chain.push(next);
    parent = next.parent;
  }
}

function resolve(set: IconifySet, name: string, icon: Layer, chain: Layer[]): Resolved {
  const box: [number, number, number, number] = [set.left ?? 0, set.top ?? 0, set.width ?? 16, set.height ?? 16];
  let rotate = 0;
  let hFlip = false;
  let vFlip = false;
  for (const layer of [icon, ...chain]) {
    (["left", "top", "width", "height"] as const).forEach((key, at) => {
      if (layer[key] !== undefined) box[at] = layer[key];
    });
    rotate = (rotate + (layer.rotate ?? 0)) % 4;
    hFlip = hFlip !== (layer.hFlip ?? false);
    vFlip = vFlip !== (layer.vFlip ?? false);
  }
  return { name, ...applyTransform(icon.body ?? "", box, rotate, hFlip, vFlip) };
}

/** Iconify's `iconToSVG` transform step. */
function applyTransform(
  body: string,
  [left, top, width, height]: [number, number, number, number],
  rotate: number,
  hFlip: boolean,
  vFlip: boolean,
): Omit<Resolved, "name"> {
  const steps: string[] = [];
  if (hFlip) {
    if (vFlip) rotate += 2;
    else {
      steps.push(`translate(${fmt(left + width)} ${fmt(-top)})`, "scale(-1 1)");
      top = left = 0;
    }
  } else if (vFlip) {
    steps.push(`translate(${fmt(-left)} ${fmt(top + height)})`, "scale(1 -1)");
    top = left = 0;
  }
  switch (rotate % 4) {
    case 1: {
      const c = height / 2 + top;
      steps.unshift(`rotate(90 ${fmt(c)} ${fmt(c)})`);
      break;
    }
    case 2:
      steps.unshift(`rotate(180 ${fmt(width / 2 + left)} ${fmt(height / 2 + top)})`);
      break;
    case 3: {
      const c = width / 2 + left;
      steps.unshift(`rotate(-90 ${fmt(c)} ${fmt(c)})`);
      break;
    }
  }
  if (rotate % 2 === 1) {
    [left, top] = [top, left];
    [width, height] = [height, width];
  }
  return {
    body: steps.length ? `<g transform="${steps.join(" ")}">${body}</g>` : body,
    viewBox: [left, top, width, height],
  };
}

/** A number as SVG writes it, `-0` as `0`. */
export function fmt(value: number): string {
  return Object.is(value, -0) ? "0" : String(value);
}

/** `arrow-left` in set `fa7-solid` as a TS export: `fa7SolidArrowLeft`. */
export function tsName(prefix: string, name: string): string {
  const words = `${prefix}-${name}`.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const camel = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("");
  return /^[0-9]/.test(camel) ? `i${camel}` : camel;
}

/** `arrow-left` in set `fa7-solid` as a Rust constant: `FA7_SOLID_ARROW_LEFT`. */
export function rustName(prefix: string, name: string): string {
  const ident = `${prefix}-${name}`.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  return /^[0-9]/.test(ident) ? `I_${ident}` : ident;
}
