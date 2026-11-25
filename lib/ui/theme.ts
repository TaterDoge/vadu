// The theme's roles, finishes, radii, focus and motion, read from `theme.json` and `semantics.json`.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type {
  AnimatedValue,
  BackdropMaterial,
  Easing as EasingCurve,
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
  type FaceRole,
  type FinishFieldList,
  type FinishFieldName,
  type FinishFields,
  type FinishOf,
  type FinishRole,
} from './finish-fields';
import {
  type FinishMaterial,
  type MaterialRecipe,
  materials,
} from './materials';
import semantics from './semantics.json';

/**
 * The Terminal idiom (`nsh`'s internal module, so not a public API): a
 * terminal program leaves out what it cannot draw well (charts,
 * sparklines, decorative icons and art, window chrome), puts on one row
 * what other platforms stack, and spaces in whole rows.
 */
export const terminal = platform.idiom === 'terminal';

/**
 * One row and one column of the terminal grid, in points (a Cell is 16 by 8
 * points): the terminal's line height and its unit of spacing. This
 * library's own, over `nsh`'s internal Cell metrics; everywhere else the
 * grid keeps two columns to a Cell.
 */
export const TERMINAL_ROW = 16;
export const TERMINAL_COLUMN = 8;

/** The gap the terminal's layout makes two columns (it makes any smaller
 * gap one): between neighbours that are words, such as icon buttons shown
 * as their labels, so they read apart. */
export const TERMINAL_GAP = 24;

/** Whether the app shows its dark palette; reactive: reading it subscribes. */
export const isDark = () => colorScheme() !== 'light';

/**
 * The `finishes` block of `semantics.json`: fields shared by both appearances plus sparse light/dark
 * overrides. A role carries exactly the fields `finish-fields.ts` gives it, in every theme.
 */
export interface SplitFinishes {
  shared: { [R in FinishRole]: Partial<FinishOf<R>> };
  light: Partial<{ [R in FinishRole]: Partial<FinishOf<R>> }>;
  dark: Partial<{ [R in FinishRole]: Partial<FinishOf<R>> }>;
}

/**
 * What a component reads of a finish (`finish.overlay`): the style keys, spread into a `style`. A
 * finish whose `material` has `apple` also has `glassEffect` (and `glassTintColor`, unless its tint is
 * `null`); otherwise these keys are not there at all. `material` itself is never a style key.
 */
interface FinishStyleFields {
  backgroundColor?: string;
  backgroundImage?: string;
  boxShadow: string;
  borderColor?: string;
  borderTopColor?: string;
  borderBottomColor?: string;
  backdropFilter?: string;
  /** The ink on this finish's surface, read by what draws text over it. */
  foreground: string;
  /**
   * The fill and ink a theme paints instead of this finish's while a filled control is pressed, read
   * by what draws the press; absent where the theme keeps the finish and dims it.
   */
  pressedBackground?: string;
  pressedForeground?: string;
  /** How far a filled control dims while it is pressed (`accent` states it; 1: no dimming). */
  pressedOpacity?: number;
  /**
   * A knob's checked state, read by the control that draws the knob while the control is on: absent
   * where the theme keeps the unchecked value, `checkedGradient` `null` where it paints the knob flat.
   */
  checkedBackground?: string;
  checkedBorderColor?: string;
  checkedGradient?: string | null;
  glassEffect?: 'regular' | 'clear';
  glassTintColor?: string;
}

/** The style key one finish field draws with; `never` for the fields read by name (the ink, the elevation). */
type FinishStyleKey = {
  background: 'backgroundColor';
  gradient: 'backgroundImage';
  shadow: 'boxShadow';
  'border-color': 'borderColor';
  'border-top-color': 'borderTopColor';
  'border-bottom-color': 'borderBottomColor';
  backdropFilter: 'backdropFilter';
  'pressed-background': 'pressedBackground';
  'pressed-foreground': 'pressedForeground';
  'pressed-opacity': 'pressedOpacity';
  'checked-background': 'checkedBackground';
  'checked-border-color': 'checkedBorderColor';
  'checked-gradient': 'checkedGradient';
  foreground: 'foreground';
  material: 'glassEffect' | 'glassTintColor';
  elevation: never;
};

type FinishStyleKeys<R extends FinishRole> = {
  [F in FinishFieldList<R>[number]]: FinishStyleKey[F];
}[FinishFieldList<R>[number]];

export type FinishStyle<R extends FinishRole = FinishRole> = Pick<
  FinishStyleFields,
  FinishStyleKeys<R>
>;

/** The finishes' roles: the layers a surface can be (`FinishRole` in `finish-fields.ts`). A control that differs reads its control dimension (`control()`), not a finish. */
export type { FaceRole, FinishRole };

/** The shadow scale's levels: a control, a card, a floating panel, a dialog. */
export type ElevationLevel = 'sm' | 'md' | 'lg' | 'xl';

/**
 * One appearance's shadow scale, as `semantics.json` writes it: the steps a finish names, plus the
 * one `inset` and the two hard edges (`edge.surface`, `edge.accent`). A part a theme has no value
 * for is `null` — a finish that names it simply does not wear it.
 */
export interface Elevation {
  sm: string | null;
  md: string | null;
  lg: string | null;
  xl: string | null;
  inset: string | null;
  edge?: { surface: string | null; accent: string | null };
}

/** What a theme's `semantics.json` holds: its style groups, its split finishes (`shared` + sparse `light`/`dark`) and the shadow scale per appearance. */
export interface Semantics extends Style {
  finishes: SplitFinishes;
  elevation: { light: Elevation; dark: Elevation };
}

/** A value for each tier: a pointer's (a desktop) and a touch screen's. */
export interface Tiered<T> {
  pointer: T;
  touch: T;
}

/** One typography role: fontSize in points and lineHeight in whole points per tier, numeric fontWeight (400..700), letterSpacing in points. */
export interface TypographyRole {
  fontSize: Tiered<number>;
  lineHeight: Tiered<number>;
  fontWeight: number;
  letterSpacing: number;
}

/** What a control's own spacing reads in one tier: the padding inside its box, the gap beside it, a radio's dot, and which switch size sits beside a label. Rows and glyphs come from the height and icon scales, not from here. */
export interface ControlMetrics {
  padding: number;
  gap: number;
  dot: number;
  switch: string;
}

/** A page's density in one tier: its padding and its gaps. Rows come from the height scale, a section's corners from `shape.container`. */
export interface DensitySpacing {
  pad: number;
  gap: number;
}

/** A list's rows in one tier: `inset` from the container's edge to a row's fill, `pad` from the fill's edge to its text. A popup list, a menu and a palette read them. */
export interface ItemSpacing {
  inset: number;
  pad: number;
}

/** Three steps of one size, small to large. */
export interface Steps {
  sm: number;
  md: number;
  lg: number;
}

/** A spring of `motion`: a unit mass's stiffness and damping. */
export interface Spring {
  stiffness: number;
  damping: number;
}

/** A timing specification as written in `semantics.json`: duration in ms and a named timing curve. */
export interface TimingSpec {
  duration: number;
  timingFunction: string;
}

/** A resolved timing configuration of `motion`, ready for `animate()` or `follow()`. */
export interface Timing {
  duration: number;
  timingFunction: EasingCurve;
}

/**
 * A field's look: `box` four edges, `underline` the bottom edge only, `box-underline` four edges with round corners.
 */
export type Field = 'box' | 'underline' | 'box-underline';

/** A choice's look (a radio, a checkbox): `well` a sunk face, `outline` an edge alone, `inset` a flat face. */
export type Choice = 'well' | 'outline' | 'inset';

/** A track's look (a progress bar, a slider, a segmented control): `sunk` a grooved channel, `tint` a flat band, `hairline` a thin line. */
export type Track = 'sunk' | 'tint' | 'hairline';

/** A handle's look (a slider's thumb, a switch's knob): `circle` a dot, `ring` a ring. */
export type Handle = 'circle' | 'ring';

/** The four control dimensions of `semantics.json`'s `dimension.control`: one value each. */
export interface ControlDimensions {
  field: Field;
  choice: Choice;
  track: Track;
  handle: Handle;
}

/** The keys of `ControlDimensions`, in the order `semantics.json` writes them. */
export const CONTROL_DIMENSIONS = [
  'field',
  'choice',
  'track',
  'handle',
] as const;

/**
 * The style of a theme: what `semantics.json` states beside its finishes, in DTCG field naming,
 * the same keys in every theme (`check:theme`). A string that names one of a list (a curve, a
 * timingFunction) or numeric fontWeight is checked by `check:theme` (`scripts/theme/style.ts`).
 * `docs/specs/native-themes.md` §3.2 says what each key is.
 */
export interface Style {
  typography: {
    caption: TypographyRole;
    detail: TypographyRole;
    body: TypographyRole;
    label: TypographyRole;
    title: TypographyRole;
    headline: TypographyRole;
    display: TypographyRole;
  };
  dimension: {
    shape: {
      control: string;
      container: string;
      modal: string;
    };
    size: {
      hit: Tiered<number>;
      density: Tiered<DensitySpacing>;
      item: Tiered<ItemSpacing>;
      control: Tiered<ControlMetrics>;
      height: Tiered<Steps>;
    };
    stroke: { hairline: number; control: number };
    focus: { style: string; width: number; offset: number };
    /** The four axes a theme decides for its controls (`control()`); nothing here names a platform. */
    control: ControlDimensions;
    icon: Tiered<Steps>;
  };
  shape: {
    curve: string;
    corners: {
      button: 'full' | 'radius';
    };
  };
  state: {
    'press-scale': number;
    overlay: { hover: number; focus: number; pressed: number; dragged: number };
    ripple: boolean;
    /** Opacity of a passive indicator at rest (a scrollbar's thumb), `rest-opacity`. */
    'rest-opacity': number;
    'pressed-opacity': number;
    disabled: { content: number; fill: boolean };
  };
  transition: {
    enter: TimingSpec;
  };
  motion: {
    fast: Spring | TimingSpec;
    default: Spring | TimingSpec;
    slow: Spring | TimingSpec;
    /** How fast a hover, a press or a choice comes and goes: always timed. */
    state: TimingSpec;
  };
}

/**
 * One theme an app can switch to while it runs (`selectTheme`): the id an
 * app stores to bring it back, the name a list of them shows, and the
 * content of the two files a theme is.
 */
export interface AppTheme {
  /** The id an app stores and compares: `"shadcn"`. */
  id: string;
  /** The name a list of themes shows: `"shadcn neutral"`. */
  label: string;
  /** `theme.json`'s content: the tokens `setTheme` takes. */
  theme: Theme;
  /** `semantics.json`'s content. */
  semantics: Semantics;
}

/** The build-time semantics: `semantics.json` beside this file (the app's `nsh-ui.json` names the theme they belong to). */
const builtIn = semantics as Semantics;

/** The theme `selectTheme` put in; `null` while the app shows its build-time one. */
const selected = signal<AppTheme | null>(null);

/** The semantics in use: the selected theme's, else the build-time ones. Reactive: reading it subscribes. */
const semanticsOf = (): Semantics => selected()?.semantics ?? builtIn;

/**
 * The style in use (type, shape, size, motion…): the selected theme's, else the build-time one's.
 * Reactive: reading it in JSX, a `draw` or an effect follows `selectTheme`.
 */
export const style = (): Style => semanticsOf();

/**
 * An object whose properties are read from the style in use: one getter per key, so `density.row`
 * follows `selectTheme` as a plain value would not, and the object still spreads. Each key is a
 * `computed` made here, at import (one made inside a component would be disposed with it), so what
 * reads a key re-runs only when its value changes, not whenever a theme is selected.
 */
export function reactive<T extends object>(
  keys: readonly (keyof T)[],
  read: () => T,
): T {
  const out = {} as T;
  for (const key of keys) {
    const value = computed(() => read()[key]);
    Object.defineProperty(out, key, { enumerable: true, get: () => value() });
  }
  return out;
}

/** The tier a pointer's screen (a desktop) or a touch screen reads: `platform.desktop`, fixed for the run. */
export const tier: 'pointer' | 'touch' = platform.desktop ? 'pointer' : 'touch';

/** A bare `{token}` reference (used by `dimension.shape.*`). */
const tokenRef = /^\{([a-z0-9-]+)\}$/;

/** The one relative color a finish writes: a token's color at another alpha. */
const relative = /oklch\(from \{([a-z0-9-]+)\} l c h \/ ([\d.]+)\)/g;

/** A token's color, `#rrggbbaa` as `token` gives it, at another alpha. */
const atAlpha = (color: string, a: number) =>
  `${color.slice(0, 7)}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** Resolve a `{token}` dimension reference through `token()` reactively (returns points). */
const resolveDimension = (value: string): number => {
  const match = tokenRef.exec(value);
  if (match) {
    const resolved = token(match[1] as keyof Tokens);
    if (typeof resolved === 'number') return resolved;
  }
  return Number(value);
};

/**
 * A finish's strings name the theme's tokens instead of writing their colors (`{raised}`, an
 * alias): the finishes keep one shape in every theme while the colors they draw are the theme's.
 * `token` reads the same token the rest of the theme does, so an alias follows the appearance,
 * the theme `selectTheme` put in, and host `setThemeOverrides`, and a `{token}` anywhere in a
 * gradient or a shadow resolves with it.
 *
 * A token named at another alpha (`oklch(from {card} l c h / 0.78)`, the one relative color a
 * finish writes) resolves to that token's color with the alpha replaced: NSH reads these strings
 * as plain CSS and has no relative color syntax. It goes through `token` rather than reading the
 * theme file, so this module imports nothing but `semantics.json`: it is `lib/ui/theme.ts` in an
 * app, whose `theme.json` sits at its root.
 */
const alias = (value: string): string =>
  value
    .replace(relative, (whole, name: string, a: string) => {
      const color = token(name as keyof Tokens);
      return typeof color === 'string' ? atAlpha(color, Number(a)) : whole;
    })
    .replace(/\{([a-z0-9-]+)\}/g, (whole, name: string) => {
      const color = token(name as keyof Tokens);
      return typeof color === 'string' ? color : whole;
    });

/** Merge `shared` with the active appearance's sparse override for one finish role (reactive). */
const finishOf = <R extends FinishRole>(role: R): FinishOf<R> => {
  const { finishes } = semanticsOf();
  const overrides = isDark() ? finishes.dark : finishes.light;
  return { ...finishes.shared[role], ...overrides[role] } as FinishOf<R>;
};

/** A role's finish as the fields it may or may not carry: what the platform layer reads of every role. */
const anyFieldOf = (role: FinishRole): Partial<FinishFields> => finishOf(role);

/** A field every role carries (the table gives all fifteen `foreground` and `shadow`): read without a guard. */
const sharedFieldOf = <F extends FinishFieldName>(
  role: FinishRole,
  field: F,
): FinishFields[F] => (anyFieldOf(role) as FinishFields)[field];

/** The material one finish role asks for in the semantics in use, in the appearance shown (reactive). */
const materialOf = (role: FinishRole): FinishMaterial | null =>
  anyFieldOf(role).material ?? null;

/** The recipe of the material a finish asks for, in the appearance shown (reactive); `undefined` for `null`. */
const recipeOf = (role: FinishRole): MaterialRecipe | undefined => {
  const material = materialOf(role);
  return material === null ? undefined : materials[material];
};

/** The style keys a finish's glass adds: `glassEffect` and the layer's own colour as its tint. */
const glassKeys = (role: FinishRole): readonly string[] => {
  const recipe = recipeOf(role);
  return recipe?.glassEffect === undefined
    ? []
    : ['glassEffect', 'glassTintColor'];
};

/**
 * An object whose getters read one finish role of the semantics in use, in
 * the appearance shown: shadows and gradients are no design tokens, so they
 * stay here while every color is the theme's, by alias. Reading one
 * subscribes to the appearance, to the theme `selectTheme` put in, and to
 * host token overrides.
 *
 * `material` and `elevation` are not among its keys: a glass material is two style keys instead
 * (NSH's `glassEffect` and `glassTintColor`), which the object has only while the finish asks for
 * them, so a finish with `material: null` spreads into exactly the keys it always had. The platform
 * props of the material (its `ios` and `windows` blurs, its `android` elevation) come from
 * `platformMaterial`.
 */
const finishStyleKeys: { [F in FinishFieldName]?: keyof FinishStyleFields } = {
  background: 'backgroundColor',
  gradient: 'backgroundImage',
  shadow: 'boxShadow',
  'border-color': 'borderColor',
  'border-top-color': 'borderTopColor',
  'border-bottom-color': 'borderBottomColor',
  backdropFilter: 'backdropFilter',
};

function themed<R extends FinishRole>(role: R): FinishStyle<R> {
  const out = {} as FinishStyle<R>;
  const builtInRole: Partial<FinishFields> = {
    ...builtIn.finishes.shared[role],
    ...builtIn.finishes.dark[role],
    ...builtIn.finishes.light[role],
  };
  for (const [field, styleKey] of Object.entries(finishStyleKeys) as [
    FinishFieldName,
    keyof FinishStyleFields,
  ][]) {
    if (!(field in builtInRole)) continue;
    Object.defineProperty(out, styleKey, {
      enumerable: true,
      configurable: true,
      get: () => {
        const value = anyFieldOf(role)[field];
        if (field === 'backdropFilter') {
          // A material guarantees its blur: a platform that draws no glass nor the host's blur still
          // blurs what is behind the layer, at the recipe's radius.
          const recipe = recipeOf(role);
          if (
            recipe !== undefined &&
            (value === undefined || value === 'none')
          ) {
            return `blur(${recipe.fallback.blur}px)`;
          }
        }
        return typeof value === 'string' ? alias(value) : undefined;
      },
    });
  }
  // The surface's ink is a color, not a style key: read it by name, and keep it out of a spread.
  Object.defineProperty(out, 'foreground', {
    enumerable: false,
    configurable: true,
    get: () => alias(sharedFieldOf(role, 'foreground')),
  });
  // The theme's own pressed fill and ink, where it states them; a spread never wears them.
  Object.defineProperty(out, 'pressedBackground', {
    enumerable: false,
    configurable: true,
    get: () => {
      const value = anyFieldOf(role)['pressed-background'];
      return typeof value === 'string' ? alias(value) : undefined;
    },
  });
  Object.defineProperty(out, 'pressedForeground', {
    enumerable: false,
    configurable: true,
    get: () => {
      const value = anyFieldOf(role)['pressed-foreground'];
      return typeof value === 'string' ? alias(value) : undefined;
    },
  });
  Object.defineProperty(out, 'pressedOpacity', {
    enumerable: false,
    configurable: true,
    get: () => anyFieldOf(role)['pressed-opacity'],
  });
  // A knob's checked state, where the theme states it; a spread never wears these either.
  Object.defineProperty(out, 'checkedBackground', {
    enumerable: false,
    configurable: true,
    get: () => {
      const value = anyFieldOf(role)['checked-background'];
      return typeof value === 'string' ? alias(value) : undefined;
    },
  });
  Object.defineProperty(out, 'checkedBorderColor', {
    enumerable: false,
    configurable: true,
    get: () => {
      const value = anyFieldOf(role)['checked-border-color'];
      return typeof value === 'string' ? alias(value) : undefined;
    },
  });
  Object.defineProperty(out, 'checkedGradient', {
    enumerable: false,
    configurable: true,
    get: () => {
      const value = anyFieldOf(role)['checked-gradient'];
      if (value === null) return null;
      return typeof value === 'string' ? alias(value) : undefined;
    },
  });
  const glass = (key: string): string | undefined => {
    const recipe = recipeOf(role);
    if (recipe?.glassEffect === undefined) return undefined;
    if (key === 'glassEffect') return recipe.glassEffect;
    const background = anyFieldOf(role).background;
    return background === undefined ? undefined : alias(background);
  };
  return new Proxy(out, {
    ownKeys: (target) => [...Reflect.ownKeys(target), ...glassKeys(role)],
    getOwnPropertyDescriptor: (target, key) =>
      typeof key === 'string' && glassKeys(role).includes(key)
        ? {
            value: glass(key),
            enumerable: true,
            configurable: true,
            writable: false,
          }
        : Reflect.getOwnPropertyDescriptor(target, key),
    has: (target, key) =>
      Reflect.has(target, key) ||
      (typeof key === 'string' && glassKeys(role).includes(key)),
    get: (target, key, receiver) =>
      typeof key === 'string' &&
      (key === 'glassEffect' || key === 'glassTintColor')
        ? glass(key)
        : Reflect.get(target, key, receiver),
  });
}

/** What `platformMaterial` returns: the platform props a finish's material asks for. A platform it
 * asks nothing of has `undefined`; a role that has neither field has neither prop. */
export type PlatformMaterial<R extends FinishRole = FinishRole> =
  ('material' extends FinishFieldList<R>[number]
    ? {
        ios?: { backdropMaterial: BackdropMaterial };
        windows?: { backdrop: { material: WindowsBackdropMaterial } };
      }
    : {}) &
    ('elevation' extends FinishFieldList<R>[number]
      ? { android?: { elevation?: number } }
      : {});

/**
 * The platform props of a finish's material, for the view that draws the finish: NSH's `ios`
 * backdrop material, the `windows` backdrop blur and Android's `elevation`. They are props, not
 * style keys, so a component spreads them on the same view that spreads `finish.<role>` into its
 * `style`:
 *
 *     <View {...platformMaterial("overlay")} style={{ ...finish.overlay }} />
 *
 * Its keys are getters, so they follow `selectTheme` and the appearance as `finish` does, and a
 * finish whose `material` is `null` and whose `elevation` is `null` (every layer of the themes that
 * imitate no platform) gives `undefined` for all three: the view is drawn as it was. The Liquid
 * Glass of a glass material needs no prop: `glassEffect` and `glassTintColor` are in the style.
 */
export function platformMaterial<R extends FinishRole>(
  role: R,
): PlatformMaterial<R> {
  return {
    get ios() {
      return recipeOf(role)?.props.ios;
    },
    get windows() {
      return recipeOf(role)?.props.windows;
    },
    get android() {
      const { elevation } = anyFieldOf(role);
      return typeof elevation === 'number' ? { elevation } : undefined;
    },
  } as PlatformMaterial<R>;
}

/** The palette's roles: one color each, a token of the theme's `theme.json`. */
export interface Palette {
  /** The page behind the cards. */
  background: string;
  /** A card. */
  card: string;
  /** A surface inside a card. */
  inset: string;
  /** A control on a card (buttons, fields, tracks). */
  raised: string;
  /** A quiet fill one step off the surface under it: the grey block chosen inside a capsule (iOS's
   * secondary fill), a segment's ground. */
  muted: string;
  /** An input's well: below the card and the insets it sits on. */
  field: string;
  /** An input's edge. */
  input: string;
  /** The hairline round what needs an edge (a card, a well, a divider). */
  border: string;
  /** Hairlines inside insets. */
  line: string;
  /** The edge a filled pane draws (a primary button, a chosen run, a chip): `border`. */
  brandEdge: string;
  /** Body text. */
  foreground: string;
  /** Secondary text: a detail, a caption. */
  mutedForeground: string;
  /** What recedes the furthest: a placeholder, an icon at rest. */
  faint: string;
  /** The accent as a foreground: text, icons, lines, small marks. */
  brand: string;
  /** The main action's fill (the theme's `primary`): the citrus, in both appearances. */
  primary: string;
  /** Text on `primary`. */
  primaryForeground: string;
  /** The app's sidebar, beside the page. */
  sidebar: string;
  /** The selected row of the sidebar. */
  sidebarAccent: string;
  /** The sidebar's edge and the toolbar's hairline. */
  sidebarBorder: string;
  /** A switch's track when off. */
  track: string;
  /** A switch's knob when off. */
  knob: string;
  /** The surface of a tip or a toast, read apart from the page's: a flat theme's popover, an inverted pane in Material. */
  inverse: string;
  /** Text on `inverse`. */
  inverseForeground: string;
  /** The accent on `inverse`: a toast's action. */
  inverseBrand: string;
  /** The tone colors: information, a warning, a failure, a gain, a loss. */
  info: string;
  warn: string;
  destructive: string;
  up: string;
  /** The ground a photograph or a video sits on. It does not flip: dark in either appearance. */
  media: string;
  /** White ink on a photograph or any other surface that is not the theme's. It does not flip. */
  onMedia: string;
}

/** An object whose getters read the theme's tokens: reads in a reactive
 * scope (JSX, a `draw`, an effect) follow the appearance and the theme. */
function tokens<K extends string>(
  names: Record<K, keyof Tokens>,
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(names) as K[]) {
    Object.defineProperty(out, key, {
      enumerable: true,
      get: () => token(names[key]),
    });
  }
  return out;
}

/**
 * The palette in use, read from the theme's tokens: reactive, so reading it
 * in JSX, a `draw` or an `effect` follows the appearance and the theme
 * `selectTheme` put in.
 */
export const colors: Palette = tokens<keyof Palette>({
  background: 'background',
  card: 'card',
  inset: 'inset',
  raised: 'raised',
  muted: 'muted',
  field: 'field',
  input: 'input',
  border: 'border',
  line: 'line',
  brandEdge: 'brand-edge',
  foreground: 'foreground',
  mutedForeground: 'muted-foreground',
  faint: 'faint',
  brand: 'brand',
  primary: 'primary',
  primaryForeground: 'primary-foreground',
  sidebar: 'sidebar',
  sidebarAccent: 'sidebar-accent',
  sidebarBorder: 'sidebar-border',
  track: 'track',
  knob: 'knob',
  info: 'info',
  warn: 'warn',
  destructive: 'destructive',
  up: 'up',
  media: 'media',
  onMedia: 'on-media',
  inverse: 'inverse',
  inverseForeground: 'inverse-foreground',
  inverseBrand: 'inverse-brand',
});

/**
 * `color` at opacity `a` (0 to 1): a `color-mix` over nothing, for a fill or a text color that is
 * the theme's at a lighter weight. Clamped, so a ratio past its ends is still a color.
 */
export function alpha(color: string, a: number): string {
  return `color-mix(in srgb, ${color} ${Math.min(Math.max(a, 0), 1) * 100}%, transparent)`;
}

/** The charts' series colors, in order (`theme.json`'s `chart-1` to
 * `chart-5`): the brand's citrus first, then graphite from dark to light,
 * so one series leads and the rest stay as quiet as the interface. */
export const chart = tokens({
  chart1: 'chart-1',
  chart2: 'chart-2',
  chart3: 'chart-3',
  chart4: 'chart-4',
  chart5: 'chart-5',
});

/** Translucent tints of the tones, for fills behind text. */
export const tints = tokens({
  brand: 'brand-tint',
  info: 'info-tint',
  warn: 'warn-tint',
  destructive: 'destructive-tint',
  up: 'up-tint',
  down: 'down-tint',
});

/**
 * Light and depth, kept quiet: a control on a card stands off it by a step (`raised`: a hard drop
 * below, a highlight above, a hairline), a card stands off the page by the next one (`card`), a
 * panel floats (`overlay`), a dialog waits above the page (`modal`). What is sunk (`inset`: a field,
 * a track, a groove) is drawn by an inner shade and an edge, never by a fill alone.
 *
 * The layers are what a surface is, not what draws it: `accent` is the accent's own face (a filled
 * button, a chosen switch's track), `fill` a run's filled part (a progress bar's bar, a slider's
 * range, a switch's open track), `inverse` the page's inverse (a toast, a tooltip),
 * `glass` a translucent pane, `knob` the small thing that moves (a switch's thumb, a slider's
 * handle; a theme may state its checked state, `checked-*`, for the switch that is on), `plate` the
 * labelled block chosen inside a well (the selected tab, a segmented
 * control's thumb), and `channel` the track such a block is chosen in (a segmented control's
 * track; a tab strip's track is a well, `inset`). `hover`, `pressed` and `disabled` are the steps a control takes — a control
 * that differs (a slider's thumb, a sheet's grabber) says so in its own
 * preset, not in a finish of its own.
 */
export const finish: { [R in FinishRole]: FinishStyle<R> } = {
  card: themed('card'),
  inset: themed('inset'),
  channel: themed('channel'),
  raised: themed('raised'),
  plate: themed('plate'),
  overlay: themed('overlay'),
  modal: themed('modal'),
  inverse: themed('inverse'),
  glass: themed('glass'),
  accent: themed('accent'),
  fill: themed('fill'),
  knob: themed('knob'),
  hover: themed('hover'),
  pressed: themed('pressed'),
  disabled: themed('disabled'),
};

/**
 * A step of the shadow scale, in the appearance shown (`semantics.json`'s `elevation`): `sm` a
 * control's cast, `md` a card's, `lg` an overlay's, `xl` a dialog's. A finish already wears the
 * steps it names, so a component reads this only where it draws a shadow without a finish; a theme
 * that has no value for a step gives `"none"`. Reactive: reading it follows `selectTheme`.
 */
export function elevation(level: ElevationLevel): string {
  const scale = isDark() ? builtIn.elevation.dark : builtIn.elevation.light;
  return scale[level] ?? 'none';
}

/**
 * How far a press sinks a control, as the theme in use says (`semantics.json`'s `state["press-scale"]`):
 * `0.97` where a press is a small sink, `1` where the theme draws none. A control that sinks
 * deeper than that names its own scale (`pressSink(0.9)`); a theme of `1` turns every sink off.
 * Reactive: reading it follows `selectTheme`.
 */
export const press = {
  get scale() {
    return semanticsOf().state['press-scale'];
  },
};

/**
 * Switch the app to `theme` while it runs: the tokens first (`setTheme`),
 * then its semantics, so every component on screen redraws with both on the
 * next frame. `null` goes back to the theme the app was built with
 * (`nsh.json`'s `theme.json`, and `semantics.json` beside this file).
 *
 * A theme NSH refuses to read (a color it does not know) throws
 * `TypeError` and leaves the app as it was: the semantics follow the tokens
 * only once they are in.
 */
export function selectTheme(theme: AppTheme | null): void {
  setTheme(theme ? theme.theme : null);
  selected.set(theme);
}

/**
 * The `id` of the theme the app shows (`selectTheme`), or `null` while it
 * shows its build-time one — the runtime cannot read `nsh-ui.json`. Reactive:
 * reading it subscribes.
 */
export function currentTheme(): string | null {
  const theme = selected();
  return theme === null ? null : theme.id;
}

export type Tone =
  'neutral' | 'accent' | 'info' | 'warn' | 'destructive' | 'up' | 'down';

/**
 * The color of a tone. `accent` is the brand ink: the tone keeps its name, and the palette key is
 * the token (`brand`).
 */
export const toneColor = (tone: Tone) =>
  tone === 'neutral'
    ? colors.mutedForeground
    : tone === 'accent'
      ? colors.brand
      : tone === 'down'
        ? colors.destructive
        : colors[tone];

/**
 * The tint of a tone. `accent` reads `tints.brand` (the `brand-tint` token); the other tones share
 * a key with `colors`.
 */
export const toneTint = (tone: Tone) =>
  tone === 'neutral'
    ? colors.raised
    : tone === 'accent'
      ? tints.brand
      : tints[tone];

/** A typography role of `semantics.json`'s `typography`: the seven text roles. */
export type TypeName = keyof Style['typography'];

/**
 * One facet of a typography role, read from the style in use (reactive: reading it in JSX, a `draw` or
 * an effect follows `selectTheme`). A component reads only the facets it set before, so text that
 * leaves its weight or line height to the text around it still does:
 * `style={{ fontSize: font.size("label"), fontWeight: font.weight("label") }}`.
 * `size` and `lineHeight` take the tier of the screen (`tier`); `lineHeight` is the theme's
 * line height in points (a whole number of pixels).
 */
export const font = {
  size: (role: TypeName) => style().typography[role].fontSize[tier],
  lineHeight: (role: TypeName) => style().typography[role].lineHeight[tier],
  weight: (role: TypeName) =>
    style().typography[role].fontWeight as NonNullable<TextStyle['fontWeight']>,
  letterSpacing: (role: TypeName) => style().typography[role].letterSpacing,
};

/** Radius used by `shape.button` when `shape.corners.button === "full"` (capsule-shaped buttons). */
const CAPSULE_RADIUS = 999;

/**
 * The corner radii by layer (`semantics.json`'s `dimension.shape`), resolved from `theme.json`'s
 * `radius-*` tokens via `token()`: `control` (in-page elements), `container` (cards, menus,
 * popovers, tooltips, list panels, toasts, frames), `modal` (dialogs, sheets, drawers), and
 * `button` (`CAPSULE_RADIUS` when `shape.corners.button === "full"`, else `control`). Reactive:
 * reading one in JSX, a `draw` or an effect follows `selectTheme` and host token overrides.
 */
export const shape = {
  get control() {
    return resolveDimension(style().dimension.shape.control);
  },
  get container() {
    return resolveDimension(style().dimension.shape.container);
  },
  get modal() {
    return resolveDimension(style().dimension.shape.modal);
  },
  get button() {
    return style().shape.corners.button === 'full'
      ? CAPSULE_RADIUS
      : shape.control;
  },
};

/** Line widths in points (`semantics.json`'s `dimension.stroke`): `hairline` a divider's or a surface's edge (0 where surfaces stand by tone or shadow alone), `control` a control's edge. The focus ring's width is `dimension.focus.width`. */
export const stroke = {
  get hairline() {
    return style().dimension.stroke.hairline;
  },
  get control() {
    return style().dimension.stroke.control;
  },
};

/**
 * How far a control fades (`semantics.json`'s `state`): `rest` is the opacity a passive indicator
 * sits at (`rest-opacity`), `pressed` that of a pressed control (`pressed-opacity`), `disabled` that of
 * a disabled control's content when drawn as one. How far a filled control dims while it is pressed
 * is the accent's own (`finish.accent.pressedOpacity`).
 */
export const dimmed = {
  get rest() {
    return style().state['rest-opacity'];
  },
  get pressed() {
    return style().state['pressed-opacity'];
  },
  get disabled() {
    return style().state.disabled.content;
  },
};

/**
 * The resolved overlay wash color (`atAlpha(token(ink), opacity)`) for a `state.overlay` role,
 * or `undefined` when the theme's overlay opacity is `<= 0`.
 */
export function stateLayerColor(
  kind: keyof Style['state']['overlay'],
  ink: keyof Tokens = 'foreground',
): string | undefined {
  const opacity = style().state.overlay[kind];
  if (opacity <= 0) return undefined;
  return atAlpha(token(ink) as string, opacity);
}

/**
 * The state layer of a theme that draws its hover, focus, press and drag as a wash of `ink`
 * (default `"foreground"`) over the surface (`state.overlay`, an opacity; Material's): a gradient
 * of that one color. A theme whose overlay is 0 (the default: its states swap the surface's
 * finish) draws none, so this is an empty style.
 */
export function stateLayer(
  kind: keyof Style['state']['overlay'],
  ink: keyof Tokens = 'foreground',
): ViewStyle {
  const wash = stateLayerColor(kind, ink);
  if (!wash) return {};
  return {
    backgroundImage: `linear-gradient(180deg, ${wash} 0%, ${wash} 100%)`,
  };
}

/** The smallest target a finger or a pointer gets (`dimension.size.hit` of the tier): 0 adds none. */
export const hitTarget = (): number => style().dimension.size.hit[tier];

/** The control dimensions in use, made once at import (a `computed` made inside a component would
 * be disposed with it), so `control().field` follows `selectTheme` and re-runs only when that
 * value changes. A control reads the axis it draws and keeps its own fallback where a value cannot
 * express it; see `docs/specs/theme-contract-v2.md` §11. */
const controlDimensions = reactive<ControlDimensions>(
  CONTROL_DIMENSIONS,
  () => style().dimension.control,
);

/**
 * The four control dimensions a theme decides (`semantics.json`'s `dimension.control`): how a
 * field, a choice, a track and a handle are drawn. Reactive: reading one in JSX, a `draw` or an
 * effect follows `selectTheme`.
 */
export const control = (): ControlDimensions => controlDimensions;

/** A button's height by size (`dimension.size.height` of the tier). */
export const controlHeight = {
  get sm() {
    return style().dimension.size.height[tier].sm;
  },
  get md() {
    return style().dimension.size.height[tier].md;
  },
  get lg() {
    return style().dimension.size.height[tier].lg;
  },
};

/** An icon's side by size (`dimension.icon` of the tier). */
export const iconSize = {
  get sm() {
    return style().dimension.icon[tier].sm;
  },
  get md() {
    return style().dimension.icon[tier].md;
  },
  get lg() {
    return style().dimension.icon[tier].lg;
  },
};

/** Every corner that reads a theme radius is continuous: the curve macOS
 * draws, not a circular arc. */
export const cornerCurve: ViewStyle = {
  get borderCurve() {
    return style().shape.curve === 'circular' ? 'circular' : 'continuous';
  },
};

/**
 * A corner on one of the theme's radii, with the curve they all share. `inset` makes it concentric:
 * a surface drawn `inset` points inside another takes the outer radius less `inset`, never below 0.
 */
export function rounded(radius: number, inset = 0): ViewStyle {
  return { borderRadius: Math.max(radius - inset, 0), ...cornerCurve };
}

/** The system header's colors on every page (iOS, Android). */
export const header = {
  get headerStyle() {
    return {
      backgroundColor: colors.background,
      color: colors.foreground,
      tintColor: colors.brand,
    };
  },
};

/** Whether a resolved motion role is a `Timing` (`{ duration, timingFunction }`) rather than a `Spring`. */
export const isTiming = (m: Spring | Timing): m is Timing => 'duration' in m;

/** The easings a theme names (`transition.enter.timingFunction` and timing roles): the curve is code, the name is data. */
const easings: Record<string, EasingCurve> = {
  'out-cubic': Easing.out(Easing.cubic),
  'in-cubic': Easing.in(Easing.cubic),
  'in-out-cubic': Easing.inOut(Easing.cubic),
  // Material 3 (`md.sys.motion.easing.standard` / single-bezier `emphasized`) & NSH `snappy`
  standard: Easing.bezier(0.2, 0, 0, 1),
  // Material 3 (`md.sys.motion.easing.emphasized-decelerate`)
  'emphasized-decelerate': Easing.bezier(0.05, 0.7, 0.1, 1),
  // Material 3 (`md.sys.motion.easing.emphasized-accelerate`)
  'emphasized-accelerate': Easing.bezier(0.3, 0, 0.8, 0.15),
  // WinUI 3 Fast Out, Slow In (`0,0,0,1`) & M3 `standard-decelerate`
  decelerate: Easing.bezier(0, 0, 0, 1),
  // WinUI 3 Slow Out, Fast In (`1,0,1,1`)
  accelerate: Easing.bezier(1, 0, 1, 1),
  // WinUI 3 Existing Elements / Point-to-Point (`0.55,0.55,0,1`, windows-dev-docs)
  'point-to-point': Easing.bezier(0.55, 0.55, 0, 1),
};

const resolveMotion = (raw: Spring | TimingSpec): Spring | Timing =>
  'duration' in raw
    ? { duration: raw.duration, timingFunction: easings[raw.timingFunction] }
    : raw;

/**
 * A reactive proxy over a `Spring | Timing` motion role so controls created before `selectTheme`
 * dynamically pick up shape switches between `Spring` and `Timing` when they animate or render.
 */
const motionRole = (read: () => Spring | TimingSpec): Spring | Timing => {
  const current = computed(() => resolveMotion(read()));
  return new Proxy({} as Spring | Timing, {
    get: (_, key) => Reflect.get(current(), key),
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => {
      const value = current();
      if (!(key in value)) return undefined;
      return {
        enumerable: true,
        configurable: true,
        value: Reflect.get(value, key),
      };
    },
  });
};

/**
 * The theme's motion roles: `fast` (a small control's state coming and going), `default` (the one
 * most feedback uses: a press, a release, a modest move), `slow` (a large surface or a
 * long-travel movement) and `state` (a hover, a press or a choice fading in and out, which is
 * always timed). A spring, unless a theme times the role with `{ duration, timingFunction }`.
 * `enter` is a surface's entrance, which is always timed.
 */
export const motion = {
  fast: motionRole(() => style().motion.fast),
  default: motionRole(() => style().motion.default),
  slow: motionRole(() => style().motion.slow),
  state: motionRole(() => style().motion.state),
  get enter(): Timing {
    const { duration, timingFunction } = style().transition.enter;
    return { duration, timingFunction: easings[timingFunction] };
  },
};

/**
 * Drive `value` to `to` using `config` (a theme `Spring` or `Timing`, `motion.default` by
 * default). Lands immediately when `reduceMotion()` is active. Optional `springExtra` (such as an
 * initial `velocity`) applies only when `config` is a spring.
 */
export function animate(
  value: AnimatedValue,
  to: number,
  config: Spring | Timing = motion.default,
  springExtra?: { velocity?: number; mass?: number },
): Promise<{ finished: boolean }> {
  if (reduceMotion()) {
    value.set(to);
    return Promise.resolve({ finished: true });
  }
  if (isTiming(config)) {
    return value.timing(to, {
      duration: config.duration,
      easing: config.timingFunction,
    });
  }
  return value.spring(to, {
    stiffness: config.stiffness,
    damping: config.damping,
    ...springExtra,
  });
}

/**
 * An animated value that springs or times to `target` each time it changes (a
 * control's state: 1 while on, 0 while off), natively: JS only starts each
 * animation. A change mid-way turns it from where it is, with its velocity when
 * springing; with reduced motion it lands at once. For discrete changes only: what
 * the pointer drives (a dragged thumb, a hover's place) is set in the same
 * frame, never animated toward the pointer.
 */
export function follow(
  target: () => number,
  config: Spring | Timing = motion.fast,
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

/**
 * A pressable under the pointer (`hoverStyle`): when `state.overlay.hover` is 0 (the default:
 * swap fills), returns the theme's `hover` background; when `state.overlay.hover > 0`, returns a
 * state-layer wash of `ink` (default `"foreground"`). Leave it off a disabled control and, where a
 * theme uses swap fills, off a selected one whose own fill shows.
 */
export const hovered = (ink: keyof Tokens = 'foreground'): ViewStyle => {
  if (style().state.overlay.hover <= 0) {
    return { backgroundColor: token('hover') };
  }
  return stateLayer('hover', ink);
};

/**
 * The keyboard focus (`focusVisibleStyle`: not after a click or a tap):
 * - `"halo"`: `borderColor` turns `ring` and a halo of `ring` at 30% (`focus.width` points, 3 by default) sits outside.
 * - `"outline"`: `borderColor` stays untouched; `outlineColor` is `ring`.
 * - `"double"`: `borderColor` stays untouched; a 1 px line of `card` hugs the edge (a spread shadow, which
 *   stands in for the surface's own shadow while focused) and the `focus.width` outline of `ring` lies just outside
 *   it, so the outline's offset grows by that 1 px (WinUI 3's `FocusStrokeColorInner` / `Outer`).
 */
export const focusRing = (offset?: number): ViewStyle => {
  const { style: look, width, offset: base } = style().dimension.focus;
  const ringOutline: ViewStyle = {
    outlineStyle: 'solid',
    outlineWidth: width,
    outlineColor: look === 'halo' ? alpha(token('ring'), 0.3) : token('ring'),
    outlineOffset: offset ?? base,
  };
  if (look === 'halo') {
    return {
      borderColor: token('ring'),
      ...ringOutline,
    };
  }
  if (look === 'double') {
    return {
      ...ringOutline,
      outlineOffset: (offset ?? base) + 1,
      boxShadow: `0 0 0 1px ${token('card')}`,
    };
  }
  return ringOutline;
};

/*
 * Below: this library's own, with no upstream origin.
 */

/**
 * A theme's fill for a run, a bar or a slider's range: the `fill` finish's gradient and the colour
 * under it. The gradient carries the colour where a theme has one; the colour under it shows
 * through the translucent stops, so the two never drift apart.
 *
 * A theme that draws its fill flat states no gradient, and the colour goes to both stops instead of
 * a background colour alone: a run is one gradient in every theme, so a vertical one can turn it.
 */
export function fillStyle(): ViewStyle {
  const face = finish.fill.backgroundColor;
  const gradient = finish.fill.backgroundImage;
  if (gradient !== undefined) {
    return face === undefined
      ? { backgroundImage: gradient }
      : { backgroundColor: face, backgroundImage: gradient };
  }
  if (face === undefined) return {};
  return {
    backgroundImage: `linear-gradient(180deg, ${face} 0%, ${face} 100%)`,
  };
}

/** Default width in points of the hairline edge drawn by `insetEdge` and `outerEdge`. */
export const EDGE_WIDTH = 1;

function edgeShadow(
  borderColor: string | undefined,
  boxShadow: string | undefined,
  width: number,
  inset: boolean,
): string {
  const line = borderColor
    ? `${inset ? 'inset ' : ''}0 0 0 ${width}px ${borderColor}`
    : undefined;
  const shade = boxShadow && boxShadow !== 'none' ? boxShadow : undefined;
  const parts = [line, shade].filter((part) => part !== undefined);
  return parts.length === 0 ? 'none' : parts.join(', ');
}

/**
 * A rail's edge: a `width`-point inset line of `borderColor` inside the theme's `boxShadow`,
 * whichever of the two the theme gives. `semantics.json` may write `shadow: "none"` or leave
 * the border color out, and a rail that joined the absent one after a comma would void the whole
 * declaration (`none, inset …` is not a shadow).
 */
export function insetEdge(
  borderColor: string | undefined,
  boxShadow: string | undefined,
  width = EDGE_WIDTH,
): string {
  return edgeShadow(borderColor, boxShadow, width, true);
}

/**
 * A handle's outer edge: a `width`-point outer line of `borderColor` around the theme's
 * `boxShadow`, sharing the same border/shadow normalization as `insetEdge`.
 */
export function outerEdge(
  borderColor: string | undefined,
  boxShadow: string | undefined,
  width = EDGE_WIDTH,
): string {
  return edgeShadow(borderColor, boxShadow, width, false);
}
