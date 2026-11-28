// A card dialog: the look (`dialogCard`, `dialogTitle`, `dialogText`) at the top, and the parts that
// wear it below. `nsh/base`'s `Dialog` is the box; what this file adds is its card.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { JSX, Signal, StyleProp, TextStyle, ViewStyle } from 'nsh';
import {
  context,
  platform,
  safeArea,
  Scroll,
  signal,
  split,
  View,
  windowSize,
} from 'nsh';
import {
  Dialog as BaseDialog,
  type DialogChangeReason,
  type DialogProps as BaseDialogProps,
} from 'nsh/base';

import { backdrop } from '../../lib/ui/popup';
import { createOpenState, type OpenState } from '../../lib/ui/state';
import {
  colors,
  font,
  rounded,
  shape,
  stroke,
  surface,
  surfaceBorderWidth,
  terminal,
} from '../../lib/ui/theme';
import { AsText } from '../../lib/ui/utils';
import { Action, type ButtonVariant } from './button';

const pointer = platform.desktop;

/** A card's width where the app gives none: 360 points with a pointer, 320 on a touch screen
 * (upstream's dialog demo, `el-dialog`; never wider than 90% of the window). */
const cardWidth = pointer ? 360 : 320;

/**
 * A dialog shown as a card in the middle of the window, over `backdrop()`:
 * the modal face (`finish.modal`: the card's colour, the border's edge and the
 * floating shadow of a menu), the theme's card radius, 20 points of
 * padding, its rows 12 apart. Given a `width`, it is `nsh/base`'s `Dialog`'s `style` itself:
 * centered, `width` across and never wider than 90% of the window; without
 * one, the look alone, for a view inside the dialog (one that springs in).
 * A terminal draws its edge alone.
 *
 * It is never taller than the window holds inside the safe areas, 24 points
 * clear of either edge (`DialogContent` scrolls its body under that cap): a
 * card that outgrows the window scrolls instead of running off it.
 */
export function dialogCard(width?: number): ViewStyle {
  return {
    ...(width === undefined ? {} : { margin: 'auto', width, maxWidth: '90%' }),
    ...rounded(shape.modal),
    borderWidth: terminal
      ? stroke.hairline
      : surfaceBorderWidth(
          surface('modal').style.borderColor as string | undefined,
        ),
    padding: 20,
    gap: 12,
    maxHeight: windowSize().height - safeArea().top - safeArea().bottom - 48,
    ...(terminal
      ? { borderColor: colors.border }
      : {
          backgroundColor: surface('modal').style.backgroundColor,
          boxShadow: surface('modal').style.boxShadow,
          borderColor: surface('modal').style.borderColor,
        }),
  };
}

/**
 * A dialog that is a page rather than a card in the middle of the window: it fills what the
 * `nsh/base` dialog gives it, over the page's fill, and takes the card's edge, radius, shadow,
 * padding, width and height cap off (it fills the window) — the content is laid out as a page.
 *
 * `DialogContent` wears it for a `presentation` the system presents itself (`fullScreen`,
 * `pageSheet`, `formSheet`), which draws the card there; pass it as `style` for a dialog of the
 * app's own that owns its whole surface on every platform — a lightbox, a full-screen editor.
 */
export function dialogPage(): ViewStyle {
  return {
    flex: 1,
    margin: 0,
    // Over a card's width and height cap, when this is passed as `style` to the card's dialog.
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    gap: 0,
    boxShadow: 'none',
    ...(terminal ? {} : { backgroundColor: colors.background }),
  };
}

/** A card dialog's title (`dialogCard`): 17 points semibold with a pointer, 20 on a touch screen. */
export function dialogTitle(): TextStyle {
  return {
    // No type role has this size: a card dialog's title is 17 / 20.
    fontSize: pointer ? 17 : 20,
    fontWeight: font.weight('title'),
    color: colors.foreground,
  };
}

/** A card dialog's text under its title: 13 points with a pointer, 15 on a touch screen, muted. */
export function dialogText(): TextStyle {
  return {
    fontSize: font.size('body'),
    lineHeight: font.lineHeight('body'),
    color: colors.mutedForeground,
  };
}

/** The root: it owns whether the dialog is open, and nothing of how it looks. */
export type DialogProps = {
  /** Controlled; leave it out and the root keeps the state (`defaultOpen`). */
  open?: boolean | null;
  defaultOpen?: boolean;
  children?: JSX.Element;
  onOpenChange?: (event: { open: boolean; reason: DialogChangeReason }) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
};

/**
 * The card, over the theme's scrim: its body scrolls inside the card's height cap (`dialogCard`)
 * and its footer (`DialogFooter`) stays at its end. `presentation` (iOS and Android) hands the
 * dialog to the system — `fullScreen`, `pageSheet` or `formSheet` — and the card is not worn at all
 * (`dialogPage`), the system's own surface taking its place. Every prop of `nsh/base`'s Dialog
 * passes through but the ones the root owns; `style` and `backdropStyle` go over the look's.
 * `animation` defaults to `fade`, a card's.
 */
export type DialogContentProps = Omit<
  BaseDialogProps,
  'open' | 'onOpenChange' | 'onOpen' | 'onClose' | 'onCancel'
> & {
  /** The card's width, never wider than 90% of the window (default 360 with a pointer, 320 on a touch screen). */
  width?: number;
  /**
   * The body scrolls inside the card's height cap (default), a `DialogFooter` staying at its end.
   * `false` draws the children as given, with no scroll of the shell's — for a body that takes
   * gestures of its own (a lightbox's pinch and pan, an editor's canvas).
   */
  scroll?: boolean;
};

/** What opens the dialog: a string is a `Button`'s label, anything else a pressable of its own. */
export type DialogTriggerProps = {
  children?: string | JSX.Element;
  /** The button's variant, for a string child (default `secondary`). */
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** What closes the dialog: as `DialogTrigger`; `onPress` runs before it closes. */
export type DialogCloseProps = DialogTriggerProps & {
  onPress?: () => void;
};

/** A text part of the card (`DialogTitle`, `DialogDescription`). */
export type DialogTextProps = {
  children?: string | JSX.Element;
  style?: StyleProp<TextStyle>;
};

/** The row of actions at the card's end. */
export type DialogFooterProps = {
  children?: JSX.Element;
  style?: StyleProp<ViewStyle>;
};

type DialogContextValue = OpenState &
  Pick<DialogProps, 'onOpen' | 'onClose' | 'onCancel'> & {
    /** Where `DialogFooter` leaves its row: `DialogContent` draws it under the scrolling body. */
    footer: Signal<JSX.Element | null>;
    setFooter: (node: JSX.Element | null) => void;
  };

const DialogContext = context<DialogContextValue | null>(null);

function useDialog() {
  const ctx = DialogContext();
  if (!ctx) throw new Error('Dialog parts must be used within <Dialog>');
  return ctx;
}

/** The root of a dialog's parts. */
export function Dialog(props: DialogProps) {
  const state = createOpenState<DialogChangeReason>(props);
  const footer = signal<JSX.Element | null>(null);
  return (
    <DialogContext.Provider
      value={{
        ...state,
        footer,
        setFooter: (node) => footer.set(node),
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
    </DialogContext.Provider>
  );
}

/** Opens the dialog. */
export function DialogTrigger(props: DialogTriggerProps) {
  const ctx = useDialog();
  return <Action {...props} onPress={() => ctx.setOpen(true)} />;
}

/** Closes the dialog, after its own `onPress`. */
export function DialogClose(props: DialogCloseProps) {
  const ctx = useDialog();
  return (
    <Action
      {...props}
      onPress={() => {
        props.onPress?.();
        ctx.setOpen(false, 'closePress');
      }}
    />
  );
}

/** The card, over the theme's scrim: its body scrolls under the card's height cap, its footer
 * (`DialogFooter`) stays at its end. A dialog the system presents itself is a page instead
 * (`dialogPage`), and one the app fills the window with passes `dialogPage()` as `style`. */
export function DialogContent(props: DialogContentProps) {
  const ctx = useDialog();
  const [, rest] = split(props, [
    'width',
    'children',
    'style',
    'backdropStyle',
    'animation',
    'presentation',
    'scroll',
  ]);
  const presentation = () => props.presentation;
  // The system presents it itself on a phone or a tablet; anywhere else the presentation is
  // ignored and the card stands.
  const presented = () => presentation() !== undefined && !platform.desktop;
  // Read once, here where the body is drawn; the branch below is the one that draws it.
  const body = props.children;
  return (
    <BaseDialog
      {...rest}
      presentation={presentation()}
      open={ctx.open()}
      animation={props.animation ?? 'fade'}
      onOpenChange={({ open, reason }) => ctx.setOpen(open, reason)}
      onOpen={ctx.onOpen}
      onClose={ctx.onClose}
      onCancel={ctx.onCancel}
      backdropStyle={[backdrop(), props.backdropStyle ?? null]}
      style={[
        presented() ? dialogPage() : dialogCard(props.width ?? cardWidth),
        props.style ?? null,
      ]}
    >
      {props.scroll === false ? (
        <View style={{ flexGrow: 1, flexShrink: 1 }}>{body}</View>
      ) : (
        <Scroll
          style={{ flexGrow: 1, flexShrink: 1 }}
          contentStyle={{ gap: 12 }}
        >
          {body}
        </Scroll>
      )}
      {ctx.footer()}
    </BaseDialog>
  );
}

/** The card's title; a string child takes `dialogTitle`'s type, anything else is drawn as given. */
export function DialogTitle(props: DialogTextProps) {
  return (
    <AsText style={[dialogTitle(), props.style ?? null]}>
      {props.children}
    </AsText>
  );
}

/** The text under the title; a string child takes `dialogText`'s type, anything else as given. */
export function DialogDescription(props: DialogTextProps) {
  return (
    <AsText style={[dialogText(), props.style ?? null]}>
      {props.children}
    </AsText>
  );
}

/**
 * The row of the card's actions, laid out as upstream's dialog demo (`el-dialog`) lays them:
 * 8 points apart, at the trailing edge with a pointer. On a touch screen the demo's buttons
 * share the width: give each `style={{ flex: 1 }}`.
 *
 * It registers with `DialogContent`, which draws it under the scrolling body, so the actions
 * stay where they are while the body scrolls.
 */
export function DialogFooter(props: DialogFooterProps) {
  const ctx = useDialog();
  ctx.setFooter(
    <View
      style={[
        {
          flexDirection: 'row',
          gap: 8,
          paddingTop: 4,
          justifyContent: pointer ? 'flex-end' : undefined,
        },
        props.style ?? null,
      ]}
    >
      {props.children}
    </View>,
  );
  return null;
}
