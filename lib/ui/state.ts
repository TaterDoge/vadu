// Reactive composition state shared across controls: controlled/uncontrolled open state, part
// slots, registered list items, and timed clipboard copy confirmation.

import { cleanup, type Signal, signal } from 'nsh';

/** Controlled/uncontrolled open flag shared by composition roots. */
export type OpenState = {
  open: () => boolean;
  setOpen: (next: boolean, reason?: string) => void;
};

/** What a root's `onOpenChange` gets. */
export type OpenChangeEvent<Reason extends string = string> = {
  open: boolean;
  reason: Reason;
};

/** The open flag of a composition root: the app's `open` when it gives one, else its own. */
export function createOpenState<Reason extends string = string>(options: {
  open?: boolean | null;
  defaultOpen?: boolean;
  onOpenChange?: (event: OpenChangeEvent<Reason>) => void;
}): OpenState {
  const uncontrolled = signal(options.defaultOpen ?? false);
  return {
    open: () => (options.open != null ? Boolean(options.open) : uncontrolled()),
    setOpen: (next, reason = 'triggerPress') => {
      if (options.open == null) uncontrolled.set(next);
      options.onOpenChange?.({ open: next, reason: reason as Reason });
    },
  };
}

/**
 * A part another part reads when it lays out: filled by the first, read by the second. `T` is what
 * the reading part calls it with — the element a Trigger part built once for the base component to
 * place, or a function a part hands back that rebuilds what it draws (a multiple combobox's chips,
 * which follow the chosen values).
 */
export type Slot<T = unknown> = {
  get: () => T | undefined;
  set: (value: T) => void;
};

/** A mutable slot: one part fills it, another reads it when it lays out. */
export function createSlot<T = unknown>(): Slot<T> {
  let value: T | undefined;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
}

/** What a registered item is: the row a select or a combobox lists. */
export type RegisteredItem = {
  value: string;
  title: string;
  disabled?: boolean;
  group?: string | null;
};

/** The items a composition root's `…Item` parts register (a select's choices). */
export type ItemRegistry<T extends RegisteredItem> = {
  items: Signal<T[]>;
  register: (item: T) => void;
  unregister: (value: string) => void;
};

/**
 * Items registered by the parts under a root (the rows of a listbox). An item is kept in
 * registration order; registering the same item again notifies nothing, so a part that runs again
 * on a re-render does not loop the root.
 */
export function createItemRegistry<T extends RegisteredItem>(
  initial: T[] = [],
): ItemRegistry<T> {
  const items = signal<T[]>(initial);
  const same = (a: T, b: T) =>
    a.value === b.value &&
    a.title === b.title &&
    a.disabled === b.disabled &&
    a.group === b.group;
  return {
    items,
    register: (item) => {
      items.update((list) => {
        const at = list.findIndex((found) => found.value === item.value);
        if (at >= 0 && same(list[at]!, item)) return list;
        const next = list.slice();
        if (at >= 0) next[at] = item;
        else next.push(item);
        return next;
      });
    },
    unregister: (value) => {
      items.update((list) => {
        const at = list.findIndex((found) => found.value === value);
        if (at < 0) return list;
        const next = list.slice();
        next.splice(at, 1);
        return next;
      });
    },
  };
}

/** How long a copy's confirmation stays up, in milliseconds. */
export const COPIED_FOR = 2000;

/** What `useCopied` hands a copy button. */
export interface Copied {
  /** Whether the copy just happened: the label and the glyph read it. */
  readonly copied: () => boolean;
  /** The text is on the clipboard: show the confirmation for `COPIED_FOR`, then take it back. */
  readonly mark: () => void;
}

/**
 * A copy's confirmation. `mark()` flips it on and schedules it off; a second mark restarts the
 * wait. The timer is cleared with the component, so a mark never lands after it is gone.
 */
export function useCopied(): Copied {
  const copied = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  cleanup(() => clearTimeout(timer));
  return {
    copied,
    mark: () => {
      copied.set(true);
      clearTimeout(timer);
      timer = setTimeout(() => copied.set(false), COPIED_FOR);
    },
  };
}
