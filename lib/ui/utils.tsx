// Shared pure component utilities: class merging (`mergeClasses`, `joinClass`), reactive props
// (`Live`, `read`), and string-to-Text child wrapping (`AsText`).
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { JSX, StyleProp, TextStyle } from 'nsh';
import { Text } from 'nsh';

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

/**
 * A value, or a function reading it where the look is applied (a signal): read at draw time, a
 * signal's value stays live.
 */
export type Live<T> = T | (() => T);

/** `v`, read where it is applied: the value itself, or what its accessor returns then. */
export const read = <T,>(v: Live<T> | undefined): T | undefined =>
  typeof v === 'function' ? (v as () => T)() : v;

/** What `AsText` takes: the `Text` a string child draws in, its class and its style. */
export type AsTextProps = {
  class?: string;
  style?: StyleProp<TextStyle>;
  children?: string | number | JSX.Element;
};

/**
 * One child, drawn as its control's text: a string or number is a `Text`; an array draws its
 * items this way (each string or number a `Text` of its own, an icon as it is); a getter (a child
 * that changes, `{label()}` among other children) is followed the same way where it is drawn;
 * anything else (an element) is drawn as given.
 */
function draw(
  kids: JSX.Element,
  textClass?: string,
  style?: StyleProp<TextStyle>,
): JSX.Element {
  if (typeof kids === 'string' || typeof kids === 'number') {
    return (
      <Text class={textClass} style={style}>
        {kids}
      </Text>
    );
  }
  if (Array.isArray(kids)) {
    return kids.map((kid) => draw(kid, textClass, style));
  }
  if (typeof kids === 'function') {
    const getter = kids as () => JSX.Element;
    return () => draw(getter(), textClass, style);
  }
  return kids;
}

/**
 * A control's children, drawn as its text: each string or number among them is a `Text` in
 * the control's label style, and everything else is drawn as it is — an element the control
 * lays out itself, or a child that changes, which arrives as a getter the renderer follows. A
 * component, so its props are getters, read where they are applied: place it where the children
 * are drawn, `<AsText style={look()}>{props.children}</AsText>`, and the one read of
 * `props.children` is the child position — a look in `style` is re-read on every style the
 * `Text` applies, and a child that reads a signal updates where it is drawn
 * (`references/nsh/website/docs/jsx-and-components.md`, "read it once, in the place where the
 * children go"). A control hands screen readers its name through `accessibilityLabel`; a view
 * with none is read as the texts inside it, which is what the children drawn here say.
 */
export function AsText(props: AsTextProps) {
  return (
    <>
      {(() => {
        // Read once, here where the children are drawn: each string or number becomes text,
        // anything else stays as it is.
        return draw(props.children, props.class, props.style);
      })()}
    </>
  );
}
