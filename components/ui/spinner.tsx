// A spinner: a ring turning with its top arc in one color, the shape of work going on.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import { reduceMotion, View } from 'nsh';

import { trackLook } from '../../lib/ui/look';
import { alpha, control, iconSize } from '../../lib/ui/theme';

/** A spinner's size, on the theme's icon tiers: the ring's side is `iconSize`'s `sm`, `md` or
 * `lg` (12 / 16 / 20 points with a pointer, 16 / 20 / 24 on a touch screen). */
export type SpinnerSize = 'sm' | 'default' | 'lg';

/** The thinnest a ring's stroke gets, in points: below it the arc stops reading as a turn. */
const MIN_STROKE = 1.5;

/** The ring's side divided by this is its stroke: a stroke at 40 points, the size it is drawn at
 * most, so a smaller ring thins down to `MIN_STROKE` and no further. */
const STROKE_SHARE = 8;

/** One turn, in milliseconds: fast enough to read as work going on, slow enough not to blur. */
const TURN_MS = 800;

/** A spinner's props. */
export interface SpinnerProps {
  /** The theme's icon tier (default `default`): `sm` 12, `default` 16, `lg` 20 points with a
   * pointer (16 / 20 / 24 on a touch screen). */
  size?: SpinnerSize;
  /** The ring's side in points, for a place that needs an exact size over the scale's. */
  side?: number;
  /** The moving arc's color (the theme's text, a tone); the rest of the ring follows the theme's
   * `track` form: sunk, a groove behind the arc at the recipe's opacity — `tint` and `hairline` draw
   * none, and the arc stands alone. */
  tint: string;
}

/** The color of the ring behind the arc: `tint` at the recipe's opacity when the theme's `track`
 * form draws a groove, transparent when it does not. */
function grooveColor(tint: string): string {
  const groove = trackLook(control().track).spinner;
  const opacity = groove.groove ? groove.opacity : null;
  return opacity === null ? 'transparent' : alpha(tint, opacity);
}

/**
 * A ring turning with its top arc in `tint`: work going on. Its side is `side` when given,
 * else the theme's icon tier named by `size`; the stroke is that side over `STROKE_SHARE`, no
 * thinner than `MIN_STROKE`; whether a groove shows behind the arc is the theme's `track` form to
 * say (`control().track`). It stands still when the user asks for less motion.
 */
export function Spinner(props: SpinnerProps) {
  const side = () =>
    props.side ??
    (props.size === 'sm'
      ? iconSize.sm
      : props.size === 'lg'
        ? iconSize.lg
        : iconSize.md);
  const stroke = () => Math.max(MIN_STROKE, side() / STROKE_SHARE);
  return (
    <View
      style={{
        width: side(),
        height: side(),
        borderRadius: side() / 2,
        borderWidth: stroke(),
        borderColor: grooveColor(props.tint),
        borderTopColor: props.tint,
        animationName: reduceMotion() ? undefined : 'spin',
        animationDuration: TURN_MS,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
      }}
    />
  );
}
