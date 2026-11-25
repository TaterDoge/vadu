// A switch: the look (`switchLook`) and the `Switch` that wears it.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { ViewStyle } from 'nsh';
import { reduceMotion, split } from 'nsh';
import {
  Switch as BaseSwitch,
  type SwitchProps as BaseSwitchProps,
} from 'nsh/base';

import { joinClass } from '../../lib/ui/class-names';
import { handleLook } from '../../lib/ui/look';
import { cssMotion } from '../../lib/ui/motion';
import {
  knobTravel,
  type SwitchGeometry,
  switchSlop,
} from '../../lib/ui/switch-geometry';
import {
  colors,
  control,
  finish,
  hitTarget,
  iconSize,
  motion,
  stroke,
  terminal,
  TERMINAL_COLUMN,
  TERMINAL_ROW,
  tier,
  type Tiered,
} from '../../lib/ui/theme';

/**
 * A switch's size: `default` draws the theme's middle icon step as its knob (`icon.md`), `sm` the
 * small one (`icon.sm`); the track is that knob plus 2 points of room on every side. A theme whose
 * form brings its own switch recipe (Material's, WinUI's) draws that at either size.
 */
export type SwitchSize = 'sm' | 'default';

/** The props `switchLook` gives a `Switch`. */
export interface SwitchLook {
  /** Mirrors the track right to left, so the knob rests at the start there. */
  readonly trackClass: string;
  readonly trackStyle: ViewStyle;
  readonly thumbClass: string;
  readonly thumbStyle: ViewStyle;
}

/**
 * How much track the library's circle keeps around its knob, on every side: a 1-point border and 1
 * point of padding, so the track stands 4 points taller than the knob and 2 × knob + 4 long
 * (`docs/specs/theme-contract-v2.md` §12 M1).
 */
const CIRCLE_ROOM = 4;

/** How a family's knob answers a hover, a press and the open state. */
type KnobFeedback = 'none' | 'expand' | 'stretch';

/**
 * The library's own switch: a circle's knob at the theme's `icon.md` (`icon.sm` for `sm`), and a
 * track that is that knob plus `CIRCLE_ROOM` on every side. Only the outline is the family's.
 */
interface CircleShape {
  readonly kind: 'circle';
  /** The track's outline off, and on. */
  border: number;
  onBorder: number;
}

/**
 * A form that brings its own switch: the track and knob in points, the same at either size, so the
 * pixels do not ride on the library's scales at all (a form's official numbers,
 * `docs/specs/theme-contract-v2.md` §4). A form that publishes no desktop density states its
 * numbers once per tier (`Tiered<RecipeShape>`) — WinUI's switch has one, Material's does not.
 */
interface RecipeShape {
  readonly kind: 'recipe';
  width: number;
  height: number;
  border: number;
  onBorder: number;
  knob: number;
  onKnob: number;
  knobHover: number;
  knobPressedWidth: number;
  knobPressedHeight: number;
  knobFeedback: KnobFeedback;
}

type SwitchShape = CircleShape | RecipeShape;

// M3 Switch: 52x32 track, 2dp off / 0dp on outline, the 16dp knob 24dp open and 28dp pressed, no hover growth (_md-comp-switch.scss:47-65 v34.0.21 / SwitchTokens.kt). M3 gives the switch no density, so the desktop numbers are the library's own one step down: 40x24, the knob 16 open 20 and 22 pressed, and a 1-point outline (M3's 2dp against a track a quarter shorter; `docs/decisions/0003-material-desktop-tier.md`).
const materialSwitch: Tiered<RecipeShape> = {
  pointer: {
    kind: 'recipe',
    width: 40,
    height: 24,
    border: 1,
    onBorder: 0,
    knob: 16,
    onKnob: 20,
    knobHover: 16,
    knobPressedWidth: 22,
    knobPressedHeight: 22,
    knobFeedback: 'expand',
  },
  touch: {
    kind: 'recipe',
    width: 52,
    height: 32,
    border: 2,
    onBorder: 0,
    knob: 16,
    onKnob: 24,
    knobHover: 16,
    knobPressedWidth: 28,
    knobPressedHeight: 28,
    knobFeedback: 'expand',
  },
};

// WinUI 3 ToggleSwitch: 40x20 track, 1px off / 0px on stroke, the 12px knob 14px hover and 17x14 pressed (ToggleSwitch_themeresources.xaml:5,6,130,269,312,315 in winui3/release/2.7.0). WinUI 3 publishes one density, so one recipe serves both tiers.
const winuiSwitch: RecipeShape = {
  kind: 'recipe',
  width: 40,
  height: 20,
  border: 1,
  onBorder: 0,
  knob: 12,
  onKnob: 12,
  knobHover: 14,
  knobPressedWidth: 17,
  knobPressedHeight: 14,
  knobFeedback: 'stretch',
};

/**
 * A switch's look: a switch is always a circle (the library's disc,
 * `docs/specs/theme-contract-v2.md` §11.4), so the form the theme's `handle` names picks the family
 * whose switch the theme is — the library's own on `circle`, WinUI's stretching one on `ring`.
 * M3's growing knob has no form of its own (material's slider handle is the library's circle, #367):
 * it rides on the `tint` track, the filled M3 track only material paints.
 */
/** The shape this theme's switch draws on this screen's tier: a recipe stated per tier takes this one. */
function switchShape(): SwitchShape {
  if (handleLook(control().handle).form === 'ring') return winuiSwitch;
  if (control().track === 'tint') return materialSwitch[tier];
  return { kind: 'circle', border: 1, onBorder: 1 };
}

interface ResolvedSwitchGeometry extends SwitchGeometry {
  onBorder: number;
  onKnob: number;
  knobHover: number;
  knobPressedWidth: number;
  knobPressedHeight: number;
  knobFeedback: KnobFeedback;
}

/** The track and knob of a size: the library's circle from the icon scale, a recipe from itself (or the terminal). */
function geometry(size: SwitchSize): ResolvedSwitchGeometry {
  if (terminal)
    return {
      width: 5 * TERMINAL_COLUMN,
      height: TERMINAL_ROW,
      border: 1,
      inset: 0,
      knob: TERMINAL_ROW,
      onBorder: 1,
      onKnob: TERMINAL_ROW,
      knobHover: TERMINAL_ROW,
      knobPressedWidth: TERMINAL_ROW,
      knobPressedHeight: TERMINAL_ROW,
      knobFeedback: 'none',
    };
  const shape = switchShape();
  if (shape.kind === 'recipe')
    return {
      width: shape.width,
      height: shape.height,
      border: shape.border,
      inset: Math.max(0, (shape.height - shape.knob) / 2 - shape.border),
      knob: shape.knob,
      onBorder: shape.onBorder,
      onKnob: shape.onKnob,
      knobHover: shape.knobHover,
      knobPressedWidth: shape.knobPressedWidth,
      knobPressedHeight: shape.knobPressedHeight,
      knobFeedback: shape.knobFeedback,
    };
  const knob = size === 'sm' ? iconSize.sm : iconSize.md;
  const height = knob + CIRCLE_ROOM;
  return {
    width: height + knob,
    height,
    border: shape.border,
    inset: Math.max(0, (height - knob) / 2 - shape.border),
    knob,
    onBorder: shape.onBorder,
    onKnob: knob,
    knobHover: knob,
    knobPressedWidth: knob,
    knobPressedHeight: knob,
    knobFeedback: 'none',
  };
}

/**
 * A switch's knob: the `knob` layer, and on an open switch its checked state — the fill, the edge
 * and the gradient the theme states in `checked-*`, which a field it leaves out keeps from the
 * unchecked knob.
 */
function knobLook(on: boolean): ViewStyle {
  const checked: ViewStyle = { ...finish.knob };
  if (!on) return checked;
  const background = finish.knob.checkedBackground;
  if (background !== undefined) checked.backgroundColor = background;
  const border = finish.knob.checkedBorderColor;
  if (border !== undefined) checked.borderColor = border;
  const gradient = finish.knob.checkedGradient;
  if (gradient === null) delete checked.backgroundImage;
  else if (gradient !== undefined) checked.backgroundImage = gradient;
  return checked;
}

/**
 * The knob's size feedback, as transform classes: the knob's box never takes a new size, so a
 * hover, a press and the open state scale it — built from the geometry, so a family that brings a
 * recipe and the library's circle take the same path.
 * A knob that stretches (WinUI) reaches toward the track's centre as it grows: a `shift` past the
 * box it grew from, and `travel - shift` back once it is open — the same pixels as today's box,
 * without moving `transformOrigin`, which a press would jump.
 */
function knobFeedbackClasses(
  g: ResolvedSwitchGeometry,
  travel: number,
): string[] {
  if (g.knobFeedback === 'none') return [];
  /** A size as a scale of the knob's box, to four places (a whole number of points fits). */
  const of = (size: number) => Number((size / g.knob).toFixed(4));
  /** Both axes together as `scale`, apart as `scale-x` and `scale-y`. */
  const scale = (w: number, h: number): string[] =>
    w === h
      ? [`scale-[${of(w)}]`]
      : [`scale-x-[${of(w)}]`, `scale-y-[${of(h)}]`];
  const under = (variant: string, utilities: string[]): string[] =>
    utilities.map((utility) => `${variant}:${utility}`);
  const pressed = under(
    'active',
    scale(g.knobPressedWidth, g.knobPressedHeight),
  );
  if (g.knobFeedback === 'expand') {
    return [...under('checked', scale(g.onKnob, g.onKnob)), ...pressed];
  }
  const shift = (g.knobPressedWidth - g.knobHover) / 2;
  return [
    ...under('hover', scale(g.knobHover, g.knobHover)),
    ...pressed,
    ...under('active', [`translate-x-[${shift}px]`]),
    ...under('checked:active', [`translate-x-[${travel - shift}px]`]),
  ];
}

/**
 * The gallery's switch, as the props of `Switch`'s parts (spread them:
 * `<Switch {...switchLook(() => on())}>`): track, knob geometry, border, and
 * hover/press knob feedback come from the family the theme's `control()` names (`switchShape`)
 * and from its `track`. `on` is the
 * value the app owns: the knob follows it, from a press or from elsewhere.
 *
 * The knob's box stays one size; its travel and its hover/press growth are CSS classes, so a
 * spring or a timing role in the theme paces them and no layout property moves. NSH animates a
 * view's translate and scale as one transform, so one transition carries both: `motion.fast`.
 */
export function switchLook(
  on: () => boolean,
  size: SwitchSize = 'default',
): SwitchLook {
  return {
    // The knob sits at the track's physical left (`left`, which keeps its
    // side) and travels right; right to left the whole track is mirrored, so
    // it rests at the start and springs toward the end in either direction.
    trackClass: 'rtl:-scale-x-100',
    get trackStyle(): ViewStyle {
      const g = geometry(size);
      const checked = on();
      return {
        width: g.width,
        height: g.height,
        borderRadius: g.height / 2,
        padding: g.inset,
        backgroundColor: checked ? finish.fill.backgroundColor : colors.track,
        borderWidth: checked ? g.onBorder : g.border,
        borderColor: checked
          ? finish.fill.borderColor
          : finish.inset.borderColor,
        boxShadow: checked ? finish.fill.boxShadow : finish.inset.boxShadow,
        transitionProperty: reduceMotion()
          ? 'none'
          : 'background-color, border-color, box-shadow',
        ...cssMotion(motion.fast),
      };
    },
    get thumbClass(): string {
      const g = geometry(size);
      const travel = knobTravel(g);
      return [
        `checked:translate-x-[${travel}px]`,
        ...knobFeedbackClasses(g, travel),
      ].join(' ');
    },
    get thumbStyle(): ViewStyle {
      const g = geometry(size);
      const checked = on();
      const border = checked ? g.onBorder : g.border;
      const offset = g.height / 2 - border - g.knob / 2;
      return {
        position: 'absolute',
        // physical: the knob's travel is a translateX from the track's left edge, and transforms do not mirror.
        left: offset,
        top: offset,
        width: g.knob,
        height: g.knob,
        borderRadius: g.knob / 2,
        borderWidth: stroke.control,
        ...knobLook(checked),
        transitionProperty: reduceMotion() ? 'none' : 'transform',
        ...cssMotion(motion.fast),
      };
    },
  };
}

/**
 * The hit slop of a switch that stands alone (its track is all of it), so
 * a finger gets 44 points without the track looking bigger: none with a
 * pointer or in the terminal. Leave it off a switch that is a row with its
 * label: the row is the target, and a slop would reach into the rows next
 * to it, which take presses before it where they overlap.
 */
export function switchHitSlop(
  size: SwitchSize = 'default',
): { top: number; bottom: number; left: number; right: number } | undefined {
  const hit = hitTarget();
  return terminal || hit <= 0 ? undefined : switchSlop(geometry(size), hit);
}

/**
 * `nsh/base`'s Switch in the look of `switchLook`. Every base prop passes through; `trackClass`,
 * `trackStyle` and `thumbStyle` go over the look's.
 */
export type SwitchProps = BaseSwitchProps & {
  /** Its size on a touch screen (default `default`); read once, as `switchLook` does. */
  size?: SwitchSize;
};

/**
 * A switch. Alone (no children) it takes `switchHitSlop`, so a finger gets 44 points; with
 * children it is a row with its label, and the row is the target.
 */
export function Switch(props: SwitchProps) {
  const [, rest] = split(props, [
    'size',
    'trackClass',
    'trackStyle',
    'thumbClass',
    'thumbStyle',
    'hitSlop',
  ]);
  const size = props.size ?? 'default';
  const look = switchLook(() => props.checked ?? false, size);
  return (
    <BaseSwitch
      {...rest}
      hitSlop={
        props.hitSlop ??
        (props.children == null ? switchHitSlop(size) : undefined)
      }
      trackClass={joinClass(look.trackClass, props.trackClass)}
      trackStyle={[look.trackStyle, props.trackStyle ?? null]}
      thumbClass={joinClass(look.thumbClass, props.thumbClass)}
      thumbStyle={[look.thumbStyle, props.thumbStyle ?? null]}
    />
  );
}
