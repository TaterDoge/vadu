// Shared motion and press feedback: CSS transitions for theme timing roles, reject shakes,
// rolling counters, press sink transforms, and touch hit-target expansion.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type {
  MotionSpec as NshMotionSpec,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'nsh';
import {
  createMotion,
  effect,
  reduceMotion,
  ScreenTransition,
  shadersAvailable,
  signal,
  Text,
} from 'nsh';

import {
  feedback,
  motion as themeMotion,
  press,
  terminal,
  type Timing,
} from './theme';
import { type Live, read } from './utils';

/** Theme-driven dialog enter motion spec (`dialogEnter` timing, scale, Y offset, and optional spring). */
export function dialogMotion(): NshMotionSpec {
  return themeMotion.enterSpec('dialogEnter');
}

/**
 * A theme's motion role as a CSS transition: the two properties a `transitionProperty` needs, for
 * the feedback the CSS states own — a knob's `scale` under `hover:` and `active:` — because an
 * animated value and a CSS transition cannot both drive one view's transform.
 *
 * A role gives its own duration and its curve as `cubic-bezier`. A named curve
 * (`Easing.out(Easing.cubic)`) has no CSS spelling, so it falls back to `ease-out`.
 */
export function cssMotion(m: Timing): {
  transitionDuration: number;
  transitionTimingFunction: ViewStyle['transitionTimingFunction'];
} {
  const curve = m.timingFunction;
  return {
    transitionDuration: m.duration,
    transitionTimingFunction: Array.isArray(curve)
      ? `cubic-bezier(${curve.join(', ')})`
      : 'ease-out',
  };
}

/**
 * A `style`'s transition for a press's sink: `transform`, and `also` (more
 * of CSS's property names the control's states change, as
 * `"background-color, opacity"`) alike, over the theme's `motion.state`.
 */
export function pressTransition(also?: string): ViewStyle {
  return {
    transitionProperty: also ? `${also}, transform` : 'transform',
    ...cssMotion(themeMotion.state),
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
): { readonly activeStyle: ViewStyle; readonly transition: ViewStyle } {
  return {
    get activeStyle(): ViewStyle {
      if (reduceMotion()) return {};
      const sink = press.scale;
      if (sink >= 1) return {};
      return { transform: [{ scale: read(scale) ?? sink }] };
    },
    get transition(): ViewStyle {
      return pressTransition(also);
    },
  };
}

/**
 * How far presses count past a control `side` points tall (a button's height,
 * a toggle's side), so a finger gets the theme's `size.hit` points without the control
 * looking bigger: none in a terminal or where the theme's hit target is 0 (a pointer's), and none
 * once `side` is that big already.
 */
export function touchSlop(side: number): number | undefined {
  return feedback.touchSlop(side);
}

/**
 * A shake that plays when `tick` changes to a new number (a second submit, a second wrong code).
 * The first value does not play, and a return to `undefined` does not either, so a field that
 * becomes valid stays still. `play("shake")` already does nothing when the user asks for less
 * motion.
 *
 * The shake is `nsh`'s own preset: how hard and how long a rejected field shakes is the platform's
 * feedback, not a theme's.
 *
 * It returns the style to call where the field draws it (`style={shake.style()}`): a component's
 * body runs once, so only the style an expression builds is read again when the shake starts and
 * ends. At rest it is `null`, so a quiet field has no transform at all. `playing()` says whether
 * it is under way, for a control that holds its press until the field has answered; `plays()` is
 * how many it has played, for a test, which cannot time one — the shake can start and end inside
 * the step that pressed.
 */
export function createRejectShake(tick: () => number | undefined): {
  style: () => ViewStyle | null;
  playing: () => boolean;
  plays: () => number;
} {
  const motion = createMotion();
  const shaking = signal(false);
  const played = signal(0);
  let seen: number | undefined;
  let ready = false;
  effect(() => {
    const next = tick();
    if (!ready) {
      ready = true;
      seen = next;
      return;
    }
    if (next === undefined || next === seen) {
      seen = next;
      return;
    }
    seen = next;
    if (reduceMotion()) return;
    shaking.set(true);
    played.update((count) => count + 1);
    void Promise.resolve(motion.play('shake')).then(() => shaking.set(false));
  });
  return {
    style: () => (shaking() ? { transform: motion.transform } : null),
    playing: () => shaking(),
    plays: () => played(),
  };
}

/**
 * A figure that rolls to its next value: up when `value` grows, down when it shrinks, over the
 * theme's `motion.fast`. The native number field keeps its own glyphs and caret, so the
 * roll is the text beside it (upstream's ticker), not the field. The first value is already there.
 * With reduced motion the next value replaces this one in place.
 */
export function Roll(props: {
  value: number;
  style?: StyleProp<TextStyle>;
  children: string;
}) {
  const motion = createMotion({ initial: { translateY: 0, opacity: 1 } });
  const shown = signal(props.value);
  effect(() => {
    const next = props.value;
    const at = shown();
    if (next === at) return;
    shown.set(next);
    if (reduceMotion()) {
      motion.translateY.set(0);
      motion.opacity.set(1);
      return;
    }
    const away = next > at ? 10 : -10;
    motion.translateY.set(away);
    motion.opacity.set(0);
    void motion.play({
      keyframes: { translateY: [away, 0], opacity: [0, 1] },
      duration: themeMotion.fast.duration,
      easing: themeMotion.fast.timingFunction,
    });
  });
  return (
    <Text
      style={[
        props.style ?? null,
        { transform: motion.transform, opacity: motion.opacity },
      ]}
    >
      {props.children}
    </Text>
  );
}

/**
 * Props of `ThemeTransition`. `value` is what `ScreenTransition` watches: a string, a number or a
 * boolean, because that is the identity a screen transition compares.
 */
export interface ThemeTransitionProps {
  /** Identity of the screen being shown. A change runs the active theme's switch. */
  readonly value: string | number | boolean;
  /** Length of the transition in milliseconds. Defaults to the theme's `themeSwitch.duration`. */
  readonly duration?: number;
}

/**
 * The active theme's screen transition when `value` changes. A theme that switches with `"none"`,
 * and the terminal, draw nothing. Where a GPU shader is available the theme's WGSL runs; otherwise
 * the platform cross-fades.
 */
export function ThemeTransition(props: ThemeTransitionProps) {
  return (
    <>
      {() => {
        const sw = themeMotion.themeSwitch;
        if (sw.kind === 'none' || terminal) return null;
        if (sw.shader && shadersAvailable()) {
          return (
            <ScreenTransition
              value={props.value}
              source={sw.shader}
              duration={props.duration ?? sw.duration}
              fallback="fade"
            />
          );
        }
        return (
          <ScreenTransition
            value={props.value}
            duration={props.duration ?? sw.duration}
            fallback="fade"
          />
        );
      }}
    </>
  );
}
