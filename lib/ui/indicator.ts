// How a control's field reads `control().field` (`fieldLook`): one place that turns a field's recipe
// into the styles and classes every field control draws with, so they all read the recipe the same way.

import type { ViewStyle } from 'nsh';

import { type FieldLook, fieldLook, type Fill } from './look';
import {
  alpha,
  colors,
  cornerCurve,
  finish,
  rounded,
  shape,
  stroke,
  style,
  terminal,
  tints,
} from './theme';

/**
 * The frame a field draws, as the platform reads it: the theme's, or the terminal's box — a shell's
 * fields are its own grid's, whatever the theme says.
 */
export function fieldDrawn(field: FieldLook): FieldLook {
  return terminal ? fieldLook('box') : field;
}

/** What a fill paints, as a color: a finish's own face, a palette role, or a tint. */
function painted(fill: Fill): string {
  switch (fill.kind) {
    case 'finish':
      return finish[fill.role].backgroundColor ?? 'transparent';
    case 'colour':
      return colors[fill.role];
    case 'tint':
      return tints[fill.role];
  }
}

/**
 * A field's corners: all four at the control radius, or the top two only where the form draws its
 * bottom edge alone (a line).
 */
export function fieldCorners(field: FieldLook): ViewStyle {
  const radius = shape.control;
  if (fieldDrawn(field).corners !== 'top') return rounded(radius);
  return {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    ...cornerCurve,
  };
}

/**
 * `fieldCorners` for a frame drawn in classes: `rounded-(--radius-control)` names the same token,
 * and a class's corner is a circular one, the curve those frames already draw.
 */
export function fieldCornerClass(field: FieldLook): string {
  return fieldDrawn(field).corners === 'top'
    ? 'rounded-t-(--radius-control)'
    : 'rounded-(--radius-control)';
}

/** A field's edge widths: one control stroke all round, or its bottom edge alone for a line. */
export function fieldEdgeWidths(field: FieldLook): ViewStyle {
  return fieldDrawn(field).edges === 'bottom'
    ? {
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: stroke.control,
      }
    : { borderWidth: stroke.control };
}

/** `fieldEdgeWidths` for a frame drawn in classes: `border` all round, or `border-b` for a line. */
export function fieldEdgeClass(field: FieldLook): string {
  return fieldDrawn(field).edges === 'bottom' ? 'border-b' : 'border';
}

/**
 * A field's edge at rest, in `style`: the sides in the recipe's color where the form draws them, and
 * the bottom edge in its own (a box carrying an underline reads the input color there).
 */
export function fieldRestEdge(field: FieldLook): ViewStyle {
  const look = fieldDrawn(field);
  const bottom = { borderBottomColor: painted(look.bottom) };
  return look.side
    ? { borderColor: painted(look.side), ...bottom }
    : { borderColor: painted(look.bottom) };
}

/**
 * A field's ring, invisible until a state lights it (`fieldFocusEdge`): the two numbers its class
 * form draws (`outline-2 -outline-offset-1`), which are not `focusRing`'s scale.
 */
export function fieldRing(tone: string): ViewStyle {
  return {
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineOffset: -1,
    outlineColor: alpha(tone, 0),
  };
}

/** A field's states whose edge a class can say (`edgeClass`'s `focus`). */
export type FieldState = 'focus' | 'focus-within' | 'focus-visible';

/**
 * The line a field draws with the keys, `focus.width` wide, as classes: each size written whole, so
 * no class is ever assembled from a number. The scales state 3; WinUI's 2 is the only other step.
 */
const focusLine = {
  focus: { 2: 'focus:border-b-[2px]', 3: 'focus:border-b-[3px]' },
  'focus-within': {
    2: 'focus-within:border-b-[2px]',
    3: 'focus-within:border-b-[3px]',
  },
  'focus-visible': {
    2: 'focus-visible:border-b-[2px]',
    3: 'focus-visible:border-b-[3px]',
  },
} as const;

/** The line class a state draws (`edgeClass` adds it): `focus.width` wide, never assembled. */
export function fieldFocusLine(state: FieldState): string {
  return focusLine[state][style().dimension.focus.width === 2 ? 2 : 3];
}

/**
 * A field's edge with the keys, in `style`, in `tone`: the border and the ring together, or for a
 * box-underline its bottom edge alone, `focus.width` wide, and no ring.
 */
export function fieldFocusEdge(field: FieldLook, tone: string): ViewStyle {
  const look = fieldDrawn(field);
  const ring = { ...fieldRing(tone), outlineColor: tone };
  if (look.form !== 'box-underline') return { ...ring, borderColor: tone };
  return {
    ...ring,
    borderBottomColor: tone,
    borderBottomWidth: style().dimension.focus.width,
    outlineColor: alpha(tone, 0),
  };
}
