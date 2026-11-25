// How an app's part classes meet ours: `mergeClasses` merges the parts one by one (a string after
// ours, `null` dropping ours, a map name by name), and `joinClass` puts one part's classes after the look's.

/** A part's classes by name (`RichEditorClasses`'s `nodes`, `marks`): a node type's, a mark's. */
export type PartMap = { [name: string]: string | null | undefined };

/** A part's classes: the classes themselves, or a map of them by name, as a rich document has. */
type PartClasses = string | PartMap | null | undefined;

/**
 * `consumer` over `base`, part by part: a string goes after ours, `null` drops ours, and a part it
 * leaves out (or `undefined`) keeps ours. A part that is a map (`RichEditorClasses`'s `nodes`,
 * `marks`) merges name by name the same way, so the app overrides one node or mark and keeps the
 * look's others.
 */
export function mergeClasses<C extends { [K in keyof C]?: PartClasses }>(
  base: C,
  consumer?: C | null,
): C {
  if (consumer == null) return base;
  const merged: C = { ...base };
  for (const key of Object.keys(consumer) as (keyof C)[]) {
    const next = consumer[key];
    if (next === undefined) continue;
    if (next === null) {
      delete merged[key];
      continue;
    }
    const prior = merged[key];
    const ours = typeof prior === 'string' && prior ? `${prior} ` : '';
    merged[key] = (
      typeof next === 'string'
        ? `${ours}${next}`
        : mergePartMap(
            typeof prior === 'object' && prior !== null ? prior : undefined,
            next,
          )
    ) as C[keyof C];
  }
  return merged;
}

/** `consumer`'s classes over `base`'s, name by name, as `mergeClasses` merges the parts themselves. */
function mergePartMap(base: PartMap | undefined, consumer: PartMap): PartMap {
  const merged: PartMap = { ...base };
  for (const [name, classes] of Object.entries(consumer)) {
    if (classes === undefined) continue;
    if (classes === null) {
      delete merged[name];
      continue;
    }
    const prior = merged[name];
    merged[name] = prior ? `${prior} ${classes}` : classes;
  }
  return merged;
}

/**
 * `base`'s classes with `extra`'s after them: no `extra` keeps `base` as it is, and a `base` that
 * is absent leaves `extra` alone (a part with no default class of its own).
 */
export function joinClass(base: string, extra?: string | null): string;
export function joinClass(
  base: string | null | undefined,
  extra?: string | null,
): string | undefined;
export function joinClass(
  base: string | null | undefined,
  extra?: string | null,
): string | undefined {
  const prior = base ?? undefined;
  const next = extra ?? undefined;
  if (prior && next) return `${prior} ${next}`;
  return next ?? prior;
}
