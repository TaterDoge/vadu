// The platform materials a finish can ask for, and what each guarantees where the platform has
// none of them. From the NSH design guides; yours to change.
import type { BackdropMaterial, WindowsBackdropMaterial } from 'nsh';

/**
 * The materials a finish can ask for: the platform's own glass or acrylic. `null` in
 * `Finish.material` asks nothing of the platform — the layer draws only itself — which is every
 * layer of the themes that imitate no platform.
 */
export type FinishMaterial = 'glass' | 'acrylic';

/**
 * What one material asks of NSH, and what it guarantees a platform that has none of it.
 *
 * NSH has no SVG filters: a material is either the platform's own (Liquid Glass, the Windows 11
 * backdrop blur) or a blur of what is behind the view (`backdropFilter`) — never a refraction, a
 * noise or a luminosity blend, which the platform draws for us or not at all.
 */
export interface MaterialRecipe {
  /**
   * Liquid Glass on iOS 26 and macOS 26 and later, as the style key it rides in (`glassEffect`,
   * with the layer's own colour as `glassTintColor`). NSH draws the finish's `backdropFilter` on
   * every other platform, so a recipe states a glass or a platform backdrop, never both.
   */
  glassEffect?: 'regular' | 'clear';
  /** NSH's platform props: `platformMaterial()` spreads them on the view that draws the finish. */
  props: {
    /** The system material of the finish's `backdropFilter` blur (`ios={{ backdropMaterial }}`). */
    ios?: { backdropMaterial: BackdropMaterial };
    /** The system blur of what is behind the window (`windows={{ backdrop }}`), Windows 11 (22000) and later. */
    windows?: { backdrop: { material: WindowsBackdropMaterial } };
  };
  /** What every platform that draws no material of its own draws instead. */
  fallback: {
    /** The blur the layer wears, in points: `backdropFilter` is the only blur NSH has. */
    blur: number;
    /**
     * The least opaque the layer's own fill may be, so that a platform which draws no blur (Linux,
     * GPUI) shows nothing through the layer's fill. A theme states its fills at or above it.
     */
    minOpacity: number;
  };
}

/**
 * The recipes, by material: what `Finish.material` names.
 *
 * `glass` is Liquid Glass: the system glass on iOS 26 and macOS 26 and later, with the layer's
 * colour as its tint, and a 30pt blur elsewhere — the layer's fill is at least 0.72 opaque, so what
 * is behind it never comes through unfiltered. `acrylic` is Windows 11's Acrylic: the system blur of
 * what is behind the window, over a fill that states WinUI's tint and luminosity (0.85 light, 0.96
 * dark, in `themes/winui/`), falling back to a 30pt blur elsewhere. Both numbers are the guide's;
 * they are checked against platform screenshots, not derived.
 */
export const materials: Record<FinishMaterial, MaterialRecipe> = {
  glass: {
    glassEffect: 'regular',
    props: { ios: { backdropMaterial: 'regular' } },
    fallback: { blur: 30, minOpacity: 0.72 },
  },
  acrylic: {
    props: { windows: { backdrop: { material: 'blur' } } },
    fallback: { blur: 30, minOpacity: 0.85 },
  },
};
