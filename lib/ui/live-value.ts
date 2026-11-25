// A look's value read where it is applied: a prop may be a plain value or a function of the current
// state (`Live`), so a control reads it in the JSX that draws it and follows the change.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

/**
 * A value, or a function reading it where the look is applied (a signal): read at draw time, a
 * signal's value stays live.
 */
export type Live<T> = T | (() => T);

/** `v`, read where it is applied: the value itself, or what its accessor returns then. */
export const read = <T>(v: Live<T> | undefined): T | undefined =>
  typeof v === 'function' ? (v as () => T)() : v;
