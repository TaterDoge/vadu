/**
 * Theme v5 runtime: unified colors, shapes, metrics, surfaces, feedback, motion, and control recipes
 * (`docs/decisions/0020-theme-v5.md`).
 *
 * Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.
 */
import type {
  AnimatedValue,
  BackdropMaterial,
  Easing as EasingCurve,
  MotionSpec as NshMotionSpec,
  TextStyle,
  Theme,
  Tokens,
  ViewStyle,
  WindowsBackdropMaterial,
} from 'nsh';
import {
  colorScheme,
  computed,
  createAnimatedValue,
  Easing,
  effect,
  platform,
  reduceMotion,
  setTheme,
  signal,
  token,
} from 'nsh';

import {
  type ResolvedSurfaceEffect,
  resolveSurfaceEffect,
  resolveTransitionShader,
} from './effects';
import { type ResolvedMaterial, resolveMaterial } from './materials';
import { presetTheme } from './preset';
import {
  type AnyColorKey,
  type AppTheme,
  type ColorExpr,
  type CoreColorKey,
  EASING_BEZIERS,
  type ElevationScale,
  type FaceExpr,
  type MaterialSpec,
  type Mode,
  type ModeOrFlat,
  type MotionSpringSpec,
  type ShadowExpr,
  type ShadowPart,
  SHARED_TYPE_SCALE,
  type SlotCorner,
  type SlotSize,
  type SurfaceEffectKind,
  type SurfaceEffectSpec,
  type SurfaceLayer,
  type SurfaceMaterial,
  type SurfaceRole,
  type SurfaceSpec,
  type ThemeSpec,
  type ThemeSwitchKind,
  type Tiered,
  type TieredOrFlat,
  type TimingSpec,
  type ToneColorKey,
  type TypeRole,
} from './schema';

export type {
  AnyColorKey,
  AppTheme,
  ColorExpr,
  CoreColorKey,
  ElevationScale,
  FaceExpr,
  MaterialSpec,
  Mode,
  ModeOrFlat,
  MotionSpringSpec,
  ResolvedSurfaceEffect,
  SlotCorner,
  SlotSize,
  SurfaceEffectKind,
  SurfaceEffectSpec,
  SurfaceMaterial,
  SurfaceRole,
  SurfaceSpec,
  ThemeSpec,
  ThemeSwitchKind,
  Tiered,
  TimingSpec,
  ToneColorKey,
  TypeRole,
};

export {
  SURFACE_SHADERS,
  TRANSITION_SHADERS,
  resolveSurfaceEffect,
  resolveTransitionShader,
} from './effects';
export { resolveMaterial } from './materials';

/** L1 axes. `defineTheme` expands them and does not store them on `ThemeSpec`. */
export type {
  ParadigmDensity,
  ParadigmDepth,
  ParadigmFeedback,
  ParadigmMotion,
  ParadigmPatch,
  ParadigmShape,
  ParadigmStroke,
  ThemeParadigm,
} from './paradigm';
export { expandParadigm } from './paradigm';

/** Terminal idiom metrics (`16x8` character grid points). */
export const terminal = platform.idiom === 'terminal';
export const TERMINAL_ROW = 16;
export const TERMINAL_COLUMN = 8;
export const TERMINAL_GAP = 24;

/** Active input tier fixed for the run: `"pointer"` on desktop, `"touch"` elsewhere. */
export const tier: 'pointer' | 'touch' = platform.desktop ? 'pointer' : 'touch';

/** Maximum radius rendered as a full capsule. */
export const CAPSULE_RADIUS = 999;

/** Default hairline edge width in points used by rail/knob edge shadow helpers. */
export const EDGE_WIDTH = 1;

/** Reactive dark-mode flag. */
export const isDark = () => colorScheme() !== 'light';

const selected = signal<AppTheme | null>(null);

/** Active runtime `AppTheme` (`selectTheme`), or the build-time preset when `null`. */
export const activeTheme = (): AppTheme => selected() ?? presetTheme;

/** Active `ThemeSpec` (reactive). */
export const activeSpec = (): ThemeSpec => activeTheme().spec;

/** Switch the active theme at runtime (`null` restores the build-time preset). */
export function selectTheme(theme: AppTheme | null): void {
  setTheme(theme ? (theme.theme as unknown as Theme) : null);
  selected.set(theme);
}

/** Current runtime theme ID, or `null` when showing the build-time preset. */
export function currentTheme(): string | null {
  const theme = selected();
  return theme === null ? null : theme.id;
}

/** Reactive token proxy object backed by NSH `token()`. */
function tokenGetters<K extends string>(
  names: Record<K, keyof Tokens>,
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(names) as K[]) {
    Object.defineProperty(out, key, {
      enumerable: true,
      get: () => token(names[key]) as string,
    });
  }
  return out;
}

export interface Palette {
  background: string;
  card: string;
  popover: string;
  muted: string;
  surface: string;
  foreground: string;
  mutedForeground: string;
  faint: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  accent: string;
  brand: string;
  border: string;
  line: string;
  input: string;
  ring: string;
  info: string;
  success: string;
  warning: string;
  destructive: string;
  scrim: string;
  media: string;
  onMedia: string;
}

/** Palette colors read reactively from active `theme.json` tokens. */
export const colors: Palette = tokenGetters<keyof Palette>({
  background: 'background',
  card: 'card',
  popover: 'popover',
  muted: 'muted',
  surface: 'surface',
  foreground: 'foreground',
  mutedForeground: 'muted-foreground',
  faint: 'faint',
  primary: 'primary',
  primaryForeground: 'primary-foreground',
  secondary: 'secondary',
  accent: 'accent',
  brand: 'brand',
  border: 'border',
  line: 'line',
  input: 'input',
  ring: 'ring',
  info: 'info',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
  scrim: 'scrim',
  media: 'media',
  onMedia: 'on-media',
});

/** Mix `color` with transparency (`0`–`1`) using CSS `color-mix`. */
export function alpha(color: string, a: number): string {
  return `color-mix(in srgb, ${color} ${Math.min(Math.max(a, 0), 1) * 100}%, transparent)`;
}

const relativeAlpha = /oklch\(from \{([a-z0-9-]+)\} l c h \/ ([\d.]+)\)/g;

const atAlpha = (color: string, a: number) =>
  `${color.slice(0, 7)}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;

function resolveTokenAliases(value: string): string {
  return value
    .replace(relativeAlpha, (whole, name: string, a: string) => {
      const c = token(name as keyof Tokens);
      return typeof c === 'string' ? atAlpha(c, Number(a)) : whole;
    })
    .replace(/var\(--([a-z0-9-]+)\)/g, (whole, name: string) => {
      const c = token(name as keyof Tokens);
      return typeof c === 'string' ? c : whole;
    })
    .replace(/\{([a-z0-9-]+)\}/g, (whole, name: string) => {
      const c = token(name as keyof Tokens);
      return typeof c === 'string' ? c : whole;
    });
}

function resolveTintValue(
  role: 'brand' | ToneColorKey,
  customAlpha?: number,
): string {
  const spec = activeSpec();
  const mode: Mode = isDark() ? 'dark' : 'light';
  if (customAlpha === undefined) {
    const custom = spec.tokens.tints?.[mode]?.[role];
    if (custom) return resolveTokenAliases(custom);
  }
  const base = colors[role];
  return alpha(base, customAlpha ?? spec.tokens.tintAlpha[mode]);
}

/** Reactive translucent tints (`tints.brand`, `tints.info`, `tints.success`, `tints.warning`, `tints.destructive`). */
export const tints: Record<'brand' | ToneColorKey, string> = {
  get brand() {
    return resolveTintValue('brand');
  },
  get info() {
    return resolveTintValue('info');
  },
  get success() {
    return resolveTintValue('success');
  },
  get warning() {
    return resolveTintValue('warning');
  },
  get destructive() {
    return resolveTintValue('destructive');
  },
};

export type Tone = 'neutral' | 'accent' | ToneColorKey;

/** Semantic text/border color for a UI tone. */
export const toneColor = (tone: Tone): string =>
  tone === 'neutral'
    ? colors.mutedForeground
    : tone === 'accent'
      ? colors.brand
      : colors[tone];

/** Subtle background tint for a UI tone. */
export const toneTint = (tone: Tone): string =>
  tone === 'neutral'
    ? colors.surface
    : tone === 'accent'
      ? tints.brand
      : tints[tone];

const THEME_COLOR_TOKENS = new Set<string>([
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
  'scrim',
  'media',
  'on-media',
]);

function readMode<T>(val: ModeOrFlat<T>): T {
  if (
    typeof val === 'object' &&
    val !== null &&
    'light' in val &&
    'dark' in val
  ) {
    return isDark() ? val.dark : val.light;
  }
  return val as T;
}

function readTiered<T>(val: TieredOrFlat<T>): T {
  if (
    typeof val === 'object' &&
    val !== null &&
    'pointer' in val &&
    'touch' in val
  ) {
    return val[tier];
  }
  return val as T;
}

/** Resolve any `ColorExpr` (or mode-wrapped color) to a CSS color string, or `null` for `"none"`. */
export function resolveColor(
  expr: ModeOrFlat<ColorExpr | 'none' | null> | undefined,
): string | null {
  if (expr === undefined || expr === null) return null;
  const unwrapped = readMode(expr);
  if (unwrapped === null || unwrapped === 'none') return null;
  if (typeof unwrapped === 'string') {
    if (THEME_COLOR_TOKENS.has(unwrapped))
      return token(unwrapped as keyof Tokens) as string;
    return resolveTokenAliases(unwrapped);
  }
  if ('tint' in unwrapped) {
    return resolveTintValue(unwrapped.tint, unwrapped.alpha);
  }
  if ('color' in unwrapped) {
    const base = THEME_COLOR_TOKENS.has(unwrapped.color)
      ? (token(unwrapped.color as keyof Tokens) as string)
      : resolveTokenAliases(unwrapped.color);
    return unwrapped.alpha === undefined ? base : alpha(base, unwrapped.alpha);
  }
  return null;
}

/** Reactive 5-series chart colors (defaults to `[brand, info, success, warning, destructive]`). */
function chartAt(index: 0 | 1 | 2 | 3 | 4): string {
  const mode: Mode = isDark() ? 'dark' : 'light';
  const custom = activeSpec().tokens.chart?.[mode];
  if (custom) return resolveColor(custom[index]) ?? colors.primary;
  return [
    colors.brand,
    colors.info,
    colors.success,
    colors.warning,
    colors.destructive,
  ][index]!;
}

export const chart = {
  get chart1() {
    return chartAt(0);
  },
  get chart2() {
    return chartAt(1);
  },
  get chart3() {
    return chartAt(2);
  },
  get chart4() {
    return chartAt(3);
  },
  get chart5() {
    return chartAt(4);
  },
};

/** Corner radii by layer, read reactively from `theme.json` + active `ThemeSpec`. */
export const shape = {
  get control(): number {
    return token('radius-control') as number;
  },
  get container(): number {
    return token('radius-container') as number;
  },
  get modal(): number {
    return token('radius-modal') as number;
  },
  get curve(): 'continuous' | 'circular' {
    return activeSpec().tokens.radius.curve;
  },
};

/** Border curve matching active theme (`"continuous"` or `"circular"`). */
export const cornerCurve: ViewStyle = {
  get borderCurve() {
    return shape.curve;
  },
};

/** Concentric rounded border radius (`Math.max(radius - inset, 0)`). */
export function rounded(radius: number, inset = 0): ViewStyle {
  return { borderRadius: Math.max(radius - inset, 0), ...cornerCurve };
}

function resolveCorner(raw: SlotCorner): number {
  if (raw === 'full') return CAPSULE_RADIUS;
  if (raw === 'container') return shape.container;
  if (raw === 'control') return shape.control;
  return raw;
}

/** Button corner radius for `"sm" | "default" | "lg"` at current tier. */
export function buttonCorner(size: 'sm' | 'default' | 'lg'): number {
  const step = size === 'default' ? 'md' : size;
  return resolveCorner(readTiered(activeSpec().controls.button.corner[step]));
}

/** Shared typography sizes + per-theme fontWeight/letterSpacing (`ADR 0009`). */
export const font = {
  size: (role: TypeRole) => SHARED_TYPE_SCALE[role].fontSize[tier],
  lineHeight: (role: TypeRole) => SHARED_TYPE_SCALE[role].lineHeight[tier],
  weight: (role: TypeRole) =>
    activeSpec().metrics.typography[role].fontWeight as NonNullable<
      TextStyle['fontWeight']
    >,
  letterSpacing: (role: TypeRole) =>
    activeSpec().metrics.typography[role].letterSpacing,
};

/** Stroke widths (`hairline`, `control`). */
export const stroke = {
  get hairline() {
    return activeSpec().metrics.stroke.hairline;
  },
  get control() {
    return activeSpec().metrics.stroke.control;
  },
};

/** Control heights by size (`sm`, `md`, `lg`) at active tier. */
export const controlHeight = {
  get sm() {
    return activeSpec().metrics.height[tier].sm;
  },
  get md() {
    return activeSpec().metrics.height[tier].md;
  },
  get lg() {
    return activeSpec().metrics.height[tier].lg;
  },
};

/** Icon sizes by size (`sm`, `md`, `lg`) at active tier. */
export const iconSize = {
  get sm() {
    return activeSpec().metrics.icon[tier].sm;
  },
  get md() {
    return activeSpec().metrics.icon[tier].md;
  },
  get lg() {
    return activeSpec().metrics.icon[tier].lg;
  },
};

/** Minimum touch/pointer hit target size at active tier. */
export const hitTarget = (): number => activeSpec().metrics.hit[tier];

/** Grouped metrics namespace (`metrics.height`, `metrics.icon`, `metrics.stroke`, `metrics.font`, etc.). */
export const metrics = {
  get height() {
    return activeSpec().metrics.height[tier];
  },
  get icon() {
    return activeSpec().metrics.icon[tier];
  },
  get density() {
    return activeSpec().metrics.density[tier];
  },
  get control() {
    return activeSpec().metrics.control[tier];
  },
  get item() {
    return activeSpec().metrics.item[tier];
  },
  get hit() {
    return activeSpec().metrics.hit[tier];
  },
  stroke,
  font,
};

/** System navigation header style across platforms. */
export const header = {
  get headerStyle() {
    return {
      backgroundColor: colors.background,
      color: colors.foreground,
      tintColor: colors.brand,
    };
  },
};

export type ElevationLevel = 'sm' | 'md' | 'lg' | 'xl';

/** Active appearance shadow scale. */
export function elevationScale(): ElevationScale {
  const scale = activeSpec().elevation;
  return isDark() ? scale.dark : scale.light;
}

/** Single shadow step (`sm | md | lg | xl`), or `"none"`. */
export function elevation(level: ElevationLevel): string {
  return elevationScale()[level] ?? 'none';
}

function resolveShadow(shadow: ShadowExpr | undefined): string | undefined {
  if (shadow === undefined) return undefined;
  if (shadow === null) return 'none';
  if (typeof shadow === 'string') {
    if (shadow in elevationScale()) {
      return elevationScale()[shadow as ShadowPart] ?? 'none';
    }
    return resolveTokenAliases(shadow);
  }
  const scale = elevationScale();
  const parts = shadow
    .map((part) => scale[part])
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
  return parts.length > 0 ? parts.join(', ') : 'none';
}

export interface PlatformMaterialProps {
  readonly ios?: { backdropMaterial: BackdropMaterial };
  readonly windows?: { backdrop: { material: WindowsBackdropMaterial } };
  readonly android?: { elevation?: number };
}

export interface ResolvedSurface {
  readonly style: ViewStyle;
  readonly ink: string;
  readonly platformProps: PlatformMaterialProps;
  /** GPU surface shader, or `null` in the terminal, under reduced motion, or when the layer asks for none. */
  readonly effect: ResolvedSurfaceEffect | null;
}

function backdropFilterFor(resolved: ResolvedMaterial): string {
  const blur = `blur(${resolved.blur}px)`;
  if (resolved.saturate === undefined) return blur;
  return `${blur} saturate(${Math.round(resolved.saturate * 100)}%)`;
}

function compileSurfaceLayer(layer: SurfaceLayer): ResolvedSurface {
  const style: ViewStyle = {};
  const bg = resolveColor(layer.background);
  if (bg !== null) style.backgroundColor = bg;
  if (layer.gradient)
    style.backgroundImage = resolveTokenAliases(layer.gradient);
  const boxShadow = resolveShadow(layer.shadow);
  if (boxShadow !== undefined) style.boxShadow = boxShadow;
  const border = resolveColor(layer.border);
  if (border !== null) style.borderColor = border;
  const borderTop = resolveColor(layer.borderTop);
  if (borderTop !== null) style.borderTopColor = borderTop;
  const borderBottom = resolveColor(layer.borderBottom);
  if (borderBottom !== null) style.borderBottomColor = borderBottom;

  const resolved = layer.material ? resolveMaterial(layer.material) : undefined;
  if (layer.backdropFilter !== undefined) {
    if (layer.backdropFilter !== null)
      style.backdropFilter = layer.backdropFilter;
  } else if (resolved) {
    style.backdropFilter = backdropFilterFor(resolved);
  }
  if (resolved?.glassEffect !== undefined) {
    style.glassEffect = resolved.glassEffect;
    if (bg !== null) style.glassTintColor = bg;
  }
  if (resolved?.specular) {
    const specColor = resolveColor(resolved.specular);
    if (specColor) {
      const highlight = `inset 0 1px 0 ${specColor}`;
      const existing = style.boxShadow;
      if (typeof existing === 'string' && existing !== 'none') {
        style.boxShadow = `${highlight}, ${resolveTokenAliases(existing)}`;
      } else if (Array.isArray(existing)) {
        style.boxShadow = [
          { x: 0, y: 1, color: specColor, inset: true },
          ...existing,
        ];
      } else {
        style.boxShadow = highlight;
      }
    }
  }

  const ink = resolveColor(layer.foreground) ?? colors.foreground;
  const platformProps: PlatformMaterialProps = {
    ...(resolved?.props.ios ? { ios: resolved.props.ios } : {}),
    ...(resolved?.props.windows ? { windows: resolved.props.windows } : {}),
    ...(typeof layer.elevation === 'number'
      ? { android: { elevation: layer.elevation } }
      : {}),
  };
  const effect =
    terminal || reduceMotion() ? null : resolveSurfaceEffect(layer.effect);

  return { style, ink, platformProps, effect };
}

function mergeSurfaceSpec(spec: SurfaceSpec): SurfaceLayer {
  const mode: Mode = isDark() ? 'dark' : 'light';
  return { ...spec, ...spec[mode] };
}

/** Resolve one named semantic surface (`card`, `raised`, `inset`, `overlay`, `modal`, `inverse`, `glass`, `accent`, `fill`, ...). */
export function surface(role: SurfaceRole): ResolvedSurface {
  return compileSurfaceLayer(mergeSurfaceSpec(activeSpec().surfaces[role]));
}

/** Width in points for a surface border (`0` when `"transparent"` or absent, else `stroke.hairline`). */
export function surfaceBorderWidth(borderColor: string | undefined): number {
  return !borderColor || borderColor === 'transparent' ? 0 : stroke.hairline;
}

/** Resolved progress/slider run gradient + fallback solid background. */
export function fillStyle(): ViewStyle {
  const fill = surface('fill').style;
  if (fill.backgroundImage) {
    return fill.backgroundColor
      ? {
          backgroundColor: fill.backgroundColor,
          backgroundImage: fill.backgroundImage,
        }
      : { backgroundImage: fill.backgroundImage };
  }
  if (typeof fill.backgroundColor !== 'string') return {};
  return {
    backgroundImage: `linear-gradient(180deg, ${fill.backgroundColor} 0%, ${fill.backgroundColor} 100%)`,
  };
}

function edgeShadow(
  borderColor: string | undefined,
  boxShadow: string | undefined,
  width: number,
  inset: boolean,
): string {
  const line =
    borderColor && borderColor !== 'transparent'
      ? `${inset ? 'inset ' : ''}0 0 0 ${width}px ${borderColor}`
      : undefined;
  const shade = boxShadow && boxShadow !== 'none' ? boxShadow : undefined;
  const parts = [line, shade].filter((p): p is string => p !== undefined);
  return parts.length === 0 ? 'none' : parts.join(', ');
}

function optionalEdgeShadow(
  borderColor: string | undefined,
  boxShadow: string | undefined,
  width: number,
): string | undefined {
  const resolved = edgeShadow(borderColor, boxShadow, width, true);
  return resolved === 'none' ? undefined : resolved;
}

/** Hairline inset shadow line inside a rail's own `boxShadow`. */
export function insetEdge(
  borderColor: string | undefined,
  boxShadow: string | undefined,
  width = EDGE_WIDTH,
): string {
  return edgeShadow(borderColor, boxShadow, width, true);
}

/** Hairline outer shadow line around a handle's `boxShadow`. */
export function outerEdge(
  borderColor: string | undefined,
  boxShadow: string | undefined,
  width = EDGE_WIDTH,
): string {
  return edgeShadow(borderColor, boxShadow, width, false);
}

/** Timing curve configuration ready for NSH `animate()` or CSS transitions. */
export interface Timing {
  readonly duration: number;
  readonly timingFunction: EasingCurve;
}

const EASINGS: Record<keyof typeof EASING_BEZIERS, EasingCurve> = {
  'out-cubic': Easing.out(Easing.cubic),
  'in-cubic': Easing.in(Easing.cubic),
  'in-out-cubic': Easing.inOut(Easing.cubic),
  standard: Easing.bezier(0.2, 0, 0, 1),
  'emphasized-decelerate': Easing.bezier(0.05, 0.7, 0.1, 1),
  'emphasized-accelerate': Easing.bezier(0.3, 0, 0.8, 0.15),
  decelerate: Easing.bezier(0, 0, 0, 1),
  accelerate: Easing.bezier(1, 0, 1, 1),
  'point-to-point': Easing.bezier(0.55, 0.55, 0, 1),
};

function resolveTiming(spec: TimingSpec): Timing {
  return {
    duration: spec.duration,
    timingFunction: EASINGS[spec.easing],
  };
}

const motionRole = (read: () => TimingSpec): Timing => {
  const current = computed(() => resolveTiming(read()));
  return {
    get duration() {
      return current().duration;
    },
    get timingFunction() {
      return current().timingFunction;
    },
  };
};

export type MotionPresetName = 'popoverEnter' | 'dialogEnter';
export type EnterSide = 'top' | 'bottom' | 'left' | 'right';

/** Motion timing channels, optional spring, CSS transition helper, and enter/indicator presets. */
export const motion = {
  fast: motionRole(() => activeSpec().motion.fast),
  default: motionRole(() => activeSpec().motion.default),
  slow: motionRole(() => activeSpec().motion.slow),
  state: motionRole(() => activeSpec().motion.state),
  get spring(): MotionSpringSpec | undefined {
    return activeSpec().motion.spring;
  },
  preset(name: MotionPresetName) {
    const m = activeSpec().motion;
    const p = m.presets[name];
    const reduced = reduceMotion();
    return {
      fromScale: reduced ? 1 : p.fromScale,
      fromY: reduced ? 0 : p.fromY,
      role: p.timing,
      timing: motion[p.timing],
      spring: !reduced && p.spring && m.spring ? m.spring : undefined,
    };
  },
  /** Build an NSH `MotionSpec` from a named theme enter preset, honoring `reduceMotion()` and `spring`. */
  enterSpec(
    name: MotionPresetName,
    options?: { readonly side?: EnterSide; readonly distance?: number },
  ): NshMotionSpec {
    const p = motion.preset(name);
    if (reduceMotion()) {
      return { duration: 0, keyframes: { opacity: [1, 1] } };
    }
    const distance =
      options?.distance ?? (p.fromY !== 0 ? Math.abs(p.fromY) : 0);
    const side = options?.side ?? (p.fromY < 0 ? 'top' : 'bottom');
    const away =
      options?.side !== undefined
        ? side === 'top' || side === 'left'
          ? distance
          : -distance
        : p.fromY !== 0
          ? p.fromY
          : -distance;
    const axis =
      side === 'top' || side === 'bottom' ? 'translateY' : 'translateX';
    return {
      duration: p.timing.duration,
      easing: p.timing.timingFunction,
      ...(p.spring ? { spring: p.spring } : {}),
      keyframes: {
        opacity: [0, 1],
        ...(p.fromScale === 1 ? {} : { scale: [p.fromScale, 1] }),
        ...(away === 0 ? {} : { [axis]: [away, 0] }),
      },
    };
  },
  /** Timing & optional spring used when switch/tab/segmented indicators glide between states. */
  get indicatorGlide(): {
    readonly timing: Timing;
    readonly spring: MotionSpringSpec | undefined;
  } {
    const m = activeSpec().motion;
    const g = m.presets.indicatorGlide;
    return {
      timing: motion[g.timing],
      spring: !reduceMotion() && g.spring && m.spring ? m.spring : undefined,
    };
  },
  /** Transition policy when switching runtime themes (`selectTheme`). */
  get themeSwitch(): {
    readonly kind: ThemeSwitchKind;
    readonly duration: number;
    readonly shader: string | null;
  } {
    if (reduceMotion()) return { kind: 'none', duration: 0, shader: null };
    const sw = activeSpec().motion.presets.themeSwitch;
    return {
      kind: sw.kind,
      duration: sw.duration,
      shader: resolveTransitionShader(sw.kind),
    };
  },
  transition(
    properties: string,
    role: 'state' | 'fast' | 'default' | 'slow' = 'state',
  ): ViewStyle {
    if (reduceMotion()) return { transitionProperty: 'none' };
    const spec = activeSpec().motion[role];
    const [x1, y1, x2, y2] = EASING_BEZIERS[spec.easing];
    return {
      transitionProperty: properties,
      transitionDuration: spec.duration,
      transitionTimingFunction: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
    };
  },
};

/** Drive `AnimatedValue` toward `to` over `config` (`spring` takes precedence when provided; lands immediately if `reduceMotion()`). */
export function animate(
  value: AnimatedValue,
  to: number,
  config: Timing & { readonly spring?: MotionSpringSpec } = motion.default,
): Promise<{ finished: boolean }> {
  if (reduceMotion()) {
    value.set(to);
    return Promise.resolve({ finished: true });
  }
  if (config.spring) {
    return value.spring(to, config.spring);
  }
  return value.timing(to, {
    duration: config.duration,
    easing: config.timingFunction,
  });
}

/** Reactive animated value that transitions whenever `target()` changes discreetly. */
export function follow(
  target: () => number,
  config: Timing = motion.fast,
): AnimatedValue {
  const v = createAnimatedValue(target());
  let shown = target();
  effect(() => {
    const next = target();
    if (next === shown) return;
    shown = next;
    void animate(v, next, config);
  });
  return v;
}

function stateLayerColor(
  kind: 'hover' | 'pressed',
  ink: AnyColorKey = 'foreground',
): string | undefined {
  const fb = activeSpec().feedback;
  const opacity = kind === 'hover' ? fb.hover.overlay : fb.press.overlay;
  if (opacity <= 0) return undefined;
  return alpha(resolveColor(ink) ?? colors.foreground, opacity);
}

function stateLayerStyle(
  kind: 'hover' | 'pressed',
  ink: AnyColorKey = 'foreground',
): ViewStyle {
  const wash = stateLayerColor(kind, ink);
  if (!wash) return {};
  return {
    backgroundImage: `linear-gradient(180deg, ${wash} 0%, ${wash} 100%)`,
  };
}

/**
 * Unified interaction feedback domain: hover, press, focus, disabled, passive opacities, and touchSlop.
 */
export const feedback = {
  /** Generic hover fill or Material state-layer wash. */
  hoverStyle(ink: AnyColorKey = 'foreground'): ViewStyle {
    const fb = activeSpec().feedback.hover;
    if (fb.overlay > 0) return stateLayerStyle('hover', ink);
    return { backgroundColor: resolveColor(fb.fill) ?? 'transparent' };
  },
  /** Raised control hover surface (`backgroundColor`, `border*`, `boxShadow`). */
  hoverSurface(ink: AnyColorKey = 'foreground'): ViewStyle {
    const fb = activeSpec().feedback.hover;
    if (fb.overlay > 0) return stateLayerStyle('hover', ink);
    return compileSurfaceLayer(mergeSurfaceSpec(fb.surface)).style;
  },
  /**
   * Press interaction style (`activeStyle` + `transition`).
   * Unifies press scale/translateY, Material state layer, secondary press surface swap, and accent press.
   */
  press(
    intent:
      | 'surface'
      | 'accent'
      | 'ghost'
      | 'outline'
      | 'destructive'
      | 'sinkOnly' = 'surface',
    o?: {
      scale?: number;
      also?: string;
      ink?: AnyColorKey;
      outlineBorder?: string;
    },
  ): { readonly activeStyle: ViewStyle; readonly transition: ViewStyle } {
    const p = activeSpec().feedback.press;
    const transform = (() => {
      if (reduceMotion()) return undefined;
      const list: NonNullable<ViewStyle['transform']> = [];
      if (p.scale < 1) list.push({ scale: o?.scale ?? p.scale });
      if (p.translateY !== 0) list.push({ translateY: p.translateY });
      return list.length > 0 ? list : undefined;
    })();
    const transitionProp = o?.also ? `${o.also}, transform` : 'transform';
    const transition = motion.transition(transitionProp, 'state');

    if (intent === 'sinkOnly') {
      return {
        activeStyle: transform ? { transform } : {},
        transition,
      };
    }

    let shade: ViewStyle = {};
    if (p.overlay > 0) {
      shade = stateLayerStyle('pressed', o?.ink ?? 'foreground');
    } else if (intent === 'accent') {
      const pressedBg = resolveColor(p.accent.background);
      if (pressedBg !== null) {
        shade = {
          ...surface('accent').style,
          opacity: p.accent.opacity,
          backgroundColor: pressedBg,
          backgroundImage: 'none',
          borderColor: 'transparent',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
        };
      } else {
        shade = { ...surface('accent').style, opacity: p.accent.opacity };
      }
    } else if (intent === 'destructive') {
      shade = {
        backgroundColor: alpha(colors.destructive, 0.22),
        boxShadow: 'none',
      };
    } else if (intent === 'outline') {
      shade = {
        ...compileSurfaceLayer(mergeSurfaceSpec(p.surface)).style,
        ...(o?.outlineBorder ? { borderColor: o.outlineBorder } : {}),
      };
    } else {
      shade = compileSurfaceLayer(mergeSurfaceSpec(p.surface)).style;
    }

    return {
      activeStyle: transform ? { ...shade, transform } : shade,
      transition,
    };
  },
  /** Ink when accent or surface control is pressed. */
  pressedInk(intent: 'accent' | 'surface'): string {
    const p = activeSpec().feedback.press;
    if (intent === 'accent') {
      return resolveColor(p.accent.foreground) ?? surface('accent').ink;
    }
    return compileSurfaceLayer(mergeSurfaceSpec(p.surface)).ink;
  },
  /** Keyboard focus ring (`halo`, `outline`, or `double`). */
  focusRing(offset?: number): ViewStyle {
    const f = activeSpec().feedback.focus;
    const ring = colors.ring;
    const base: ViewStyle = {
      outlineStyle: 'solid',
      outlineWidth: f.width,
      outlineColor: f.style === 'halo' ? alpha(ring, 0.3) : ring,
      outlineOffset: offset ?? f.offset,
    };
    if (f.style === 'halo') return { borderColor: ring, ...base };
    if (f.style === 'double') {
      const inner = resolveColor(f.innerColor) ?? colors.card;
      return {
        ...base,
        outlineOffset: (offset ?? f.offset) + 1,
        boxShadow: `0 0 0 1px ${inner}`,
      };
    }
    return base;
  },
  /** Disabled appearance (`replaceFace`, `contentOpacity`, replacement `style` and `ink`). */
  get disabled() {
    const d = activeSpec().feedback.disabled;
    const resolved = compileSurfaceLayer(mergeSurfaceSpec(d.surface));
    return {
      contentOpacity: d.contentOpacity,
      replaceFace: d.replaceFace,
      style: resolved.style,
      ink: resolved.ink,
    };
  },
  /** Passive indicator opacity (e.g. scrollbar thumb). */
  get passive() {
    return activeSpec().feedback.passive;
  },
  /** Touch hit expansion outside small controls on touch screens. */
  touchSlop(side: number): number | undefined {
    const hit = hitTarget();
    if (terminal || side >= hit) return undefined;
    return (hit - side) / 2;
  },
  /** Hover overlay opacity (`> 0` on Material). */
  get hoverOverlay() {
    return activeSpec().feedback.hover.overlay;
  },
  /** Press overlay opacity (`> 0` on Material). */
  get pressOverlay() {
    return activeSpec().feedback.press.overlay;
  },
  /** Hover overlay color helper for circular targets (checkbox/radio). */
  hoverLayerColor: (ink: AnyColorKey = 'foreground') =>
    stateLayerColor('hover', ink),
};

export const focusRing = (offset?: number): ViewStyle =>
  feedback.focusRing(offset);
export const hovered = (ink?: AnyColorKey): ViewStyle =>
  feedback.hoverStyle(ink);
export const dimmed = {
  get rest() {
    return activeSpec().feedback.passive.restOpacity;
  },
  get pressed() {
    return activeSpec().feedback.passive.pressedOpacity;
  },
  get disabled() {
    return activeSpec().feedback.disabled.contentOpacity;
  },
};
export const press = {
  get scale() {
    return activeSpec().feedback.press.scale;
  },
};

/** Resolved face for a control slot (`style` when surface or color, plus resolved `backgroundColor` & `borderColor` & `ink`). */
export interface ResolvedFace {
  readonly kind: 'surface' | 'color';
  readonly style: ViewStyle;
  readonly color: string;
  readonly borderColor?: string;
  readonly ink?: string;
}

function resolveFaceExpr(
  expr: FaceExpr | 'none' | null | undefined,
): ResolvedFace | null {
  if (expr === undefined || expr === null || expr === 'none') return null;
  if (typeof expr === 'object' && 'surface' in expr) {
    const s = surface(expr.surface);
    return {
      kind: 'surface',
      style: s.style,
      color: (s.style.backgroundColor as string | undefined) ?? 'transparent',
      borderColor: s.style.borderColor as string | undefined,
      ink: s.ink,
    };
  }
  const color = resolveColor(expr);
  if (color === null) return null;
  return { kind: 'color', style: { backgroundColor: color }, color };
}

function resolveBoxSize(
  raw: TieredOrFlat<SlotSize>,
  fallback?: readonly [number, number],
): readonly [number, number] {
  const val = readTiered(raw);
  if (val === 'same') {
    if (!fallback) throw new Error('`same` size requires a resting knob size');
    return fallback;
  }
  return typeof val === 'number' ? [val, val] : val;
}

const FOCUS_BG_MAP: Record<string, string> = {
  brand: 'focus:bg-brand/15',
  accent: 'focus:bg-accent',
};

/**
 * Strongly typed reactive reader for every control group in `controls` (`docs/decisions/0020-theme-v5.md`).
 */
export function control<K extends keyof ThemeSpec['controls']>(
  name: K,
): ResolvedControlMap[K] {
  const c = activeSpec().controls;
  switch (name) {
    case 'button': {
      const b = c.button;
      const shadeStyle =
        b.shade === 'none'
          ? 'none'
          : (surface(b.shade).style.boxShadow ?? 'none');
      const secFace = resolveFaceExpr(b.secondary.face);
      const secEdge =
        b.secondary.edge === 'none'
          ? null
          : typeof b.secondary.edge === 'object' &&
              'surface' in b.secondary.edge
            ? (surface(b.secondary.edge.surface).style.borderColor ??
              colors.border)
            : resolveColor(b.secondary.edge);
      const outEdge =
        typeof b.outline.edge === 'object' && 'surface' in b.outline.edge
          ? (surface(b.outline.edge.surface).style.borderColor ?? colors.border)
          : (resolveColor(b.outline.edge) ?? colors.border);
      const selFace = resolveFaceExpr(b.selected.face);
      const desEdge =
        b.destructive.edge === 'none' ? null : resolveColor(b.destructive.edge);
      return {
        corner: buttonCorner,
        shade: shadeStyle,
        selected: {
          style: selFace?.style ?? {},
          ink: resolveColor(b.selected.ink) ?? colors.primaryForeground,
        },
        secondary: {
          style: {
            ...(secFace?.style ?? {}),
            borderColor: secEdge ?? 'transparent',
            boxShadow: shadeStyle,
          } satisfies ViewStyle,
        },
        outlineEdge: outEdge,
        destructive: {
          edge: desEdge,
          style: {
            backgroundColor: tints.destructive,
            borderColor: desEdge ?? 'transparent',
            ...(b.shade === 'none' ? {} : { boxShadow: shadeStyle }),
          } satisfies ViewStyle,
          ink: colors.destructive,
        },
      } as ResolvedControlMap[K];
    }
    case 'badge':
      return { corner: resolveCorner(c.badge.corner) } as ResolvedControlMap[K];
    case 'field': {
      const f = c.field;
      const edges = f.edge.sides ? ('all' as const) : ('bottom' as const);
      return {
        edges,
        width: stroke.control,
        radius: shape.control,
        // Structural rule: underline fields always have flat bottom corners (0).
        bottomRadius: edges === 'bottom' ? 0 : shape.control,
        sideColor:
          edges === 'all' ? (resolveColor(f.edge.color) ?? colors.input) : null,
        sideClass:
          edges === 'all' && typeof f.edge.color === 'string'
            ? `border-${f.edge.color}`
            : 'border-transparent',
        bottomColor: resolveColor(f.edge.bottom) ?? colors.input,
        bottomClass:
          typeof f.edge.bottom === 'string'
            ? `border-b-${f.edge.bottom}`
            : 'border-b-input',
        ground: resolveColor(f.ground) ?? colors.card,
        shadeShadow:
          f.shade === 'none'
            ? 'none'
            : (surface(f.shade).style.boxShadow ?? 'none'),
        focusLine: f.focus.line,
        focusWidth: f.focus.width,
        focusUsesRing: f.focus.color === 'ring',
      } as ResolvedControlMap[K];
    }
    case 'choice': {
      const ch = c.choice;
      const size = readTiered(ch.size);
      const box = readTiered(ch.box);
      const corner = resolveCorner(readTiered(ch.corner));
      const edgeW = ch.edge.width;
      const edgeColor = resolveColor(ch.edge.color);
      const disabledEdgeColor = resolveColor(ch.edge.disabled);
      const checkedFace = resolveFaceExpr(ch.checked.face);
      const radioCheckedFace = resolveFaceExpr(ch.radioChecked.face);
      return {
        size,
        box,
        corner,
        face: resolveColor(ch.face),
        shadeShadow:
          ch.shade === 'none'
            ? 'none'
            : (surface(ch.shade).style.boxShadow ?? 'none'),
        edgeWidth: edgeColor === null ? 0 : edgeW,
        edgeColor,
        disabledEdgeColor: disabledEdgeColor ?? edgeColor,
        checkedStyle: checkedFace?.style ?? null,
        radioCheckedStyle: radioCheckedFace?.style ?? null,
        mark: readTiered(ch.mark),
      } as ResolvedControlMap[K];
    }
    case 'switch': {
      const sw = c.switch;
      const track = readTiered(sw.track);
      const smallTrack = readTiered(sw.small.track);
      const smallKnob = resolveBoxSize(sw.small.knob);
      const knob = resolveBoxSize(sw.knob.size);
      const knobOn = resolveBoxSize(sw.knob.on, knob);
      const knobPressed = resolveBoxSize(sw.knob.pressed, knob);
      const [bw, bh] = knob;
      const [pw, ph] = knobPressed;
      const feedbackKind =
        pw === bw && ph === bh
          ? ('none' as const)
          : pw / bw > ph / bh
            ? ('stretch' as const)
            : ('expand' as const);
      return {
        width: track[0],
        height: track[1],
        smallWidth: smallTrack[0],
        smallHeight: smallTrack[1],
        trackOffFace: resolveColor(sw.trackOffFace) ?? colors.muted,
        edgeOff: readTiered(sw.edge.off),
        edgeOn: readTiered(sw.edge.on),
        edgeColor:
          sw.edge.color === 'none' ? null : resolveColor(sw.edge.color),
        knobWidth: knob[0],
        knobHeight: knob[1],
        knobSmallWidth: smallKnob[0],
        knobSmallHeight: smallKnob[1],
        knobOnWidth: knobOn[0],
        knobOnHeight: knobOn[1],
        knobPressedWidth: knobPressed[0],
        knobPressedHeight: knobPressed[1],
        feedback: feedbackKind,
        knobStyle(checked: boolean): ViewStyle {
          const bg = resolveColor(
            checked && sw.knob.checkedBackground
              ? sw.knob.checkedBackground
              : sw.knob.background,
          );
          const border = resolveColor(
            checked && sw.knob.checkedBorder
              ? sw.knob.checkedBorder
              : sw.knob.border,
          );
          const grad =
            checked && sw.knob.checkedGradient !== undefined
              ? sw.knob.checkedGradient
              : sw.knob.gradient;
          const resolvedGrad = readMode(grad ?? null);
          const shadow = resolveShadow(sw.knob.shadow);
          return {
            ...(bg !== null ? { backgroundColor: bg } : {}),
            ...(border !== null ? { borderColor: border } : {}),
            backgroundImage: resolvedGrad
              ? resolveTokenAliases(resolvedGrad)
              : 'none',
            ...(shadow !== undefined ? { boxShadow: shadow } : {}),
          };
        },
      } as ResolvedControlMap[K];
    }
    case 'slider': {
      const sl = c.slider;
      const knob = resolveBoxSize(sl.knob.size);
      const pressed = resolveBoxSize(sl.knob.pressed, knob);
      const grad = readMode(sl.knob.gradient ?? null);
      const border = resolveColor(sl.knob.border);
      const shadow = resolveShadow(sl.knob.shadow);
      const grooveColor = resolveColor(sl.face) ?? colors.muted;
      const shadeShadow =
        sl.shade === 'none'
          ? 'none'
          : (surface(sl.shade).style.boxShadow ?? 'none');
      const edgeColor =
        sl.edge.color === 'none' ? null : resolveColor(sl.edge.color);
      return {
        rail: readTiered(sl.rail),
        band: readTiered(sl.band),
        knobWidth: knob[0],
        knobHeight: knob[1],
        knobPressedWidth: pressed[0],
        knobPressedHeight: pressed[1],
        knobStyle: {
          backgroundColor: resolveColor(sl.knob.background) ?? colors.card,
          ...(grad ? { backgroundImage: resolveTokenAliases(grad) } : {}),
          borderColor: border ?? 'transparent',
          ...(shadow !== undefined ? { boxShadow: shadow } : {}),
        } satisfies ViewStyle,
        hasKnobEdge: border !== null && border !== 'transparent',
        knobEdgeColor: border,
        knobShadow: shadow,
        grooveColor,
        grooveShadow: optionalEdgeShadow(
          edgeColor ?? undefined,
          typeof shadeShadow === 'string' ? shadeShadow : undefined,
          sl.edge.width,
        ),
        hasGrooveShade: sl.shade !== 'none',
        mark: readTiered(sl.mark),
      } as ResolvedControlMap[K];
    }
    case 'progress': {
      const pr = c.progress;
      const grooveColor = resolveColor(pr.face) ?? colors.muted;
      const shadeShadow =
        pr.shade === 'none' ? 'none' : surface(pr.shade).style.boxShadow;
      const edgeColor =
        pr.edge.color === 'none' ? null : resolveColor(pr.edge.color);
      return {
        height: pr.height,
        grooveColor,
        grooveShadow: optionalEdgeShadow(
          edgeColor ?? undefined,
          typeof shadeShadow === 'string' ? shadeShadow : undefined,
          pr.edge.width,
        ),
      } as ResolvedControlMap[K];
    }
    case 'spinner':
      return { trackOpacity: c.spinner.trackOpacity } as ResolvedControlMap[K];
    case 'popup':
      return { corner: resolveCorner(c.popup.corner) } as ResolvedControlMap[K];
    case 'list': {
      const hl = c.list.item.highlight;
      const key =
        typeof hl === 'string'
          ? hl
          : typeof hl === 'object' && hl !== null && 'tint' in hl
            ? hl.tint
            : '';
      const bgCls = FOCUS_BG_MAP[key];
      if (!bgCls)
        throw new Error(
          `unsupported list.item.highlight: ${JSON.stringify(hl)}`,
        );
      const hasEdge = c.list.item.edge !== 'none';
      return {
        highlightClass: (withEdge = true) =>
          withEdge && hasEdge ? `focus:border-brand/30 ${bgCls}` : bgCls,
      } as ResolvedControlMap[K];
    }
    case 'tabs': {
      const tr = c.tabs.track;
      return {
        face: resolveColor(tr.face),
        edge: tr.edge === 'none' ? null : resolveColor(tr.edge),
        corner: resolveCorner(tr.corner),
      } as ResolvedControlMap[K];
    }
    case 'menubar':
      return {
        bar: c.menubar.bar,
        style: c.menubar.bar === 'card' ? surface('card').style : {},
      } as ResolvedControlMap[K];
    case 'well':
      return {
        edge: c.well.edge === 'none' ? null : resolveColor(c.well.edge),
      } as ResolvedControlMap[K];
  }
  throw new Error(`unknown control group: ${String(name)}`);
}

export interface ResolvedControlMap {
  button: {
    readonly corner: (size: 'sm' | 'default' | 'lg') => number;
    readonly shade: string;
    readonly selected: { readonly style: ViewStyle; readonly ink: string };
    readonly secondary: { readonly style: ViewStyle };
    readonly outlineEdge: string;
    readonly destructive: {
      readonly edge: string | null;
      readonly style: ViewStyle;
      readonly ink: string;
    };
  };
  badge: { readonly corner: number };
  field: {
    readonly edges: 'all' | 'bottom';
    readonly width: number;
    readonly radius: number;
    readonly bottomRadius: number;
    readonly sideColor: string | null;
    readonly sideClass: string;
    readonly bottomColor: string;
    readonly bottomClass: string;
    readonly ground: string;
    readonly shadeShadow: string;
    readonly focusLine: boolean;
    readonly focusWidth: number;
    readonly focusUsesRing: boolean;
  };
  choice: {
    readonly size: number;
    readonly box: number;
    readonly corner: number;
    readonly face: string | null;
    readonly shadeShadow: string;
    readonly edgeWidth: number;
    readonly edgeColor: string | null;
    readonly disabledEdgeColor: string | null;
    readonly checkedStyle: ViewStyle | null;
    readonly radioCheckedStyle: ViewStyle | null;
    readonly mark: number;
  };
  switch: {
    readonly width: number;
    readonly height: number;
    readonly smallWidth: number;
    readonly smallHeight: number;
    readonly trackOffFace: string;
    readonly edgeOff: number;
    readonly edgeOn: number;
    readonly edgeColor: string | null;
    readonly knobWidth: number;
    readonly knobHeight: number;
    readonly knobSmallWidth: number;
    readonly knobSmallHeight: number;
    readonly knobOnWidth: number;
    readonly knobOnHeight: number;
    readonly knobPressedWidth: number;
    readonly knobPressedHeight: number;
    readonly feedback: 'none' | 'expand' | 'stretch';
    readonly knobStyle: (checked: boolean) => ViewStyle;
  };
  slider: {
    readonly rail: number;
    readonly band: number;
    readonly knobWidth: number;
    readonly knobHeight: number;
    readonly knobPressedWidth: number;
    readonly knobPressedHeight: number;
    readonly knobStyle: ViewStyle;
    readonly hasKnobEdge: boolean;
    readonly knobEdgeColor: string | null;
    readonly knobShadow: string | undefined;
    readonly grooveColor: string;
    readonly grooveShadow: string | undefined;
    readonly hasGrooveShade: boolean;
    readonly mark: number;
  };
  progress: {
    readonly height: number;
    readonly grooveColor: string;
    readonly grooveShadow: string | undefined;
  };
  spinner: { readonly trackOpacity: number };
  popup: { readonly corner: number };
  list: { readonly highlightClass: (withEdge?: boolean) => string };
  tabs: {
    readonly face: string | null;
    readonly edge: string | null;
    readonly corner: number;
  };
  menubar: { readonly bar: 'card' | 'none'; readonly style: ViewStyle };
  well: { readonly edge: string | null };
}
