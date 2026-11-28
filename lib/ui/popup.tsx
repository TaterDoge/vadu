// The popup families' one surface and the motion they come in with: menus, popovers, a select's
// list, and the mark of a checkable menu item and the scrim behind what is modal.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { JSX, MotionSpec, StyleProp, ViewStyle } from 'nsh';
import { createMotion, reduceMotion, View } from 'nsh';

import { CheckMark } from './icons';
import {
  colors,
  control,
  metrics,
  motion,
  rounded,
  stroke,
  surface,
  surfaceBorderWidth,
  terminal,
  TERMINAL_COLUMN,
} from './theme';

/**
 * The scrim behind what is modal (a sheet, a dialog, a menu's sheet on a
 * touch screen): the theme's `scrim`, one dimming for every overlay. Pass
 * it as the overlay's `backdropStyle`.
 */
export function backdrop(): ViewStyle {
  return { backgroundColor: colors.scrim };
}

/** The side of its trigger a popup is on. */
export type PopupSide = 'top' | 'bottom' | 'left' | 'right';

/** How far a popup slides out of its trigger's edge as it comes in when the theme preset specifies no offset. */
const ENTER_DISTANCE = 4;

/** The dot of a choice in a menu, and the corners that make it round: 6 points across. */
const DOT = 6;

/**
 * The surface every anchored popup shares (menus, popovers, a select's
 * list): the floating tier, one edge, a soft shadow, the theme's `popup.corner`
 * (its `radius` unless it says otherwise) and 4 points around its rows (Design
 * Guides, "Surfaces and elevation"). A terminal shows it by its line alone: a
 * box there is its line or its fill.
 */
export function popupSurface(): ViewStyle {
  const overlay = surface('overlay');
  return (
    // A terminal draws a popup as its line alone, over no fill of its own.
    terminal
      ? {
          ...rounded(control('popup').corner),
          borderWidth: stroke.hairline,
          padding: POPUP_PAD,
          borderColor: overlay.style.borderColor as string | undefined,
        }
      : {
          ...rounded(control('popup').corner),
          borderWidth: surfaceBorderWidth(
            overlay.style.borderColor as string | undefined,
          ),
          padding: POPUP_PAD,
          ...overlay.style,
        }
  );
}

/**
 * The spacing of a list's rows in a popup or a palette, from the theme in use
 * (`dimension.size.item`): `inset` from the container's edge to a row's fill,
 * `pad` from the fill's edge to its text. A terminal's rows span the frame,
 * their text one Cell in. A trigger whose chosen row lies over it (a select's)
 * sets its text `inset + pad` in, so title lies on title.
 */
export const itemSpacing = {
  get inset(): number {
    return terminal ? 0 : metrics.item.inset;
  },
  get pad(): number {
    return terminal ? TERMINAL_COLUMN : metrics.item.pad;
  },
};

/** The room above and below a full-bleed list's rows (inset 0), so the first and last clear the
 * container's corners: Material 3's `DropdownMenuVerticalPadding`. */
const BLEED_VERTICAL = 8;

/** The least room a popup keeps around its rows: 4 points, which is also the least room a row
 * keeps above and below its own content (`rowVerticalPad`). */
export const POPUP_PAD = 4;

/**
 * The room above and below a row's content, so a row can hold a line under its title
 * (`detail`) without touching the row after it: the theme's `inset` between rows — the same
 * room the list keeps at its edges — and `POPUP_PAD` for a theme that draws its rows
 * full-bleed (Material). A one-line row does not grow by it: the row's least height is the
 * taller of the two.
 */
export function rowVerticalPad(): number {
  return Math.max(itemSpacing.inset, POPUP_PAD);
}

/** A list's container padding around its rows: `inset` on every side, or `BLEED_VERTICAL`
 * above and below a full-bleed list. */
export function listPadding(): ViewStyle {
  const { inset } = itemSpacing;
  return {
    paddingHorizontal: inset,
    paddingVertical: inset === 0 && !terminal ? BLEED_VERTICAL : inset,
  };
}

/** A list row's corners: concentric with its container's (the container's radius less `inset`,
 * at least 2), square when the container is or the row is full-bleed. */
export function itemRadius(): number {
  const { inset } = itemSpacing;
  const corner = control('popup').corner;
  return inset === 0 || corner === 0 ? 0 : Math.max(2, corner - inset);
}

/**
 * Where a popup grows from: the edge that faces its trigger. The keys are `PopupSide`s (the
 * measured side of the trigger on screen), so the sides stay physical.
 *
 * physical: the side is measured from the screen, not the reading direction.
 */
const origins: Record<PopupSide, string> = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left',
};

/**
 * How a popup comes in, driven by the active theme's `popoverEnter` preset (duration, easing,
 * optional spring, and scale) while sliding `distance` points out of its trigger's edge. Reduced
 * motion lands it at once.
 */
function popIn(side: PopupSide = 'bottom', distance?: number): MotionSpec {
  const preset = motion.preset('popoverEnter');
  const resolved =
    distance ?? (preset.fromY !== 0 ? Math.abs(preset.fromY) : ENTER_DISTANCE);
  return motion.enterSpec('popoverEnter', { side, distance: resolved });
}

/**
 * `popIn` on a popup's own box, which `nsh/base` makes on each opening (a `Menu`'s and its
 * submenus', whose surface is that box so it stays put around the items scrolling in it): `style`
 * the theme's `popoverEnter` transition and edge origin, `starting` its first frame's look from
 * the theme's `fromScale` and `distance`. Reduced motion, and a terminal, land it at once.
 */
export function popInStyles(
  side: PopupSide = 'bottom',
  distance?: number,
): { style: ViewStyle; starting?: ViewStyle } {
  if (terminal || reduceMotion()) return { style: {} };
  const preset = motion.preset('popoverEnter');
  const resolved =
    distance ?? (preset.fromY !== 0 ? Math.abs(preset.fromY) : ENTER_DISTANCE);
  const away = side === 'top' || side === 'left' ? resolved : -resolved;
  const slide =
    side === 'top' || side === 'bottom'
      ? { translateY: away }
      : { translateX: away };
  return {
    style: {
      transformOrigin: origins[side],
      ...motion.transition('opacity, transform', preset.role),
    },
    starting: { opacity: 0, transform: [{ scale: preset.fromScale }, slide] },
  };
}

/**
 * A popup's surface that comes in with `popIn` each time it is made: the
 * content of a `Popover`, which makes it on every opening. The look is `class` and `style` (the popup's own box keeps
 * none, so the shadow stays in register with the moving panel); `side` is
 * the trigger's side it opens on.
 */
export function PopIn(props: {
  side?: PopupSide;
  class?: string;
  style?: StyleProp<ViewStyle>;
  children: JSX.Element;
}) {
  const m = createMotion({ enter: popIn(props.side) });
  return (
    <View
      {...surface('overlay').platformProps}
      class={props.class}
      style={[
        props.style ?? null,
        { transformOrigin: origins[props.side ?? 'bottom'], ...m.style },
      ]}
    >
      {props.children}
    </View>
  );
}

/** The indicator part a `MenuMark` goes in: a `group` whose `group-checked:` classes the mark's
 * follow (give the item `indicatorClass={menuIndicator}`). */
export const menuIndicator = 'group';

/**
 * The mark of a checkable menu item, its `indicator`: a check (a setting)
 * or a dot (one choice of a group) in a box before the label, so the labels
 * of a menu stay in line. It shows the value through the indicator part
 * around it, which takes the item's state: give the item
 * `indicatorClass={menuIndicator}` (`group`), and the mark's `group-checked:`
 * classes follow the item. It fades and grows in from 75 % in
 * 150 ms as the item is checked and goes the same way, so moving a group's
 * choice crosses over from one item to the next. Reduced motion shows it at
 * once.
 */
export function MenuMark(props: {
  kind?: 'check' | 'dot';
  tint: string;
  size?: number;
}) {
  const size = () => props.size ?? 16;
  return (
    <View
      class="scale-75 items-center justify-center opacity-0 transition duration-150 ease-out group-checked:scale-100 group-checked:opacity-100 motion-reduce:transition-none"
      style={{ width: size(), height: size() }}
    >
      {props.kind === 'dot' ? (
        <View
          style={{
            width: DOT,
            height: DOT,
            borderRadius: DOT / 2,
            backgroundColor: props.tint,
          }}
        />
      ) : (
        <CheckMark size={size() - 2} weight={2.7} tint={props.tint} />
      )}
    </View>
  );
}
