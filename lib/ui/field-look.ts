// How a field draws its frame: one place that turns the theme's `control("field")` recipe into the
// styles and classes every field control draws with, so an input, a select and an editor read the
// same value the same way.

import type { ViewStyle } from 'nsh';

import {
  activeSpec,
  alpha,
  colors,
  control,
  cornerCurve,
  feedback,
  shape,
  stroke,
  terminal,
} from './theme';
import type { ResolvedControlMap } from './theme';

/** A field's resolved frame (`control("field")`). */
export type FieldLook = ResolvedControlMap['field'];

/**
 * The frame a field draws, as the platform reads it: the theme's, or the terminal's box — a shell's
 * fields are its own grid's, whatever the theme says.
 */
export function fieldDrawn(field: FieldLook): FieldLook {
  if (!terminal) return field;
  return {
    ...field,
    edges: 'all',
    width: stroke.control,
    radius: shape.control,
    bottomRadius: shape.control,
    sideColor: colors.input,
    bottomColor: colors.input,
  };
}

/**
 * A field's corners: the sides' corner and the bottom's, which differ where the theme draws a line
 * (an underline keeps its bottom square).
 */
export function fieldCorners(field: FieldLook): ViewStyle {
  const look = fieldDrawn(field);
  if (look.radius === look.bottomRadius) {
    return { borderRadius: look.radius, ...cornerCurve };
  }
  return {
    borderTopLeftRadius: look.radius,
    borderTopRightRadius: look.radius,
    borderBottomLeftRadius: look.bottomRadius,
    borderBottomRightRadius: look.bottomRadius,
    ...cornerCurve,
  };
}

/**
 * `fieldCorners` for a frame drawn in classes: `rounded-(--radius-control)` names the control radius
 * every theme's field corner names, and a class's corner is a circular one, the curve those frames
 * already draw. The bottom stays square where the theme draws a line under the text.
 */
export function fieldCornerClass(field: FieldLook): string {
  return fieldDrawn(field).bottomRadius === 0
    ? 'rounded-t-(--radius-control)'
    : 'rounded-(--radius-control)';
}

/** A field's edge widths: every side, its bottom edge alone for a line, or none when borderless. */
export function fieldEdgeWidths(field: FieldLook): ViewStyle {
  const look = fieldDrawn(field);
  const width = look.width;
  if (width === 0) return { borderWidth: 0 };
  return look.edges === 'bottom'
    ? {
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: width,
      }
    : { borderWidth: width };
}

/** `fieldEdgeWidths` for a frame drawn in classes: `border` all round, `border-b` for a line, or empty when borderless. */
export function fieldEdgeClass(field: FieldLook): string {
  const look = fieldDrawn(field);
  if (look.width === 0) return '';
  return look.edges === 'bottom' ? 'border-b' : 'border';
}

/** Total vertical edge thickness in points (both top and bottom, bottom alone, or 0 when borderless). */
export function fieldEdgeThickness(field: FieldLook): number {
  const look = fieldDrawn(field);
  if (look.width === 0) return 0;
  return look.width * (look.edges === 'bottom' ? 1 : 2);
}

/** Whether a field draws a uniform non-zero edge across all four sides (not split-edge or borderless). */
export function fieldHasUniformEdge(field: FieldLook): boolean {
  const look = fieldDrawn(field);
  if (look.width === 0) return false;
  return (look.sideColor ?? look.bottomColor) === look.bottomColor;
}

/**
 * A field's edge at rest, in `style`: the sides in the theme's colour where it draws them, and the
 * bottom edge in its own (a box carrying an underline reads the input colour there).
 */
export function fieldRestEdge(field: FieldLook): ViewStyle {
  const look = fieldDrawn(field);
  if (look.width === 0) return {};
  const bottom = { borderBottomColor: look.bottomColor };
  return look.sideColor
    ? { borderColor: look.sideColor, ...bottom }
    : { borderColor: look.bottomColor };
}

/**
 * A field's ring, invisible until a state lights it (`fieldFocusEdge`), sized to the theme's focus
 * ring (`feedback.focus`).
 */
export function fieldRing(tone: string): ViewStyle {
  const { width, offset } = activeSpec().feedback.focus;
  return {
    outlineStyle: 'solid',
    outlineWidth: width,
    outlineOffset: offset,
    // Keep a non-zero alpha so the renderer retains `outlineStyle: solid` and interpolates from the
    // ring hue rather than flashing from 100% `currentcolor` on focus.
    outlineColor: alpha(tone, 0.004),
  };
}

/** A field's states whose edge a class can say (`fieldEdgeClass`'s `focus`). */
export type FieldState = 'focus' | 'focus-within' | 'focus-visible';

/**
 * The line a field draws with the keys, `field.focus.width` wide, as classes: each size written
 * whole, so no class is ever assembled from a number. The scales state 3; WinUI's and M3's 2 are
 * the other step, and a theme that states anything else is a theme bug.
 */
const focusLine = {
  focus: {
    1: 'focus:border-b-[1px]',
    2: 'focus:border-b-[2px]',
    3: 'focus:border-b-[3px]',
  },
  'focus-within': {
    1: 'focus-within:border-b-[1px]',
    2: 'focus-within:border-b-[2px]',
    3: 'focus-within:border-b-[3px]',
  },
  'focus-visible': {
    1: 'focus-visible:border-b-[1px]',
    2: 'focus-visible:border-b-[2px]',
    3: 'focus-visible:border-b-[3px]',
  },
} as const;

/** The line class a state draws: `field.focus.width` wide, never assembled. */
export function fieldFocusLine(state: FieldState): string {
  const width = fieldDrawn(control('field')).focusWidth;
  const line = focusLine[state][width as 1 | 2 | 3];
  if (line === undefined) {
    throw new Error(
      `the theme's \`field.focus.width\` slot is ${width} points; a line is 1, 2 or 3`,
    );
  }
  return line;
}

/** The focus colour for a field: `destructive` when invalid, `ring` when `field.focus.colour` names it, else `brand`. */
export function fieldFocusTone(field: FieldLook, invalid = false): string {
  if (invalid) return colors.destructive;
  const look = fieldDrawn(field);
  if (look.focusLine) return colors.brand;
  if (look.focusUsesRing) {
    const ring = feedback.focusRing();
    return (
      (ring.borderColor as string | undefined) ?? (ring.outlineColor as string)
    );
  }
  return colors.brand;
}

/**
 * A field's edge with the keys, in `style`, in `tone`: the border and the ring together, or for a
 * field whose focus is a line, its bottom edge alone, `focus.width` wide, and no ring.
 */
export function fieldFocusEdge(field: FieldLook, tone: string): ViewStyle {
  const look = fieldDrawn(field);
  if (look.focusLine) {
    return {
      ...fieldRing(tone),
      borderBottomColor: tone,
      borderBottomWidth: look.focusWidth,
      outlineColor: alpha(tone, 0),
    };
  }
  if (!look.focusUsesRing) {
    // NSH Gallery (`color:brand`): crisp 2px outline inset by 1px over the focused border.
    return {
      outlineStyle: 'solid',
      outlineWidth: 2,
      outlineOffset: -1,
      outlineColor: tone,
      ...(look.width > 0 ? { borderColor: tone } : {}),
    };
  }
  const focus = activeSpec().feedback.focus;
  return {
    ...fieldRing(tone),
    outlineColor: focus.style === 'halo' ? alpha(tone, 0.3) : tone,
    ...(focus.style === 'halo' && look.width > 0 ? { borderColor: tone } : {}),
  };
}
