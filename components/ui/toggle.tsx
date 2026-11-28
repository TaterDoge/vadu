// A toggle: the look (`toggleLook` and its companions), the `Toggle` that wears it, and
// `ToggleGroup`, a row or column of them on the inset track (`toolbarTrack` in `lib/surface.tsx`).
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { JSX, TextStyle, ViewStyle } from 'nsh';
import { platform, split, Text } from 'nsh';
import {
  Toggle as BaseToggle,
  ToggleGroup as BaseToggleGroup,
  type ToggleGroupProps as BaseToggleGroupProps,
  type ToggleProps as BaseToggleProps,
} from 'nsh/base';

import { pressSink, pressTransition, touchSlop } from '../../lib/ui/motion';
import { toolbarTrack } from '../../lib/ui/surface';
import {
  buttonCorner,
  colors,
  control,
  controlHeight,
  feedback,
  font,
  iconSize,
  rounded,
  stroke,
  terminal,
} from '../../lib/ui/theme';
import { type Live, read } from '../../lib/ui/utils';

/** A toggle's size: the theme's three heights, `default` the middle (`sm` and `lg` the steps under
 * and over it). */
export type ToggleSize = 'sm' | 'default' | 'lg';

/** A toggle's variants: `default` bare while off, `outline` on a field's edge while off. */
export type ToggleVariant = 'default' | 'outline';

/** Options of `toggleLook`, `toggleLabel` and `toggleGlyph` (the same object for all three). */
export interface ToggleLookOptions {
  /** Default `default`. */
  size?: Live<ToggleSize | undefined>;
  /** `default`: bare while off, a toolbar's tool. `outline`: on a field's
   * edge while off, a toggle standing on its own among buttons. */
  variant?: ToggleVariant;
  /** It carries a text label (beside its icon or alone): padded at its
   * sides rather than a square. */
  text?: boolean;
  /** For a `Button` or a popup's trigger that shows as on (what it opens
   * is open, a mode it starts is running): the on fill in `style`, no
   * hover. A `Toggle` needs none of it: its `pressedStyle` follows its
   * `pressed`. */
  on?: Live<boolean | undefined>;
  /** No hover and no press feedback; dimmed to 50% (`disabledStyle`). */
  disabled?: Live<boolean | undefined>;
  /** More style (a flex, a width, a margin), over the look's. */
  style?: Live<ViewStyle | undefined>;
}

/** The sizes of a size: the side (the height, and the width of an icon-only toggle), the icon's and the label's size, the padding of a toggle with text. */
export interface ToggleDimensions {
  side: number;
  icon: number;
  text: number;
  pad: number;
}

/** The ground a toggle wears while on (`button.selected.face`), as the style that paints it. */
function onFill(): ViewStyle {
  return { borderColor: 'transparent', ...control('button').selected.style };
}

/** The tier the theme measures at: a pointer's compact padding, a touch screen's roomier one. */
const pointer = platform.desktop;

/**
 * A toggle's sides, icon and label sizes and paddings, by size: compact with a pointer, roomier on
 * a touch screen. The side is the theme's `size.height`, the icon its `icon.size` and the label a
 * type role, all read where they are used so they follow `selectTheme`; the padding is the
 * toggle's own (no scale has a step for it).
 */
export const toggleSizes: Record<ToggleSize, ToggleDimensions> = {
  sm: {
    get side() {
      return controlHeight.sm;
    },
    get icon() {
      return iconSize.sm;
    },
    get text() {
      return font.size('detail');
    },
    pad: pointer ? 8 : 10,
  },
  default: {
    get side() {
      return controlHeight.md;
    },
    get icon() {
      return iconSize.md;
    },
    get text() {
      return font.size('body');
    },
    pad: pointer ? 10 : 12,
  },
  lg: {
    get side() {
      return controlHeight.lg;
    },
    get icon() {
      return iconSize.lg;
    },
    get text() {
      return font.size('label');
    },
    pad: pointer ? 12 : 14,
  },
};

/** How far a press sinks a toggle (`activeStyle`): none with reduced motion. */
const sink = (scale: number): ViewStyle => pressSink(scale).activeStyle;

/** The properties a toggle's states change, eased as a button's press
 * (`pressTransition`): the sink (Design Guides, "Motion"), the on fill
 * fading in and out, the hover's. */
const transition = pressTransition(
  'background-color, border-color, box-shadow, opacity',
);

const dimensions = (o?: ToggleLookOptions) =>
  toggleSizes[read(o?.size) ?? 'default'];

/**
 * A toggle's props (spread them: `<Toggle pressed={..} {...toggleLook()}>`,
 * or on a toolbar's `Button` or trigger with `on`): its style and its
 * states. A square the theme's middle height across (`sm` and `lg` its
 * steps under and over), padded at its sides when it carries
 * text, its corners a quarter of its side; a hit slop makes a touch target
 * 44 points. Off, a default toggle is bare and an `outline` sits on a
 * field's edge; on (`pressedStyle`), it takes the chosen ground
 * (`control("button").selected.style`, the accent unless a theme says otherwise) and its ink
 * (`control("button").selected.ink`), a fill that stands off its surface in both appearances,
 * further than the hover's whisper of the text color. Pressed it sinks to 92% (none with reduced motion). Keyboard
 * focus: `feedback.focusRing(1)`. Disabled: dimmed, no hover or press. Pair it with
 * `toggleLabel` for a label and `toggleGlyph` for an icon: muted while
 * off, the text's color while on.
 */
export function toggleLook(o?: ToggleLookOptions) {
  const outline = o?.variant === 'outline';
  return {
    get style(): ViewStyle {
      const dims = dimensions(o);
      const on = !!read(o?.on);
      const disabled = !!read(o?.disabled);
      const off = disabled ? feedback.disabled : null;
      const split = off !== null && off.replaceFace;
      return {
        // The terminal sizes it to its label, which it never breaks: a
        // track too narrow for its tools wraps them instead.
        minWidth: terminal ? undefined : dims.side,
        height: terminal ? undefined : dims.side,
        flexShrink: terminal ? 0 : undefined,
        paddingHorizontal: o?.text ? dims.pad : 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        ...rounded(buttonCorner(read(o?.size) ?? 'default')),
        borderWidth: stroke.control,
        ...(outline
          ? {
              borderColor: control('button').outlineEdge,
              backgroundColor: 'transparent',
            }
          : { borderColor: 'transparent' }),
        ...(on && !split ? onFill() : {}),
        ...(off !== null && split
          ? on
            ? off.style
            : outline
              ? {
                  backgroundColor: 'transparent',
                  borderColor:
                    typeof off.style.borderColor === 'string'
                      ? off.style.borderColor
                      : colors.border,
                  boxShadow: 'none',
                }
              : {
                  backgroundColor: 'transparent',
                  borderColor: 'transparent',
                  boxShadow: 'none',
                }
          : {}),
        ...transition,
        ...read(o?.style),
      };
    },
    get pressedStyle(): ViewStyle {
      return onFill();
    },
    get hoverStyle(): ViewStyle | undefined {
      if (read(o?.disabled)) return undefined;
      if (feedback.hoverOverlay > 0) {
        return read(o?.on)
          ? feedback.hoverStyle('primary-foreground')
          : feedback.hoverStyle();
      }
      return read(o?.on) ? undefined : feedback.hoverStyle();
    },
    get activeStyle(): ViewStyle | undefined {
      if (read(o?.disabled)) return undefined;
      if (feedback.pressOverlay > 0) {
        return feedback.press(read(o?.on) ? 'accent' : 'surface', {
          scale: 0.92,
          ink: read(o?.on) ? 'primary-foreground' : 'foreground',
        }).activeStyle;
      }
      return sink(0.92);
    },
    get focusVisibleStyle(): ViewStyle {
      return feedback.focusRing(1);
    },
    get disabledStyle(): ViewStyle {
      return feedback.disabled.replaceFace
        ? {}
        : { opacity: feedback.disabled.contentOpacity };
    },
    get hitSlop(): number | undefined {
      return touchSlop(dimensions(o).side);
    },
  };
}

/** The ink of a toggle's content: the selected color while on, muted while off, disabled ink when disabled apart. */
const ink = (
  pressed: Live<boolean | undefined>,
  disabled?: Live<boolean | undefined>,
) => {
  if (read(disabled)) return feedback.disabled.ink;
  return read(pressed)
    ? control('button').selected.ink || colors.foreground
    : colors.mutedForeground;
};

/** The label of a `toggleLook` of the same options: the theme's `body` type role (`sm` `detail`, `lg` `label`), medium weight, muted while off. */
export function toggleLabel(
  pressed: Live<boolean | undefined>,
  o?: ToggleLookOptions,
): TextStyle {
  return {
    get color() {
      return ink(pressed, o?.disabled);
    },
    get fontSize() {
      return dimensions(o).text;
    },
    get fontWeight() {
      return font.weight('label');
    },
  };
}

/** An icon in a `toggleLook` (`<Icon {...toggleGlyph(pressed)} />`): the theme's `icon.size` step of the size, muted while off. */
export function toggleGlyph(
  pressed: Live<boolean | undefined>,
  o?: ToggleLookOptions,
) {
  return {
    get size() {
      return dimensions(o).icon;
    },
    get tint() {
      return ink(pressed, o?.disabled);
    },
  };
}

/**
 * `nsh/base`'s Toggle in the look of `toggleLook`. Every base prop passes through; the style
 * props go over the look's. A string child is the label; anything else is drawn as given.
 */
export type ToggleProps = Omit<BaseToggleProps, 'children'> & {
  /** Default `default`: bare while off. `outline`: on a field's edge while off. */
  variant?: ToggleVariant;
  /** Default `default`. */
  size?: ToggleSize;
  /**
   * It carries a text label, beside its icon or alone: padded at its sides rather than a
   * square (`toggleLook`'s `text`). A string child says so; an icon and a label drawn as
   * children say it here.
   */
  text?: boolean;
  /** A string is the label, in `toggleLabel`'s type; anything else is drawn as given. A string
   * label is also the toggle's name for screen readers, unless `accessibilityLabel` says otherwise. */
  children?: string | JSX.Element;
};

/** A toggle of a `variant` and a `size`. `pressed` (a base prop) shows it as on. */
export function Toggle(props: ToggleProps) {
  const [, rest] = split(props, [
    'variant',
    'size',
    'text',
    'children',
    'style',
    'hoverStyle',
    'activeStyle',
    'focusVisibleStyle',
    'pressedStyle',
    'disabledStyle',
    'hitSlop',
  ]);
  // Read once, here where the toggle is made: a string child is the label, which makes the look a
  // text one (`options.text`), and the kind of the children never changes (a child that changes
  // arrives as a function, drawn as given below).
  const kids = props.children;
  const options: ToggleLookOptions = {
    size: () => props.size,
    variant: props.variant,
    text: props.text ?? typeof kids === 'string',
    on: () => props.pressed,
    disabled: () => props.disabled,
  };
  const look = toggleLook(options);
  return (
    <BaseToggle
      {...rest}
      hitSlop={props.hitSlop ?? look.hitSlop}
      style={[look.style, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look.activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      pressedStyle={[look.pressedStyle, props.pressedStyle ?? null]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    >
      {typeof kids === 'string' ? (
        <Text style={toggleLabel(() => props.pressed, options)}>{kids}</Text>
      ) : (
        kids
      )}
    </BaseToggle>
  );
}

/**
 * `nsh/base`'s ToggleGroup. Every base prop passes through; `style` goes over the look's.
 * Put `Toggle`s inside; they keep their own look. Default `inset` wears `toolbarTrack`; set
 * `inset={false}` inside a `Toolbar` that already has the track.
 */
export type ToggleGroupProps = BaseToggleGroupProps & {
  /** A column of toggles (default a row). */
  vertical?: boolean;
  /** Default true: the inset track. False inside a Toolbar that already has the track. */
  inset?: boolean;
};

/** Tools in a row (or column), matching `toolbarTrack`'s gap when not inset. */
function groupChrome(vertical?: boolean): ViewStyle {
  return {
    flexDirection: vertical ? 'column' : 'row',
    alignItems: 'center',
    gap: 2,
  };
}

/**
 * The track holding a row (or column) of toggles. The look is read where the style is applied,
 * not held in a variable: `toolbarTrack` reads the theme's colors and radius there (tokens are
 * values, so a look built once in the body would keep the build-time ones when the app switches
 * theme).
 */
export function ToggleGroup(props: ToggleGroupProps) {
  const [, rest] = split(props, ['style', 'vertical', 'inset']);
  return (
    <BaseToggleGroup
      {...rest}
      style={[
        props.inset === false
          ? groupChrome(props.vertical)
          : toolbarTrack({ vertical: props.vertical }),
        props.style ?? null,
      ]}
    />
  );
}
