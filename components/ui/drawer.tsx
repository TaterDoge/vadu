// A drawer: a sheet from the bottom edge, its grabber wide at the top, closed by a swipe, holding a
// card's header, footer, title and description. The panel is `sheet.tsx`'s (`sheetPanel`); the title
// and text are `dialog.tsx`'s (`dialogTitle`, `dialogText`).

import type { JSX, StyleProp, TextStyle, ViewStyle } from 'nsh';
import { context, split, View } from 'nsh';
import {
  type OpenChangeReason,
  Sheet as BaseSheet,
  type SheetProps as BaseSheetProps,
} from 'nsh/base';

import { backdrop } from '../../lib/ui/popup';
import { createOpenState, type OpenState } from '../../lib/ui/state';
import { alpha, colors, rounded } from '../../lib/ui/theme';
import { AsText } from '../../lib/ui/utils';
import { Action, type ButtonVariant } from './button';
import { dialogText, dialogTitle } from './dialog';
import { sheetPanel, type SheetSide } from './sheet';

/**
 * The pill at the top of a bottom drawer (a view's `style`): 100 by 8 points, fully round, in
 * `mutedForeground` at 35% so it reads cleanly on any tonal or elevated modal surface — wider and
 * heavier than a sheet's grabber, since a drawer is dragged from it. Spread it on a view of your
 * own when the app draws the drawer from the look.
 */
export function drawerGrabber(): ViewStyle {
  return {
    width: 100,
    height: 8,
    ...rounded(4),
    alignSelf: 'center',
    backgroundColor: alpha(colors.mutedForeground, 0.35),
  };
}

/**
 * The block holding a drawer's title and description, inside the panel's padding: a column, 2 points
 * apart, each part as wide as the drawer (shadcn's `gap-0.5`).
 */
export function drawerHeader(): ViewStyle {
  return { gap: 2 };
}

/**
 * The block holding a drawer's actions, inside the panel's padding: a column, 8 points apart, each
 * action as wide as the drawer — a drawer's actions stack, so a finger reaches the one under another
 * (shadcn's footer).
 */
export function drawerFooter(): ViewStyle {
  return { gap: 8, paddingTop: 4 };
}

/** Why a drawer closed (`onOpenChange`'s `reason`): `nsh/base`'s `OpenChangeReason`, under this part's name. */
export type DrawerOpenChangeReason = OpenChangeReason;

/** The root: it owns whether the drawer is open, and nothing of how it looks. */
export type DrawerProps = {
  /** Controlled; leave it out and the root keeps the state (`defaultOpen`). */
  open?: boolean | null;
  defaultOpen?: boolean;
  children?: JSX.Element;
  onOpenChange?: (event: {
    open: boolean;
    reason: DrawerOpenChangeReason;
  }) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
};

/**
 * The panel. Every prop of `nsh/base`'s Sheet passes through but the ones the root owns;
 * `popupStyle` and `backdropStyle` go over the look's. Defaults: `side` `"bottom"` and
 * `closeOnSwipe` on (a drawer closes when it is dragged down, a sheet does not), so a drawer on a
 * phone is dismissed the way a bottom panel is.
 */
export type DrawerContentProps = Omit<
  BaseSheetProps,
  'open' | 'onOpenChange' | 'onOpen' | 'onClose' | 'onCancel'
> & {
  /** The edge it comes from (default `"bottom"`). The grabber shows at the bottom one alone. */
  side?: SheetSide;
  children?: JSX.Element;
};

/** What opens the drawer: a string is a `Button`'s label, anything else a pressable of its own. */
export type DrawerTriggerProps = {
  children?: string | JSX.Element;
  /** The button's variant, for a string child (default `secondary`). */
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** What closes the drawer: as `DrawerTrigger`; `onPress` runs before it closes. */
export type DrawerCloseProps = DrawerTriggerProps & {
  onPress?: () => void;
};

/** The block of a drawer's heading: its title and its description. */
export type DrawerHeaderProps = {
  children?: JSX.Element;
  style?: StyleProp<ViewStyle>;
};

/** The block of a drawer's actions, a column as wide as the drawer. */
export type DrawerFooterProps = {
  children?: JSX.Element;
  style?: StyleProp<ViewStyle>;
};

/** A drawer's title text. */
export type DrawerTitleProps = {
  children?: string | JSX.Element;
  style?: StyleProp<TextStyle>;
};

/** A drawer's description, the line under its title. */
export type DrawerDescriptionProps = DrawerTitleProps;

type DrawerContextValue = OpenState &
  Pick<DrawerProps, 'onOpen' | 'onClose' | 'onCancel'>;

const DrawerContext = context<DrawerContextValue | null>(null);

function useDrawer() {
  const ctx = DrawerContext();
  if (!ctx) throw new Error('Drawer parts must be used within <Drawer>');
  return ctx;
}

/** The root of a drawer's parts. */
export function Drawer(props: DrawerProps) {
  const state = createOpenState<OpenChangeReason>(props);
  return (
    <DrawerContext.Provider
      value={{
        ...state,
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
    </DrawerContext.Provider>
  );
}

/** Opens the drawer. */
export function DrawerTrigger(props: DrawerTriggerProps) {
  const ctx = useDrawer();
  return <Action {...props} onPress={() => ctx.setOpen(true)} />;
}

/** Closes the drawer, after its own `onPress`. */
export function DrawerClose(props: DrawerCloseProps) {
  const ctx = useDrawer();
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

/** The panel that slides in from `side`, over the theme's scrim, a grabber at its top edge. */
export function DrawerContent(props: DrawerContentProps) {
  const ctx = useDrawer();
  const [, rest] = split(props, [
    'side',
    'children',
    'popupStyle',
    'backdropStyle',
    'closeOnSwipe',
  ]);
  const side = () => props.side ?? 'bottom';
  return (
    <BaseSheet
      {...rest}
      side={side()}
      open={ctx.open()}
      closeOnSwipe={props.closeOnSwipe ?? true}
      onOpenChange={({ open, reason }) => ctx.setOpen(open, reason)}
      onOpen={ctx.onOpen}
      onClose={ctx.onClose}
      onCancel={ctx.onCancel}
      backdropStyle={[backdrop(), props.backdropStyle ?? null]}
      popupStyle={[sheetPanel(side()), props.popupStyle ?? null]}
    >
      {side() === 'bottom' ? <View style={drawerGrabber()} /> : null}
      {props.children}
    </BaseSheet>
  );
}

/** The heading block of the panel: its title and its description. */
export function DrawerHeader(props: DrawerHeaderProps) {
  return (
    <View style={[drawerHeader(), props.style ?? null]}>{props.children}</View>
  );
}

/** The actions of the panel, one under the other, each as wide as the drawer. */
export function DrawerFooter(props: DrawerFooterProps) {
  return (
    <View style={[drawerFooter(), props.style ?? null]}>{props.children}</View>
  );
}

/** The drawer's title; a string child takes `dialogTitle`'s type, anything else is drawn as given. */
export function DrawerTitle(props: DrawerTitleProps) {
  return (
    <AsText style={[dialogTitle(), props.style ?? null]}>
      {props.children}
    </AsText>
  );
}

/** The drawer's description; a string child takes `dialogText`'s type, the muted line under the title. */
export function DrawerDescription(props: DrawerDescriptionProps) {
  return (
    <AsText style={[dialogText(), props.style ?? null]}>
      {props.children}
    </AsText>
  );
}
