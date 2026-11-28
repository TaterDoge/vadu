/**
 * L1 theme paradigm: six semantic axes expanded into a sparse L2 patch.
 *
 * Pure TypeScript. This module does not import `nsh`, so build scripts and unit tests can load it.
 * Durations, hit targets, and material opacity stay inside `scripts/theme/invariants.ts`.
 */
import type {
  EasingName,
  ElevationScale,
  SlotCorner,
  ThemePatch,
  TimingSpec,
} from './schema';

/** How far a surface lifts off the page. */
export type ParadigmDepth =
  'flat' | 'hairline' | 'soft-shadow' | 'glass' | 'acrylic';

/** Corner family for controls and containers. */
export type ParadigmShape = 'sharp' | 'rounded' | 'soft' | 'pill';

/** Edge weight and contrast. */
export type ParadigmStroke = 'crisp' | 'hairline' | 'translucent';

/** Motion tempo, including the theme-switch transition. */
export type ParadigmMotion = 'snappy' | 'fluid' | 'springy' | 'instant';

/** How a control answers hover, press, and focus. */
export type ParadigmFeedback = 'tint' | 'underline' | 'lift' | 'ring';

/** Pointer and touch spacing, on the 4px grid. */
export type ParadigmDensity = 'compact' | 'balanced' | 'airy';

/** Optional semantic axes. An omitted axis leaves the base theme's L2 fields alone. */
export interface ThemeParadigm {
  /** Surface lift: flat fill, hairline, soft shadow, glass, or acrylic. */
  readonly depth?: ParadigmDepth;
  /** Corner family. `"pill"` capsules controls and keeps container radii. */
  readonly shape?: ParadigmShape;
  /** Stroke width, and for `"translucent"` a quieter edge. */
  readonly stroke?: ParadigmStroke;
  /** Timing scale and `motion.presets.themeSwitch`. */
  readonly motion?: ParadigmMotion;
  /** Hover, press, and focus treatment. */
  readonly feedback?: ParadigmFeedback;
  /** Pointer and touch metrics. Touch stays at least as large as pointer. */
  readonly density?: ParadigmDensity;
}

/**
 * Sparse L2 fields a paradigm expands into.
 * A `ThemePatch` also carries `id`, `label`, and `extends`; those stay on the `defineTheme` call.
 */
export type ParadigmPatch = Omit<
  ThemePatch,
  'id' | 'label' | 'extends' | 'paradigm' | 'meta'
>;

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Color, tint, material, effect, timing, and spring objects replace as a whole. */
const isAtomic = (value: Plain): boolean =>
  ('kind' in value && typeof value.kind === 'string') ||
  ('color' in value && 'alpha' in value) ||
  ('tint' in value && typeof value.tint === 'string') ||
  ('duration' in value && 'easing' in value) ||
  ('stiffness' in value && 'damping' in value);

function merge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch))
    return patch as T;
  if (!isPlain(base) || !isPlain(patch)) return patch as T;
  if (isAtomic(patch) || isAtomic(base)) return patch as T;
  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = key in base ? merge(base[key], value) : value;
  }
  return out as T;
}

const mergePatch = (base: ParadigmPatch, patch: ParadigmPatch): ParadigmPatch =>
  merge(base, patch);

const timing = (duration: number, easing: EasingName): TimingSpec => ({
  duration,
  easing,
});

const veil = (alpha: number) => ({ color: 'border' as const, alpha });

const flatElevation = (): ElevationScale => ({
  sm: null,
  md: null,
  lg: null,
  xl: null,
  inset: null,
  edgeSurface: null,
  edgeAccent: null,
});

const hairlineElevation = (ring: string): ElevationScale => ({
  sm: ring,
  md: null,
  lg: null,
  xl: null,
  inset: null,
  edgeSurface: ring,
  edgeAccent: null,
});

const softLight: ElevationScale = {
  sm: '0 1px 2px oklch(0 0 0 / 0.06)',
  md: '0 4px 12px oklch(0 0 0 / 0.08)',
  lg: '0 12px 28px oklch(0 0 0 / 0.12)',
  xl: '0 20px 48px oklch(0 0 0 / 0.16)',
  inset: 'inset 0 1px 2px oklch(0 0 0 / 0.05)',
  edgeSurface: '0 0 0 1px oklch(0 0 0 / 0.06)',
  edgeAccent: null,
};

const softDark: ElevationScale = {
  sm: '0 1px 2px oklch(0 0 0 / 0.28)',
  md: '0 4px 12px oklch(0 0 0 / 0.36)',
  lg: '0 12px 28px oklch(0 0 0 / 0.46)',
  xl: '0 20px 48px oklch(0 0 0 / 0.56)',
  inset: 'inset 0 1px 2px oklch(0 0 0 / 0.35)',
  edgeSurface: '0 0 0 1px oklch(1 0 0 / 0.08)',
  edgeAccent: null,
};

function depthPatch(depth: ParadigmDepth): ParadigmPatch {
  if (depth === 'flat') {
    const clear = {
      shadow: null,
      gradient: null,
      backdropFilter: null,
      material: null,
      effect: null,
      border: 'border' as const,
    };
    return {
      elevation: { light: flatElevation(), dark: flatElevation() },
      surfaces: {
        card: { ...clear, background: 'card' },
        plate: {
          ...clear,
          light: { background: 'card', border: 'border', shadow: null },
          dark: { background: 'card', border: 'border', shadow: null },
        },
        raised: {
          ...clear,
          background: 'surface',
          light: {
            background: 'surface',
            border: 'border',
            borderTop: 'border',
            borderBottom: 'border',
            shadow: null,
          },
          dark: {
            background: 'surface',
            border: 'border',
            borderTop: 'border',
            borderBottom: 'border',
            shadow: null,
          },
        },
        overlay: { ...clear, background: 'popover' },
        modal: { ...clear, background: 'card' },
      },
    };
  }
  if (depth === 'hairline') {
    return {
      elevation: {
        light: hairlineElevation('0 0 0 1px oklch(0 0 0 / 0.12)'),
        dark: hairlineElevation('0 0 0 1px oklch(1 0 0 / 0.16)'),
      },
      surfaces: {
        card: {
          border: 'border',
          shadow: 'sm',
          material: null,
          effect: null,
          backdropFilter: null,
        },
        raised: {
          border: 'border',
          shadow: 'sm',
          material: null,
          effect: null,
          backdropFilter: null,
        },
        overlay: {
          border: 'border',
          shadow: 'sm',
          material: null,
          effect: null,
          backdropFilter: null,
        },
        plate: {
          border: 'border',
          shadow: 'sm',
          material: null,
          effect: null,
          backdropFilter: null,
        },
        modal: {
          border: 'border',
          shadow: 'sm',
          material: null,
          effect: null,
          backdropFilter: null,
        },
      },
    };
  }
  if (depth === 'soft-shadow') {
    return {
      elevation: { light: softLight, dark: softDark },
      surfaces: {
        card: {
          shadow: 'md',
          material: null,
          effect: null,
          backdropFilter: null,
        },
        overlay: {
          shadow: 'lg',
          material: null,
          effect: null,
          backdropFilter: null,
        },
        modal: {
          shadow: 'xl',
          material: null,
          effect: null,
          backdropFilter: null,
        },
      },
    };
  }
  // Preset floors: glass 0.72, acrylic 0.85 (`materials.ts`). Fills sit strictly above them.
  const glassAlpha = depth === 'acrylic' ? 0.9 : 0.78;
  const material = depth === 'acrylic' ? 'acrylic' : 'glass';
  const effect =
    depth === 'acrylic'
      ? { kind: 'acrylic-noise' as const, intensity: 0.035 }
      : { kind: 'liquid-glass' as const, intensity: 0.35 };
  const overlayEffect =
    depth === 'acrylic'
      ? { kind: 'acrylic-noise' as const, intensity: 0.035 }
      : { kind: 'specular-rim' as const, intensity: 0.4 };
  const fill = {
    light: { background: { color: 'popover' as const, alpha: glassAlpha } },
    dark: { background: { color: 'popover' as const, alpha: glassAlpha } },
  };
  return {
    surfaces: {
      glass: {
        material,
        effect,
        backdropFilter: 'blur(30px)',
        ...fill,
      },
      overlay: {
        material,
        effect: overlayEffect,
        backdropFilter: 'blur(30px)',
        ...fill,
      },
    },
  };
}

function radii(
  control: number,
  container: number,
  modal: number,
  curve: 'continuous' | 'circular',
) {
  return { control, container, modal, curve };
}

function corners(corner: SlotCorner): NonNullable<ParadigmPatch['controls']> {
  return {
    button: { corner: { sm: corner, md: corner, lg: corner } },
    badge: { corner },
    tabs: { track: { corner } },
  };
}

function shapePatch(shape: ParadigmShape): ParadigmPatch {
  if (shape === 'sharp') {
    return {
      tokens: { radius: radii(4, 4, 6, 'circular') },
      controls: {
        ...corners(2),
        choice: { corner: { pointer: 2, touch: 4 } },
        popup: { corner: 4 },
      },
    };
  }
  if (shape === 'rounded') {
    return {
      tokens: { radius: radii(8, 12, 14, 'continuous') },
      controls: {
        ...corners('control'),
        choice: { corner: { pointer: 6, touch: 8 } },
        popup: { corner: 'container' },
      },
    };
  }
  if (shape === 'soft') {
    return {
      tokens: { radius: radii(12, 16, 20, 'continuous') },
      controls: {
        ...corners('control'),
        choice: { corner: { pointer: 8, touch: 12 } },
        popup: { corner: 'container' },
      },
    };
  }
  // Capsule the interactive controls. Container and modal radii stay with the base.
  return {
    controls: {
      ...corners('full'),
      badge: { corner: 'full' },
      tabs: { track: { corner: 'full' } },
    },
  };
}

function strokePatch(stroke: ParadigmStroke): ParadigmPatch {
  if (stroke === 'hairline') {
    return {
      metrics: { stroke: { hairline: 0.5, control: 1 } },
      controls: { choice: { edge: { width: 0.5 } } },
    };
  }
  if (stroke === 'translucent') {
    const edge = veil(0.45);
    return {
      metrics: { stroke: { hairline: 1, control: 1 } },
      surfaces: {
        card: { border: edge },
        raised: { border: edge },
        overlay: { border: veil(0.4) },
        modal: { border: veil(0.4) },
      },
      controls: {
        choice: { edge: { width: 1, color: veil(0.5) } },
        field: { edge: { color: edge, bottom: veil(0.7) } },
      },
    };
  }
  return {
    metrics: { stroke: { hairline: 1, control: 1 } },
    controls: { choice: { edge: { width: 1 } } },
  };
}

function motionPatch(motion: ParadigmMotion): ParadigmPatch {
  if (motion === 'instant') {
    // `state` / `fast` / `default` / `slow` cannot be 0. Only the theme switch can.
    return {
      motion: {
        state: timing(40, 'out-cubic'),
        fast: timing(60, 'out-cubic'),
        default: timing(100, 'out-cubic'),
        slow: timing(150, 'out-cubic'),
        presets: { themeSwitch: { kind: 'none', duration: 0 } },
      },
    };
  }
  if (motion === 'snappy') {
    return {
      motion: {
        state: timing(80, 'out-cubic'),
        fast: timing(100, 'out-cubic'),
        default: timing(160, 'out-cubic'),
        slow: timing(260, 'out-cubic'),
        presets: { themeSwitch: { kind: 'fade', duration: 140 } },
      },
    };
  }
  if (motion === 'fluid') {
    return {
      motion: {
        state: timing(120, 'standard'),
        fast: timing(140, 'standard'),
        default: timing(220, 'standard'),
        slow: timing(360, 'standard'),
        presets: { themeSwitch: { kind: 'dissolve', duration: 280 } },
      },
    };
  }
  // zeta = 34 / (2 * sqrt(420 * 1)) ≈ 0.83, inside [0.55, 1.5].
  return {
    motion: {
      state: timing(80, 'point-to-point'),
      fast: timing(160, 'point-to-point'),
      default: timing(240, 'point-to-point'),
      slow: timing(380, 'point-to-point'),
      spring: { stiffness: 420, damping: 34, mass: 1 },
      presets: {
        popoverEnter: { spring: true },
        dialogEnter: { spring: true },
        indicatorGlide: { timing: 'fast', spring: true },
        themeSwitch: { kind: 'radial-wipe', duration: 320 },
      },
    },
  };
}

function feedbackPatch(feedback: ParadigmFeedback): ParadigmPatch {
  if (feedback === 'tint') {
    return {
      feedback: {
        hover: { overlay: 0.06, fill: { color: 'foreground', alpha: 0.08 } },
        press: { scale: 0.98, overlay: 0.1, accent: { opacity: 0.84 } },
      },
    };
  }
  if (feedback === 'underline') {
    return {
      feedback: { focus: { style: 'outline', width: 2, offset: 0 } },
      controls: {
        field: {
          edge: { sides: false, bottom: 'brand' },
          focus: { line: true, width: 2, color: 'brand' },
        },
      },
    };
  }
  if (feedback === 'lift') {
    return {
      feedback: {
        hover: { overlay: 0.08, fill: { color: 'foreground', alpha: 0.06 } },
        press: { scale: 0.94, translateY: -1 },
      },
    };
  }
  return {
    feedback: { focus: { style: 'outline', width: 2, offset: 2 } },
    controls: { field: { focus: { line: false, width: 2, color: 'ring' } } },
  };
}

interface Steps {
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
}

interface DensityRow {
  readonly height: { readonly pointer: Steps; readonly touch: Steps };
  readonly icon: { readonly pointer: Steps; readonly touch: Steps };
  readonly density: {
    readonly pointer: { readonly pad: number; readonly gap: number };
    readonly touch: { readonly pad: number; readonly gap: number };
  };
  readonly control: {
    readonly pointer: { readonly padding: number; readonly gap: number };
    readonly touch: { readonly padding: number; readonly gap: number };
  };
  readonly item: {
    readonly pointer: { readonly inset: number; readonly pad: number };
    readonly touch: { readonly inset: number; readonly pad: number };
  };
  readonly hit: { readonly pointer: number; readonly touch: number };
}

const DENSITY: Record<ParadigmDensity, DensityRow> = {
  compact: {
    height: {
      pointer: { sm: 20, md: 24, lg: 28 },
      touch: { sm: 32, md: 40, lg: 44 },
    },
    icon: {
      pointer: { sm: 12, md: 16, lg: 16 },
      touch: { sm: 16, md: 16, lg: 20 },
    },
    density: {
      pointer: { pad: 8, gap: 8 },
      touch: { pad: 8, gap: 8 },
    },
    control: {
      pointer: { padding: 4, gap: 4 },
      touch: { padding: 8, gap: 8 },
    },
    item: {
      pointer: { inset: 0, pad: 4 },
      touch: { inset: 8, pad: 8 },
    },
    hit: { pointer: 0, touch: 44 },
  },
  balanced: {
    height: {
      pointer: { sm: 24, md: 28, lg: 32 },
      touch: { sm: 32, md: 40, lg: 48 },
    },
    icon: {
      pointer: { sm: 12, md: 16, lg: 20 },
      touch: { sm: 16, md: 20, lg: 24 },
    },
    density: {
      pointer: { pad: 12, gap: 12 },
      touch: { pad: 12, gap: 12 },
    },
    control: {
      pointer: { padding: 8, gap: 8 },
      touch: { padding: 8, gap: 8 },
    },
    item: {
      pointer: { inset: 4, pad: 8 },
      touch: { inset: 8, pad: 8 },
    },
    hit: { pointer: 0, touch: 44 },
  },
  airy: {
    height: {
      pointer: { sm: 28, md: 36, lg: 44 },
      touch: { sm: 44, md: 52, lg: 56 },
    },
    icon: {
      pointer: { sm: 16, md: 20, lg: 24 },
      touch: { sm: 20, md: 24, lg: 28 },
    },
    density: {
      pointer: { pad: 16, gap: 16 },
      touch: { pad: 24, gap: 16 },
    },
    control: {
      pointer: { padding: 12, gap: 8 },
      touch: { padding: 16, gap: 12 },
    },
    item: {
      pointer: { inset: 8, pad: 12 },
      touch: { inset: 8, pad: 16 },
    },
    hit: { pointer: 0, touch: 48 },
  },
};

function densityPatch(density: ParadigmDensity): ParadigmPatch {
  return { metrics: DENSITY[density] };
}

/**
 * Expand one L1 paradigm into a sparse L2 patch.
 * `defineTheme` merges it after the extended theme and before that call's own L2 fields.
 */
export function expandParadigm(paradigm: ThemeParadigm): ParadigmPatch {
  const parts: ParadigmPatch[] = [];
  if (paradigm.depth) parts.push(depthPatch(paradigm.depth));
  if (paradigm.shape) parts.push(shapePatch(paradigm.shape));
  if (paradigm.stroke) parts.push(strokePatch(paradigm.stroke));
  if (paradigm.motion) parts.push(motionPatch(paradigm.motion));
  if (paradigm.feedback) parts.push(feedbackPatch(paradigm.feedback));
  if (paradigm.density) parts.push(densityPatch(paradigm.density));
  return parts.reduce(mergePatch, {});
}
