// A popover: the look (`popoverLook`) at the top, and the parts that wear it below.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { JSX, StyleProp, TextStyle, ViewStyle } from 'nsh';
import { context, platform, split, View } from 'nsh';
import {
  type OpenChangeReason,
  Popover as BasePopover,
  type PopoverProps as BasePopoverProps,
} from 'nsh/base';

import { PopIn, popupSurface } from '../../lib/ui/popup';
import {
  createOpenState,
  createSlot,
  type OpenState,
  type Slot,
} from '../../lib/ui/state';
import { AsText } from '../../lib/ui/utils';
import { Button, type ButtonVariant } from './button';

const pointer = platform.desktop;

/** Options of `popoverLook`. */
export interface PopoverLookOptions {
  /** Its width; unset, as wide as its content. */
  width?: number;
  /** A small note (a line or two): 12 points of padding, its rows 4 apart. */
  compact?: boolean;
}

/**
 * A popover's or a hover card's surface (the `style` of the `PopIn` it
 * comes in with): the popup surface every menu shares (`popupSurface`:
 * `surface("overlay")`'s fill, edge and soft shadow, 10-point corners), 14 points
 * of padding with a pointer and 16 on a touch screen, its rows 12 apart.
 */
export function popoverLook(o?: PopoverLookOptions): ViewStyle {
  const room: ViewStyle = o?.compact
    ? { padding: 12, gap: 4 }
    : { padding: pointer ? 14 : 16, gap: 12 };
  return { ...popupSurface(), ...room, width: o?.width };
}

/** Why a popover closed (`onOpenChange`'s `reason`): `nsh/base`'s `OpenChangeReason`, under this part's name. */
export type PopoverOpenChangeReason = OpenChangeReason;

/** The root: it owns whether the popover is open, and the trigger slot. */
export type PopoverProps = {
  /** Controlled; leave it out and the root keeps the state (`defaultOpen`). */
  open?: boolean | null;
  defaultOpen?: boolean;
  children?: JSX.Element;
  onOpenChange?: (event: {
    open: boolean;
    reason: PopoverOpenChangeReason;
  }) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
};

/**
 * The panel. Every prop of `nsh/base`'s Popover passes through but the ones the root owns;
 * `popoverLook` is the surface of the `PopIn` it comes in with, and `class` and `style` go
 * over it (shadcn's `className` on the content). Defaults: placement `bottom`.
 */
export type PopoverContentProps = Omit<
  BasePopoverProps,
  | 'trigger'
  | 'open'
  | 'defaultOpen'
  | 'onOpenChange'
  | 'onOpen'
  | 'onClose'
  | 'onCancel'
  | 'children'
> & {
  /** A line or two: 12 points of padding and 4 between rows. */
  compact?: boolean;
  /** The panel's width; unset, as wide as its content. */
  width?: number;
  /** Classes of the panel's surface, over `popoverLook`. */
  class?: string;
  /** The panel's surface, over `popoverLook` (`{ padding: 0 }` for content that brings its own). */
  style?: StyleProp<ViewStyle>;
  children?: JSX.Element;
};

/**
 * What opens the popover: a string is a `Button`'s label; any other single element is the
 * trigger itself (its press, focus, hover and open state land on it, no view in between).
 */
export type PopoverTriggerProps = {
  children?: string | JSX.Element;
  /** The button's variant, for a string child (default `secondary`). */
  variant?: ButtonVariant;
  /** No press, for a string child; an element carries its own `disabled`. */
  disabled?: boolean;
  /** The string child's button style. */
  style?: StyleProp<ViewStyle>;
};

/** The header block of a panel (not an `nsh/base` part): the app's layout and type. */
export type PopoverHeaderProps = {
  children?: JSX.Element;
  class?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** A panel's title: a string is text, anything else is drawn as given. */
export type PopoverTitleProps = {
  children?: string | JSX.Element;
  class?: string | null;
  style?: StyleProp<TextStyle>;
};

/** A panel's quieter text under the title: as `PopoverTitle`. */
export type PopoverDescriptionProps = PopoverTitleProps;

type PopoverContextValue = OpenState & {
  trigger: Slot<JSX.Element>;
  onOpen?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
};

const PopoverContext = context<PopoverContextValue | null>(null);

function usePopover() {
  const ctx = PopoverContext();
  if (!ctx) throw new Error('Popover parts must be used within <Popover>');
  return ctx;
}

/** The root of a popover's parts. */
export function Popover(props: PopoverProps) {
  const state = createOpenState<OpenChangeReason>(props);
  const trigger = createSlot<JSX.Element>();
  return (
    <PopoverContext.Provider
      value={{
        ...state,
        trigger,
        get onOpen() {
          return props.onOpen;
        },
        get onClose() {
          return props.onClose;
        },
        get onCancel() {
          return props.onCancel;
        },
      }}
    >
      {props.children}
    </PopoverContext.Provider>
  );
}

/** Opens the popover: a `Button` for a string, the element itself for anything else. */
export function PopoverTrigger(props: PopoverTriggerProps) {
  const ctx = usePopover();
  // The trigger is an element, as an app hands one to `nsh/base` (`trigger={<View …>}`, the shape
  // upstream's demos use): built once, here, and placed by the popover without building it again
  // on every layout. A single element is the trigger itself — `nsh/base` hands its press, focus
  // and open state to that element, and its own look, test id and name stay — so no view goes
  // between them. The kind is read once, here: a string child is read where it is drawn (the
  // `Button`'s own read, through the spread's getter, so a child that reads a signal stays live).
  const kids = props.children;
  ctx.trigger.set(
    typeof kids === 'string' ? (
      <Button {...props} variant={props.variant ?? 'secondary'} />
    ) : (
      (kids ?? <View />)
    ),
  );
  return null;
}

/** The panel, over the popup surface of `popoverLook`. */
export function PopoverContent(props: PopoverContentProps) {
  const ctx = usePopover();
  const [, rest] = split(props, [
    'children',
    'compact',
    'width',
    'class',
    'style',
    'placement',
    'align',
    'offset',
    'margin',
  ]);
  const placement = () => props.placement ?? 'bottom';
  return (
    <BasePopover
      {...rest}
      open={ctx.open()}
      trigger={ctx.trigger.get() ?? <View />}
      placement={placement()}
      align={props.align}
      offset={props.offset}
      margin={props.margin}
      onOpenChange={({ open, reason }) => ctx.setOpen(open, reason)}
      onOpen={ctx.onOpen}
      onClose={ctx.onClose}
      onCancel={ctx.onCancel}
    >
      {() => (
        <PopIn
          side={placement()}
          class={props.class}
          style={[
            popoverLook({ compact: props.compact, width: props.width }),
            props.style ?? null,
          ]}
        >
          {/* children-lint: the panel's contents, built when it opens, not before. */}
          {props.children}
        </PopIn>
      )}
    </BasePopover>
  );
}

/** The block around a panel's title and its description. */
export function PopoverHeader(props: PopoverHeaderProps) {
  return (
    <View class={props.class ?? undefined} style={props.style}>
      {props.children}
    </View>
  );
}

/** A panel's title; a string child is `Text` (give it the app's type with `style`). */
export function PopoverTitle(props: PopoverTitleProps) {
  return (
    <AsText class={props.class ?? undefined} style={props.style}>
      {props.children}
    </AsText>
  );
}

/** A panel's text under the title; as `PopoverTitle`. */
export function PopoverDescription(props: PopoverDescriptionProps) {
  return (
    <AsText class={props.class ?? undefined} style={props.style}>
      {props.children}
    </AsText>
  );
}
