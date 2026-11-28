// A button: the look (`buttonLook` and its companions) and the `Button` that wears it.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { IconNode } from 'lucide';
import type { JSX, StyleProp, TextStyle, ViewProps, ViewStyle } from 'nsh';
import {
  context,
  createAnimatedValue,
  effect,
  platform,
  reduceMotion,
  signal,
  split,
  token,
  View,
} from 'nsh';
import {
  Button as BaseButton,
  type ButtonProps as BaseButtonProps,
} from 'nsh/base';

import { Icon, IconLabel } from '../../lib/ui/icons';
import { pressTransition, touchSlop } from '../../lib/ui/motion';
import {
  alpha,
  animate,
  buttonCorner,
  colors,
  control,
  controlHeight,
  feedback,
  focusRing,
  font,
  iconSize,
  motion,
  rounded,
  stroke,
  surface,
  terminal,
  TERMINAL_COLUMN,
  TERMINAL_ROW,
  tints,
} from '../../lib/ui/theme';
import type { AnyColorKey } from '../../lib/ui/theme';
import { AsText, type Live, read } from '../../lib/ui/utils';
import { Spinner } from './spinner';

/**
 * The resting fill of a ghost control: none, bare until the pointer is over
 * it; in the terminal, which shows no hover until the pointer is there and no
 * outline to hint at one, a faint `secondary` band, so it reads as pressable.
 */
const ghostFill = () => (terminal ? token('secondary') : 'transparent');

/**
 * `default`: the citrus fill, the one main action of a decision area.
 * `secondary`: a raised neutral, the ordinary visible action. `outline`:
 * bare with a `border` edge and no shadow, a quiet secondary action.
 * `ghost`: bare until the pointer is over it, a quiet toolbar or inline
 * action. `destructive`: a destructive action, the danger tone's tint,
 * edge and text, as quiet as `secondary`. shadcn's `link` is not a look
 * of this library yet, so it is not a value here.
 */
export type ButtonVariant =
  'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';

/** A button's size: 24 / 28 / 34 points with a pointer, 36 / 40 / 48 on a touch screen. */
export type ButtonSize = 'sm' | 'default' | 'lg';

/** Options of `buttonLook`, `buttonLabel` and `buttonGlyph` (the same object for all three). */
export interface ButtonLookOptions {
  /** Default `default`. */
  size?: Live<ButtonSize | undefined>;
  /** Shown as chosen: what it opens is open (a menu's or a popover's
   * trigger), or it is the current one of a few. A raised button takes the
   * `on` fill, a ghost the neutral `accent` fill, a filled one its
   * pressed shade; no hover while selected. */
  selected?: Live<boolean | undefined>;
  /** No hover and no press feedback; dimmed to half (`disabledStyle`, shadcn's). */
  disabled?: Live<boolean | undefined>;
  /** Work started by it is going on: no hover and no press feedback, not dimmed. */
  busy?: Live<boolean | undefined>;
  /** Actively pressed down (managed by `Button` / `SplitButtonSegment` so pressed ink stays reactive). */
  pressed?: Live<boolean | undefined>;
  /** More style (a flex, a width, a margin), over the look's. */
  style?: Live<ViewStyle | undefined>;
}

/** The sizes of a size: the height, the label's and the icon's size, the horizontal padding. */
export interface ButtonDimensions {
  height: number;
  font: number;
  icon: number;
  pad: number;
}

const pointer = platform.desktop;

/**
 * A button's heights, label and icon sizes and paddings, by size: compact with a pointer, roomier
 * on a touch screen. The height is the theme's `size.height` and the icon its `icon.size` (read
 * where they are used, so they follow `selectTheme`); the label size and the padding are the
 * button's own (no type role has the 12 / 13 / 14 of a button's steps).
 */
export const buttonSizes: Record<ButtonSize, ButtonDimensions> = {
  sm: {
    get height() {
      return controlHeight.sm;
    },
    font: pointer ? 12 : 14,
    get icon() {
      return iconSize.sm;
    },
    pad: pointer ? 8 : 12,
  },
  default: {
    get height() {
      return controlHeight.md;
    },
    font: pointer ? 13 : 15,
    get icon() {
      return iconSize.md;
    },
    pad: pointer ? 12 : 16,
  },
  lg: {
    get height() {
      return controlHeight.lg;
    },
    font: pointer ? 14 : 17,
    get icon() {
      return iconSize.lg;
    },
    pad: pointer ? 16 : 20,
  },
};

/** How far a selected filled control rests: the theme dims a press of its accent by
 * `finish.accent.pressedOpacity`, and a selected one holds the same dim in every theme (Material and WinUI
 * paint their press instead of dimming it, so the press opacity is not the selected one's). */
const SELECTED_OPACITY = 0.88;

/** The properties a button's states change, eased over 150 ms: the press's
 * sink (Design Guides, "Motion") and the hover's and press's colors. */
const transition = pressTransition(
  'background-color, border-color, box-shadow, opacity',
);

/** The style props a look fills: the shell writes each as its own prop, never as a
 * spread object, which is read once and keeps the appearance it was built in. */
const STYLE_KEYS = [
  'style',
  'hoverStyle',
  'activeStyle',
  'focusVisibleStyle',
  'disabledStyle',
  'hitSlop',
] as const;

const dimensions = (o?: ButtonLookOptions) =>
  buttonSizes[read(o?.size) ?? 'default'];

const filled = (variant: ButtonVariant) => variant === 'default';

/** A button's label ink, as the token the state layers mix (a theme that swaps fills draws none). */
const buttonInk = (variant: ButtonVariant, selected = false): AnyColorKey =>
  filled(variant)
    ? 'primary-foreground'
    : variant === 'destructive'
      ? 'destructive'
      : (variant === 'secondary' || variant === 'outline') && selected
        ? 'primary-foreground'
        : 'foreground';

/** A secondary button's resting layer: its face, edge, and shade (`none` where flat). */
function secondaryStyle(): ViewStyle {
  return control('button').secondary.style;
}

/** The raised control's hover surface (`control("button").secondary` over `feedback.hoverSurface`). */
function secondaryHoverStyle(): ViewStyle {
  return feedback.hoverSurface();
}

/** Opacity fade for disabled controls in themes without a dedicated disabled surface. */
const disabledDimmed = (): ViewStyle =>
  feedback.disabled.replaceFace
    ? {}
    : { opacity: feedback.disabled.contentOpacity };

/** The fill, edge and shadow of a variant at rest (or selected). A disabled filled button falls back
 * to the secondary surface (or the face the theme's `feedback.disabled` states). */
function restLook(
  variant: ButtonVariant,
  selected: boolean,
  disabled = false,
): ViewStyle {
  if (disabled && feedback.disabled.replaceFace) {
    if (variant === 'ghost') {
      return {
        backgroundColor: ghostFill(),
        borderColor: 'transparent',
        boxShadow: 'none',
      };
    }
    if (variant === 'outline') {
      return {
        backgroundColor: ghostFill(),
        borderColor: control('button').outlineEdge,
        boxShadow: 'none',
      };
    }
    return feedback.disabled.style;
  }
  if (filled(variant) && disabled) return secondaryStyle();
  if (filled(variant))
    return {
      ...surface('accent').style,
      opacity: selected ? SELECTED_OPACITY : 1,
    };
  if (variant === 'destructive') {
    const look = control('button').destructive;
    if (selected)
      return {
        boxShadow: look.style.boxShadow,
        backgroundColor: alpha(colors.destructive, 0.2),
        backgroundImage: 'none',
        borderColor: look.edge ?? 'transparent',
      };
    return look.style;
  }
  if (selected) {
    return control('button').selected.style;
  }
  if (variant === 'outline')
    return {
      backgroundColor: ghostFill(),
      borderColor: control('button').outlineEdge,
      boxShadow: 'none',
    };
  if (variant === 'ghost')
    return {
      backgroundColor: ghostFill(),
      borderColor: 'transparent',
    };
  return secondaryStyle();
}

/**
 * A button's props (spread them: `<Button {...buttonLook("default")}>`, or
 * on a `View` with `onPress`): its style and its states. One row, its label
 * centered, `shape.button` with continuous corners; 28 points tall with a
 * pointer, 40 on a touch screen (`sm` 24 / 36, `lg` 34 / 48), a hit
 * slop making a touch target 44 points. Under the pointer a raised button
 * lightens, a ghost gets a whisper of the text color, a filled one a touch
 * of transparency; pressed it sinks to 97% (none with reduced motion) and
 * shades (a raised button's inner shade, a filled one dims). Keyboard
 * focus: `focusRing()`. Disabled: half opacity, no hover or press (a filled one on the secondary surface, dimmed with its label). Pair it with
 * `buttonLabel` for the label and `buttonGlyph` for an icon.
 */
export function buttonLook(
  variant: Live<ButtonVariant> = 'secondary',
  o?: ButtonLookOptions,
) {
  const v = () => read(variant) ?? 'secondary';
  const idle = () => !!read(o?.disabled) || !!read(o?.busy);
  return {
    get style(): ViewStyle {
      const dims = dimensions(o);
      return {
        height: terminal ? TERMINAL_ROW : dims.height,
        paddingHorizontal: terminal ? TERMINAL_COLUMN : dims.pad,
        ...rounded(buttonCorner(read(o?.size) ?? 'default')),
        borderWidth: stroke.control,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: pointer ? 6 : 8,
        ...restLook(v(), !!read(o?.selected), !!read(o?.disabled)),
        ...transition,
        ...read(o?.style),
      };
    },
    get hoverStyle(): ViewStyle | undefined {
      if (idle() || read(o?.selected)) return undefined;
      const variant = v();
      if (feedback.hoverOverlay > 0) {
        return feedback.hoverStyle(buttonInk(variant, !!read(o?.selected)));
      }
      if (filled(variant)) return { opacity: 0.94 };
      if (variant === 'destructive')
        return { backgroundColor: alpha(colors.destructive, 0.16) };
      return variant === 'ghost' || variant === 'outline'
        ? feedback.hoverStyle()
        : secondaryHoverStyle();
    },
    get activeStyle(): ViewStyle | undefined {
      if (idle()) return undefined;
      const variant = v();
      return feedback.press(
        filled(variant)
          ? 'accent'
          : variant === 'destructive'
            ? 'destructive'
            : variant === 'outline'
              ? 'outline'
              : 'surface',
        {
          scale: 0.97,
          ...(variant === 'outline'
            ? { outlineBorder: control('button').outlineEdge }
            : {}),
        },
      ).activeStyle;
    },
    get focusVisibleStyle(): ViewStyle {
      return focusRing();
    },
    get disabledStyle(): ViewStyle {
      return disabledDimmed();
    },
    get hitSlop(): number | undefined {
      return touchSlop(dimensions(o).height);
    },
  };
}

/** The color of a variant's label and icon across rest, selected, pressed and disabled states. */
function ink(live: Live<ButtonVariant>, o?: ButtonLookOptions) {
  const variant = read(live) ?? 'secondary';
  const disabled = !!read(o?.disabled);
  if (disabled) return feedback.disabled.ink;
  if (filled(variant))
    return read(o?.pressed)
      ? feedback.pressedInk('accent')
      : surface('accent').ink;
  if (variant === 'destructive') return control('button').destructive.ink;
  if ((variant === 'secondary' || variant === 'outline') && read(o?.selected))
    return control('button').selected.ink;
  if (read(o?.pressed)) return feedback.pressedInk('surface');
  return colors.foreground;
}

/** The label of a `buttonLook` of the same variant and options: 13 points with a pointer, 15 on a touch screen (`sm` 12 / 14, `lg` 14 / 17), medium weight. */
export function buttonLabel(
  variant: Live<ButtonVariant> = 'secondary',
  o?: ButtonLookOptions,
): TextStyle {
  return {
    get color() {
      return ink(variant, o);
    },
    get fontSize() {
      return dimensions(o).font;
    },
    get fontWeight() {
      return font.weight('label');
    },
  };
}

/** An icon beside the label of a `buttonLook` (`<Icon {...buttonGlyph(..)} />`): its size and color. */
export function buttonGlyph(
  variant: Live<ButtonVariant> = 'secondary',
  o?: ButtonLookOptions,
) {
  return {
    get size() {
      return dimensions(o).icon;
    },
    get tint() {
      return ink(variant, o);
    },
  };
}

/** An icon-only button's variants: `ghost` bare until the pointer is over it, `secondary` raised, `outline` bare with a `border` edge, `destructive` a dangerous action's. */
export type IconButtonVariant =
  'ghost' | 'secondary' | 'outline' | 'destructive';

/**
 * An icon-only button's size: `xs` 20, `sm` 24, `default` 28, `lg` 32 points with a pointer, a
 * step of 4 (32 / 36 / 40 / 44 on a touch screen). shadcn's `icon-xs` … `icon-lg`, on this
 * library's compact scale; `lg` is the 32 pt tool square a toolbar draws.
 */
export type IconButtonSize = 'xs' | 'sm' | 'default' | 'lg';

/** Options of `iconButtonLook` and `iconButtonGlyph`. */
export interface IconButtonLookOptions {
  /** Chosen (a favorite, a shown sidebar): the theme's `button.selected.*` ground and ink, no hover. */
  selected?: Live<boolean | undefined>;
  /** `ghost` (default): bare until the pointer is over it; `secondary`: raised; `outline`: bare with a `border` edge; `destructive`: its icon in the danger tone, the tone's tint under the pointer. */
  variant?: IconButtonVariant;
  /** Default `default`: 28 points across with a pointer, 40 on a touch screen (`xs` … `lg` a step either side). */
  size?: Live<IconButtonSize | undefined>;
  /** No hover and no press feedback; dimmed to half. */
  disabled?: Live<boolean | undefined>;
}

/** An icon-only button's side and glyph size, by size: compact with a pointer, roomier on a touch screen. */
export const iconButtonSizes: Record<
  IconButtonSize,
  { side: number; glyph: number }
> = pointer
  ? {
      xs: { side: 20, glyph: 12 },
      sm: { side: 24, glyph: 13 },
      default: { side: 28, glyph: 15 },
      lg: { side: 32, glyph: 16 },
    }
  : {
      xs: { side: 32, glyph: 16 },
      sm: { side: 36, glyph: 16 },
      default: { side: 40, glyph: 18 },
      lg: { side: 44, glyph: 18 },
    };

/** The side and the glyph size of an icon-only button (28 points across with a pointer, 40 on a touch screen, at `default`). */
const iconButtonDimensions = (o?: IconButtonLookOptions) =>
  iconButtonSizes[read(o?.size) ?? 'default'];

/** Corner radius of an icon-only button: follows the theme's `button.corner.*` scale (`xs` shares `sm`). */
const iconButtonCorner = (o?: IconButtonLookOptions) => {
  const size = read(o?.size);
  return buttonCorner(size === 'xs' ? 'sm' : (size ?? 'default'));
};

/**
 * An icon-only button's props (spread them on a `Button` or a `View` with
 * `onPress`): a square of 28 points with a pointer, 40 on a touch screen
 * (a hit slop making 44), `buttonCorner(size)`; `size` takes `iconButtonSizes`
 * (20 / 24 / 32 with a pointer). A ghost by default, raised as
 * `secondary`, the danger tone's under the pointer as `destructive`; `selected`
 * takes the theme's `button.selected.*` look. Pressed it sinks to 90% (none with reduced
 * motion). The terminal sizes it to its label.
 */
export function iconButtonLook(o: IconButtonLookOptions = {}) {
  const raised = o.variant === 'secondary';
  const outline = o.variant === 'outline';
  const destructive = o.variant === 'destructive';
  return {
    get style(): ViewStyle {
      const selected = !!read(o.selected);
      const disabled = !!read(o.disabled);
      const side = iconButtonDimensions(o).side;
      if (disabled && feedback.disabled.replaceFace) {
        const off = feedback.disabled;
        const outlineStyle = (): ViewStyle => ({
          borderColor: control('button').outlineEdge,
          backgroundColor: ghostFill(),
          boxShadow: 'none',
        });
        return {
          width: terminal ? undefined : side,
          height: terminal ? undefined : side,
          alignItems: 'center',
          justifyContent: 'center',
          ...rounded(iconButtonCorner(o)),
          borderWidth: stroke.control,
          ...(raised || selected
            ? off.style
            : outline
              ? outlineStyle()
              : {
                  borderColor: 'transparent',
                  backgroundColor: ghostFill(),
                  boxShadow: 'none',
                }),
          ...transition,
        };
      }
      return {
        width: terminal ? undefined : side,
        height: terminal ? undefined : side,
        alignItems: 'center',
        justifyContent: 'center',
        ...rounded(iconButtonCorner(o)),
        borderWidth: stroke.control,
        borderColor:
          outline && !selected ? control('button').outlineEdge : 'transparent',
        backgroundColor: ghostFill(),
        ...(outline && !selected ? { boxShadow: 'none' } : {}),
        ...(raised && !selected ? secondaryStyle() : {}),
        ...(selected
          ? {
              borderColor: 'transparent',
              boxShadow: 'none',
              ...control('button').selected.style,
            }
          : {}),
        ...transition,
      };
    },
    get hoverStyle(): ViewStyle | undefined {
      if (read(o.selected) || read(o.disabled)) return undefined;
      if (feedback.hoverOverlay > 0) {
        return feedback.hoverStyle(
          destructive
            ? 'destructive'
            : raised
              ? 'primary-foreground'
              : 'foreground',
        );
      }
      return destructive
        ? { backgroundColor: tints.destructive }
        : raised
          ? secondaryHoverStyle()
          : feedback.hoverStyle();
    },
    get activeStyle(): ViewStyle | undefined {
      if (read(o.disabled)) return undefined;
      if (feedback.pressOverlay > 0) {
        return feedback.press(
          read(o.selected)
            ? 'accent'
            : destructive
              ? 'destructive'
              : raised
                ? 'surface'
                : 'sinkOnly',
          {
            scale: 0.9,
            ink: read(o.selected)
              ? 'primary-foreground'
              : destructive
                ? 'destructive'
                : raised
                  ? 'primary-foreground'
                  : 'foreground',
          },
        ).activeStyle;
      }
      if (raised) return feedback.press('surface', { scale: 0.9 }).activeStyle;
      if (outline)
        return feedback.press('outline', {
          scale: 0.9,
          outlineBorder: control('button').outlineEdge,
        }).activeStyle;
      return {
        backgroundColor: alpha(colors.foreground, 0.1),
        transform: [{ scale: 0.9 }],
      };
    },
    get focusVisibleStyle(): ViewStyle {
      return focusRing();
    },
    get disabledStyle(): ViewStyle {
      return disabledDimmed();
    },
    get hitSlop(): number | undefined {
      return touchSlop(iconButtonDimensions(o).side);
    },
  };
}

/** The icon of an `iconButtonLook` of the same options: 15 points with a pointer, 18 on a touch screen (`xs` and `lg` a step either side); `button.selected.ink` when `selected`, else the variant's (the danger tone's, the text's raised, muted bare). */
export function iconButtonGlyph(o: IconButtonLookOptions = {}) {
  return {
    get size() {
      return iconButtonDimensions(o).glyph;
    },
    get tint() {
      if (read(o.disabled)) {
        return feedback.disabled.ink;
      }
      return read(o.selected)
        ? control('button').selected.ink
        : o.variant === 'destructive'
          ? colors.destructive
          : o.variant === 'secondary'
            ? colors.foreground
            : o.variant === 'outline'
              ? colors.foreground
              : colors.mutedForeground;
    },
  };
}

/** A round icon button's variants: `default` the citrus fill, `secondary` raised. */
export type RoundButtonVariant = 'default' | 'secondary';

/** Options of `roundButtonLook` and `roundButtonGlyph`. */
export interface RoundButtonLookOptions {
  /** Default `default`: the diameter is a button's height at that size (28 with a pointer, 40 on a touch screen). */
  size?: ButtonSize;
  /** The diameter in points, over the scale: geometry, where a scale would be off. */
  side?: number;
  /** No hover and no press feedback; dimmed to half. */
  disabled?: Live<boolean | undefined>;
}

/** The diameter of a round button: `side` if given, else a button's height at `size`. */
const roundSide = (o?: RoundButtonLookOptions) =>
  o?.side ?? buttonSizes[o?.size ?? 'default'].height;

/**
 * A round icon button's props (a composer's send, a player's play):
 * `default` the citrus fill, `secondary` raised; `size` across (28 with a
 * pointer, 40 on a touch screen, a hit slop making 44), or `side` points
 * across exactly. Under the pointer it lightens; pressed it sinks to 92%
 * (none with reduced motion).
 */
export function roundButtonLook(
  variant: RoundButtonVariant = 'default',
  o: RoundButtonLookOptions = {},
) {
  const primary = variant === 'default';
  return {
    get style(): ViewStyle {
      const side = roundSide(o);
      const disabled = !!read(o.disabled);
      return {
        width: side,
        height: side,
        borderRadius: side / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: stroke.control,
        ...(disabled && feedback.disabled.replaceFace
          ? feedback.disabled.style
          : primary
            ? surface('accent').style
            : secondaryStyle()),
        ...transition,
      };
    },
    get hoverStyle(): ViewStyle | undefined {
      if (read(o.disabled)) return undefined;
      if (feedback.hoverOverlay > 0) {
        return feedback.hoverStyle(
          primary ? 'primary-foreground' : 'primary-foreground',
        );
      }
      return primary ? { opacity: 0.94 } : secondaryHoverStyle();
    },
    get activeStyle(): ViewStyle | undefined {
      if (read(o.disabled)) return undefined;
      if (feedback.pressOverlay > 0) {
        return feedback.press(primary ? 'accent' : 'surface', {
          scale: 0.92,
          ink: 'primary-foreground',
        }).activeStyle;
      }
      return feedback.press(primary ? 'accent' : 'surface', { scale: 0.92 })
        .activeStyle;
    },
    get focusVisibleStyle(): ViewStyle {
      return focusRing();
    },
    get disabledStyle(): ViewStyle {
      return disabledDimmed();
    },
    get hitSlop(): number | undefined {
      return touchSlop(roundSide(o));
    },
  };
}

/** How much of a round button's diameter its icon takes. */
const ROUND_GLYPH_RATIO = 0.42;

/** The icon of a `roundButtonLook` of the same options: 42% of its diameter, on the fill's color. */
export function roundButtonGlyph(
  variant: RoundButtonVariant = 'default',
  o?: RoundButtonLookOptions,
) {
  return {
    get size() {
      return roundSide(o) * ROUND_GLYPH_RATIO;
    },
    get tint() {
      if (read(o?.disabled)) {
        return feedback.disabled.ink;
      }
      return variant === 'default'
        ? colors.primaryForeground
        : colors.foreground;
    },
  };
}

/** Options of `splitButtonLook`'s halves. */
export interface SplitSegmentOptions {
  /** Shaded as pressed while what it opens is open (the menu half's menu). */
  selected?: Live<boolean | undefined>;
  /** No hover and no press feedback. */
  disabled?: Live<boolean | undefined>;
  /** More style (a width, a padding), over the look's. */
  style?: Live<ViewStyle | undefined>;
}

/**
 * A split button: a main action and the menu of its variants in one
 * silhouette of a variant's finish (`frame`, a row clipping its halves), the
 * two halves (`segment()`, each a pressable with its own hover, press and
 * focus) and the hairline between them (`divider`). A half carries no fill
 * of its own: under the pointer it takes a whisper of the label's color, a
 * deeper one pressed or while its menu is open, so the pair keeps one
 * fill. The frame and the halves are a `buttonLook` of the same variant and
 * size; the label and icons take `buttonLabel` / `buttonGlyph`.
 */
export function splitButtonLook(
  variant: Live<ButtonVariant> = 'default',
  o?: ButtonLookOptions,
) {
  const shade = (a: number) => alpha(ink(variant, o), a);
  return {
    frame: {
      get style(): ViewStyle {
        return {
          flexDirection: 'row',
          alignItems: 'stretch',
          ...rounded(buttonCorner(read(o?.size) ?? 'default')),
          borderWidth: stroke.control,
          overflow: 'hidden',
          ...restLook(read(variant) ?? 'default', false, !!read(o?.disabled)),
          ...(read(o?.disabled) ? disabledDimmed() : {}),
          ...transition,
          ...read(o?.style),
        };
      },
    },
    segment(s?: SplitSegmentOptions) {
      const segmentDisabled = () => !!read(o?.disabled) || !!read(s?.disabled);
      return {
        get style(): ViewStyle {
          const dims = dimensions(o);
          return {
            height: terminal ? TERMINAL_ROW : dims.height,
            paddingHorizontal: terminal ? TERMINAL_COLUMN : dims.pad,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: pointer ? 6 : 8,
            backgroundColor: read(s?.selected) ? shade(0.12) : 'transparent',
            ...transition,
            ...read(s?.style),
          };
        },
        get hoverStyle(): ViewStyle | undefined {
          if (segmentDisabled() || read(s?.selected)) return undefined;
          if (feedback.hoverOverlay > 0) {
            return feedback.hoverStyle(buttonInk(read(variant) ?? 'default'));
          }
          return { backgroundColor: shade(0.06) };
        },
        get activeStyle(): ViewStyle | undefined {
          if (segmentDisabled()) return undefined;
          if (feedback.pressOverlay > 0) {
            return feedback.press('sinkOnly', {
              ink: buttonInk(read(variant) ?? 'default'),
            }).activeStyle;
          }
          return { backgroundColor: shade(0.12) };
        },
        get focusVisibleStyle(): ViewStyle {
          return focusRing(-2);
        },
        get disabledStyle(): ViewStyle {
          return read(o?.disabled) ? {} : disabledDimmed();
        },
        // Taller only: the halves touch, so a finger's slop stays off their shared edge.
        get hitSlop() {
          const v = touchSlop(dimensions(o).height);
          return v ? { top: v, bottom: v } : undefined;
        },
      };
    },
    get divider(): ViewStyle {
      return { width: stroke.hairline, backgroundColor: shade(0.22) };
    },
  };
}

/**
 * `nsh/base`'s Button in the look of `buttonLook`. Every base prop passes through; the style
 * props (`style`, `hoverStyle`, `activeStyle`, `focusVisibleStyle`, `disabledStyle`) go over the look's.
 */
export type ButtonProps = Omit<BaseButtonProps, 'children'> & {
  /** Default `default`, the citrus fill: the main action. */
  variant?: ButtonVariant;
  /** Default `default`. */
  size?: ButtonSize;
  /**
   * The icon before the label (a lucide node, `import { Plus } from "lucide"`), sized and
   * tinted by the variant, the size and the state (`buttonGlyph`). The terminal draws none.
   */
  icon?: IconNode;
  /** Work started by it is going on: a spinner in the icon's place, no presses, not dimmed. */
  busy?: boolean;
  /**
   * Each string among the children is the label, in `buttonLabel`'s type (an icon before it
   * stays an icon); anything else is drawn as given. What the button draws is its name for
   * screen readers, which `accessibilityLabel` says when the app gives one.
   */
  children?: string | JSX.Element;
};

/**
 * A scale for a leading glyph that grows in (from half, out of nothing) on `motion.fast` each
 * time `key` changes: a new icon, or the spinner taking its place. At once with reduced motion.
 */
function growOn(key: () => unknown) {
  const grow = createAnimatedValue(1);
  let shown = key();
  effect(() => {
    const next = key();
    if (next === shown) return;
    shown = next;
    if (reduceMotion()) return;
    grow.set(0);
    void animate(grow, 1, motion.fast);
  });
  return {
    opacity: grow,
    transform: [
      {
        scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
      },
    ],
  } satisfies ViewStyle;
}

/**
 * A button of a `variant` and a `size`. `selected` (a base prop) shows it as chosen. Its width
 * follows the label at once: a layout animation would move every frame of the update, app-wide,
 * so the motion stays on the leading glyph.
 */
export function Button(props: ButtonProps) {
  const [, rest] = split(props, [
    ...STYLE_KEYS,
    'variant',
    'size',
    'icon',
    'busy',
    'children',
    'onPress',
    'onPressDown',
    'onPressUp',
  ]);
  const variant = () => props.variant ?? 'default';
  const pressing = signal(false);
  const options: ButtonLookOptions = {
    size: () => props.size,
    selected: () => props.selected,
    disabled: () => props.disabled,
    busy: () => props.busy,
    pressed: pressing,
  };
  const look = buttonLook(variant, options);
  const glyph = buttonGlyph(variant, options);
  const grow = growOn(() => (props.busy ? 'busy' : props.icon));
  return (
    <BaseButton
      {...rest}
      // Busy, it keeps its focus and its look and takes no second press.
      onPress={() => !props.busy && props.onPress?.()}
      onPressDown={() => {
        if (!props.disabled && !props.busy) pressing.set(true);
        props.onPressDown?.();
      }}
      onPressUp={() => {
        pressing.set(false);
        props.onPressUp?.();
      }}
      hitSlop={props.hitSlop ?? look.hitSlop}
      style={[look.style, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look.activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    >
      <If when={props.busy || (props.icon && !terminal)}>
        <View style={grow}>
          <If when={props.busy} else={<Icon icon={props.icon!} {...glyph} />}>
            <Spinner side={glyph.size} tint={glyph.tint} />
          </If>
        </View>
      </If>
      <AsText style={buttonLabel(variant, options)}>{props.children}</AsText>
    </BaseButton>
  );
}

/**
 * An icon-only button in the look of `iconButtonLook`. Every base prop passes through; the style
 * props go over the look's. `icon` draws a lucide node sized and tinted by the look
 * (`iconButtonGlyph`); for anything else, pass it as `children` and spread `iconButtonGlyph` on it.
 */
export type IconButtonProps = Omit<
  BaseButtonProps,
  'children' | 'accessibilityLabel'
> & {
  /** Default `ghost`: bare until the pointer is over it; `secondary`: raised; `outline`: bare with a `border` edge; `destructive`: a dangerous action's. */
  variant?: IconButtonVariant;
  /** Default `default`: 28 points across with a pointer, 40 on a touch screen (`xs` 20, `sm` 24, `lg` 32 with a pointer). */
  size?: IconButtonSize;
  /**
   * What screen readers say. Required: an icon alone has no text to name it, so there is no
   * name to derive.
   */
  accessibilityLabel: string;
  /**
   * The icon (a lucide node), in `iconButtonGlyph`'s size and tint: `button.selected.ink` while
   * selected, the danger tone as `destructive`. In the terminal, which draws no icons,
   * `accessibilityLabel` is its text.
   */
  icon?: IconNode;
  /** Drawn after `icon`, as given: an icon of your own, a badge. */
  children?: JSX.Element;
};

/** A square icon button. `selected` (a base prop) shows it as chosen. */
export function IconButton(props: IconButtonProps) {
  const [, rest] = split(props, [
    ...STYLE_KEYS,
    'variant',
    'size',
    'icon',
    'children',
  ]);
  const options: IconButtonLookOptions = {
    selected: () => props.selected,
    variant: props.variant,
    size: () => props.size,
    disabled: () => props.disabled,
  };
  const look = iconButtonLook(options);
  return (
    <BaseButton
      {...rest}
      hitSlop={props.hitSlop ?? look.hitSlop}
      style={[look.style, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look.activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    >
      <If when={props.icon}>
        <IconLabel
          icon={props.icon!}
          label={props.accessibilityLabel}
          {...iconButtonGlyph(options)}
        />
      </If>
      {props.children}
    </BaseButton>
  );
}

/**
 * A round icon button in the look of `roundButtonLook`. Every base prop passes through; the style
 * props go over the look's. `icon` draws a lucide node sized and tinted by the look
 * (`roundButtonGlyph`); pass an icon as `children` for anything custom (such as `fill`).
 */
export type RoundButtonProps = Omit<
  BaseButtonProps,
  'children' | 'accessibilityLabel'
> & {
  /** Default `default`, the citrus fill; `secondary` raised. */
  variant?: RoundButtonVariant;
  /** Default `default`: the diameter is a button's height at that size (28 with a pointer, 40 on a touch screen). */
  size?: ButtonSize;
  /** The diameter in points, over the scale. */
  side?: number;
  /**
   * The icon (a lucide node), in `roundButtonGlyph`'s size and tint. In the terminal, which draws
   * no icons, `accessibilityLabel` is its text.
   */
  icon?: IconNode;
  /**
   * What screen readers say. Required: an icon alone has no text to name it, so there is no
   * name to derive.
   */
  accessibilityLabel: string;
  /** Drawn after `icon`, as given: a filled icon (`<Icon fill ... />`) or custom glyph. */
  children?: JSX.Element;
};

/** A round icon button of a `variant`, a `size` or a `side`. */
export function RoundButton(props: RoundButtonProps) {
  const [, rest] = split(props, [
    ...STYLE_KEYS,
    'variant',
    'size',
    'side',
    'icon',
    'children',
  ]);
  const variant = props.variant ?? 'default';
  const options: RoundButtonLookOptions = {
    size: props.size,
    side: props.side,
    disabled: () => props.disabled,
  };
  const look = roundButtonLook(variant, options);
  return (
    <BaseButton
      {...rest}
      hitSlop={props.hitSlop ?? look.hitSlop}
      style={[look.style, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look.activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    >
      <If when={props.icon}>
        <IconLabel
          icon={props.icon!}
          label={props.accessibilityLabel}
          {...roundButtonGlyph(variant, options)}
        />
      </If>
      {props.children}
    </BaseButton>
  );
}

type SplitContextValue = {
  look: ReturnType<typeof splitButtonLook>;
  variant: () => ButtonVariant;
  options: ButtonLookOptions;
};

const SplitContext = context<SplitContextValue | null>(null);

function useSplit() {
  const ctx = SplitContext();
  if (!ctx)
    throw new Error('SplitButton parts must be used within <SplitButton>');
  return ctx;
}

/** The frame of a split button: a main action and a menu half in one silhouette. */
export type SplitButtonProps = {
  /** Default `default`. */
  variant?: ButtonVariant;
  /** Default `default`. */
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: JSX.Element;
};

/**
 * One half of a split button. Each string among the children is the label in `buttonLabel`;
 * anything else is drawn as given. Spread `buttonGlyph` on an icon for the menu half.
 */
export type SplitButtonSegmentProps = Omit<BaseButtonProps, 'children'> & {
  children?: string | JSX.Element;
};

/** The hairline between the two halves. */
export type SplitButtonDividerProps = {
  style?: StyleProp<ViewStyle>;
};

/** The frame that clips the two halves of a split button. */
export function SplitButton(props: SplitButtonProps) {
  const variant = () => props.variant ?? 'default';
  const options: ButtonLookOptions = {
    size: () => props.size,
    disabled: () => props.disabled,
  };
  const look = splitButtonLook(variant, options);
  return (
    <SplitContext.Provider value={{ look, variant, options }}>
      <View style={[look.frame.style, props.style ?? null]}>
        {props.children}
      </View>
    </SplitContext.Provider>
  );
}

/** A pressable half of a `SplitButton`. */
export function SplitButtonSegment(props: SplitButtonSegmentProps) {
  const ctx = useSplit();
  const [, rest] = split(props, [
    ...STYLE_KEYS,
    'disabled',
    'children',
    'onPressDown',
    'onPressUp',
  ]);
  const pressing = signal(false);
  const segmentDisabled = () =>
    !!read(ctx.options.disabled) || !!props.disabled;
  const segmentOptions: ButtonLookOptions = {
    ...ctx.options,
    disabled: segmentDisabled,
    selected: () => props.selected,
    pressed: pressing,
  };
  const segment = ctx.look.segment({
    selected: () => props.selected,
    disabled: segmentDisabled,
  });
  return (
    <BaseButton
      {...rest}
      disabled={segmentDisabled()}
      hitSlop={props.hitSlop ?? segment.hitSlop}
      onPressDown={() => {
        if (!read(segmentOptions.disabled)) pressing.set(true);
        props.onPressDown?.();
      }}
      onPressUp={() => {
        pressing.set(false);
        props.onPressUp?.();
      }}
      style={[segment.style, props.style ?? null]}
      hoverStyle={[segment.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[segment.activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        segment.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[segment.disabledStyle, props.disabledStyle ?? null]}
    >
      <AsText style={buttonLabel(ctx.variant, segmentOptions)}>
        {props.children}
      </AsText>
    </BaseButton>
  );
}

/** The hairline between a split button's halves. */
export function SplitButtonDivider(props: SplitButtonDividerProps = {}) {
  const ctx = useSplit();
  return <View style={[ctx.look.divider, props.style ?? null]} />;
}

/**
 * What a trigger's action takes: a string child wears the button, anything else presses where it
 * is. Every other view prop (`testID`, `class`, state styles, …) lands on the node it draws.
 */
export type ActionProps = Omit<
  ViewProps,
  'children' | 'onPress' | 'onPressDown' | 'onPressUp'
> & {
  children?: string | JSX.Element;
  /** The button's variant, for a string child (default `secondary`). */
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Runs when it is pressed; a disabled one does not. */
  onPress: () => void;
};

/**
 * A trigger's action: a string presses as a `Button` of its variant; anything else (an icon, a
 * glyph of its own) presses where it lies, in a view a screen reader still calls a button and the
 * keyboard still rings.
 */
export function Action(props: ActionProps) {
  const [own, rest] = split(props, [
    'children',
    'variant',
    'disabled',
    'onPress',
    'focusVisibleStyle',
  ]);
  return (
    <>
      {(() => {
        // Read once, here where the action is drawn (`marker.tsx` reads in the same shape): a
        // string wears a `Button`, anything else presses where it lies.
        const kids = own.children;
        if (typeof kids === 'string') {
          return (
            <Button
              {...rest}
              variant={own.variant ?? 'secondary'}
              disabled={own.disabled}
              focusVisibleStyle={own.focusVisibleStyle}
              onPress={own.onPress}
            >
              {kids}
            </Button>
          );
        }
        return (
          <View
            {...rest}
            accessible
            role="button"
            accessibilityState={{ disabled: own.disabled }}
            focusVisibleStyle={[focusRing(), own.focusVisibleStyle ?? null]}
            onPress={own.disabled ? undefined : own.onPress}
          >
            {kids}
          </View>
        );
      })()}
    </>
  );
}
