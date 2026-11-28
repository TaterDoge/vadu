/**
 * Theme v5 schema and sparse inheritance builder (`docs/decisions/0020-theme-v5.md`).
 *
 * A theme is four orthogonal TypeScript layers derived from one `base` theme via `defineTheme()`:
 * 1. `tokens`   — the 25 core CSS variables compiled into `theme.json` + optional `font.{sans,mono}`
 * 2. `metrics`  — pointer/touch dimensions, icon sizes, strokes, and per-role font weight/tracking
 * 3. `surfaces` — 11 semantic surface layers + per-appearance elevation scales (no finish-fields allowlist)
 * 4. `feedback` & `motion` — unified hover/press/focus/disabled feedback primitives and motion timings/presets
 * 5. `controls` — 13 sparse control recipes with numerical/degenerate defaults (no theme-ID branches)
 *
 * L1 `ThemeParadigm` (`paradigm.ts`) is an authoring shorthand. `defineTheme` expands it into these
 * L2 fields and does not store `paradigm` on the resolved `ThemeSpec`.
 */

import {
  expandParadigm,
  type ParadigmPatch,
  type ThemeParadigm,
} from './paradigm';

/** Platform glass/acrylic material requests (`null` = pure CSS/layer paint). */
export type FinishMaterial = 'glass' | 'acrylic';

/** Both appearances. */
export type Mode = 'light' | 'dark';

/** Appearance pair. */
export interface Appearance<T> {
  readonly light: T;
  readonly dark: T;
}

/** Input-tier pair: desktop pointer vs touch screen. */
export interface Tiered<T> {
  readonly pointer: T;
  readonly touch: T;
}

export type TieredOrFlat<T> = T | Tiered<T>;
export type ModeOrFlat<T> = T | Appearance<T>;

/** The 21 per-appearance color keys in `theme.json` (`brand` is optional in source, defaulting to `var(--primary)`). */
export type CoreColorKey =
  | 'background'
  | 'card'
  | 'popover'
  | 'muted'
  | 'surface'
  | 'foreground'
  | 'muted-foreground'
  | 'faint'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'accent'
  | 'brand'
  | 'border'
  | 'line'
  | 'input'
  | 'ring'
  | 'info'
  | 'success'
  | 'warning'
  | 'destructive';

/** The 3 appearance-invariant color keys in `theme.json`. */
export type FixedColorKey = 'scrim' | 'media' | 'on-media';

/** Standard status tone keys. */
export type ToneColorKey = 'info' | 'success' | 'warning' | 'destructive';

/** Any color key declared in `theme.json`. */
export type AnyColorKey = CoreColorKey | FixedColorKey;

/** Palette written by each theme per appearance (`brand` defaults to `primary`). */
export interface CorePalette {
  readonly background: string;
  readonly card: string;
  readonly popover: string;
  readonly muted: string;
  readonly surface: string;
  readonly foreground: string;
  readonly 'muted-foreground': string;
  readonly faint: string;
  readonly primary: string;
  readonly 'primary-foreground': string;
  readonly secondary: string;
  readonly accent: string;
  /** Brand ink for links, carets, active markers; defaults to `var(--primary)` when omitted. */
  readonly brand?: string;
  readonly border: string;
  readonly line: string;
  readonly input: string;
  readonly ring: string;
  readonly info: string;
  readonly success: string;
  readonly warning: string;
  readonly destructive: string;
}

/** Reference to a color inside theme recipes. */
export type ColorExpr =
  | AnyColorKey
  | (string & {})
  | { readonly color: AnyColorKey; readonly alpha: number }
  | { readonly tint: 'brand' | ToneColorKey; readonly alpha?: number };

/** Reference to a surface or color face in a control slot. */
export type FaceExpr = ColorExpr | { readonly surface: SurfaceRole };

/** Elevation shadow scale per appearance. */
export interface ElevationScale {
  readonly sm: string | null;
  readonly md: string | null;
  readonly lg: string | null;
  readonly xl: string | null;
  readonly inset: string | null;
  readonly edgeSurface?: string | null;
  readonly edgeAccent?: string | null;
}

export type ShadowPart = keyof ElevationScale;
export type ShadowExpr =
  ShadowPart | readonly ShadowPart[] | (string & {}) | null;

/** Parameterized optical backdrop/specular material configuration for a surface layer. */
export interface MaterialSpec {
  readonly kind: 'glass' | 'acrylic' | 'blur';
  readonly blur?: number;
  readonly saturate?: number;
  readonly minOpacity?: number;
  readonly specular?: ColorExpr | null;
}

/** Material request on a surface layer: built-in platform preset name or parameterized spec. */
export type SurfaceMaterial = FinishMaterial | MaterialSpec;

/** Built-in GPU WGSL surface texture/optics shader presets matching major platform aesthetics. */
export type SurfaceEffectKind =
  'liquid-glass' | 'acrylic-noise' | 'specular-rim' | 'paper-grain';

/** Optional GPU surface shader effect with automatic fallback when shaders are unavailable. */
export interface SurfaceEffectSpec {
  readonly kind: SurfaceEffectKind;
  /** Effect strength in (0, 1]; defaults per kind. */
  readonly intensity?: number;
  /** Optional custom WGSL `fn shade(uv: vec2f) -> vec4f` source overriding the built-in shader. */
  readonly wgsl?: string;
}

/** The 11 pure structural surfaces (`hover`, `pressed`, `disabled` live in `feedback`; `knob` in controls). */
export type SurfaceRole =
  | 'card'
  | 'raised'
  | 'inset'
  | 'channel'
  | 'plate'
  | 'overlay'
  | 'modal'
  | 'inverse'
  | 'glass'
  | 'accent'
  | 'fill';

export interface SurfaceLayer {
  readonly background?: ColorExpr | null;
  readonly foreground?: ColorExpr;
  readonly gradient?: string | null;
  readonly border?: ColorExpr | null;
  readonly borderTop?: ColorExpr | null;
  readonly borderBottom?: ColorExpr | null;
  readonly shadow?: ShadowExpr;
  readonly backdropFilter?: string | null;
  readonly material?: SurfaceMaterial | null;
  readonly effect?: SurfaceEffectSpec | null;
  readonly elevation?: number | null;
}

export interface SurfaceSpec extends SurfaceLayer {
  readonly light?: Partial<SurfaceLayer>;
  readonly dark?: Partial<SurfaceLayer>;
}

export interface Steps {
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
}

export type TypeRole =
  'caption' | 'detail' | 'body' | 'label' | 'title' | 'headline' | 'display';

export interface TypographyMetric {
  readonly fontWeight: number;
  readonly letterSpacing: number;
}

export type EasingName =
  | 'out-cubic'
  | 'in-cubic'
  | 'in-out-cubic'
  | 'standard'
  | 'emphasized-decelerate'
  | 'emphasized-accelerate'
  | 'decelerate'
  | 'accelerate'
  | 'point-to-point';

export interface TimingSpec {
  readonly duration: number;
  readonly easing: EasingName;
}

export interface TokensSpec {
  /** Optional app/theme font families emitted into `theme.json` `cssVars.theme`. */
  readonly font?: {
    readonly sans?: string;
    readonly mono?: string;
  };
  readonly radius: {
    readonly control: number;
    readonly container: number;
    readonly modal: number;
    readonly curve: 'continuous' | 'circular';
  };
  readonly fixed: {
    readonly scrim: string;
    readonly media: string;
    readonly 'on-media': string;
  };
  readonly light: CorePalette;
  readonly dark: CorePalette;
  /** Default translucent alpha used by `tints.*` (`color-mix(in srgb, token N%, transparent)`). */
  readonly tintAlpha: Appearance<number>;
  /** Optional solid/custom tint overrides per appearance/tone (e.g. Material/WinUI tonal surfaces). */
  readonly tints?: Partial<
    Appearance<Partial<Record<'brand' | ToneColorKey, string>>>
  >;
  /** Optional 5-color chart ramp override; defaults to `[brand, info, success, warning, destructive]`. */
  readonly chart?: Appearance<
    readonly [ColorExpr, ColorExpr, ColorExpr, ColorExpr, ColorExpr]
  >;
}

export interface MetricsSpec {
  readonly height: Tiered<Steps>;
  readonly icon: Tiered<Steps>;
  readonly density: Tiered<{ readonly pad: number; readonly gap: number }>;
  readonly control: Tiered<{ readonly padding: number; readonly gap: number }>;
  readonly item: Tiered<{ readonly inset: number; readonly pad: number }>;
  readonly hit: Tiered<number>;
  readonly stroke: { readonly hairline: number; readonly control: number };
  readonly typography: Record<TypeRole, TypographyMetric>;
}

export interface FeedbackSpec {
  readonly hover: {
    /** State-layer ink wash opacity (> 0 draws overlay instead of swapping fill). */
    readonly overlay: number;
    /** Generic hover background fill (`hovered()`). */
    readonly fill: ModeOrFlat<ColorExpr>;
    /** Raised control hover surface overrides. */
    readonly surface: SurfaceSpec;
  };
  readonly press: {
    /** Transform scale when pressed (`1` disables press sink). */
    readonly scale: number;
    /** Vertical press travel in points (`0` by default; extensible). */
    readonly translateY: number;
    /** Pressed state-layer ink wash opacity. */
    readonly overlay: number;
    /** Secondary/raised control pressed surface. */
    readonly surface: SurfaceSpec;
    /** Filled accent button/control press behavior. */
    readonly accent: {
      readonly opacity: number;
      readonly background?: ModeOrFlat<ColorExpr> | null;
      readonly foreground?: ModeOrFlat<ColorExpr> | null;
    };
  };
  readonly focus: {
    readonly style: 'halo' | 'outline' | 'double';
    readonly width: number;
    readonly offset: number;
    /** Inner separator line for `"double"` focus rings. */
    readonly innerColor?: ModeOrFlat<ColorExpr>;
  };
  readonly disabled: {
    readonly contentOpacity: number;
    /** When true, disabled surfaces swap to `disabled.surface` rather than dimming resting surface. */
    readonly replaceFace: boolean;
    readonly surface: SurfaceSpec;
  };
  readonly passive: {
    readonly restOpacity: number;
    readonly pressedOpacity: number;
  };
}

/** Physics spring parameters for native NSH motion (`stiffness`, `damping`, optional `mass`). */
export interface MotionSpringSpec {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass?: number;
}

/** Built-in transition style used when switching themes at runtime (`selectTheme`). */
export type ThemeSwitchKind = 'none' | 'fade' | 'dissolve' | 'radial-wipe';

export interface MotionSpec {
  readonly state: TimingSpec;
  readonly fast: TimingSpec;
  readonly default: TimingSpec;
  readonly slow: TimingSpec;
  readonly spring?: MotionSpringSpec;
  readonly presets: {
    readonly popoverEnter: {
      readonly fromScale: number;
      readonly fromY: number;
      readonly timing: 'fast' | 'default';
      readonly spring?: boolean;
    };
    readonly dialogEnter: {
      readonly fromScale: number;
      readonly fromY: number;
      readonly timing: 'fast' | 'default' | 'slow';
      readonly spring?: boolean;
    };
    readonly indicatorGlide: {
      readonly timing: 'fast' | 'default';
      readonly spring?: boolean;
    };
    readonly themeSwitch: {
      readonly kind: ThemeSwitchKind;
      readonly duration: number;
    };
  };
}

export type SlotCorner = number | 'control' | 'container' | 'full';
export type SlotSize = number | readonly [number, number] | 'same';

export interface ControlsSpec {
  readonly button: {
    readonly corner: {
      readonly sm: TieredOrFlat<SlotCorner>;
      readonly md: TieredOrFlat<SlotCorner>;
      readonly lg: TieredOrFlat<SlotCorner>;
    };
    readonly selected: { readonly face: FaceExpr; readonly ink: ColorExpr };
    readonly secondary: {
      readonly face: FaceExpr;
      readonly edge: FaceExpr | 'none';
    };
    readonly outline: { readonly edge: FaceExpr };
    readonly destructive: { readonly edge: ColorExpr | 'none' };
    readonly shade: SurfaceRole | 'none';
  };
  readonly badge: { readonly corner: SlotCorner };
  readonly field: {
    readonly ground: ModeOrFlat<ColorExpr>;
    readonly shade: SurfaceRole | 'none';
    readonly edge: {
      readonly sides: boolean;
      readonly color: ColorExpr;
      readonly bottom: ColorExpr;
    };
    readonly focus: {
      readonly line: boolean;
      readonly width: number;
      readonly color: 'brand' | 'ring';
    };
  };
  readonly choice: {
    readonly size: TieredOrFlat<number>;
    readonly box: TieredOrFlat<number>;
    readonly corner: TieredOrFlat<SlotCorner>;
    readonly face: ModeOrFlat<ColorExpr | 'none'>;
    readonly shade: SurfaceRole | 'none';
    readonly edge: {
      readonly width: number;
      readonly color: ModeOrFlat<ColorExpr | 'none'>;
      readonly disabled: ModeOrFlat<ColorExpr | 'none'>;
    };
    readonly checked: { readonly face: FaceExpr | 'none' };
    readonly radioChecked: { readonly face: FaceExpr | 'none' };
    readonly mark: TieredOrFlat<number>;
  };
  readonly switch: {
    readonly track: TieredOrFlat<readonly [number, number]>;
    readonly trackOffFace: ModeOrFlat<ColorExpr>;
    readonly small: {
      readonly track: TieredOrFlat<readonly [number, number]>;
      readonly knob: TieredOrFlat<SlotSize>;
    };
    readonly edge: {
      readonly off: TieredOrFlat<number>;
      readonly on: TieredOrFlat<number>;
      readonly color: ColorExpr | 'none';
    };
    readonly knob: {
      readonly size: TieredOrFlat<SlotSize>;
      /** Retained numeric degenerate slot: Material grows knob when checked; others use `"same"`. */
      readonly on: TieredOrFlat<SlotSize>;
      readonly pressed: TieredOrFlat<SlotSize>;
      readonly background: ModeOrFlat<ColorExpr>;
      readonly gradient?: ModeOrFlat<string | null>;
      readonly border: ModeOrFlat<ColorExpr>;
      readonly shadow: ShadowExpr;
      readonly checkedBackground?: ModeOrFlat<ColorExpr>;
      readonly checkedBorder?: ModeOrFlat<ColorExpr>;
      readonly checkedGradient?: ModeOrFlat<string | null>;
    };
  };
  readonly slider: {
    readonly rail: TieredOrFlat<number>;
    readonly band: TieredOrFlat<number>;
    readonly face: ModeOrFlat<ColorExpr>;
    readonly shade: SurfaceRole | 'none';
    readonly edge: {
      readonly color: ColorExpr | 'none';
      readonly width: number;
    };
    readonly knob: {
      readonly size: TieredOrFlat<SlotSize>;
      readonly pressed: TieredOrFlat<SlotSize>;
      readonly background: ModeOrFlat<ColorExpr>;
      readonly gradient?: ModeOrFlat<string | null>;
      readonly border: ModeOrFlat<ColorExpr | 'none'>;
      readonly shadow: ShadowExpr;
    };
    /** Retained numeric degenerate slot: WinUI ring inner dot diameter (`0` elsewhere). */
    readonly mark: TieredOrFlat<number>;
  };
  readonly progress: {
    readonly height: number;
    readonly face: ModeOrFlat<ColorExpr>;
    readonly shade: SurfaceRole | 'none';
    readonly edge: {
      readonly color: ColorExpr | 'none';
      readonly width: number;
    };
  };
  readonly spinner: {
    readonly trackOpacity: number;
  };
  readonly popup: {
    readonly corner: SlotCorner;
  };
  readonly list: {
    readonly item: {
      readonly highlight: ColorExpr;
      readonly edge: ColorExpr | 'none';
    };
  };
  readonly tabs: {
    readonly track: {
      readonly face: ModeOrFlat<ColorExpr | 'none'>;
      readonly edge: ColorExpr | 'none';
      readonly corner: SlotCorner;
    };
  };
  readonly menubar: { readonly bar: 'card' | 'none' };
  readonly well: { readonly edge: ColorExpr | 'none' };
}

export interface ContrastWaiver {
  readonly fg: string;
  readonly bg: string;
  readonly source: string;
}

export interface ThemeMeta {
  readonly overview?: string;
  readonly elevationNote?: string;
  readonly dos?: readonly string[];
  readonly donts?: readonly string[];
  readonly contrastWaivers?: readonly ContrastWaiver[];
  readonly scaleCitations?: Readonly<Record<string, string>>;
}

export interface ThemeSpec {
  readonly id: string;
  readonly label: string;
  readonly tokens: TokensSpec;
  readonly metrics: MetricsSpec;
  readonly elevation: Appearance<ElevationScale>;
  readonly surfaces: Record<SurfaceRole, SurfaceSpec>;
  readonly feedback: FeedbackSpec;
  readonly motion: MotionSpec;
  readonly controls: ControlsSpec;
  readonly meta?: ThemeMeta;
}

/** Deep partial helper preserving atomic leaf unions/tuples while allowing sparse tiered/nested patches. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends { readonly pointer: infer P; readonly touch: infer Q }
    ? { readonly pointer?: DeepPartial<P>; readonly touch?: DeepPartial<Q> }
    : T extends
          | { readonly color: AnyColorKey; readonly alpha: number }
          | { readonly tint: 'brand' | ToneColorKey }
          | { readonly surface: SurfaceRole }
          | { readonly duration: number; readonly easing: string }
          | MotionSpringSpec
          | MaterialSpec
          | SurfaceEffectSpec
      ? T
      : T extends object
        ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
        : T;

export interface ThemePatch extends Omit<
  DeepPartial<ThemeSpec>,
  'id' | 'label' | 'meta'
> {
  readonly id: string;
  readonly label: string;
  readonly extends: ThemeSpec;
  /**
   * L1 axes. Expanded after `extends` and before this patch's own L2 fields, which win.
   * Stripped from the resolved `ThemeSpec`.
   */
  readonly paradigm?: ThemeParadigm;
  readonly meta?: ThemeMeta;
}

/** NSH `theme.json` payload consumed by `setTheme` and Tailwind. */
export interface NshThemeFile {
  readonly name: string;
  readonly cssVars: {
    readonly theme: Record<string, string>;
    readonly light: Record<string, string>;
    readonly dark: Record<string, string>;
  };
}

/** One runtime-switchable theme (`selectTheme`). */
export interface AppTheme {
  readonly id: string;
  readonly label: string;
  /** Compiled minimal 25-key `theme.json` for NSH `setTheme`. */
  readonly theme: NshThemeFile;
  /** Resolved semantic spec (`tokens` + `metrics` + `surfaces` + `feedback` + `motion` + `controls`). */
  readonly spec: ThemeSpec;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Material and surface-effect specs replace as a whole so a patch cannot leave a half-merged kind. */
const isMaterialOrEffect = (v: Record<string, unknown>): boolean =>
  'kind' in v &&
  typeof v.kind === 'string' &&
  (v.kind === 'glass' ||
    v.kind === 'acrylic' ||
    v.kind === 'blur' ||
    v.kind === 'liquid-glass' ||
    v.kind === 'acrylic-noise' ||
    v.kind === 'specular-rim' ||
    v.kind === 'paper-grain');

const isAtomicObject = (v: Record<string, unknown>): boolean =>
  isMaterialOrEffect(v) ||
  ('color' in v &&
    typeof v.color === 'string' &&
    'alpha' in v &&
    Object.keys(v).every((k) => k === 'color' || k === 'alpha')) ||
  ('tint' in v && typeof v.tint === 'string') ||
  ('surface' in v &&
    typeof v.surface === 'string' &&
    Object.keys(v).length === 1) ||
  ('duration' in v && typeof v.duration === 'number' && 'easing' in v) ||
  ('stiffness' in v && typeof v.stiffness === 'number' && 'damping' in v);

function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch))
    return patch as T;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T;
  if (isAtomicObject(patch) || isAtomicObject(base)) return patch as T;
  // `knob.{background,border,checkedBackground,checkedBorder,gradient,checkedGradient}` and `choice.*`:
  // if either side is non-record and we handled primitives above, both are `{light, dark}` or plain records.
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out as T;
}

const APPEARANCE_KEYS: readonly (keyof CorePalette)[] = [
  'background',
  'card',
  'popover',
  'muted',
  'surface',
  'foreground',
  'muted-foreground',
  'faint',
  'primary',
  'primary-foreground',
  'secondary',
  'accent',
  'brand',
  'border',
  'line',
  'input',
  'ring',
  'info',
  'success',
  'warning',
  'destructive',
];

function compilePalette(palette: CorePalette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of APPEARANCE_KEYS) {
    if (key === 'brand') {
      out.brand = palette.brand ?? 'var(--primary)';
    } else {
      out[key] = palette[key];
    }
  }
  return out;
}

/** Compile a `ThemeSpec`'s `tokens` into the minimal NSH `theme.json` structure. */
export function compileNshTheme(spec: ThemeSpec): NshThemeFile {
  const { font, radius, fixed, light, dark } = spec.tokens;
  const themeVars: Record<string, string> = {
    ...(font?.sans ? { 'font-sans': font.sans } : {}),
    ...(font?.mono ? { 'font-mono': font.mono } : {}),
    radius: `${radius.control}px`,
    'radius-control': `${radius.control}px`,
    'radius-container': `${radius.container}px`,
    'radius-modal': `${radius.modal}px`,
    scrim: fixed.scrim,
    media: fixed.media,
    'on-media': fixed['on-media'],
  };
  return {
    name: spec.label,
    cssVars: {
      theme: themeVars,
      light: compilePalette(light),
      dark: compilePalette(dark),
    },
  };
}

export const SHARED_TYPE_SCALE: Record<
  TypeRole,
  { readonly fontSize: Tiered<number>; readonly lineHeight: Tiered<number> }
> = {
  caption: {
    fontSize: { pointer: 11, touch: 12 },
    lineHeight: { pointer: 16, touch: 16 },
  },
  detail: {
    fontSize: { pointer: 12, touch: 13 },
    lineHeight: { pointer: 16, touch: 20 },
  },
  body: {
    fontSize: { pointer: 13, touch: 15 },
    lineHeight: { pointer: 20, touch: 20 },
  },
  label: {
    fontSize: { pointer: 14, touch: 15 },
    lineHeight: { pointer: 20, touch: 20 },
  },
  title: {
    fontSize: { pointer: 16, touch: 16 },
    lineHeight: { pointer: 24, touch: 24 },
  },
  headline: {
    fontSize: { pointer: 20, touch: 22 },
    lineHeight: { pointer: 28, touch: 28 },
  },
  display: {
    fontSize: { pointer: 26, touch: 28 },
    lineHeight: { pointer: 32, touch: 36 },
  },
};

export const EASING_BEZIERS: Record<
  EasingName,
  readonly [number, number, number, number]
> = {
  'out-cubic': [0.333333, 1, 0.666667, 1],
  'in-cubic': [0.333333, 0, 0.666667, 0],
  'in-out-cubic': [0.65, 0, 0.35, 1],
  standard: [0.2, 0, 0, 1],
  'emphasized-decelerate': [0.05, 0.7, 0.1, 1],
  'emphasized-accelerate': [0.3, 0, 0.8, 0.15],
  decelerate: [0, 0, 0, 1],
  accelerate: [1, 0, 1, 1],
  'point-to-point': [0.55, 0.55, 0, 1],
};

/** Merge a paradigm's sparse L2 fields onto a base spec. Identity and `meta` stay put. */
function withParadigm(base: ThemeSpec, patch: ParadigmPatch): ThemeSpec {
  return {
    ...base,
    tokens: mergeTokens(base.tokens, patch.tokens),
    metrics: deepMerge(base.metrics, patch.metrics),
    elevation: deepMerge(base.elevation, patch.elevation),
    surfaces: deepMerge(base.surfaces, patch.surfaces),
    feedback: deepMerge(base.feedback, patch.feedback),
    motion: deepMerge(base.motion, patch.motion),
    controls: deepMerge(base.controls, patch.controls),
  };
}

function mergeTokens(
  base: TokensSpec,
  patch: ThemePatch['tokens'],
): TokensSpec {
  const merged = deepMerge(base, patch);
  if (!patch?.light && !patch?.dark) return merged;
  return {
    ...merged,
    light: patch.light
      ? { ...merged.light, brand: patch.light.brand }
      : merged.light,
    dark: patch.dark
      ? { ...merged.dark, brand: patch.dark.brand }
      : merged.dark,
    tints: patch.tints,
    chart: patch.chart as TokensSpec['chart'],
  };
}

/**
 * Create a complete `ThemeSpec` and runtime `AppTheme` from either a full `ThemeSpec` or a sparse
 * patch extending another theme. When `paradigm` is set, the merge order is the extended theme,
 * then `expandParadigm`, then the patch's own L2 fields. Omitting `paradigm` keeps the previous merge.
 */
export function defineTheme(input: ThemeSpec | ThemePatch): AppTheme {
  const base =
    'extends' in input
      ? input.paradigm
        ? withParadigm(input.extends, expandParadigm(input.paradigm))
        : input.extends
      : undefined;
  const spec: ThemeSpec =
    base !== undefined && 'extends' in input
      ? {
          id: input.id,
          label: input.label,
          tokens: mergeTokens(base.tokens, input.tokens),
          metrics: deepMerge(base.metrics, input.metrics),
          elevation: deepMerge(base.elevation, input.elevation),
          surfaces: deepMerge(base.surfaces, input.surfaces),
          feedback: deepMerge(base.feedback, input.feedback),
          motion: deepMerge(base.motion, input.motion),
          controls: deepMerge(base.controls, input.controls),
          meta: input.meta,
        }
      : (input as ThemeSpec);
  return {
    id: spec.id,
    label: spec.label,
    theme: compileNshTheme(spec),
    spec,
  };
}
