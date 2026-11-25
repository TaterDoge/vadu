// A control dimension's value, drawn out: which parts the value has, the geometry it reads from the
// scales, and the numbers the form itself states. The recipe is `docs/specs/theme-contract-v2.md`
// §11.3; its numbers are the spec's table (`docs/specs/theme-roles.md` "维度配方的数字"), which
// `bun run check:theme` holds this module to.
//
// Pure: the caller reads `control()` itself — so its read stays reactive — and passes the value in.
// What comes back names the roles and scale keys a part reads, never a resolved colour or a copy of
// a scale's number: only a form's own official numbers are written out, each with its source.

import type {
  Choice,
  FaceRole,
  Field,
  FinishRole,
  Handle,
  Palette,
  Tiered,
  Track,
} from './theme';

/** A palette role a part reads: `colors[role]`. */
export type ColourRole = keyof Palette;

/** A tint a part reads: `tints[role]`. */
export type TintRole = 'brand';

/** What fills a part: a finish's whole layer (a role with a fill: every role but `inset`), a palette role, or a translucent tint. */
export type Fill =
  | { readonly kind: 'finish'; readonly role: FaceRole }
  | { readonly kind: 'colour'; readonly role: ColourRole }
  | { readonly kind: 'tint'; readonly role: TintRole };

/**
 * A scale key a part reads instead of a copied number: a path into `style()`'s dimension, or `icon`
 * alone, whose step the control picks (a radio reads its `md`, a checkbox its `sm`).
 *
 * `size.target` is the hit target §12 M11 adds to the theme; until then no control reads it.
 */
export type Scale =
  | 'height.md'
  | 'icon'
  | 'icon.md'
  | 'shape.control'
  | 'size.control.dot'
  | 'size.control.gap'
  | 'size.control.padding'
  | 'size.target'
  | 'stroke.control'
  | 'stroke.hairline';

/** Which sides of a part its form draws. */
export type Edges = 'all' | 'bottom';

/** Which corners of a part its form rounds. */
export type Corners = 'all' | 'top';

/** A corner radius a form states: a scale, a capsule, half the part's own thickness, or a number. */
export type Radius = 'shape.control' | 'pill' | 'half-thickness' | number;

/** An edge a part draws: its width and what paints it. */
export interface Edge {
  readonly width: Scale | number;
  readonly fill: Fill;
}

/** A dimension value a switch has not been taught: an enum added without a look fails the typecheck. */
function unreachable(value: never): never {
  throw new Error(`no look for the dimension value ${String(value)}`);
}

/** The parts a field value draws: an input's frame. */
export interface FieldLook {
  readonly form: Field;
  readonly edges: Edges;
  readonly corners: Corners;
  /** Every edge's width: one control stroke, laid in two colours where the box carries an underline. */
  readonly width: Scale;
  readonly radius: Radius;
  /** What the sides read, where the form draws them (`null` when only the bottom edge does). */
  readonly side: Fill | null;
  /** What the bottom edge reads. */
  readonly bottom: Fill;
}

/**
 * The frame a `control()` value draws. `underline` is an input's frame in a dense form (a line under
 * the text); `box-underline` is WinUI's TextBox — a box, with the bottom edge taking the input's own
 * colour so focus and the editable line read in one place.
 */
export function fieldLook(value: Field): FieldLook {
  switch (value) {
    case 'box':
      return {
        form: value,
        edges: 'all',
        corners: 'all',
        width: 'stroke.control',
        radius: 'shape.control',
        side: { kind: 'colour', role: 'input' },
        bottom: { kind: 'colour', role: 'input' },
      };
    case 'underline':
      return {
        form: value,
        edges: 'bottom',
        corners: 'top',
        width: 'stroke.control',
        radius: 'shape.control',
        side: null,
        bottom: { kind: 'colour', role: 'mutedForeground' },
      };
    case 'box-underline':
      return {
        form: value,
        edges: 'all',
        corners: 'all',
        width: 'stroke.control',
        radius: 'shape.control',
        side: { kind: 'colour', role: 'border' },
        bottom: { kind: 'colour', role: 'input' },
      };
  }
  return unreachable(value);
}

/** The parts a choice value draws: a radio's well or a checkbox's box. */
export interface ChoiceLook {
  readonly form: Choice;
  /** The face at rest, where the form paints one. */
  readonly face: Fill | null;
  /**
   * The finish whose shade the face wears, where the form reads one it does not paint: the well's
   * sunk `inset`. `null` where the face carries no shade.
   */
  readonly shade: FinishRole | null;
  /**
   * The face once chosen: the accent layer the filled forms turn over to. A form that leaves its face
   * alone draws its own mark in it instead, and states null.
   */
  readonly checked: Fill | null;
  /** The edge, where the form draws one. */
  readonly edge: Edge | null;
  /** The form's corner: a number per tier (each choice form states its own, off the shape scale). */
  readonly corner: Tiered<number>;
  /** The chosen mark's inner disc, where the form has one: a radio's dot. */
  readonly dot: Scale | null;
  /** The disc's diameter with a pointer on it, where the form grows the mark; null where it does not. */
  readonly dotHover: number | null;
  /** The disc's diameter while it is pressed, where the form grows the mark; null where it does not. */
  readonly dotPressed: number | null;
  /**
   * The radio's box diameter, in points: the form's own numbers (§12 M8 — the well 16 with a pointer,
   * 22 on a touch screen; M3's and WinUI's 20). A checkbox's box is the icon scale's `md` instead
   * (§12 M6 states its corner and border, not its size), so a checkbox does not read this.
   */
  readonly size: Tiered<number>;
  /** How far the hit area grows past the box, where the form asks for a state layer. */
  readonly target: Scale | null;
}

/**
 * The state layer's diameter until the theme carries `size.target` (§12 M11, P5): M3's 40 dp, the
 * geometry `choiceLook("outline").target` names. It goes when the scale arrives.
 */
export const HIT_TARGET = 40;

/**
 * The shape a `control()` value gives a choice. `well` is a sunk well (the library's own 5 / 7-point
 * corner); `outline` is M3's — a 2 dp stroke, an empty well, a mark the control draws, and a 40 dp
 * state layer; `inset` is WinUI's — a flat `ControlFillColorDefault` face with a 1 px edge and a
 * 4 px corner.
 */
export function choiceLook(value: Choice): ChoiceLook {
  switch (value) {
    case 'well':
      return {
        form: value,
        face: null,
        shade: 'inset',
        checked: { kind: 'finish', role: 'accent' },
        edge: {
          width: 'stroke.control',
          fill: { kind: 'colour', role: 'input' },
        },
        // 5 points with a pointer, 7 on a touch screen: the well's own corner, off the shape scale.
        corner: { pointer: 5, touch: 7 },
        dot: 'size.control.dot',
        dotHover: null,
        dotPressed: null,
        // 16 points with a pointer, 22 on a touch screen: the well's own box (§12 M8).
        size: { pointer: 16, touch: 22 },
        target: null,
      };
    case 'outline':
      return {
        form: value,
        face: null,
        shade: null,
        // M3 leaves the well empty and each control draws its own mark (a radio's ring, a tick).
        checked: null,
        // 2 px: M3's outline (`outlineWidth`).
        edge: { width: 2, fill: { kind: 'colour', role: 'mutedForeground' } },
        // 2 dp: M3's checkbox corner.
        corner: { pointer: 2, touch: 2 },
        dot: 'size.control.dot',
        dotHover: null,
        dotPressed: null,
        // 20 dp: M3's radio and checkbox, both tiers.
        size: { pointer: 20, touch: 20 },
        target: 'size.target',
      };
    case 'inset':
      return {
        form: value,
        // WinUI's `ControlFillColorDefault`, the face an off switch's track takes.
        face: { kind: 'colour', role: 'track' },
        shade: null,
        checked: { kind: 'finish', role: 'accent' },
        // 1 px: WinUI's `ControlStrokeColorDefault`.
        edge: { width: 1, fill: { kind: 'colour', role: 'input' } },
        // 4 px: WinUI's control corner.
        corner: { pointer: 4, touch: 4 },
        dot: 'size.control.dot',
        // 14 and 10 px: the radio's dot grows under a pointer and shrinks while pressed.
        dotHover: 14,
        dotPressed: 10,
        // 20 px: WinUI's radio, both tiers.
        size: { pointer: 20, touch: 20 },
        target: null,
      };
  }
  return unreachable(value);
}

/** A groove or band a track's controls sit in: its face and the shade it wears, where it wears one. */
export interface Groove {
  readonly fill: Fill;
  /** The finish whose shade sinks or lifts the part, where two readers make its face. */
  readonly shade: FinishRole | null;
}

/** What a progress bar reads: its run's height, and the line's height where the form draws one inside it. */
export interface ProgressNumbers {
  readonly height: number;
  readonly line: number | null;
}

/** What a slider reads: its band or rail. */
export interface SliderNumbers {
  readonly height: number;
}

/** What a spinner reads: whether it sits in the groove, and how far its bottom fades. */
export interface SpinnerNumbers {
  readonly groove: boolean;
  readonly opacity: number | null;
}

/** The parts a track value draws: a progress bar's, a slider's and a spinner's shared track. */
export interface TrackLook {
  readonly form: Track;
  readonly groove: Groove | null;
  readonly edge: Edge | null;
  readonly progress: ProgressNumbers;
  readonly slider: SliderNumbers;
  readonly spinner: SpinnerNumbers;
}

/**
 * The track a `control()` value draws. `sunk` is a groove in the surface with a 1-point edge;
 * `tint` is a band of the accent's tint with no edge; `hairline` is one thin input-coloured line,
 * progress drawing its run 3 points high over a 1-point rail. A track's groove is the `track`
 * colour — the role [`theme-roles.md`](../../docs/specs/theme-roles.md) gives a switch's, a
 * slider's and a progress bar's groove — under the inset finish's shade, inside an edge in the
 * `border` colour, the line the upstream rail draws; a segmented control's bar is a deeper well of
 * its own (`inset`), because in a dark theme `track` is raised as its thumb is.
 */
export function trackLook(value: Track): TrackLook {
  switch (value) {
    case 'sunk':
      return {
        form: value,
        // A sunk well: the track colour under the inset finish's shade, inside a control-stroke edge.
        groove: { fill: { kind: 'colour', role: 'track' }, shade: 'inset' },
        edge: {
          width: 'stroke.control',
          fill: { kind: 'colour', role: 'border' },
        },
        // 6 points: the groove the library's progress and slider draw.
        progress: { height: 6, line: null },
        slider: { height: 6 },
        spinner: { groove: true, opacity: 0.25 },
      };
    case 'tint':
      return {
        form: value,
        groove: { fill: { kind: 'tint', role: 'brand' }, shade: null },
        edge: null,
        // 4 points: the band under progress; 16 for a slider is M3's track.
        progress: { height: 4, line: null },
        slider: { height: 16 },
        spinner: { groove: false, opacity: null },
      };
    case 'hairline':
      return {
        form: value,
        // The line itself is the track.
        groove: { fill: { kind: 'colour', role: 'input' }, shade: null },
        edge: null,
        // 3 points of run over WinUI's 1 px rail; a slider's is 4.
        progress: { height: 3, line: 1 },
        slider: { height: 4 },
        spinner: { groove: false, opacity: null },
      };
  }
  return unreachable(value);
}

/** A circle handle's numbers: a 6 / 8-point rail and a knob that grows under a touch screen's press. */
export interface CircleHandleLook {
  readonly form: 'circle';
  readonly rail: Tiered<number>;
  /** The band a slider keeps around the rail: the knob plus the room it sits in. */
  readonly band: Tiered<number>;
  readonly knob: Tiered<number>;
  readonly knobPressed: Tiered<number>;
  readonly verticalLength: Tiered<number>;
  /** The knob and track a switch made from this handle draws: the icon and height scales at `md`. */
  readonly switch: { readonly knob: Scale; readonly track: Scale };
  readonly brightensOnHover: true;
}

/** A ring handle's numbers: WinUI's 18 px knob with a 12 px dot on a 4-point rail. */
export interface RingHandleLook {
  readonly form: 'ring';
  readonly knob: number;
  readonly dot: number;
  readonly knobHover: number;
  readonly knobPressed: number;
  readonly rail: number;
  /** The band a slider keeps around the rail: WinUI's 32 px slider band. */
  readonly band: number;
  readonly verticalLength: Tiered<number>;
  readonly switch: null;
  readonly brightensOnHover: false;
}

/** The parts a handle value draws: a slider's knob, and a switch's where the form makes one. */
export type HandleLook = CircleHandleLook | RingHandleLook;

/**
 * How long a vertical slider's rail is, in points: the same on every handle form, because a slider
 * is as long as the pane it sits in rather than as its knob is wide.
 */
const verticalLength: Tiered<number> = { pointer: 128, touch: 144 };

/**
 * The knob a `control()` value draws. `circle` is the library's disc, the one a switch also uses;
 * `ring` is WinUI's ring around a dot. Only `circle` gives a switch its knob:
 * `docs/specs/theme-contract-v2.md` §11.4 has a switch fall back to it on every theme.
 */
export function handleLook(value: Handle): HandleLook {
  switch (value) {
    case 'circle':
      return {
        form: value,
        // 6 points of rail with a pointer, 8 on a touch screen.
        rail: { pointer: 6, touch: 8 },
        // 20 points of band with a pointer, 32 on a touch screen: the knob plus its rail.
        band: { pointer: 20, touch: 32 },
        // 14 points of knob with a pointer, 20 on a touch screen.
        knob: { pointer: 14, touch: 20 },
        // A press swells the knob to 32 on a touch screen, and not with a pointer.
        knobPressed: { pointer: 14, touch: 32 },
        verticalLength,
        switch: { knob: 'icon.md', track: 'height.md' },
        brightensOnHover: true,
      };
    case 'ring':
      return {
        form: value,
        // WinUI's 18 px knob with a 12 px dot: 14 hovered, 10 pressed.
        knob: 18,
        dot: 12,
        knobHover: 14,
        knobPressed: 10,
        rail: 4,
        band: 32,
        verticalLength,
        switch: null,
        brightensOnHover: false,
      };
  }
  return unreachable(value);
}
