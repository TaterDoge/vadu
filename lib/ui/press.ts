// A press's feedback, native: a control sinks while pressed and eases back, from its
// `activeStyle`, so it never waits for JS.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { AndroidProps, Tokens, ViewStyle } from 'nsh';
import { reduceMotion, token } from 'nsh';

import { type Live, read } from './live-value';
import {
  hitTarget,
  press,
  stateLayerColor,
  style as themeStyle,
  terminal,
} from './theme';

/** How long a press's sink, and the state changes beside it, take to settle. */
const PRESS_MS = 150;

/** The easing of a press and of the state changes beside it: 150 ms, ease-out. */
const pressEasing = {
  transitionDuration: PRESS_MS,
  transitionTimingFunction: 'ease-out',
} satisfies ViewStyle;

/** A `style`'s transition for a press's sink: `transform`, and `also` (more
 * of CSS's property names the control's states change, as
 * `"background-color, opacity"`) alike, over `pressEasing`. */
export function pressTransition(also?: string): ViewStyle {
  return {
    transitionProperty: also ? `${also}, transform` : 'transform',
    ...pressEasing,
  };
}

/**
 * A press that sinks a control to `scale` (default: the theme's `press.scale`,
 * 97%; none with reduced motion). A theme that draws no press (`press.scale` of
 * 1, as shadcn's flat surfaces do) sinks nothing, whichever scale a control
 * asks for. `scale` may be a function (a signal), read where the press is
 * drawn. Spread `activeStyle` into the control's `activeStyle` (after its
 * own pressed shade) and `transition` into its `style`
 * (`pressTransition(also)`).
 */
export function pressSink(
  scale?: Live<number | undefined>,
  also?: string,
): { readonly activeStyle: ViewStyle; transition: ViewStyle } {
  return {
    get activeStyle(): ViewStyle {
      if (reduceMotion()) return {};
      const sink = press.scale;
      if (sink >= 1) return {};
      return { transform: [{ scale: read(scale) ?? sink }] };
    },
    transition: pressTransition(also),
  };
}
/**
 * Android press ripple when `state.ripple` is enabled: `{ ripple: { color } }` using `ink`
 * (default `"foreground"`) at `state.overlay.pressed` opacity (or bare `ink` when `overlay.pressed <= 0`).
 * Returns `undefined` when disabled, in a terminal, or when `state.ripple` is `false`.
 */
export function pressRipple(
  ink: keyof Tokens = 'foreground',
  disabled?: Live<boolean | undefined>,
): AndroidProps | undefined {
  if (terminal || read(disabled) || !themeStyle().state.ripple)
    return undefined;
  const color = stateLayerColor('pressed', ink) ?? (token(ink) as string);
  return { ripple: { color } };
}

/**
 * Packages a reactive `android` ripple getter in a spreadable object for `nsh/base` primitives
 * (matching `{...platformMaterial(...)}`, since `ComponentHostProps` omits named platform attrs).
 */
export function pressHostProps(readAndroid: () => AndroidProps | undefined): {
  readonly android?: AndroidProps;
} {
  return {
    get android() {
      return readAndroid();
    },
  };
}

/**
 * How far presses count past a control `side` points tall (a button's height,
 * a toggle's side), so a finger gets the theme's `size.hit` points without the control
 * looking bigger: none in a terminal or where the theme's hit target is 0 (a pointer's), and none once `side` is
 * that big already.
 */
export function touchSlop(side: number): number | undefined {
  const hit = hitTarget();
  if (terminal || side >= hit) return undefined;
  return (hit - side) / 2;
}
