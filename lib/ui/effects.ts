/**
 * Built-in WGSL surface and theme-switch shaders.
 *
 * Pure TypeScript and shader source: this file does not import `nsh`, so the CLI, Node and Bun
 * tests can read it. NSH supplies `nsh`, `uniforms`, `sample_content`, `sample_backdrop`,
 * `sample_from` and `sample_to` when it compiles a source.
 */
import type {
  SurfaceEffectKind,
  SurfaceEffectSpec,
  ThemeSwitchKind,
} from './schema';

const HASH = /* wgsl */ `
fn hash(p: vec2f) -> f32 {
  let q = bitcast<vec2u>(vec2i(floor(p)));
  var h = (q.x * 1597334677u) ^ (q.y * 3812015801u);
  h = h * 1664525u + 1013904223u;
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  return f32(h >> 8u) / 16777216.0;
}`;

const NOISE = /* wgsl */ `${HASH}
fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2f(1.0, 0.0)), u.x),
    mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x),
    u.y
  );
}`;

/**
 * Built-in surface shaders, keyed by `SurfaceEffectKind`.
 * Every source declares `struct Uniforms { intensity: f32 }` and `fn shade(uv: vec2f) -> vec4f`.
 */
export const SURFACE_SHADERS: Record<
  SurfaceEffectKind,
  {
    readonly source: string;
    readonly defaultIntensity: number;
    readonly maxSampleOffset: number;
  }
> = {
  'liquid-glass': {
    defaultIntensity: 0.35,
    maxSampleOffset: 4,
    source: /* wgsl */ `
struct Uniforms { intensity: f32 }
fn shade(uv: vec2f) -> vec4f {
  let px = 1.0 / max(nsh.size, vec2f(1.0));
  let from_edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  let rim = smoothstep(0.14, 0.0, from_edge);
  let delta = uv - vec2f(0.5);
  let bend = delta * rim * uniforms.intensity * 8.0 * px;
  let split = vec2f(px.x, 0.0) * rim * uniforms.intensity;
  let backdrop_r = sample_backdrop(uv + bend + split);
  let backdrop_g = sample_backdrop(uv + bend);
  let backdrop_b = sample_backdrop(uv + bend - split);
  let glass = vec4f(backdrop_r.r, backdrop_g.g, backdrop_b.b, backdrop_g.a);
  let content = sample_content(uv);
  var color = mix(glass, content, content.a);
  let graz = smoothstep(0.16, 0.0, uv.y);
  let sheen = graz * uniforms.intensity;
  color = vec4f(mix(color.rgb, vec3f(1.0), sheen * 0.7), max(color.a, sheen * 0.22));
  return color;
}`,
  },
  'acrylic-noise': {
    defaultIntensity: 0.035,
    maxSampleOffset: 0,
    source: /* wgsl */ `${HASH}
struct Uniforms { intensity: f32 }
fn shade(uv: vec2f) -> vec4f {
  let content = sample_content(uv);
  let grain = hash(uv * nsh.size * max(nsh.scale, 1.0)) - 0.5;
  let rgb = clamp(content.rgb + vec3f(grain * uniforms.intensity), vec3f(0.0), vec3f(1.0));
  return vec4f(rgb, content.a);
}`,
  },
  'specular-rim': {
    defaultIntensity: 0.4,
    maxSampleOffset: 0,
    source: /* wgsl */ `
struct Uniforms { intensity: f32 }
fn shade(uv: vec2f) -> vec4f {
  let content = sample_content(uv);
  let top = smoothstep(0.2, 0.0, uv.y);
  let edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  let rim = smoothstep(0.07, 0.0, edge);
  let bottom = smoothstep(0.76, 1.0, uv.y);
  var rgb = mix(content.rgb, vec3f(1.0), top * uniforms.intensity * 0.55);
  rgb = mix(rgb, vec3f(1.0), rim * uniforms.intensity * 0.22);
  rgb = mix(rgb, rgb * vec3f(0.62), bottom * uniforms.intensity);
  return vec4f(clamp(rgb, vec3f(0.0), vec3f(1.0)), content.a);
}`,
  },
  'paper-grain': {
    defaultIntensity: 0.025,
    maxSampleOffset: 0,
    source: /* wgsl */ `${NOISE}
struct Uniforms { intensity: f32 }
fn shade(uv: vec2f) -> vec4f {
  let content = sample_content(uv);
  let p = uv * nsh.size * max(nsh.scale, 1.0);
  let low = noise(p / 42.0);
  let high = noise(p / 3.5);
  let grain = (low - 0.5) * 0.65 + (high - 0.5) * 0.35;
  let warm = vec3f(0.02, 0.008, -0.012) * uniforms.intensity;
  let rgb = clamp(content.rgb + vec3f(grain * uniforms.intensity) + warm, vec3f(0.0), vec3f(1.0));
  return vec4f(rgb, content.a);
}`,
  },
};

/**
 * Theme-switch shaders for the kinds that are not a plain fade.
 * Every source defines `fn shade(uv: vec2f) -> vec4f` and reads `nsh.progress`, `sample_from` and `sample_to`.
 */
export const TRANSITION_SHADERS: Record<
  Exclude<ThemeSwitchKind, 'none' | 'fade'>,
  { readonly source: string }
> = {
  dissolve: {
    source: /* wgsl */ `${HASH}
fn shade(uv: vec2f) -> vec4f {
  let n = hash(uv * nsh.size * max(nsh.scale, 1.0));
  let t = 1.0 - smoothstep(nsh.progress - 0.06, nsh.progress + 0.06, n);
  return mix(sample_from(uv), sample_to(uv), t);
}`,
  },
  'radial-wipe': {
    source: /* wgsl */ `
fn shade(uv: vec2f) -> vec4f {
  let aspect = nsh.size.x / max(nsh.size.y, 1.0);
  let p = (uv - vec2f(0.5)) * vec2f(aspect, 1.0);
  let d = length(p);
  let reach = nsh.progress * 1.15;
  let t = 1.0 - smoothstep(reach, reach + 0.12, d);
  return mix(sample_from(uv), sample_to(uv), t);
}`,
  },
};

/** A surface effect ready to hand to `ShaderEffect`. */
export interface ResolvedSurfaceEffect {
  /** WGSL source (`fn shade`). */
  readonly source: string;
  /** Uniforms the source's `struct Uniforms` reads. */
  readonly uniforms: { readonly intensity: number };
  /** How far, in points, samples may reach outside the view. */
  readonly maxSampleOffset: number;
}

/** Resolve a surface effect spec to shader source and uniforms, or `null` when unset. */
export function resolveSurfaceEffect(
  spec: SurfaceEffectSpec | null | undefined,
): ResolvedSurfaceEffect | null {
  if (spec == null) return null;
  const built = SURFACE_SHADERS[spec.kind];
  return {
    source: spec.wgsl ?? built.source,
    uniforms: { intensity: spec.intensity ?? built.defaultIntensity },
    maxSampleOffset: built.maxSampleOffset,
  };
}

/** WGSL for a theme-switch kind, or `null` for `"none"` and `"fade"`. */
export function resolveTransitionShader(kind: ThemeSwitchKind): string | null {
  switch (kind) {
    case 'none':
    case 'fade':
      return null;
    case 'dissolve':
    case 'radial-wipe':
      return TRANSITION_SHADERS[kind].source;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
