// A sidebar: an app's navigation column beside its page — folded to a strip of icons, sliding in as
// a sheet on a phone — the look (`sidebarLook` and the looks of its parts) and the parts that wear
// it, on `nsh`'s own View and Text.

import { PanelLeft } from 'lucide';
import type { JSX, StyleProp, TextStyle, ViewProps, ViewStyle } from 'nsh';
import {
  context,
  effect,
  keymap,
  platform,
  reduceMotion,
  safeArea,
  Scroll,
  signal,
  split,
  untracked,
  View,
  windowSize,
} from 'nsh';
import {
  Button as BaseButton,
  type ButtonProps as BaseButtonProps,
} from 'nsh/base';

import { IconLabel } from '../../lib/ui/icons';
import { pressSink, pressTransition } from '../../lib/ui/motion';
import { controlSize, narrowWindow } from '../../lib/ui/surface';
import {
  alpha,
  colors,
  controlHeight,
  feedback,
  font,
  iconSize,
  rounded,
  shape,
  stroke,
  surface,
  terminal,
} from '../../lib/ui/theme';
import { AsText, type Live, read } from '../../lib/ui/utils';
import { IconButton, iconButtonGlyph, type IconButtonProps } from './button';
import { Input, type InputProps } from './input';
import { Separator, type SeparatorProps } from './separator';
import { Sheet, SheetContent } from './sheet';
import { Skeleton } from './skeleton';
import {
  Tooltip,
  TooltipContent,
  type TooltipContentProps,
  TooltipTrigger,
} from './tooltip';

/** The rail line's width: 2 points. */
const RAIL_LINE = 2;

/**
 * A sidebar's measurements, in points, after shadcn/ui's: 256 across (`16rem`), 48 folded to its
 * icons (`3rem`), 288 in a phone's sheet (`18rem`); 8 of room around a floating or inset column, 8
 * inside a header, a footer or a group, 4 between menu rows; a group's label 32 high; an action and
 * a badge 20 square; the rail 8 wide inside the column's edge (16 with its hit slop); a sub menu 14
 * in from the row above it. The column's frame, not a control's: the only row here is `folded`, and
 * it is the theme's row height.
 */
export const sidebarSize = {
  width: 256,
  icon: 48,
  mobile: 288,
  frame: 8,
  padding: 8,
  gap: 8,
  menuGap: 4,
  label: 32,
  /** The square a row takes folded to its icon: a row's height, without its label. */
  get folded() {
    return controlSize.row;
  },
  action: 20,
  badge: 20,
  rail: 8,
  sub: 14,
  subPadding: 10,
} as const;

/** Which edge the column stands on. */
export type SidebarSide = 'left' | 'right';

/**
 * How the column meets the page: `sidebar` its own edge against the page, `floating` a card
 * standing in the window's air, `inset` the page's card beside it on the window's own ground.
 */
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';

/**
 * What it does when it closes: `offcanvas` leaves the window, `icon` folds to a strip of icons,
 * `none` never closes.
 */
export type SidebarCollapsible = 'offcanvas' | 'icon' | 'none';

/** Whether the column is open or folded, as `useSidebar()` reports it. */
export type SidebarState = 'expanded' | 'collapsed';

/** Why the sidebar opened or closed (`onOpenChange`'s `reason`). */
export type SidebarOpenChangeReason = 'triggerPress' | 'railPress' | 'shortcut';

/** A row's height: the theme's height scale, `default` the row itself and `sm` the step under it;
 * `lg` is a team switcher's row, taller than the scale where the row is a pointer's. */
export type SidebarMenuButtonSize = 'sm' | 'default' | 'lg';

/** A row's look: `default` bare until the pointer is over it, `outline` a card of its own on the
 * column. */
export type SidebarMenuButtonVariant = 'default' | 'outline';

/** A sub menu row's height: `sm` is a step under `default` (shadcn's `md` is this `default`). */
export type SidebarMenuSubButtonSize = 'sm' | 'default';

/**
 * What a row keeps room for on its trailing edge: an action's square (`"action"`), a badge's pill
 * (`"badge"`), or both — the action steps in by the badge's width, so the two stand side by side
 * instead of on top of each other.
 */
export type SidebarMenuTrailing = 'action' | 'badge' | 'both';

/** A team switcher's row stands a step over the height scale, which stops at the row: shadcn's
 * `h-12`, 48 points with a pointer (a touch screen's row is already a finger's height). */
const TEAM_ROW = 48;

/** A row's height by size: `default` the theme's row (`controlSize.row`), `sm` the height step
 * under it, `lg` a team switcher's row. */
const rowHeight: Record<SidebarMenuButtonSize, number> = {
  get sm() {
    return controlHeight.md;
  },
  get default() {
    return controlSize.row;
  },
  get lg() {
    return Math.max(controlSize.row, TEAM_ROW);
  },
};

/** A row's label size by size: the theme's `body` type role, a step under and over it. */
const rowLabel: Record<SidebarMenuButtonSize, number> = {
  get sm() {
    return font.size('detail');
  },
  get default() {
    return font.size('body');
  },
  get lg() {
    return font.size('label');
  },
};

/** A sub menu row's height by size: the two steps under the row, `controlHeight.sm` and `.md`. */
const subRowHeight: Record<SidebarMenuSubButtonSize, number> = {
  get sm() {
    return controlHeight.sm;
  },
  get default() {
    return controlHeight.md;
  },
};

/** A sub menu row's label by size: `detail` and `body`. */
const subRowLabel: Record<SidebarMenuSubButtonSize, number> = {
  get sm() {
    return font.size('detail');
  },
  get default() {
    return font.size('body');
  },
};

/** A row's icon: the theme's middle icon (`iconSize.md`). */
const rowIcon = () => iconSize.md;

/** The room a row keeps for a part on its trailing edge: an action's (32, shadcn's `pr-8`), a
 * badge's (24), and both together (52). The frame's room, off the height scale. */
const actionRoom = 32;
const badgeRoom = 24;
const bothRoom = 52;

/** The room a row keeps for an action, a badge, or both. */
const trailingRoom = (trailing: SidebarMenuTrailing | null | undefined) =>
  trailing === 'action'
    ? actionRoom
    : trailing === 'badge'
      ? badgeRoom
      : trailing === 'both'
        ? bothRoom
        : sidebarSize.padding;

/** Whether a badge stands at the row's trailing edge, so an action steps in past it. */
const hasBadge = (trailing: SidebarMenuTrailing | null | undefined) =>
  trailing === 'badge' || trailing === 'both';

/** How far in from a row's edge its trailing parts stand: 4 points. */
const trailingInset = 4;

/** How far in a row's action stands with a badge beside it: past the edge room and the badge. */
const actionPastBadge = trailingInset + sidebarSize.badge + trailingInset;

/** What an item holds beside its row: the room the row keeps, and where the action stands. */
const trailingOf = (holds: {
  action: boolean;
  badge: boolean;
}): SidebarMenuTrailing | null =>
  holds.action && holds.badge
    ? 'both'
    : holds.action
      ? 'action'
      : holds.badge
        ? 'badge'
        : null;

/**
 * What a part of a sidebar reads to know how it stands: the column's axes and whether it is open.
 * A part that steps aside when the column folds to its icons takes these, and nothing else of the
 * column's.
 */
export interface SidebarFoldOptions {
  /** Which edge the column is on (default `left`). */
  side?: Live<SidebarSide>;
  /** What the column does when it closes (default `offcanvas`). */
  collapsible?: Live<SidebarCollapsible>;
  /** Open (the provider's state; default closed). */
  open?: Live<boolean>;
  /** A phone or a narrow window: the column is a sheet, always open (default false). */
  isMobile?: Live<boolean>;
}

/**
 * Whether a look draws the folded column: closed on an `icon` column, on a window that shows it (a
 * phone's slide-in shows the whole column, so it never folds).
 */
const folded = (o?: SidebarFoldOptions) =>
  !read(o?.open) &&
  (read(o?.collapsible) ?? 'offcanvas') === 'icon' &&
  !read(o?.isMobile);

/** What the column's own look takes: the axes it wears and the provider's state. */
export interface SidebarLookOptions extends SidebarFoldOptions {
  /** How it meets the page (default `sidebar`). */
  variant?: Live<SidebarVariant>;
  /** Width while expanded. */
  width?: Live<number | undefined>;
  /** Width while folded to icons. */
  collapsedWidth?: Live<number | undefined>;
}

/** The frame's parts as the styles they wear: spread each one on the view it names. */
export interface SidebarLook {
  /** What the provider lays out: the ground the column and the page stand on (the sidebar's fill
   * for an inset column, whose gutters come from it), and the column and the page side by side —
   * the column on the right edge when `side` is `right`. */
  readonly root: ViewStyle;
  /** The column's box in the row: its width, and the room a floating or an inset column keeps
   * around its card. */
  readonly frame: ViewStyle;
  /** The column's surface: the sidebar's fill, its edge, and for a floating one its corners and
   * shadow. Clips what it holds. */
  readonly column: ViewStyle;
  /** The page's box: the page's own fill, and for an inset page a card with its corners. */
  readonly inset: ViewStyle;
  /** The rail: a strip down the column's inner edge that takes a press. */
  readonly rail: ViewStyle;
  /** The line down the rail's middle, in the sidebar's edge color while the pointer is on it: as
   * wide as the theme's selection line. */
  readonly railLine: ViewStyle;
  /** The column's header (`SidebarHeader`): a stack of rows at its top. */
  readonly header: ViewStyle;
  /** The column's footer (`SidebarFooter`): a stack of rows at its bottom. */
  readonly footer: ViewStyle;
  /** The scrolling part between them (`SidebarContent`'s scroll view). */
  readonly content: ViewStyle;
  /** What the scroll view holds: a column of groups a gap apart. */
  readonly contentRows: ViewStyle;
  /** The separator under a header (`SidebarSeparator`'s own style): the sidebar's edge, inset from
   * both sides. */
  readonly separator: ViewStyle;
}

/** How much room a floating or inset column keeps around its card. */
const frameRoom = (variant: SidebarVariant) =>
  variant === 'sidebar' ? 0 : sidebarSize.frame;

/** The width a column takes: open, folded to its icons, or off the window. */
const columnWidth = (
  open: boolean,
  collapsible: SidebarCollapsible,
  variant: SidebarVariant,
  width: number | undefined,
  collapsedWidth: number | undefined,
) => {
  const room = 2 * frameRoom(variant);
  if (collapsible === 'none' || open)
    return (width ?? sidebarSize.width) + room;
  return collapsible === 'icon'
    ? (collapsedWidth ?? sidebarSize.icon) + room
    : 0;
};

// The fold takes the room away at once: the platform transitions colors, opacity, transforms and
// rotations, not layout (`width` is refused as a `transitionProperty`), and a native layout
// animation belongs to a control that reveals content (a `Collapsible`), not to a column's width.
// shadcn's 200 ms width transition has nothing to land on here, so `motion-reduce` has nothing to
// switch off either.

/**
 * A sidebar's look, after shadcn/ui's: a 256-point column (48 folded to its icons) on the sidebar's
 * fill with its edge; the page beside it, a card in the inset variant; a rail down the column's
 * inner edge. Colors are read here, so the look follows the appearance and the theme.
 */
export function sidebarLook(o?: SidebarLookOptions): SidebarLook {
  const side = () => read(o?.side) ?? 'left';
  const variant = () => read(o?.variant) ?? 'sidebar';
  const collapsible = () => read(o?.collapsible) ?? 'offcanvas';
  const open = () => !!read(o?.open);
  const mobile = () => !!read(o?.isMobile);
  const width = () => read(o?.width);
  const collapsedWidth = () => read(o?.collapsedWidth);
  const aside = () => variant() !== 'sidebar';
  const card = () => variant() === 'inset' && !mobile();
  /** Off the window: closed, with the offcanvas collapsible. */
  const off = () => !open() && collapsible() === 'offcanvas';
  return {
    get root(): ViewStyle {
      return {
        flex: 1,
        minWidth: 0,
        flexDirection: side() === 'right' ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        backgroundColor:
          card() || variant() === 'inset'
            ? colors.background
            : colors.background,
      };
    },
    get frame(): ViewStyle {
      return {
        boxSizing: 'border-box',
        position: 'relative',
        flexShrink: 0,
        width: columnWidth(
          open() || mobile(),
          collapsible(),
          variant(),
          width(),
          collapsedWidth(),
        ),
        padding: off() ? 0 : frameRoom(variant()),
      };
    },
    get column(): ViewStyle {
      const flat = !aside();
      return {
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: colors.background,
        borderColor: colors.line,
        ...(flat
          ? // physical: the column's side is the window edge it stands on; the edge that faces the page keeps the hairline in either direction.
            side() === 'left'
            ? { borderRightWidth: stroke.hairline }
            : { borderLeftWidth: stroke.hairline }
          : {
              borderWidth: stroke.hairline,
              ...rounded(shape.container),
              boxShadow: surface('card').style.boxShadow,
            }),
      };
    },
    get inset(): ViewStyle {
      return {
        boxSizing: 'border-box',
        flex: 1,
        minWidth: 0,
        flexDirection: 'column',
        backgroundColor: colors.background,
        ...(card()
          ? {
              margin: sidebarSize.frame,
              // physical: the frame's air goes on the page-facing side, whichever window edge the column stands on.
              ...(side() === 'left' ? { marginLeft: 0 } : { marginRight: 0 }),
              borderWidth: stroke.hairline,
              borderColor: colors.line,
              ...rounded(shape.container),
              boxShadow: surface('card').style.boxShadow,
              overflow: 'hidden',
            }
          : {}),
      };
    },
    get rail(): ViewStyle {
      return {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: sidebarSize.rail,
        zIndex: 20,
        alignItems: 'center',
        cursor: side() === 'left' ? 'e-resize' : 'w-resize',
        // physical: the rail is the drag edge between the column and the page, on the column's inner side.
        ...(side() === 'left' ? { right: 0 } : { left: 0 }),
      };
    },
    get railLine(): ViewStyle {
      return {
        width: RAIL_LINE,
        height: '100%',
        borderRadius: 1,
        backgroundColor: colors.line,
        ...(reduceMotion()
          ? {}
          : { transitionProperty: 'opacity', transitionDuration: 150 }),
      };
    },
    get header(): ViewStyle {
      return {
        flexDirection: 'column',
        flexShrink: 0,
        gap: sidebarSize.gap,
        padding: sidebarSize.padding,
      };
    },
    get footer(): ViewStyle {
      return {
        flexDirection: 'column',
        flexShrink: 0,
        gap: sidebarSize.gap,
        padding: sidebarSize.padding,
      };
    },
    get content(): ViewStyle {
      return { flex: 1, minHeight: 0 };
    },
    get contentRows(): ViewStyle {
      return { flexDirection: 'column', gap: sidebarSize.gap };
    },
    get separator(): ViewStyle {
      return {
        marginHorizontal: sidebarSize.padding,
        width: 'auto',
        backgroundColor: colors.line,
      };
    },
  };
}

/**
 * A group's look, after shadcn/ui's: 8 points of room around a label 32 high and the rows under it;
 * folded to icons, the label takes no room and draws nothing (a screen reader still reads it).
 * Colors as `sidebarLook`'s.
 */
export function sidebarGroupLook(o?: SidebarFoldOptions) {
  return {
    get group(): ViewStyle {
      return {
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        padding: sidebarSize.padding,
      };
    },
    get labelBox(): ViewStyle {
      // Every property is here in both states: a property that appears only on the fold is a
      // property the platform has not been told to apply (it is added to the style, and the
      // element keeps what it had).
      return {
        height: folded(o) ? 0 : sidebarSize.label,
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        paddingHorizontal: sidebarSize.padding,
        gap: 8,
        ...rounded(shape.control),
        opacity: folded(o) ? 0 : 1,
        overflow: 'hidden',
      };
    },
    get label(): TextStyle {
      return {
        fontSize: font.size('detail'),
        fontWeight: font.weight('label'),
        color: alpha(colors.foreground, 0.7),
        numberOfLines: 1,
        flexShrink: 1,
      };
    },
    get action(): ViewStyle {
      return {
        position: 'absolute',
        top: sidebarSize.padding + 6,
        end: sidebarSize.padding + 4,
        width: sidebarSize.action,
        height: sidebarSize.action,
        alignItems: 'center',
        justifyContent: 'center',
        ...rounded(shape.control),
        display: folded(o) ? 'none' : 'flex',
      };
    },
    get actionHover(): ViewStyle {
      return { backgroundColor: colors.accent };
    },
    get content(): ViewStyle {
      return { width: '100%', flexDirection: 'column' };
    },
  };
}

/** A menu row's options: the column as it stands, and the row's own axes. */
export interface SidebarMenuButtonLookOptions extends SidebarFoldOptions {
  /** Default `default`: the theme's row (`controlSize.row`). */
  size?: Live<SidebarMenuButtonSize | undefined>;
  /** Default `default`: bare until the pointer is over it. `outline` is a card of its own. */
  variant?: Live<SidebarMenuButtonVariant | undefined>;
  /** The page the app is on: the chosen fill under it, its ink and its icon the text's. */
  active?: Live<boolean>;
  /** No presses, no hover, 50%. */
  disabled?: Live<boolean>;
  /** Room the row keeps on its right for what the item holds: an action or a badge. */
  trailing?: Live<SidebarMenuTrailing | null | undefined>;
}

/**
 * A menu row's look, after shadcn/ui's: a row as wide as the group, 8 points in, its icon 16 and
 * its name small, the theme's control corners; under the pointer the theme's hover, on the page the
 * app is on the `sidebarAccent` fill with the name medium, the keyboard's ring while it is there,
 * the press's sink, 50% while disabled. Folded to icons (a closed `icon` column on a window that
 * shows it) the row is a 32-point square with its icon alone: its name is still there for a screen
 * reader, clipped to nothing.
 */
export function sidebarMenuButtonLook(o?: SidebarMenuButtonLookOptions) {
  const size = () => read(o?.size) ?? 'default';
  const active = () => !!read(o?.active);
  const disabled = () => !!read(o?.disabled);
  return {
    get style(): ViewStyle {
      const isFolded = folded(o);
      return {
        boxSizing: 'border-box',
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        justifyContent: isFolded ? 'center' : 'flex-start',
        gap: isFolded ? 0 : sidebarSize.gap,
        ...(isFolded
          ? { width: sidebarSize.folded, height: sidebarSize.folded }
          : { width: '100%', height: rowHeight[size()] }),
        overflow: 'hidden',
        ...rounded(shape.control),
        paddingHorizontal: isFolded ? 0 : sidebarSize.padding,
        paddingEnd: isFolded ? 0 : trailingRoom(read(o?.trailing)),
        ...(read(o?.variant) === 'outline'
          ? {
              backgroundColor: colors.background,
              borderWidth: stroke.hairline,
              borderColor: colors.line,
            }
          : {}),
        // The selected row's fill.
        ...(active() ? { backgroundColor: colors.accent } : {}),
        ...pressTransition('background-color'),
      };
    },
    get hoverStyle(): ViewStyle | undefined {
      if (disabled() || active()) return undefined;
      return feedback.hoverStyle();
    },
    get activeStyle(): ViewStyle | undefined {
      if (disabled()) return undefined;
      if (feedback.pressOverlay > 0) {
        return {
          ...feedback.press('surface').activeStyle,
          ...pressSink(0.98).activeStyle,
        };
      }
      return pressSink(0.98).activeStyle;
    },
    get focusVisibleStyle(): ViewStyle {
      return feedback.focusRing();
    },
    get disabledStyle(): ViewStyle {
      return { opacity: feedback.disabled.contentOpacity };
    },
    /** Its name: `rowLabel`'s size, medium on the page the app is on, one line, the text clipped
     * when the column is folded. */
    get label(): TextStyle {
      return {
        fontSize: rowLabel[size()],
        fontWeight: active() ? font.weight('label') : font.weight('body'),
        color: colors.foreground,
        numberOfLines: 1,
        flexShrink: 1,
        ...(folded(o) ? { display: 'none' } : {}),
      };
    },
    /** A row's leading icon: the theme's middle icon, the muted ink — the text's on the page the
     * app is on. */
    get glyph(): { size: number; tint: string } {
      return {
        size: rowIcon(),
        tint: active() ? colors.foreground : colors.mutedForeground,
      };
    },
  };
}

/** A row's action's options: what the row keeps room for, over the column's own axes. */
export interface SidebarMenuActionLookOptions extends SidebarFoldOptions {
  /** What the row keeps room for (default nothing): past a badge, the action steps in by its
   * width, so the two stand side by side. */
  trailing?: Live<SidebarMenuTrailing | null | undefined>;
}

/**
 * A row's action's look (`SidebarMenuAction`): a 20-point square at the row's trailing edge, in the
 * sidebar's edge corners, over whatever the row draws — 24 points further in while a badge stands
 * there. Colors as `sidebarLook`'s.
 */
export function sidebarMenuActionLook(o?: SidebarMenuActionLookOptions) {
  return {
    get style(): ViewStyle {
      return {
        position: 'absolute',
        top: '50%',
        translate: '0 -50%',
        width: sidebarSize.action,
        height: sidebarSize.action,
        alignItems: 'center',
        justifyContent: 'center',
        ...rounded(shape.control),
        end: hasBadge(read(o?.trailing)) ? actionPastBadge : trailingInset,
        display: folded(o) ? 'none' : 'flex',
      };
    },
    get hoverStyle(): ViewStyle {
      return { backgroundColor: colors.accent };
    },
    get focusVisibleStyle(): ViewStyle {
      return feedback.focusRing();
    },
    /** Its glyph: 16 points in the muted ink. */
    get glyph(): { size: number; tint: string } {
      return { size: rowIcon(), tint: colors.mutedForeground };
    },
  };
}

/**
 * A row's badge's look (`SidebarMenuBadge`): a pill at least 20 points high and wide at the row's
 * trailing edge, its numbers tabular, the text's ink. Colors as `sidebarLook`'s.
 */
export function sidebarMenuBadgeLook(o?: SidebarFoldOptions) {
  return {
    get style(): ViewStyle {
      return {
        position: 'absolute',
        top: '50%',
        translate: '0 -50%',
        height: sidebarSize.badge,
        minWidth: sidebarSize.badge,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        ...rounded(shape.control),
        end: trailingInset,
        display: folded(o) ? 'none' : 'flex',
      };
    },
    /** Its type: 12 points medium (13 on a touch screen), the text's ink, the numbers tabular. */
    get text(): TextStyle {
      return {
        fontSize: font.size('detail'),
        fontWeight: font.weight('label'),
        color: colors.foreground,
        fontVariant: 'tabular-nums',
        numberOfLines: 1,
      };
    },
  };
}

/**
 * A sub menu's look (`SidebarMenuSub` and the rows in it): a column 14 points in from the row above
 * it, a hairline down its start in the sidebar's edge, its rows a gap apart. Colors as
 * `sidebarLook`'s.
 */
export function sidebarMenuSubLook(o?: SidebarFoldOptions) {
  return {
    get sub(): ViewStyle {
      return {
        marginStart: sidebarSize.sub,
        borderStartWidth: stroke.hairline,
        borderColor: colors.line,
        paddingStart: sidebarSize.subPadding,
        paddingVertical: 2,
        gap: sidebarSize.menuGap,
        flexDirection: 'column',
        minWidth: 0,
        display: folded(o) ? 'none' : 'flex',
      };
    },
    get item(): ViewStyle {
      return { position: 'relative' };
    },
  };
}

/** A sub menu row's options. */
export interface SidebarMenuSubButtonLookOptions extends SidebarFoldOptions {
  /** Default `default`: the height step under the row (`controlHeight.md`). */
  size?: Live<SidebarMenuSubButtonSize | undefined>;
  /** The page the app is on: the chosen fill under it. */
  active?: Live<boolean>;
  /** No presses, no hover, 50%. */
  disabled?: Live<boolean>;
}

/**
 * A sub menu row's look, after shadcn/ui's: a row as wide as the sub menu, 8 points in, its name
 * small; the pointer's hover, the chosen fill on the page the app is on, the keyboard's ring, the
 * press's sink, 50% while disabled.
 */
export function sidebarMenuSubButtonLook(o?: SidebarMenuSubButtonLookOptions) {
  const size = () => read(o?.size) ?? 'default';
  const active = () => !!read(o?.active);
  const disabled = () => !!read(o?.disabled);
  return {
    get style(): ViewStyle {
      return {
        boxSizing: 'border-box',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: sidebarSize.gap,
        width: '100%',
        height: subRowHeight[size()],
        paddingHorizontal: sidebarSize.padding,
        overflow: 'hidden',
        ...rounded(shape.control),
        ...(active() ? { backgroundColor: colors.accent } : {}),
        ...pressTransition('background-color'),
      };
    },
    get hoverStyle(): ViewStyle | undefined {
      if (disabled() || active()) return undefined;
      return feedback.hoverStyle();
    },
    get activeStyle(): ViewStyle | undefined {
      if (disabled()) return undefined;
      if (feedback.pressOverlay > 0) {
        return {
          ...feedback.press('surface').activeStyle,
          ...pressSink(0.98).activeStyle,
        };
      }
      return pressSink(0.98).activeStyle;
    },
    get focusVisibleStyle(): ViewStyle {
      return feedback.focusRing();
    },
    get disabledStyle(): ViewStyle {
      return { opacity: feedback.disabled.contentOpacity };
    },
    /** Its name: `subRowLabel`'s size, one line, the text clipped by a tight row. */
    get label(): TextStyle {
      return {
        fontSize: subRowLabel[size()],
        fontWeight: active() ? font.weight('label') : font.weight('body'),
        color: colors.foreground,
        numberOfLines: 1,
        flexShrink: 1,
      };
    },
  };
}

/**
 * A loading row's look (`SidebarMenuSkeleton`): a row the height of a row 8 points in, an icon's box and
 * a line of text in the skeleton's breathing blocks. Colors as `sidebarLook`'s.
 */
export function sidebarMenuSkeletonLook() {
  return {
    get row(): ViewStyle {
      return {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sidebarSize.gap,
        height: rowHeight.default,
        paddingHorizontal: sidebarSize.padding,
      };
    },
    get icon(): ViewStyle {
      return { width: rowIcon(), height: rowIcon() };
    },
    /** The line of text: as tall as its type, `width` of the row across. */
    get text(): ViewStyle {
      return { height: 16, flexGrow: 1 };
    },
  };
}

/** A sidebar's search field's look (`SidebarInput`): as tall as a row, on the page's fill rather
 * than a field's, so it reads as the page's own search. Colors as `sidebarLook`'s. */
export function sidebarInputLook(o?: SidebarFoldOptions) {
  return {
    get style(): ViewStyle {
      return {
        height: rowHeight.default,
        width: '100%',
        backgroundColor: colors.background,
        boxShadow: 'none',
        display: folded(o) ? 'none' : 'flex',
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The provider: the open state every part reads.
// ---------------------------------------------------------------------------------------------

/** What `Sidebar` publishes for the parts and the page beside it: its axes. */
type SidebarAxes = {
  side: SidebarSide;
  variant: SidebarVariant;
  collapsible: SidebarCollapsible;
};

/** The axes before a `Sidebar` is in the tree: a plain column on the left. */
const noAxes: SidebarAxes = {
  side: 'left',
  variant: 'sidebar',
  collapsible: 'offcanvas',
};

type SidebarContextValue = {
  /** The axes the `Sidebar` in the tree published. */
  axes: () => SidebarAxes;
  /** Publish them (the `Sidebar` does, where it draws). */
  setAxes: (next: SidebarAxes) => void;
  /** Whether the open state is open. */
  open: () => boolean;
  /** Ask for it open or closed, saying why it changed. */
  setOpen: (next: boolean, reason?: SidebarOpenChangeReason) => void;
  /** Whether the phone's sheet is showing. */
  openMobile: () => boolean;
  /** Ask for the sheet open or closed. */
  setOpenMobile: (next: boolean) => void;
  /** A phone or a narrow window: the column is a sheet. */
  isMobile: () => boolean;
  /** Ask for the other state: the sheet's on a phone, the column's otherwise. */
  toggle: (reason?: SidebarOpenChangeReason) => void;
  /** `"expanded"` while open (`"collapsed"` otherwise). */
  state: () => SidebarState;
};

const SidebarContext = context<SidebarContextValue | null>(null);

function useSidebarContext() {
  const ctx = SidebarContext();
  if (!ctx)
    throw new Error('Sidebar parts must be used within <SidebarProvider>');
  return ctx;
}

/**
 * What the parts of a sidebar read: its state, the sheet's, and whether the window shows a sheet at
 * all. Every value is live — in a JSX binding it follows the provider.
 */
export interface SidebarApi {
  /** `"expanded"` or `"collapsed"`, following the open state. */
  readonly state: SidebarState;
  /** The column is open. */
  readonly open: boolean;
  /** The phone's sheet is showing. */
  readonly openMobile: boolean;
  /** A phone or a narrow window: the column is a sheet, and the trigger opens that. */
  readonly isMobile: boolean;
  /** Ask for the column open or closed; on a phone that is the sheet's state. */
  setOpen: (next: boolean) => void;
  /** Ask for the phone's sheet open or closed. */
  setOpenMobile: (next: boolean) => void;
  /** Ask for the other state: the sheet's on a phone, the column's otherwise. */
  toggleSidebar: () => void;
}

/** What a sidebar's parts read: its state (`useSidebar()`), or the axes it wears. */
export function useSidebar(): SidebarApi {
  const ctx = useSidebarContext();
  return {
    get state() {
      return ctx.state();
    },
    get open() {
      return ctx.open();
    },
    get openMobile() {
      return ctx.openMobile();
    },
    get isMobile() {
      return ctx.isMobile();
    },
    setOpen(next: boolean) {
      ctx.setOpen(next);
    },
    setOpenMobile(next: boolean) {
      ctx.setOpenMobile(next);
    },
    toggleSidebar() {
      ctx.toggle();
    },
  };
}

/**
 * The axes the `Sidebar` published, and the provider's state, for a part that folds with it. Each is
 * a reader, not a value: a part spreads these into its look's options, and a spread copies a value
 * once (the axes the column published by then, `offcanvas` before it had published any) — the fold
 * would then never reach the part.
 */
function useFoldOptions(): SidebarFoldOptions {
  const ctx = useSidebarContext();
  return {
    side: () => ctx.axes().side,
    collapsible: () => ctx.axes().collapsible,
    open: ctx.open,
    isMobile: ctx.isMobile,
  };
}

/**
 * Whether the column is folded to its icons: `folded`, read from the provider's state rather than
 * from options a part is handed.
 */
function useFolded(): () => boolean {
  const ctx = useSidebarContext();
  return () =>
    folded({
      open: ctx.open,
      collapsible: () => ctx.axes().collapsible,
      isMobile: ctx.isMobile,
    });
}

/**
 * Whether a part is drawn now: a part that goes when the column folds to its icons hands this to
 * `<If>`, which reads it again as the column folds. A style cannot say it — a style written where
 * the part renders is the one it keeps, and the array a shell merges its look into is merged then.
 */
function useShown(): () => boolean {
  const iconOnly = useFolded();
  return () => !iconOnly();
}

/** The same fold options, for the column itself and the page beside it: every axis it wears. The
 * axes are readers for the same reason they are in `useFoldOptions`. */
function useLookOptions(): SidebarLookOptions {
  const ctx = useSidebarContext();
  return {
    side: () => ctx.axes().side,
    variant: () => ctx.axes().variant,
    collapsible: () => ctx.axes().collapsible,
    open: ctx.open,
    isMobile: ctx.isMobile,
  };
}

/** Icon sidebars keep their column on desktop, including narrow windows. */
const showsSheet = (collapsible: SidebarCollapsible) =>
  !terminal &&
  (!platform.desktop || (collapsible !== 'icon' && narrowWindow()));

/** What a phone's sheet leaves showing of the page beside it: 48 points. */
const sheetMargin = 48;

/** The root: it owns whether the column is open, the phone's sheet's state, and ⌘B / Ctrl+B. */
export type SidebarProviderProps = ViewProps & {
  /** Open at first, while `open` is not set (default true). */
  defaultOpen?: boolean;
  /** Open (controlled); leave it out and the provider keeps the state. */
  open?: boolean;
  /**
   * The state changed. This is where an app keeps it — the provider writes nothing down (no cookie:
   * store it here, in the app's own storage, and pass it back as `open`).
   */
  onOpenChange?: (event: {
    open: boolean;
    reason: SidebarOpenChangeReason;
  }) => void;
};

/**
 * A sidebar and the page beside it, after shadcn/ui's: the provider lays the two out side by side,
 * owns the open state ⌘B / Ctrl+B and the trigger ask for, and gives every part `useSidebar()`. On
 * a touch screen, or a narrow desktop window with an offcanvas sidebar, the column is a sheet.
 * Desktop icon sidebars always keep their column.
 */
export function SidebarProvider(props: SidebarProviderProps) {
  const [, rest] = split(props, [
    'defaultOpen',
    'open',
    'onOpenChange',
    'style',
    'children',
  ]);
  const own = signal(props.defaultOpen ?? true);
  const sheet = signal(false);
  const axes = signal<SidebarAxes>(noAxes);
  const isMobile = () => showsSheet(axes().collapsible);
  const open = () => (props.open !== undefined ? props.open : own());
  const setOpen = (
    next: boolean,
    reason: SidebarOpenChangeReason = 'triggerPress',
  ) => {
    if (props.open === undefined) own.set(next);
    props.onOpenChange?.({ open: next, reason });
  };
  const setOpenMobile = (next: boolean) => sheet.set(next);
  const toggle = (reason: SidebarOpenChangeReason = 'triggerPress') => {
    if (isMobile()) sheet.set(!sheet());
    else setOpen(!open(), reason);
  };
  // The ground the column and the page stand on (the sidebar's fill for an inset column, which is
  // where that variant's gutters come from): read from the axes the `Sidebar` publishes, so it
  // follows the variant the app switches to. Read where it is worn, not into a value here: the axes
  // arrive after the parts below have drawn once.
  const look = sidebarLook({
    side: () => axes().side,
    variant: () => axes().variant,
  });
  // 固定侧栏没有折叠动作，不占用应用快捷键。
  effect(() => {
    if (axes().collapsible !== 'none')
      return keymap.bind('mod+b', () => toggle('shortcut'));
  });
  return (
    <SidebarContext.Provider
      value={{
        axes: () => axes(),
        setAxes: (next) => axes.set(next),
        open,
        setOpen,
        openMobile: () => sheet(),
        setOpenMobile,
        isMobile,
        toggle,
        state: () => (open() ? 'expanded' : 'collapsed'),
      }}
    >
      <View {...rest} style={[look.root, props.style ?? null]}>
        {props.children}
      </View>
    </SidebarContext.Provider>
  );
}

// ---------------------------------------------------------------------------------------------
// The column: its axes, and the three windows it draws in.
// ---------------------------------------------------------------------------------------------

/** The column's props: its axes, and every `nsh` view prop (which reach the column's box). */
export type SidebarProps = ViewProps & {
  /** Which edge it stands on (default `left`). */
  side?: SidebarSide;
  /** How it meets the page (default `sidebar`). */
  variant?: SidebarVariant;
  /** What it does when it closes (default `offcanvas`). */
  collapsible?: SidebarCollapsible;
  /** Expanded width. */
  width?: number;
  /** Folded icon-only width. */
  collapsedWidth?: number;
};

/**
 * The column: a header, its groups and a footer in a box as wide as the sidebar, on the sidebar's
 * fill. Closing it takes the room away — a width of none, or of the strip its icons need, at once:
 * the platform transitions colors, opacity and transforms, not layout. On a phone, or in a narrow
 * desktop window with `offcanvas`, it is a sheet. A `collapsible="none"` column stays open.
 *
 * Its `style` and other view props reach the column's box — the sheet's column on a phone.
 */
export function Sidebar(props: SidebarProps) {
  const ctx = useSidebarContext();
  const [, rest] = split(props, [
    'side',
    'variant',
    'collapsible',
    'width',
    'collapsedWidth',
    'style',
    'children',
  ]);
  // The axes the parts read: published here, kept live for the parts that draw outside this file's
  // own tree (the page beside the column) when the app changes one. Written only where a value
  // changes: the axes are an object, and an equal one would still wake every part that reads them.
  effect(() => {
    const next: SidebarAxes = {
      side: props.side ?? 'left',
      variant: props.variant ?? 'sidebar',
      collapsible: props.collapsible ?? 'offcanvas',
    };
    const now = untracked(() => ctx.axes());
    if (
      next.side === now.side &&
      next.variant === now.variant &&
      next.collapsible === now.collapsible
    ) {
      return;
    }
    ctx.setAxes(next);
  });
  const look = sidebarLook({
    ...useLookOptions(),
    width: () => props.width,
    collapsedWidth: () => props.collapsedWidth,
  });
  const fixed = () => props.collapsible === 'none';
  const column = () => (
    <View style={look.frame}>
      <View {...rest} style={[look.column, props.style ?? null]}>
        {props.children}
      </View>
    </View>
  );
  return (
    <If when={!fixed() && ctx.isMobile()} else={column()}>
      <Sheet
        open={ctx.openMobile()}
        onOpenChange={({ open: next }) => ctx.setOpenMobile(next)}
      >
        <SheetContent
          side={ctx.axes().side}
          popupStyle={[
            {
              boxSizing: 'border-box',
              width: Math.min(
                sidebarSize.mobile,
                windowSize().width - sheetMargin,
              ),
              height: '100%',
              paddingHorizontal: 0,
              paddingTop: safeArea().top,
              paddingBottom: safeArea().bottom,
              gap: 0,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              backgroundColor: colors.background,
              borderColor: colors.line,
            },
          ]}
        >
          <View
            {...rest}
            style={[look.column, { flex: 1 }, props.style ?? null]}
          >
            {props.children}
          </View>
        </SheetContent>
      </Sheet>
    </If>
  );
}

/** A `Sidebar`'s header: a stack of rows at the top of the column. Every `nsh` view prop passes
 * through; `style` goes over the look's. */
export type SidebarHeaderProps = ViewProps;

/** The top of the column: a team switcher, a title, a search field. */
export function SidebarHeader(props: SidebarHeaderProps) {
  const [, rest] = split(props, ['style']);
  const look = sidebarLook(useLookOptions());
  return (
    <View {...rest} style={[look.header, props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** A `Sidebar`'s footer: a stack of rows at the bottom of the column. Every `nsh` view prop passes
 * through; `style` goes over the look's. */
export type SidebarFooterProps = ViewProps;

/** The bottom of the column: the user's row, a help link. */
export function SidebarFooter(props: SidebarFooterProps) {
  const [, rest] = split(props, ['style']);
  const look = sidebarLook(useLookOptions());
  return (
    <View {...rest} style={[look.footer, props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** A `Sidebar`'s scrolling middle: the groups, scrolling when they do not fit. Every `nsh` view
 * prop passes through; `style` goes over the look's. */
export type SidebarContentProps = Omit<ViewProps, 'ref'>;

/** The groups between the header and the footer, scrolling when they do not fit. */
export function SidebarContent(props: SidebarContentProps) {
  const [, rest] = split(props, ['style', 'children']);
  const look = sidebarLook(useLookOptions());
  return (
    <Scroll {...rest} style={[look.content, props.style ?? null]}>
      <View style={look.contentRows}>{props.children}</View>
    </Scroll>
  );
}

/** A separator between a header and the content, inset from both sides. Every `nsh` separator prop
 * passes through; `style` goes over the look's. */
export type SidebarSeparatorProps = SeparatorProps;

/** The sidebar's own separator: the sidebar's edge color, a gap either side. */
export function SidebarSeparator(props: SidebarSeparatorProps) {
  const [, rest] = split(props, ['style']);
  const look = sidebarLook(useLookOptions());
  return <Separator {...rest} style={[look.separator, props.style ?? null]} />;
}

// ---------------------------------------------------------------------------------------------
// Groups: a label, an action, and the rows under it.
// ---------------------------------------------------------------------------------------------

/** A group's props. Every `nsh` view prop passes through; `style` goes over the look's. */
export type SidebarGroupProps = ViewProps;

/** A titled group of rows, 8 points of room around it. */
export function SidebarGroup(props: SidebarGroupProps) {
  const [, rest] = split(props, ['style']);
  const look = sidebarGroupLook(useFoldOptions());
  return (
    <View {...rest} style={[look.group, props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** A group's label's props: a string is its name, anything else is drawn as given. Every `nsh` view
 * prop passes through; `style` goes over the look's. */
export type SidebarGroupLabelProps = Omit<ViewProps, 'children'> & {
  children?: string | JSX.Element;
};

/**
 * A group's name: 32 points high, small and quiet, 8 points in. Folded to icons it takes no room
 * and draws nothing — and stays in the tree, so a screen reader still reads it.
 */
export function SidebarGroupLabel(props: SidebarGroupLabelProps) {
  const [, rest] = split(props, ['children', 'style']);
  const look = sidebarGroupLook(useFoldOptions());
  return (
    <View {...rest} style={[look.labelBox, props.style ?? null]}>
      <AsText style={look.label}>{props.children}</AsText>
    </View>
  );
}

/** A group's action: a small square at its top right that takes a press. */
export type SidebarGroupActionProps = Omit<BaseButtonProps, 'children'> & {
  children?: string | JSX.Element;
  /** Over the look's, not instead of it. */
  style?: StyleProp<ViewStyle>;
};

/**
 * A group's action — a search, a settings — at the top right of its label: a 20-point square, the
 * pointer's fill under it, the keyboard's ring. An icon alone has no name of its own: give it an
 * `accessibilityLabel`.
 */
export function SidebarGroupAction(props: SidebarGroupActionProps) {
  const [, rest] = split(props, [
    'children',
    'disabled',
    'style',
    'hoverStyle',
    'activeStyle',
    'focusVisibleStyle',
    'disabledStyle',
  ]);
  const look = sidebarGroupLook(useFoldOptions());
  const shown = useShown();
  return (
    <If when={shown()}>
      <BaseButton
        {...rest}
        disabled={props.disabled}
        style={[look.action, props.style ?? null]}
        hoverStyle={[look.actionHover, props.hoverStyle ?? null]}
        activeStyle={props.activeStyle ?? null}
        focusVisibleStyle={[
          feedback.focusRing(),
          props.focusVisibleStyle ?? null,
        ]}
        disabledStyle={[
          { opacity: feedback.disabled.contentOpacity },
          props.disabledStyle ?? null,
        ]}
      >
        <AsText style={look.label}>{props.children}</AsText>
      </BaseButton>
    </If>
  );
}

/** What a group holds. Every `nsh` view prop passes through; `style` goes over the look's. */
export type SidebarGroupContentProps = ViewProps;

/** A group's rows, as wide as the group. */
export function SidebarGroupContent(props: SidebarGroupContentProps) {
  const [, rest] = split(props, ['style']);
  const look = sidebarGroupLook(useFoldOptions());
  return (
    <View {...rest} style={[look.content, props.style ?? null]}>
      {props.children}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// The menu: rows, the actions and badges that sit on them, and the sub menus under them.
// ---------------------------------------------------------------------------------------------

/** A list of rows (`SidebarMenu`): a column of them 4 points apart. Every `nsh` view prop passes
 * through; `style` goes over the look's. */
export type SidebarMenuProps = ViewProps;

/** The rows of a group: a gap apart, as wide as the group. */
export function SidebarMenu(props: SidebarMenuProps) {
  const [, rest] = split(props, ['style', 'children']);
  return (
    <View
      {...rest}
      role="list"
      style={[
        {
          flexDirection: 'column',
          width: '100%',
          minWidth: 0,
          gap: sidebarSize.menuGap,
        },
        props.style ?? null,
      ]}
    >
      {props.children}
    </View>
  );
}

type SidebarItemContextValue = {
  /** What the item holds beside its row (an action, a badge): the room the row keeps for it. */
  trailing: () => SidebarMenuTrailing | null;
  /** Say what it holds (the action and the badge do, where they draw). */
  hold: (what: 'action' | 'badge') => void;
};

const SidebarItemContext = context<SidebarItemContextValue | null>(null);

/** One row of a menu, and what stands beside it: a sub menu, an action, a badge. Every `nsh` view
 * prop passes through; `style` goes over the look's. */
export type SidebarMenuItemProps = ViewProps;

/**
 * A row's box: the button, the action and the badge that stand on it (they place themselves against
 * this box), and a sub menu under it.
 */
export function SidebarMenuItem(props: SidebarMenuItemProps) {
  const [, rest] = split(props, ['style', 'children']);
  const holds = signal({ action: false, badge: false });
  return (
    <SidebarItemContext.Provider
      value={{
        trailing: () => trailingOf(holds()),
        hold: (what) => holds.set({ ...holds(), [what]: true }),
      }}
    >
      <View {...rest} style={[{ position: 'relative' }, props.style ?? null]}>
        {props.children}
      </View>
    </SidebarItemContext.Provider>
  );
}

/** A row's tooltip: a string is its name, or the tooltip's own props with the name in `children`. */
export type SidebarMenuButtonTooltip =
  | string
  | (Omit<TooltipContentProps, 'children'> & {
      children?: string | JSX.Element;
    });

/**
 * A menu row's props: an `nsh/base` button's (presses, `disabled`, `tooltip`'s own placement,
 * `onPress`) plus its axes. Its name is what it draws: a string child is a text of it, and
 * anything else (an icon and a `Text`) is drawn as given.
 */
export type SidebarMenuButtonProps = Omit<
  BaseButtonProps,
  'children' | 'selected' | 'accessibilityLabel' | 'tooltip'
> & {
  /** The page the app is on: the chosen fill under it. */
  isActive?: boolean;
  /** Default `default`: the theme's row (`controlSize.row`). */
  size?: SidebarMenuButtonSize;
  /** Default `default`: bare until the pointer is over it. `outline` is a card of its own. */
  variant?: SidebarMenuButtonVariant;
  /**
   * The name it shows when the column is folded to its icons — `nsh/base`'s element `tooltip` is
   * this: a string is the name, an object is the tooltip's own props (`placement`, `delay`, …).
   * Folded, it is also the row's name for screen readers when nothing else names it (usually the
   * case: an icon and a `Text` name nothing).
   */
  tooltip?: SidebarMenuButtonTooltip;
  /** A string child is a text of the row; an icon and a `Text` are drawn as given. */
  children?: string | JSX.Element;
  /** What screen readers say; a row that draws no text takes its tooltip's words. */
  accessibilityLabel?: string | null;
};

/** A row's name when it draws no text: its tooltip's words, a row folded to icons taking none. */
function tooltipName(props: SidebarMenuButtonProps): string | undefined {
  const tooltip = props.tooltip;
  if (typeof tooltip === 'string') return tooltip;
  return typeof tooltip?.children === 'string' ? tooltip.children : undefined;
}

/**
 * A row of the sidebar's menu: an icon and a name, the height of the theme's row, the
 * pointer's fill under it, the chosen fill on the page the app is on. It takes a press (`onPress`)
 * or is a row of its own; folded to icons it is a square with its icon, and its `tooltip` names it
 * on the desktops.
 */
export function SidebarMenuButton(props: SidebarMenuButtonProps) {
  const item = SidebarItemContext();
  const iconOnly = useFolded();
  const [, rest] = split(props, [
    'isActive',
    'size',
    'variant',
    'tooltip',
    'children',
    'disabled',
    'accessibilityLabel',
    'style',
    'hoverStyle',
    'activeStyle',
    'focusVisibleStyle',
    'disabledStyle',
  ]);
  const look = sidebarMenuButtonLook({
    ...useFoldOptions(),
    size: () => props.size,
    variant: () => props.variant,
    active: () => !!props.isActive,
    disabled: () => !!props.disabled,
    trailing: item ? item.trailing : () => null,
  });
  // Read once, where the row is made: a string child is its label, and the row's name is its
  // `accessibilityLabel`, else the texts it draws (a string child is one), else — a row folded to
  // icons draws no text — its tooltip's words.
  const kids = props.children;
  const row = (
    <BaseButton
      {...rest}
      disabled={props.disabled}
      selected={props.isActive}
      accessibilityLabel={
        props.accessibilityLabel !== undefined
          ? props.accessibilityLabel
          : typeof kids === 'string'
            ? undefined
            : tooltipName(props)
      }
      style={[look.style, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look.activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    >
      <AsText style={look.label}>{kids}</AsText>
    </BaseButton>
  );
  const tip = props.tooltip;
  if (tip === undefined) return row;
  const bubble = typeof tip === 'string' ? { children: tip } : tip;
  return (
    <Tooltip disabled={!iconOnly()} delay={0}>
      <TooltipTrigger>{row}</TooltipTrigger>
      <TooltipContent placement="right" align="center" offset={8} {...bubble} />
    </Tooltip>
  );
}

/** A row's action: a small square at its trailing edge that takes a press. */
export type SidebarMenuActionProps = Omit<
  BaseButtonProps,
  'children' | 'role'
> & {
  children?: string | JSX.Element;
  accessibilityLabel?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * The action of a row — the "more" of a project, a delete — at its trailing edge: a 20-point square
 * the row keeps room for, the pointer's fill under it, the keyboard's ring. An icon alone names
 * nothing: give it an `accessibilityLabel`.
 */
export function SidebarMenuAction(props: SidebarMenuActionProps) {
  const item = SidebarItemContext();
  // The row keeps the room this action needs: the button draws after this says what it holds.
  item?.hold('action');
  const [, rest] = split(props, [
    'children',
    'disabled',
    'style',
    'hoverStyle',
    'activeStyle',
    'focusVisibleStyle',
    'disabledStyle',
  ]);
  const look = sidebarMenuActionLook({
    ...useFoldOptions(),
    trailing: item ? item.trailing : () => null,
  });
  const shown = useShown();
  return (
    <If when={shown()}>
      <BaseButton
        {...rest}
        disabled={props.disabled}
        style={[look.style, props.style ?? null]}
        hoverStyle={[look.hoverStyle, props.hoverStyle ?? null]}
        activeStyle={props.activeStyle ?? null}
        focusVisibleStyle={[
          look.focusVisibleStyle,
          props.focusVisibleStyle ?? null,
        ]}
        disabledStyle={[
          { opacity: feedback.disabled.contentOpacity },
          props.disabledStyle ?? null,
        ]}
      >
        <AsText style={{ fontSize: look.glyph.size, color: look.glyph.tint }}>
          {props.children}
        </AsText>
      </BaseButton>
    </If>
  );
}

/** A badge on a row's trailing edge: a count, a short word. Every `nsh` view prop passes through;
 * `style` goes over the look's. */
export type SidebarMenuBadgeProps = Omit<ViewProps, 'children'> & {
  children?: string | JSX.Element;
};

/**
 * A number or a short word on a row's trailing edge — how many runs are going, what is new: a pill
 * at least 20 points wide, its numbers tabular, the text's ink. It takes no presses.
 */
export function SidebarMenuBadge(props: SidebarMenuBadgeProps) {
  const item = SidebarItemContext();
  // The row keeps the room this badge needs.
  item?.hold('badge');
  const shown = useShown();
  const [, rest] = split(props, ['children', 'style']);
  const look = sidebarMenuBadgeLook(useFoldOptions());
  return (
    <If when={shown()}>
      <View
        {...rest}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[look.style, props.style ?? null]}
      >
        <AsText style={look.text}>{props.children}</AsText>
      </View>
    </If>
  );
}

/** A loading row: an icon's box and a line of text, breathing. */
export type SidebarMenuSkeletonProps = Omit<ViewProps, 'children'> & {
  /** An icon's box before the line (default false). */
  showIcon?: boolean;
  /**
   * How much of the row the line takes, as a percentage — 70 by default, shadcn's upper end. shadcn
   * makes a length up between 50 and 90 so a group of rows looks uneven; a page that has to be the
   * same every run (a screenshot comparison, a demo) says one, and so does a variation of it.
   */
  width?: number;
};

/** A row that is still coming: the skeleton's blocks where an icon and a name will be. */
export function SidebarMenuSkeleton(props: SidebarMenuSkeletonProps) {
  const [, rest] = split(props, ['showIcon', 'width', 'style']);
  // One length for every row: a length made up per mount is a picture that changes between runs.
  const width = `${props.width ?? 70}%` as `${number}%`;
  const look = sidebarMenuSkeletonLook();
  return (
    <View {...rest} style={[look.row, props.style ?? null]}>
      <If when={!!props.showIcon}>
        <Skeleton style={look.icon} />
      </If>
      <Skeleton style={[look.text, { maxWidth: width }]} />
    </View>
  );
}

/** A sub menu: the rows under a row that opens them. Every `nsh` view prop passes through; `style`
 * goes over the look's. */
export type SidebarMenuSubProps = ViewProps;

/** The rows under a row that opens them: a hairline down the start, 14 points in. */
export function SidebarMenuSub(props: SidebarMenuSubProps) {
  const [, rest] = split(props, ['style']);
  const look = sidebarMenuSubLook(useFoldOptions());
  const shown = useShown();
  return (
    <If when={shown()}>
      <View role="list" {...rest} style={[look.sub, props.style ?? null]}>
        {props.children}
      </View>
    </If>
  );
}

/** One row of a sub menu. Every `nsh` view prop passes through; `style` goes over the look's. */
export type SidebarMenuSubItemProps = ViewProps;

/** A sub menu's row's box. */
export function SidebarMenuSubItem(props: SidebarMenuSubItemProps) {
  const [, rest] = split(props, ['style']);
  const look = sidebarMenuSubLook(useFoldOptions());
  return (
    <View {...rest} style={[look.item, props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** A sub menu row: a name, the height step under the row. */
export type SidebarMenuSubButtonProps = Omit<
  BaseButtonProps,
  'children' | 'selected' | 'role' | 'accessibilityLabel'
> & {
  /** The page the app is on: the chosen fill under it. */
  isActive?: boolean;
  /** Default `default`: the height step under the row; `sm` a step under that. */
  size?: SidebarMenuSubButtonSize;
  children?: string | JSX.Element;
  accessibilityLabel?: string | null;
};

/**
 * A row of a sub menu: a name small and quiet, the chosen fill when the app is on that page, the
 * pointer's fill under it. It takes a press, as `SidebarMenuButton` does.
 */
export function SidebarMenuSubButton(props: SidebarMenuSubButtonProps) {
  const [, rest] = split(props, [
    'isActive',
    'size',
    'children',
    'disabled',
    'style',
    'hoverStyle',
    'activeStyle',
    'focusVisibleStyle',
    'disabledStyle',
  ]);
  const look = sidebarMenuSubButtonLook({
    ...useFoldOptions(),
    size: () => props.size,
    active: () => !!props.isActive,
    disabled: () => !!props.disabled,
  });
  return (
    <BaseButton
      {...rest}
      disabled={props.disabled}
      style={[look.style, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look.activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    >
      <AsText style={look.label}>{props.children}</AsText>
    </BaseButton>
  );
}

// ---------------------------------------------------------------------------------------------
// The page beside the column, the trigger, the rail and the search field.
// ---------------------------------------------------------------------------------------------

/** The page beside the column. Every `nsh` view prop passes through; `style` goes over the look's. */
export type SidebarInsetProps = ViewProps;

/**
 * The page beside the column, filling what is left of the window: the page's own fill, or — in the
 * `inset` variant — a card standing on the sidebar's ground, 8 points from the column's card and
 * from the window's edges.
 */
export function SidebarInset(props: SidebarInsetProps) {
  const [, rest] = split(props, ['style']);
  const look = sidebarLook(useLookOptions());
  return (
    <View {...rest} style={[look.inset, props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** The trigger: an icon button that opens and closes the column (the sheet, on a phone). */
export type SidebarTriggerProps = Omit<
  IconButtonProps,
  'children' | 'accessibilityLabel'
> & {
  /** Its icon, instead of the panel's (a `PanelLeft`). */
  children?: JSX.Element;
  /** What screen readers say. Default `"Toggle Sidebar"`. */
  accessibilityLabel?: string;
};

/**
 * The trigger: a 28-point square (40 on a touch screen) with a panel's icon, bare until the pointer
 * is over it. It closes the column when it is open and opens it when it is closed — the sheet on a
 * phone — and reports the press through `onOpenChange` as `"triggerPress"`.
 */
export function SidebarTrigger(props: SidebarTriggerProps) {
  const ctx = useSidebarContext();
  const [, rest] = split(props, ['children', 'accessibilityLabel', 'onPress']);
  const variant = props.variant ?? 'ghost';
  return (
    <IconButton
      {...rest}
      variant={variant}
      accessibilityLabel={props.accessibilityLabel ?? 'Toggle Sidebar'}
      onPress={() => {
        props.onPress?.();
        ctx.toggle('triggerPress');
      }}
    >
      {props.children ?? (
        <IconLabel
          label="Menu"
          icon={PanelLeft}
          {...iconButtonGlyph({ variant, size: () => props.size })}
        />
      )}
    </IconButton>
  );
}

/** The rail: a strip down the column's inner edge that takes a press. */
export type SidebarRailProps = {
  /** What screen readers say. Default `"Toggle Sidebar"`. */
  accessibilityLabel?: string;
};

/**
 * The rail: a strip 8 points wide down the column's inner edge (16 wide to a press, `hitSlop` past
 * it), a hairline in the sidebar's edge color while the pointer is on it. A press closes the column
 * or opens it; the keyboard stays on `SidebarTrigger`, so the rail is out of its order.
 */
export function SidebarRail(props: SidebarRailProps) {
  const ctx = useSidebarContext();
  const look = sidebarLook(useLookOptions());
  return (
    <If when={!ctx.isMobile() && ctx.axes().collapsible !== 'none'}>
      <View
        accessible
        role="group"
        accessibilityLabel={props.accessibilityLabel ?? 'Toggle Sidebar'}
        focusable={false}
        hitSlop={{ left: sidebarSize.rail, right: sidebarSize.rail }}
        onPress={() => ctx.toggle('railPress')}
        class="group"
        style={look.rail}
      >
        {/* The hairline's hover is the pointer's, which the class language tracks on the platform's
            own compositor: a signal here would commit a frame on every pass of the cursor. */}
        <View class="opacity-0 group-hover:opacity-100" style={look.railLine} />
      </View>
    </If>
  );
}

/** The search field a column often holds: `Input` as tall as a row, on the page's fill. */
export type SidebarInputProps = InputProps;

/** A search field for the column: `nsh/base`'s Input as `Input` styles it, as tall as a row and on
 * the page's fill rather than a field's. */
export function SidebarInput(props: SidebarInputProps) {
  const look = sidebarInputLook(useFoldOptions());
  const shown = useShown();
  return (
    <If when={shown()}>
      <Input {...props} style={[look.style, props.style ?? null]} />
    </If>
  );
}
