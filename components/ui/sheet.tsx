// A sheet: the look (`sheetPanel`, `sheetGrabber`) and the parts that wear it.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { JSX, StyleProp, TextStyle, ViewStyle } from 'nsh';
import {
  cleanup,
  context,
  keyboardFrame,
  safeArea,
  signal,
  split,
  View,
  windowSize,
} from 'nsh';
import {
  type OpenChangeReason,
  Sheet as BaseSheet,
  type SheetProps as BaseSheetProps,
} from 'nsh/base';

import { backdrop } from '../../lib/ui/popup';
import { createOpenState, type OpenState } from '../../lib/ui/state';
import {
  alpha,
  colors,
  cornerCurve,
  shape,
  stroke,
  surface,
  surfaceBorderWidth,
  terminal,
} from '../../lib/ui/theme';
import { AsText } from '../../lib/ui/utils';
import { Action, type ButtonVariant } from './button';
import { dialogText, dialogTitle } from './dialog';

/** The edge of the screen a sheet comes from. */
export type SheetSide = 'bottom' | 'top' | 'left' | 'right';

/**
 * A sheet's panel (`nsh/base`'s `Sheet`'s `popupStyle`): the modal surface's
 * face (`surface("modal")`), shadow and edge (only along the inner side facing
 * the screen, never along the screen edge). At the bottom (or the top) it spans
 * the width, its two inner corners on `shape.modal`, 16 points of padding at
 * its sides and its rows 14 apart, kept above the home indicator (the sheet
 * itself stands above the keyboard), and never taller than the screen
 * below the status bar; put `sheetGrabber` first in a bottom one. At the
 * left or the right it is the full height, at most 360 points wide (48
 * short of a narrow window), its inner corners on `shape.modal`, 20
 * points of padding inside the safe area.
 */
export function sheetPanel(side: SheetSide): ViewStyle {
  const modal = surface('modal').style;
  const edge = modal.borderColor;
  const edgeWidth = terminal
    ? stroke.hairline
    : surfaceBorderWidth(typeof edge === 'string' ? edge : undefined);
  const face: ViewStyle = terminal
    ? { borderColor: colors.border }
    : { ...modal };
  if (side === 'bottom' || side === 'top') {
    const bottom = side === 'bottom';
    return {
      ...face,
      ...(bottom
        ? {
            borderTopWidth: edgeWidth,
            borderTopLeftRadius: shape.modal,
            borderTopRightRadius: shape.modal,
            paddingTop: 8,
          }
        : {
            borderBottomWidth: edgeWidth,
            borderBottomLeftRadius: shape.modal,
            borderBottomRightRadius: shape.modal,
            paddingTop: safeArea().top + 16,
            paddingBottom: 20,
          }),
      ...cornerCurve,
      // A bottom sheet stands above the keyboard while a field has it (`Sheet` lifts it by the keyboard past the home
      // indicator): its room is what the keyboard leaves.
      maxHeight:
        windowSize().height -
        (bottom
          ? safeArea().top +
            Math.max(0, keyboardFrame().height - safeArea().bottom)
          : safeArea().bottom) -
        24,
      paddingHorizontal: 16,
      // Above the home indicator, which is behind the keyboard while it is up.
      ...(bottom ? { paddingBottom: safeArea().bottom + 16 } : {}),
      gap: 14,
    };
  }
  return {
    ...face,
    width: Math.min(360, windowSize().width - 48),
    paddingHorizontal: 20,
    paddingTop: safeArea().top + 16,
    paddingBottom: safeArea().bottom + 16,
    gap: 16,
    ...cornerCurve,
    // physical: `side` is the window edge the sheet stands on, so its inner edge (the border and the corners) is physical too.
    ...(side === 'right'
      ? {
          borderLeftWidth: edgeWidth,
          borderTopLeftRadius: shape.modal,
          borderBottomLeftRadius: shape.modal,
        }
      : {
          borderRightWidth: edgeWidth,
          borderTopRightRadius: shape.modal,
          borderBottomRightRadius: shape.modal,
        }),
  };
}

/** The grabber's geometry: one 36×5 pill in every theme, the platforms' common size (M3's drag
 * handle is 32×4; theme contract v2 keeps one grabber rather than a per-theme table). */
const GRABBER_WIDTH = 36;
const GRABBER_HEIGHT = 5;

/** The grabber at the top of a bottom sheet (its `grabberStyle`): a pill centered at the top
 * edge in the muted ink the theme already dims with (`colors.mutedForeground` at 40%), so it
 * reads on the card and on whatever a sheet is dragged over. It is the sheet's own handle — the
 * one `nsh/base` lets a press and a screen reader drag between detents — not a picture of one, so
 * a sheet never shows two. */
export function sheetGrabber(): ViewStyle {
  return {
    width: GRABBER_WIDTH,
    height: GRABBER_HEIGHT,
    borderRadius: Math.ceil(GRABBER_HEIGHT / 2),
    alignSelf: 'center',
    backgroundColor: alpha(colors.mutedForeground, 0.4),
  };
}

/** The root: it owns whether the sheet is open, and nothing of how it looks. */ export type SheetProps =
  {
    /** Controlled; leave it out and the root keeps the state (`defaultOpen`). */
    open?: boolean | null;
    defaultOpen?: boolean;
    children?: JSX.Element;
    onOpenChange?: (event: {
      open: boolean;
      reason: SheetOpenChangeReason;
    }) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onCancel?: () => void;
  };

/**
 * The panel. Every prop of `nsh/base`'s Sheet passes through but the ones the root owns;
 * `popupStyle` and `backdropStyle` go over the look's.
 */
export type SheetContentProps = Omit<
  BaseSheetProps,
  'open' | 'onOpenChange' | 'onOpen' | 'onClose' | 'onCancel'
> & {
  /** The edge it comes from (default `bottom`). */
  side?: SheetSide;
  children?: JSX.Element;
};

/** What opens the sheet: a string is a `Button`'s label, anything else a pressable of its own. */
export type SheetTriggerProps = {
  children?: string | JSX.Element;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** What closes the sheet: as `SheetTrigger`; `onPress` runs before it closes. */
export type SheetCloseProps = SheetTriggerProps & {
  onPress?: () => void;
};

type SheetContextValue = OpenState &
  Pick<SheetProps, 'onOpen' | 'onClose' | 'onCancel'> & {
    /** The title a `SheetTitle` registered, for the dialog's accessible name. */
    title: () => string | null;
    setTitle: (title: string | null) => void;
  };

const SheetContext = context<SheetContextValue | null>(null);

function useSheet() {
  const ctx = SheetContext();
  if (!ctx) throw new Error('Sheet parts must be used within <Sheet>');
  return ctx;
}

/** The root of a sheet's parts. */
export function Sheet(props: SheetProps) {
  const state = createOpenState<OpenChangeReason>(props);
  // A title's text, so the sheet's dialog can be named by it: `SheetTitle` writes it while the
  // panel's children are made, and `SheetContent` reads it for `accessibilityLabel`.
  const title = signal<string | null>(null);
  return (
    <SheetContext.Provider
      value={{
        ...state,
        title,
        setTitle: (next) => title.set(next),
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
    </SheetContext.Provider>
  );
}

/** Opens the sheet. */
export function SheetTrigger(props: SheetTriggerProps) {
  const ctx = useSheet();
  return <Action {...props} onPress={() => ctx.setOpen(true)} />;
}

/** Closes the sheet, after its own `onPress`. */
export function SheetClose(props: SheetCloseProps) {
  const ctx = useSheet();
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

/**
 * The panel that slides in from `side`, over the theme's scrim. A bottom one shows the grabber
 * `nsh/base` gives it (`grabber`, default on), in `sheetGrabber()`'s look; give `grabber={false}`
 * for a sheet the app drags by something of its own.
 */
export function SheetContent(props: SheetContentProps) {
  const ctx = useSheet();
  const [, rest] = split(props, [
    'side',
    'children',
    'popupStyle',
    'backdropStyle',
  ]);
  const side = () => props.side ?? 'bottom';
  cleanup(() => ctx.setTitle(null));
  return (
    <BaseSheet
      {...rest}
      side={side()}
      grabber={props.grabber ?? side() === 'bottom'}
      grabberAccessibilityLabel={props.grabberAccessibilityLabel ?? 'Sheet'}
      grabberStyle={[sheetGrabber(), props.grabberStyle ?? null]}
      accessibilityLabel={props.accessibilityLabel ?? ctx.title() ?? undefined}
      open={ctx.open()}
      onOpenChange={({ open, reason }) => ctx.setOpen(open, reason)}
      onOpen={ctx.onOpen}
      onClose={ctx.onClose}
      onCancel={ctx.onCancel}
      backdropStyle={[backdrop(), props.backdropStyle ?? null]}
      popupStyle={[sheetPanel(side()), props.popupStyle ?? null]}
    >
      {props.children}
    </BaseSheet>
  );
}

/** The heading block of a sheet: a title and its description, 2 points apart. */
export function SheetHeader(props: {
  children?: JSX.Element;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: 2 }, props.style ?? null]}>{props.children}</View>
  );
}

/** The actions of a sheet, in a row 8 points apart. */
export function SheetFooter(props: {
  children?: JSX.Element;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 8 },
        props.style ?? null,
      ]}
    >
      {props.children}
    </View>
  );
}

/**
 * A sheet's title, in `DialogTitle`'s type: 17 points with a pointer, 20 on a touch screen. A
 * string title also names the sheet's dialog for screen readers, unless `SheetContent` has an
 * `accessibilityLabel` of its own.
 */
export function SheetTitle(props: {
  children?: string | JSX.Element;
  style?: StyleProp<TextStyle>;
}) {
  const ctx = useSheet();
  const kids = props.children;
  const text = typeof kids === 'string' ? kids : null;
  if (ctx.title() !== text) ctx.setTitle(text);
  return <AsText style={[dialogTitle(), props.style ?? null]}>{kids}</AsText>;
}

/** A sheet's description, in `DialogDescription`'s type: the body size in the muted ink. */
export function SheetDescription(props: {
  children?: string | JSX.Element;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <AsText style={[dialogText(), props.style ?? null]}>
      {props.children}
    </AsText>
  );
}

/** Why a sheet closed (`onOpenChange`'s `reason`): `nsh/base`'s `OpenChangeReason`, under this part's name. */
export type SheetOpenChangeReason = OpenChangeReason;
