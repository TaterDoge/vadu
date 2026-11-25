// A switch's sizes and the arithmetic of its knob, apart from `switch.tsx` and free of imports: kept
// in lib so `bun test` checks it without starting NSH.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

/** A switch's track and knob, in points. */
export interface SwitchGeometry {
  /** The track's outer width. */
  width: number;
  /** The track's outer height. */
  height: number;
  /** The track's border, on every side. */
  border: number;
  /** The track's padding, between its border and the knob, on every side. */
  inset: number;
  /** The knob's diameter. */
  knob: number;
}

/**
 * How far the knob travels from off to on. Off, it rests at the start of the
 * track's content box, `border + inset` from the leading edge; on, it must
 * end the same `border + inset` from the trailing edge. So it travels the
 * width less the knob and that gap at both ends.
 */
export const knobTravel = (g: SwitchGeometry): number =>
  g.width - 2 * (g.border + g.inset) - g.knob;

/**
 * How far presses count past a switch whose track makes up its height, so a
 * finger gets `size.hit` points on each axis without the track looking
 * bigger.
 */
export function switchSlop(
  g: SwitchGeometry,
  hit: number,
): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const v = Math.max(0, (hit - g.height) / 2);
  const h = Math.max(0, (hit - g.width) / 2);
  return { top: v, bottom: v, left: h, right: h };
}
