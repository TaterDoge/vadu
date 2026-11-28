/**
 * NSH Gallery: the default build-time theme and complete `base` spec that all other themes
 * inherit sparsely from (`docs/decisions/0020-theme-v5.md`).
 * Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.
 */
import { defineTheme, type ThemeSpec } from './schema';

export const baseSpec: ThemeSpec = {
  id: 'nsh-gallery',
  label: 'NSH Gallery',
  tokens: {
    radius: {
      control: 8,
      container: 12,
      modal: 14,
      curve: 'continuous',
    },
    fixed: {
      scrim: 'oklch(0 0 0 / 0.45)',
      media: 'oklch(0.1869 0.0151 266.766)',
      'on-media': 'oklch(1 0 0)',
    },
    light: {
      background: 'oklch(0.97399 0.00397 286.326)',
      card: 'oklch(1 0 0)',
      popover: 'oklch(0.97997 0.00397 286.326)',
      muted: 'oklch(0.95222 0.00415 271.369)',
      surface: 'oklch(0.96724 0.00414 271.369)',
      foreground: 'oklch(0.18636 0.01318 264.182)',
      'muted-foreground': 'oklch(0.49859 0.01219 261.766)',
      faint: 'oklch(0.69542 0.00939 264.505)',
      primary: 'oklch(0.89637 0.16627 124.031)',
      'primary-foreground': 'oklch(0.19339 0.0197 121.819)',
      secondary: 'var(--surface)',
      accent: 'oklch(0.93609 0.00346 247.86)',
      brand: 'oklch(0.55192 0.15368 133.676)',
      border: 'oklch(0.84192 0.00298 264.54)',
      line: 'oklch(0.91973 0.00403 286.32)',
      input: 'oklch(0.81386 0.003 264.54)',
      ring: 'oklch(0.7307 0.01549 264.473)',
      info: 'oklch(0.53418 0.17531 266.181)',
      success: 'oklch(0.56078 0.1232 159.355)',
      warning: 'oklch(0.5909 0.13245 65.117)',
      destructive: 'oklch(0.58301 0.18974 19.874)',
    },
    dark: {
      background: 'oklch(0.21297 0.01273 264.257)',
      card: 'oklch(0.25145 0.01219 264.328)',
      popover: 'oklch(0.25145 0.01219 264.328)',
      muted: 'oklch(0.29661 0.01168 264.381)',
      surface: 'oklch(0.32935 0.01092 271.072)',
      foreground: 'oklch(0.95193 0.00289 264.542)',
      'muted-foreground': 'oklch(0.69819 0.01118 261.782)',
      faint: 'oklch(0.54061 0.01194 261.771)',
      primary: 'oklch(0.88837 0.16324 123.959)',
      'primary-foreground': 'oklch(0.19339 0.0197 121.819)',
      secondary: 'var(--surface)',
      accent: 'oklch(0.32053 0.01145 264.401)',
      brand: 'oklch(0.90469 0.16668 124.297)',
      border: 'oklch(0.32447 0.01141 264.404)',
      line: 'oklch(0.30863 0.01156 264.391)',
      input: 'oklch(0.3556 0.01115 264.424)',
      ring: 'oklch(0.49837 0.01905 262.684)',
      info: 'oklch(0.7377 0.13479 263.817)',
      success: 'oklch(0.77932 0.14805 162.141)',
      warning: 'oklch(0.82449 0.14865 73.346)',
      destructive: 'oklch(0.70034 0.19197 18.007)',
    },
    tintAlpha: { light: 0.1, dark: 0.16 },
    tints: {
      light: {
        brand: 'oklch(0.74395 0.18452 127.154 / 0.16)',
        warning: 'color-mix(in srgb, {warning} 11%, transparent)',
      },
      dark: {
        brand: 'color-mix(in srgb, {brand} 14%, transparent)',
      },
    },
    chart: {
      light: [
        'oklch(0.75073 0.18465 126.794)',
        'oklch(0.35944 0.01112 264.426)',
        'oklch(0.60539 0.01485 262.354)',
        'oklch(0.78155 0.01087 261.785)',
        'oklch(0.90374 0.00421 271.366)',
      ],
      dark: [
        'oklch(0.90469 0.16668 124.297)',
        'oklch(0.92503 0.00418 271.367)',
        'oklch(0.71149 0.01246 264.489)',
        'oklch(0.53054 0.01343 264.454)',
        'oklch(0.39359 0.01086 264.443)',
      ],
    },
  },
  metrics: {
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
    stroke: { hairline: 1, control: 1 },
    typography: {
      caption: { fontWeight: 400, letterSpacing: 0 },
      detail: { fontWeight: 400, letterSpacing: 0 },
      body: { fontWeight: 400, letterSpacing: 0 },
      label: { fontWeight: 500, letterSpacing: 0 },
      title: { fontWeight: 600, letterSpacing: 0 },
      headline: { fontWeight: 600, letterSpacing: 0 },
      display: { fontWeight: 600, letterSpacing: 0 },
    },
  },
  elevation: {
    light: {
      sm: '0 1px 0 oklch(0.1686 0.02256 263.693 / 0.05)',
      md: '0 1px 0 oklch(0.1686 0.02256 263.693 / 0.04)',
      lg: '0 1px 0 oklch(0.1686 0.02256 263.693 / 0.04), 0 12px 28px -10px oklch(0.1686 0.02256 263.693 / 0.22)',
      xl: '0 1px 0 oklch(0.1686 0.02256 263.693 / 0.04), 0 12px 28px -10px oklch(0.1686 0.02256 263.693 / 0.22)',
      inset: 'inset 0 1px 1px oklch(0.1686 0.02256 263.693 / 0.06)',
      edgeSurface:
        'inset 0 1px 0 oklch(1 0 0), inset 0 2px 0 oklch(1 0 0 / 0.6)',
      edgeAccent:
        'inset 0 1px 0 oklch(1 0 0 / 0.55), inset 0 -1px 0 oklch(0.42761 0.11265 128.534 / 0.12), 0 1px 0 oklch(0.42761 0.11265 128.534 / 0.14)',
    },
    dark: {
      sm: '0 1px 1px oklch(0 0 0 / 0.12)',
      md: '0 1px 0 oklch(0 0 0 / 0.35)',
      lg: '0 1px 0 oklch(0 0 0 / 0.4), 0 16px 32px -10px oklch(0 0 0 / 0.6)',
      xl: '0 1px 0 oklch(0 0 0 / 0.4), 0 16px 32px -10px oklch(0 0 0 / 0.6)',
      inset: 'inset 0 1px 1px oklch(0 0 0 / 0.2)',
      edgeSurface:
        'inset 0 0 0 1px oklch(1 0 0 / 0.06), inset 0 1px 1px oklch(1 0 0 / 0.08)',
      edgeAccent:
        'inset 0 0 0 1px oklch(1 0 0 / 0.22), inset 0 1px 1px oklch(1 0 0 / 0.35), 0 1px 1px oklch(0 0 0 / 0.12)',
    },
  },
  surfaces: {
    card: {
      background: 'card',
      foreground: 'foreground',
      border: 'border',
      shadow: 'md',
    },
    inset: {
      light: { background: 'oklch(0.96124 0.00414 271.369)' },
      dark: { background: 'oklch(0.23027 0.01247 264.293)' },
      foreground: 'foreground',
      border: 'border',
      shadow: 'inset',
    },
    channel: {
      foreground: 'foreground',
      border: 'border',
      shadow: 'inset',
      light: { background: 'oklch(0.96124 0.00414 271.369)' },
      dark: { background: 'oklch(0.23027 0.01247 264.293)' },
    },
    raised: {
      background: 'surface',
      foreground: 'foreground',
      shadow: ['edgeSurface', 'sm'],
      light: {
        border: 'border',
        borderTop: 'border',
        borderBottom: 'border',
      },
      dark: {
        border: 'oklch(0 0 0 / 0.5)',
        borderTop: 'oklch(0 0 0 / 0.5)',
        borderBottom: 'oklch(0 0 0 / 0.5)',
      },
    },
    plate: {
      foreground: 'foreground',
      shadow: ['edgeSurface', 'sm'],
      light: {
        background: 'card',
        border: 'border',
      },
      dark: {
        background: 'surface',
        border: 'oklch(0 0 0 / 0.5)',
      },
    },
    overlay: {
      background: 'popover',
      foreground: 'foreground',
      border: 'border',
      shadow: 'lg',
    },
    modal: {
      background: 'card',
      foreground: 'foreground',
      border: 'border',
      shadow: 'xl',
    },
    inverse: {
      background: 'card',
      foreground: 'foreground',
      border: 'border',
      shadow: 'lg',
    },
    glass: {
      foreground: 'foreground',
      border: 'border',
      shadow: ['edgeSurface', 'sm'],
      backdropFilter: 'blur(20px)',
      light: { background: { color: 'popover', alpha: 0.8 } },
      dark: { background: { color: 'card', alpha: 0.78 } },
    },
    accent: {
      background: 'primary',
      foreground: 'primary-foreground',
      shadow: 'edgeAccent',
      light: {
        border: 'color-mix(in srgb, {primary} 78%, oklch(0 0 0))',
        borderBottom: 'color-mix(in srgb, {primary} 78%, oklch(0 0 0))',
      },
      dark: {
        border: 'color-mix(in srgb, {primary} 45%, oklch(0 0 0))',
        borderBottom: 'color-mix(in srgb, {primary} 45%, oklch(0 0 0))',
      },
    },
    fill: {
      foreground: 'primary-foreground',
      shadow: 'edgeAccent',
      light: {
        background: 'oklch(0.75073 0.18465 126.794)',
        gradient:
          'linear-gradient(180deg, oklch(0.80472 0.1815 126.061) 0%, oklch(0.75073 0.18465 126.794) 100%)',
        border: 'oklch(0.69169 0.17204 126.956)',
      },
      dark: {
        background: 'oklch(0.83973 0.16469 124.137)',
        gradient:
          'linear-gradient(180deg, oklch(0.88348 0.15928 123.937) 0%, oklch(0.83973 0.16469 124.137) 100%)',
        border: 'oklch(0.71963 0.15821 125.456)',
      },
    },
  },
  feedback: {
    hover: {
      overlay: 0,
      fill: { color: 'foreground', alpha: 0.05 },
      surface: {
        foreground: 'foreground',
        shadow: ['edgeSurface', 'sm'],
        light: {
          background: 'popover',
          border: 'border',
          borderTop: 'border',
          borderBottom: 'border',
        },
        dark: {
          background: 'input',
          border: 'oklch(0 0 0 / 0.5)',
          borderTop: 'oklch(0 0 0 / 0.5)',
          borderBottom: 'oklch(0 0 0 / 0.5)',
        },
      },
    },
    press: {
      scale: 0.97,
      translateY: 0,
      overlay: 0,
      surface: {
        foreground: 'foreground',
        shadow: 'inset',
        light: { background: 'muted', border: 'input' },
        dark: { background: 'line', border: 'oklch(0 0 0 / 0.5)' },
      },
      accent: { opacity: 0.88 },
    },
    focus: {
      style: 'halo',
      width: 3,
      offset: 0,
      innerColor: 'card',
    },
    disabled: {
      contentOpacity: 0.5,
      replaceFace: false,
      surface: {
        background: 'surface',
        foreground: 'foreground',
        shadow: ['edgeSurface', 'sm'],
        light: { border: 'border' },
        dark: { border: 'border' },
      },
    },
    passive: {
      restOpacity: 0.5,
      pressedOpacity: 0.7,
    },
  },
  motion: {
    state: { duration: 120, easing: 'out-cubic' },
    fast: { duration: 150, easing: 'out-cubic' },
    default: { duration: 250, easing: 'out-cubic' },
    slow: { duration: 350, easing: 'out-cubic' },
    presets: {
      popoverEnter: { fromScale: 0.96, fromY: 0, timing: 'fast' },
      dialogEnter: { fromScale: 0.96, fromY: 0, timing: 'default' },
      indicatorGlide: { timing: 'fast' },
      themeSwitch: { kind: 'fade', duration: 200 },
    },
  },
  controls: {
    button: {
      corner: { sm: 'control', md: 'control', lg: 'control' },
      selected: { face: { surface: 'accent' }, ink: 'primary-foreground' },
      secondary: { face: { surface: 'raised' }, edge: 'border' },
      outline: { edge: 'border' },
      destructive: { edge: { color: 'destructive', alpha: 0.32 } },
      shade: 'raised',
    },
    badge: { corner: 'control' },
    field: {
      ground: { light: 'card', dark: 'background' },
      shade: 'inset',
      edge: { sides: true, color: 'input', bottom: 'input' },
      focus: { line: false, width: 3, color: 'brand' },
    },
    choice: {
      size: { pointer: 16, touch: 22 },
      box: { pointer: 16, touch: 20 },
      corner: { pointer: 5, touch: 7 },
      face: { light: 'card', dark: { color: 'input', alpha: 0.3 } },
      shade: 'inset',
      edge: {
        width: 1,
        color: { light: 'input', dark: { color: 'foreground', alpha: 0.2 } },
        disabled: { light: 'input', dark: { color: 'foreground', alpha: 0.4 } },
      },
      checked: { face: { surface: 'accent' } },
      radioChecked: { face: { surface: 'accent' } },
      mark: { pointer: 6, touch: 8 },
    },
    switch: {
      track: { pointer: [36, 20], touch: [44, 24] },
      trackOffFace: {
        light: 'oklch(0.96124 0.00414 271.369)',
        dark: 'oklch(0.23027 0.01247 264.293)',
      },
      small: {
        track: { pointer: [28, 16], touch: [36, 20] },
        knob: { pointer: 12, touch: 16 },
      },
      edge: { off: 1, on: 1, color: 'border' },
      knob: {
        size: { pointer: 16, touch: 20 },
        on: 'same',
        pressed: 'same',
        background: {
          light: 'oklch(1 0 0)',
          dark: 'oklch(0.92199 0.00419 271.367)',
        },
        gradient: {
          light: 'linear-gradient(180deg, oklch(1 0 0) 0%, {surface} 100%)',
          dark: 'linear-gradient(180deg, {foreground} 0%, oklch(0.88185 0.00589 264.53) 100%)',
        },
        border: {
          light: 'input',
          dark: 'oklch(0.8324 0.00597 264.528)',
        },
        shadow: 'sm',
        checkedBackground: {
          light: 'oklch(1 0 0)',
          dark: 'oklch(1 0 0)',
        },
        checkedBorder: {
          light: 'oklch(0.72099 0.15728 124.776)',
          dark: 'oklch(0.71963 0.15821 125.456)',
        },
        checkedGradient: null,
      },
    },
    slider: {
      rail: { pointer: 6, touch: 8 },
      band: { pointer: 20, touch: 32 },
      face: {
        light: 'oklch(0.93714 0.00417 271.368)',
        dark: 'oklch(0.33232 0.01134 264.409)',
      },
      shade: 'inset',
      edge: { color: 'border', width: 1 },
      knob: {
        size: { pointer: 14, touch: 20 },
        pressed: { pointer: 14, touch: 32 },
        background: {
          light: 'oklch(1 0 0)',
          dark: 'oklch(0.92199 0.00419 271.367)',
        },
        gradient: {
          light: 'linear-gradient(180deg, oklch(1 0 0) 0%, {surface} 100%)',
          dark: 'linear-gradient(180deg, {foreground} 0%, oklch(0.88185 0.00589 264.53) 100%)',
        },
        border: {
          light: 'input',
          dark: 'oklch(0.8324 0.00597 264.528)',
        },
        shadow: 'sm',
      },
      mark: 0,
    },
    progress: {
      height: 6,
      face: {
        light: 'oklch(0.93714 0.00417 271.368)',
        dark: 'oklch(0.33232 0.01134 264.409)',
      },
      shade: 'inset',
      edge: { color: 'border', width: 1 },
    },
    spinner: { trackOpacity: 0.25 },
    popup: { corner: 'container' },
    list: {
      item: {
        highlight: { tint: 'brand' },
        edge: { color: 'brand', alpha: 0.3 },
      },
    },
    tabs: {
      track: {
        face: {
          light: 'oklch(0.96124 0.00414 271.369)',
          dark: 'oklch(0.23027 0.01247 264.293)',
        },
        edge: 'border',
        corner: 'full',
      },
    },
    menubar: { bar: 'card' },
    well: { edge: 'border' },
  },
  meta: {
    overview:
      'NSH Gallery: graphite dark and paper light surfaces with citrus lime (`#c6ef6a`) primary fill, continuous squircle corners, ease-out timing motion, and layered surface finishes.',
    elevationNote:
      'Tactile layered elevation: inner top-edge highlights (`inset`), 1px hairline borders, contact + cast drop shadows (`card`, `overlay`, `modal`, `inverse`), and translucent frosted glass (`glass`).',
    dos: [
      'Preserve the citrus accent (`primary` / `primary-foreground`) for primary actions, active runs, and focus highlights.',
      'Use `inset` wells inside cards and `raised` surfaces for controls sitting on cards, paired with continuous squircle corners.',
      'Apply tactile press feedback (`feedback.press.scale: 0.97` eased by `motion.state`).',
    ],
    donts: [
      'Do not flatten shadows or remove inner highlights on `card`, `raised`, `inset`, or `plate` surfaces.',
    ],
    contrastWaivers: [
      {
        fg: 'brand',
        bg: 'background',
        source:
          'NSH Gallery citrus lime primary is a fill: light-mode brand text preserves lime hue on paper',
      },
    ],
  },
};

export const nshGallery = defineTheme(baseSpec);
export const base = nshGallery.spec;
export default nshGallery;
