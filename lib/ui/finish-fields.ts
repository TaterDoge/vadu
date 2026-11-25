/**
 * The fields each finish role draws with: the one table the types, the lint and the docs' field
 * tables read (`docs/specs/theme-roles.md` §2).
 *
 * A field belongs to a role only where at least one theme gives it a value of its own: a value that
 * differs from `null` read as "none", and from what the role would draw without the field — an edge
 * colour equal to the role's `border-color` in every theme is that role's `border-color`, not an
 * edge of its own. The measurement behind the table and what it dropped is
 * `docs/decisions/0006-finish-fields-per-role.md`.
 *
 * `finishFields` is also what `semantics.json` must hold: a role carries exactly these fields in
 * every theme, so reading a field a role does not have is a type error.
 */
import type { FinishMaterial } from './materials';

/** A finish as `semantics.json` writes it, before a role narrows it: every field a role may carry. */
export interface FinishFields {
  background: string;
  /** The gradient over the fill, or `null` where the layer paints flat. */
  gradient: string | null;
  shadow: string;
  'border-color': string;
  /**
   * A colour of its own for one edge, or `null`: that edge has none and takes `border-color`, as
   * CSS's `currentColor` does.
   */
  'border-top-color': string | null;
  'border-bottom-color': string | null;
  backdropFilter: string;
  /** The fill and ink a theme paints instead of the accent while a filled control is pressed. */
  'pressed-background': string | null;
  'pressed-foreground': string | null;
  /** How far the accent dims while a filled control is pressed, fill and ink together. */
  'pressed-opacity': number;
  /** A knob's checked state, stated only where it differs from the unchecked knob. */
  'checked-background'?: string;
  'checked-border-color'?: string;
  'checked-gradient'?: string | null;
  /** The ink on this finish's surface (a color, not a spread style key). */
  foreground: string;
  /** The platform's own material the layer asks for: `null` asks nothing of it (see `materials`). */
  material: FinishMaterial | null;
  /** The elevation the layer's material draws it at, in points; `null` where it asks for none. */
  elevation: number | null;
}

/** A field of a finish, as `semantics.json` spells it. */
export type FinishFieldName = keyof FinishFields;

/**
 * What each role draws with, in `semantics.json`'s order. A role states every field here in every
 * theme: the neutral for the fields a theme leaves to the platform (`"none"`, `null`) lives once,
 * in `tokens/base/style.shared.tokens.json`.
 */
export const finishFields = {
  card: ['background', 'shadow', 'border-color', 'foreground', 'elevation'],
  inset: ['shadow', 'border-color', 'foreground'],
  channel: ['background', 'shadow', 'border-color', 'foreground'],
  raised: [
    'background',
    'shadow',
    'border-color',
    'border-top-color',
    'border-bottom-color',
    'backdropFilter',
    'foreground',
    'material',
  ],
  plate: ['background', 'shadow', 'border-color', 'foreground', 'elevation'],
  overlay: [
    'background',
    'shadow',
    'border-color',
    'backdropFilter',
    'foreground',
    'material',
    'elevation',
  ],
  modal: ['background', 'shadow', 'border-color', 'foreground', 'elevation'],
  inverse: [
    'background',
    'shadow',
    'border-color',
    'backdropFilter',
    'foreground',
    'material',
    'elevation',
  ],
  glass: [
    'background',
    'shadow',
    'border-color',
    'backdropFilter',
    'foreground',
    'material',
    'elevation',
  ],
  accent: [
    'background',
    'shadow',
    'border-color',
    'border-bottom-color',
    'pressed-background',
    'pressed-foreground',
    'pressed-opacity',
    'foreground',
  ],
  fill: ['background', 'gradient', 'shadow', 'border-color', 'foreground'],
  knob: [
    'background',
    'gradient',
    'shadow',
    'border-color',
    'checked-background',
    'checked-border-color',
    'checked-gradient',
    'foreground',
  ],
  hover: [
    'background',
    'shadow',
    'border-color',
    'border-top-color',
    'border-bottom-color',
    'foreground',
    'elevation',
  ],
  pressed: ['background', 'shadow', 'border-color', 'foreground', 'elevation'],
  disabled: ['background', 'shadow', 'border-color', 'foreground'],
} as const satisfies Record<string, readonly FinishFieldName[]>;

/** The finishes' roles: the layers a surface can be. */
export type FinishRole = keyof typeof finishFields;

/** The fields of one role, as a tuple of their names. */
export type FinishFieldList<R extends FinishRole> = (typeof finishFields)[R];

/** One role's finish as `semantics.json` writes it. */
export type FinishOf<R extends FinishRole> = Pick<
  FinishFields,
  FinishFieldList<R>[number]
>;

/** The roles a fill is drawn from: every role but `inset`, which has no fill of its own (it is read for its shadow). */
export type FaceRole = Exclude<FinishRole, 'inset'>;
