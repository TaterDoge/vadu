// A tooltip: the look (`tooltipLook`, `tooltipText`, `tooltipNote`) at the top, and the parts below.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { JSX, StyleProp, TextStyle, ViewStyle } from 'nsh';
import { context, split, View } from 'nsh';
import {
  type OpenChangeReason,
  Tooltip as BaseTooltip,
  type TooltipProps as BaseTooltipProps,
} from 'nsh/base';

import {
  createOpenState,
  createSlot,
  type OpenState,
  type Slot,
} from '../../lib/ui/state';
import { surface, surfaceBorderWidth } from '../../lib/ui/theme';
import { AsText } from '../../lib/ui/utils';
import { Button, type ButtonVariant } from './button';

/** Options of `tooltipLook`. */
export interface TooltipLookOptions {
  /** More than a line (a title, a list): 10 points of padding, its rows 8 apart, larger corners. */
  rich?: boolean;
}

/**
 * A tooltip's bubble (`class` and `style`, on the view inside `nsh/base`'s `Tooltip`):
 * the theme's inverse surface (`surface("inverse")`), its face, shadow, edge and backdrop blur.
 * One line: a row 8 points apart, 8 by 4 points of padding,
 * the theme's control corners (`radius-control`); `rich`: a column, 10 points of padding, the
 * theme's container corners (`radius-container`).
 * Its text takes `tooltipTextStyle()`, a shortcut or a note `tooltipNote()`.
 */
export function tooltipLook(o?: TooltipLookOptions) {
  return {
    class: o?.rich
      ? 'gap-2 rounded-(--radius-container) p-2.5'
      : 'flex-row items-center gap-2 rounded-(--radius-control) px-2 py-1',
    style: {
      get backgroundColor() {
        return surface('inverse').style.backgroundColor;
      },
      get boxShadow() {
        return surface('inverse').style.boxShadow ?? 'none';
      },
      get borderColor() {
        return surface('inverse').style.borderColor;
      },
      get borderWidth() {
        const edge = surface('inverse').style.borderColor;
        return surfaceBorderWidth(typeof edge === 'string' ? edge : undefined);
      },
      get backdropFilter() {
        return (surface('inverse').style as { backdropFilter?: string })
          .backdropFilter;
      },
    } satisfies ViewStyle,
  };
}

/** Class name for tooltip sizing where only a class prop is used; prefer `tooltipTextStyle()` for color. */
export const tooltipText = 'text-xs';

/** A tooltip's text style: 12 points over 16 in the theme's `tooltip.ink`. */
export const tooltipTextStyle = (): TextStyle => ({
  fontSize: 12,
  lineHeight: 16,
  color: surface('inverse').ink,
});

/** A tooltip's quieter text (`style`): a shortcut's keys, a time, 12 points over 16 in the tooltip's ink. */
export const tooltipNote = (): TextStyle => ({
  fontSize: 12,
  lineHeight: 16,
  color: surface('inverse').ink,
});

/** Why a tooltip closed (`onOpenChange`'s `reason`): `nsh/base`'s `OpenChangeReason`, under this part's name. */
export type TooltipOpenChangeReason = OpenChangeReason;

/**
 * The root: it owns whether the hint shows, and the trigger and content slots. `nsh/base` takes a
 * tooltip as the host element's `tooltip` prop, so the root renders one host view around its
 * trigger; `TooltipContent` can also be used on its own as `tooltip={<TooltipContent>…</TooltipContent>}`.
 */
export type TooltipProps = {
  /** Shown (controlled); leave it out and the root keeps the state (`defaultOpen`). */
  open?: boolean | null;
  defaultOpen?: boolean;
  /** The side of the trigger it goes on (default `top`). */
  placement?: BaseTooltipProps['placement'];
  /** How it lines up with the trigger (default `center`). */
  align?: BaseTooltipProps['align'];
  /** The gap between the trigger and the hint (default 4). */
  offset?: number;
  /** The distance it keeps from the edges of the safe area (default 4). */
  margin?: number;
  /** Milliseconds the pointer rests on the trigger before it shows (default 500). */
  delay?: number;
  /** No tooltip: it neither shows nor asks to. */
  disabled?: boolean;
  /**
   * The view the hint hangs on, around the trigger. It lays out like the element it holds — as
   * wide as its column or its content would make it — because upstream hangs the tooltip on the
   * element itself and adds no host: a button in a column fills it, in a row it takes its label's
   * width. Give this a `flex`, an `alignSelf` or a width where the trigger should not follow that
   * (`{ flex: 1 }` for a button that spans a phone's page).
   */
  style?: StyleProp<ViewStyle>;
  children?: JSX.Element;
  onOpenChange?: (event: {
    open: boolean;
    reason: TooltipOpenChangeReason;
  }) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/** The host that shows the hint: a string is a `Button`'s label, anything else the element itself. */
export type TooltipTriggerProps = {
  children?: string | JSX.Element;
  /** The button's variant, for a string child (default `secondary`). */
  variant?: ButtonVariant;
  /** The button takes no press (a string child). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The hint's bubble. Every prop of `nsh/base`'s Tooltip passes through; `class` goes over
 * `tooltipLook`'s. In composition the root's open state, placement, delay and events win unless
 * set here; alone, it is the host's `tooltip={<TooltipContent>…</TooltipContent>}`.
 */
export type TooltipContentProps = Omit<BaseTooltipProps, 'children'> & {
  /** More than a line: a column with more padding. */
  rich?: boolean;
  /** A string is the label in `tooltipText`; anything else is drawn as given. */
  children?: string | JSX.Element;
};

type TooltipContextValue = OpenState & {
  trigger: Slot<JSX.Element>;
  content: Slot<TooltipContentProps>;
  placement?: BaseTooltipProps['placement'];
  align?: BaseTooltipProps['align'];
  offset?: number;
  margin?: number;
  delay?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onOpen?: () => void;
  onClose?: () => void;
};

const TooltipContext = context<TooltipContextValue | null>(null);

function useTooltip() {
  const ctx = TooltipContext();
  if (!ctx) throw new Error('Tooltip parts must be used within <Tooltip>');
  return ctx;
}

/** The bubble itself: `tooltipLook`'s classes, a string child in `tooltipTextStyle()`. */
function Bubble(props: TooltipContentProps) {
  const [, rest] = split(props, ['children', 'rich', 'class']);
  const look = tooltipLook({ rich: props.rich });
  return (
    <BaseTooltip
      {...surface('inverse').platformProps}
      {...rest}
      class={props.class ? `${look.class} ${props.class}` : look.class}
      style={[look.style, props.style ?? null]}
    >
      <AsText style={tooltipTextStyle()}>{props.children}</AsText>
    </BaseTooltip>
  );
}

/** The root of a tooltip's parts. */
export function Tooltip(props: TooltipProps) {
  const state = createOpenState<OpenChangeReason>(props);
  const trigger = createSlot<JSX.Element>();
  const content = createSlot<TooltipContentProps>();
  return (
    <TooltipContext.Provider
      value={{
        ...state,
        trigger,
        content,
        get placement() {
          return props.placement;
        },
        get align() {
          return props.align;
        },
        get offset() {
          return props.offset;
        },
        get margin() {
          return props.margin;
        },
        get delay() {
          return props.delay;
        },
        get disabled() {
          return props.disabled;
        },
        get style() {
          return props.style;
        },
        get onOpen() {
          return props.onOpen;
        },
        get onClose() {
          return props.onClose;
        },
      }}
    >
      {/* No gap of its own: this view only hosts the hint, the children lay out as they would. */}
      <View style={[{ gap: 0 }, props.style ?? null]}>
        {props.children}
        {() => <TooltipAnchor />}
      </View>
    </TooltipContext.Provider>
  );
}

/** What the pointer rests on: a `Button` for a string, else the element as it is. */
export function TooltipTrigger(props: TooltipTriggerProps) {
  const ctx = useTooltip();
  // The trigger is an element, as an app hands one to `nsh/base` (a `tooltip` on the view, the
  // shape upstream's demos use): built once, here, and placed by the anchor without building it
  // again on every layout. The kind is read once, here — it picks the host, and never changes; a
  // string child is read where it is drawn (the `Button`'s own read, through the spread's getter,
  // so a child that reads a signal stays live), and an element is handed as it is.
  const kids = props.children;
  ctx.trigger.set(
    typeof kids === 'string' ? (
      <Button
        {...props}
        variant={props.variant ?? 'secondary'}
        disabled={props.disabled}
      />
    ) : (
      (kids ?? <View />)
    ),
  );
  return null;
}

/** The bubble. Inside `Tooltip` it feeds the root's host; alone it is the host's `tooltip`. */
export function TooltipContent(props: TooltipContentProps) {
  const ctx = TooltipContext();
  if (!ctx) return <Bubble {...props} />;
  ctx.content.set(props);
  return null;
}

/**
 * The host view the base tooltip is on, around the trigger, once the parts have registered. It
 * gives the trigger the room it would have had without a host (no width of its own, no
 * `alignSelf`): `nsh/base` takes a tooltip as an element's prop, and upstream hangs it on the
 * element, so the shell must not move or resize what it wraps.
 */
function TooltipAnchor() {
  const ctx = TooltipContext();
  if (!ctx) return null;
  const trigger = ctx.trigger.get();
  if (!trigger) return null;
  const content = ctx.content.get();
  if (!content) return trigger;
  return (
    <View tooltip={<AnchorBubble content={content} ctx={ctx} />}>
      {trigger}
    </View>
  );
}

function AnchorBubble(props: {
  content: TooltipContentProps;
  ctx: TooltipContextValue;
}) {
  const { content, ctx } = props;
  return (
    <Bubble
      {...content}
      open={ctx.open()}
      placement={content.placement ?? ctx.placement}
      align={content.align ?? ctx.align}
      offset={content.offset ?? ctx.offset}
      margin={content.margin ?? ctx.margin}
      delay={content.delay ?? ctx.delay}
      disabled={content.disabled ?? ctx.disabled}
      onOpenChange={(event) => {
        ctx.setOpen(event.open, event.reason);
        content.onOpenChange?.(event);
      }}
      onOpen={content.onOpen ?? ctx.onOpen}
      onClose={content.onClose ?? ctx.onClose}
    >
      {content.children}
    </Bubble>
  );
}
