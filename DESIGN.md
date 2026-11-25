---
version: alpha
name: "NSH Gallery UI"
description: "Default NSH Gallery UI theme."
colors:
  scrim: "#00000073"
  media: "#10131a"
  on-media: "#ffffff"
  light:
    background: "#f6f6f9"
    foreground: "#101319"
    card: "#ffffff"
    card-foreground: "#101319"
    popover: "#ffffff"
    popover-foreground: "#101319"
    primary: "#c6ef6a"
    primary-foreground: "#13160c"
    secondary: "#f3f4f7"
    secondary-foreground: "#101319"
    muted: "#eeeff2"
    muted-foreground: "#5f636a"
    accent: "#eeeff2"
    accent-foreground: "#101319"
    destructive: "#d43a4a"
    border: "#cacbcd"
    input: "#cacbcd"
    ring: "#5f636a"
    chart-1: "#c6ef6a"
    chart-2: "#3d63d1"
    chart-3: "#138a5a"
    chart-4: "#b26a00"
    chart-5: "#d43a4a"
    sidebar: "#f6f6f9"
    sidebar-foreground: "#101319"
    sidebar-primary: "#c6ef6a"
    sidebar-primary-foreground: "#13160c"
    sidebar-accent: "#eeeff2"
    sidebar-accent-foreground: "#101319"
    sidebar-border: "#e4e4e7"
    sidebar-ring: "#5f636a"
    inset: "#eeeff2"
    raised: "#f3f4f7"
    field: "#ffffff"
    line: "#e4e4e7"
    hover: "#eeeff2"
    faint: "#9a9da3"
    brand: "#c6ef6a"
    brand-edge: "#cacbcd"
    track: "#eeeff2"
    knob: "#ffffff"
    info: "#3d63d1"
    warn: "#b26a00"
    up: "#138a5a"
    brand-tint: "#c6ef6a1a"
    inverse: "#ffffff"
    inverse-foreground: "#101319"
    inverse-brand: "#13160c"
    info-tint: "#3d63d11a"
    warn-tint: "#b26a001a"
    destructive-tint: "#d43a4a1a"
    up-tint: "#138a5a1a"
    down-tint: "#d43a4a1a"
  dark:
    background: "#16191f"
    foreground: "#eeeff1"
    card: "#1f2228"
    card-foreground: "#eeeff1"
    popover: "#1f2228"
    popover-foreground: "#eeeff1"
    primary: "#c4ec6a"
    primary-foreground: "#13160c"
    secondary: "#33353b"
    secondary-foreground: "#eeeff1"
    muted: "#2a2d33"
    muted-foreground: "#9a9ea5"
    accent: "#2a2d33"
    accent-foreground: "#eeeff1"
    destructive: "#ff6170"
    border: "#31343a"
    input: "#31343a"
    ring: "#9a9ea5"
    chart-1: "#c4ec6a"
    chart-2: "#7ea8ff"
    chart-3: "#45d49a"
    chart-4: "#ffb547"
    chart-5: "#ff6170"
    sidebar: "#16191f"
    sidebar-foreground: "#eeeff1"
    sidebar-primary: "#c4ec6a"
    sidebar-primary-foreground: "#13160c"
    sidebar-accent: "#2a2d33"
    sidebar-accent-foreground: "#eeeff1"
    sidebar-border: "#2d3036"
    sidebar-ring: "#9a9ea5"
    inset: "#2a2d33"
    raised: "#33353b"
    field: "#1f2228"
    line: "#2d3036"
    hover: "#2a2d33"
    faint: "#6b6f76"
    brand: "#c4ec6a"
    brand-edge: "#31343a"
    track: "#2a2d33"
    knob: "#eeeff1"
    info: "#7ea8ff"
    warn: "#ffb547"
    up: "#45d49a"
    brand-tint: "#c4ec6a1a"
    inverse: "#1f2228"
    inverse-foreground: "#eeeff1"
    inverse-brand: "#13160c"
    info-tint: "#7ea8ff1a"
    warn-tint: "#ffb5471a"
    destructive-tint: "#ff61701a"
    up-tint: "#45d49a1a"
    down-tint: "#ff61701a"
typography:
  caption:
    fontSize: 11px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
  detail:
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
  body:
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  label:
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0px
  title:
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0px
  headline:
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: 0px
  display:
    fontSize: 26px
    fontWeight: 600
    lineHeight: 32px
    letterSpacing: 0px
rounded:
  control: 8px
  container: 12px
  modal: 14px
spacing:
  hit: 0px
  density:
    pad: 12px
    gap: 12px
  item:
    inset: 4px
    pad: 8px
  control:
    padding: 8px
    gap: 8px
    dot: 6px
  height:
    sm: 24px
    md: 28px
    lg: 32px
  stroke:
    hairline: 1px
    control: 1px
  focus:
    width: 3px
    offset: 0px
  icon:
    sm: 12px
    md: 16px
    lg: 20px
motion:
  enter:
    duration: 420ms
    delay: 0ms
    timingFunction: "cubic-bezier(0.333333, 1, 0.666667, 1)"
  state:
    duration: 120ms
    delay: 0ms
    timingFunction: "cubic-bezier(0.333333, 1, 0.666667, 1)"
components:
  button-primary:
    backgroundColor: "{colors.light.primary}"
    textColor: "{colors.light.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "{spacing.height.md}"
    padding: "{spacing.density.gap}"
  button-secondary:
    backgroundColor: "{colors.light.raised}"
    textColor: "{colors.light.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "{spacing.height.md}"
    padding: "{spacing.density.gap}"
  button-secondary-hover:
    backgroundColor: "{colors.light.popover}"
  button-secondary-pressed:
    backgroundColor: "{colors.light.muted}"
  card:
    backgroundColor: "{colors.light.card}"
    textColor: "{colors.light.card-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.container}"
    padding: "{spacing.density.pad}"
  card-inset:
    backgroundColor: "{colors.light.inset}"
    textColor: "{colors.light.foreground}"
    rounded: "{rounded.control}"
    padding: "{spacing.control.padding}"
  input-field:
    backgroundColor: "{colors.light.inset}"
    textColor: "{colors.light.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "{spacing.height.md}"
    padding: "{spacing.control.padding}"
  badge-chip:
    backgroundColor: "{colors.light.secondary}"
    textColor: "{colors.light.secondary-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
  menu-popover:
    backgroundColor: "{colors.light.popover}"
    textColor: "{colors.light.popover-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.container}"
    padding: "{spacing.control.padding}"
  dialog:
    backgroundColor: "{colors.light.card}"
    textColor: "{colors.light.card-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.modal}"
    padding: "{spacing.density.pad}"
  tooltip:
    backgroundColor: "{colors.light.inverse}"
    textColor: "{colors.light.inverse-foreground}"
    typography: "{typography.detail}"
    rounded: "{rounded.container}"
  toast-inverse:
    backgroundColor: "{colors.light.inverse}"
    textColor: "{colors.light.inverse-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.container}"
  switch-track:
    backgroundColor: "{colors.light.inset}"
    rounded: "{rounded.control}"
  switch-track-on:
    backgroundColor: "{colors.light.primary}"
  switch-knob:
    backgroundColor: "#ffffff"
  switch-knob-checked:
    backgroundColor: "#ffffff"
  slider-handle:
    backgroundColor: "#ffffff"
  tabs-thumb:
    backgroundColor: "{colors.light.raised}"
    textColor: "{colors.light.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
  toggle-on:
    backgroundColor: "{colors.light.primary}"
    textColor: "{colors.light.primary-foreground}"
    rounded: "{rounded.control}"
  glass-overlay:
    backgroundColor: "#ffffffcc"
    textColor: "{colors.light.popover-foreground}"
    rounded: "{rounded.container}"
---

# NSH Gallery UI

## Overview

Default NSH Gallery UI theme.

NSH Gallery UI default theme: graphite dark and paper light surfaces with citrus lime (`#c6ef6a`) brand fill, continuous squircle corners, spring motion physics, and layered surface finishes.

## Colors

- **Shared (C-layer):** Appearance-invariant C-layer color roles shared by light and dark modes.
- **Light:** Appearance-invariant C-layer color roles shared by light and dark modes.

### Surface

- **`scrim`** (`#00000073`): Translucent backdrop scrim behind modals and sheets.
- **`media`** (`#10131a`): Ground behind photographs and videos; invariant across appearances.
- **`background`** (light `#f6f6f9`, dark `#16191f`): Primary application page canvas background.
- **`card`** (light `#ffffff`, dark `#1f2228`): Elevated surface background for cards and panels.
- **`popover`** (light `#ffffff`, dark `#1f2228`): Floating surface background for menus, popovers, and tooltips.
- **`secondary`** (light `#f3f4f7`, dark `#33353b`): Secondary control surface fill.
- **`muted`** (light `#eeeff2`, dark `#2a2d33`): Subdued container and subtle background surface.
- **`accent`** (light `#eeeff2`, dark `#2a2d33`): Subtle highlight fill for hovered or active items.
- **`sidebar`** (light `#f6f6f9`, dark `#16191f`): Navigation sidebar panel background.
- **`sidebar-accent`** (light `#eeeff2`, dark `#2a2d33`): Selected or active row fill in the sidebar.
- **`inset`** (light `#eeeff2`, dark `#2a2d33`): Recessed well surface nested inside a card.
- **`raised`** (light `#f3f4f7`, dark `#33353b`): Raised control surface resting on a card.
- **`field`** (light `#ffffff`, dark `#1f2228`): Input well surface below card and inset layers.
- **`hover`** (light `#eeeff2`, dark `#2a2d33`): Pointer hover overlay fill on interactive items.
- **`track`** (light `#eeeff2`, dark `#2a2d33`): Inactive track background for switches, sliders, and progress bars.
- **`knob`** (light `#ffffff`, dark `#eeeff1`): Switch thumb fill in the off state.
- **`inverse`** (light `#ffffff`, dark `#1f2228`): High-contrast surface for toasts and tooltips.

### Ink

- **`on-media`** (`#ffffff`): White ink over photographs and dark media surfaces; invariant across appearances.
- **`foreground`** (light `#101319`, dark `#eeeff1`): Default high-contrast text and icon ink on page surfaces.
- **`card-foreground`** (light `#101319`, dark `#eeeff1`): Primary text and icon ink on card surfaces.
- **`popover-foreground`** (light `#101319`, dark `#eeeff1`): Primary text and icon ink on popover surfaces.
- **`secondary-foreground`** (light `#101319`, dark `#eeeff1`): Text and icon ink on secondary control surfaces.
- **`muted-foreground`** (light `#5f636a`, dark `#9a9ea5`): Secondary and supporting text and icon ink.
- **`accent-foreground`** (light `#101319`, dark `#eeeff1`): Text and icon ink on accent surfaces.
- **`sidebar-foreground`** (light `#101319`, dark `#eeeff1`): Primary text and icon ink inside the sidebar.
- **`sidebar-accent-foreground`** (light `#101319`, dark `#eeeff1`): Text and icon ink on active sidebar rows.
- **`faint`** (light `#9a9da3`, dark `#6b6f76`): Low-emphasis text for placeholders, units, and tertiary labels.
- **`inverse-foreground`** (light `#101319`, dark `#eeeff1`): Primary text ink on inverse surfaces.

### Brand

- **`primary`** (light `#c6ef6a`, dark `#c4ec6a`): Primary brand action fill.
- **`primary-foreground`** (`#13160c`): Text and icon ink on primary brand action fills.
- **`sidebar-primary`** (light `#c6ef6a`, dark `#c4ec6a`): Primary action highlight color in the sidebar.
- **`sidebar-primary-foreground`** (`#13160c`): Text and icon ink on sidebar-primary highlights.
- **`brand`** (light `#c6ef6a`, dark `#c4ec6a`): Accent ink for text, icons, and active rules.
- **`brand-edge`** (light `#cacbcd`, dark `#31343a`): Hairline border on primary accent-filled controls.
- **`brand-tint`** (light `#c6ef6a1a`, dark `#c4ec6a1a`): Translucent brand-accent wash behind selected rows and tinted bubbles.
- **`inverse-brand`** (`#13160c`): Accent action color on inverse surfaces.

### Status

- **`destructive`** (light `#d43a4a`, dark `#ff6170`): Semantic danger color for destructive actions and errors.
- **`chart-1`** (light `#c6ef6a`, dark `#c4ec6a`): Primary chart series color.
- **`chart-2`** (light `#3d63d1`, dark `#7ea8ff`): Second chart series color.
- **`chart-3`** (light `#138a5a`, dark `#45d49a`): Third chart series color.
- **`chart-4`** (light `#b26a00`, dark `#ffb547`): Fourth chart series color.
- **`chart-5`** (light `#d43a4a`, dark `#ff6170`): Fifth chart series color.
- **`info`** (light `#3d63d1`, dark `#7ea8ff`): Informational semantic status color.
- **`warn`** (light `#b26a00`, dark `#ffb547`): Warning semantic status color.
- **`up`** (light `#138a5a`, dark `#45d49a`): Positive trend and growth semantic color.
- **`info-tint`** (light `#3d63d11a`, dark `#7ea8ff1a`): Translucent informational status background tint.
- **`warn-tint`** (light `#b26a001a`, dark `#ffb5471a`): Translucent warning status background tint.
- **`destructive-tint`** (light `#d43a4a1a`, dark `#ff61701a`): Translucent destructive status background tint.
- **`up-tint`** (light `#138a5a1a`, dark `#45d49a1a`): Translucent positive trend background tint.
- **`down-tint`** (light `#d43a4a1a`, dark `#ff61701a`): Translucent negative trend background tint.

### Chrome

- **`border`** (light `#cacbcd`, dark `#31343a`): Standard hairline border color for containers and controls.
- **`input`** (light `#cacbcd`, dark `#31343a`): Border and stroke color for form fields and control edges.
- **`ring`** (light `#5f636a`, dark `#9a9ea5`): Focus indicator ring stroke color.
- **`sidebar-border`** (light `#e4e4e7`, dark `#2d3036`): Sidebar divider and toolbar hairline border color.
- **`sidebar-ring`** (light `#5f636a`, dark `#9a9ea5`): Focus indicator ring color inside the sidebar.
- **`line`** (light `#e4e4e7`, dark `#2d3036`): Hairline divider and grid rule inside recessed wells.

## Typography

Semantic typography roles referencing tier-specific font.size and font.line-height.

- The family is the app's `font-sans` (`font-mono` for code); the sizes are the one shared scale, which the user's system font size scales (ADR 0009).

- **`caption`** (11px (touch: 12px), weight 400, line-height 16px, letter-spacing 0px): Small captions and segmented counter labels.
- **`detail`** (12px (touch: 13px), weight 400, line-height 16px, line-height 20px on touch, letter-spacing 0px): Sidebar section labels, counts, and supporting metadata.
- **`body`** (13px (touch: 15px), weight 400, line-height 20px, letter-spacing 0px): Standard body copy, list rows, and dialog content.
- **`label`** (14px (touch: 15px), weight 500, line-height 20px, letter-spacing 0px): Control labels, form labels, and interactive triggers.
- **`title`** (16px, weight 600, line-height 24px, letter-spacing 0px): Card and section headings.
- **`headline`** (20px (touch: 22px), weight 600, line-height 28px, letter-spacing 0px): Page-level headings.
- **`display`** (26px (touch: 28px), weight 600, line-height 32px, line-height 36px on touch, letter-spacing 0px): Large display numerals and hero headings.

## Layout

Ergonomic sizing scales for pointer input.

- **Hit target:** Minimum hit target size (0 disables padding expansion).
- **Density:** Page-level padding and gap.
- **List rows:** A list's rows in a popup or a palette: inset, the container's edge to the row's fill; pad, the fill's edge to its text. shadcn's select and menus: 4 (SelectContent p-1) and 8 (SelectItem pl-2).
- **Control geometry:** Control internal spacing and switch size tier.
- **Control heights:** Standard control heights (sm, md, lg).
- **Switch size tier (pointer):** `small`.
- **Icons:** Standard icon dimensions (sm, md, lg).

- **Pointer tier:** Default pointer input-tier metrics.
- **Touch tier:** Default touch input-tier metrics.

## Elevation & Depth

Tactile layered elevation: inner top-edge highlights (`inset`), 1px hairline borders, contact + cast drop shadows (`card`, `menu`, `modal`, `inverse`), and translucent frosted glass (`glass` with 80% popover alpha).

- **Strokes:** Border stroke widths.
  - `stroke.hairline` (1px): Hairline width for dividers, container edges (cards, drawers, overlays) and outlined variants.
  - `stroke.control` (1px): Interactive control border width.
- **Focus indicator (`style: "halo"`):** Focus ring geometry and style enum.
  - `focus.width` (3px): Focus ring stroke width.
  - `focus.offset` (0px): Focus ring outward offset from control bounds.
- **State overlays (hover=0, focus=0, pressed=0, dragged=0):** State-layer ink opacities for hover, focus, pressed, and dragged states.

## Shapes

Corner radius roles by layer (8px control, 12px container, 14px modal) referenced by semantic shape roles.

Non-dimensional corner curve and button capsule flag. (`curve: "continuous"`, `corners.button: "radius"`).

Semantic corner radius roles by layer, referencing base dimension.radius.* tokens.

- **`control`** (8px): Corner radius for in-page elements: buttons, fields, rows, chips, badges, wells, color areas, and kbd.
- **`container`** (12px): Corner radius for containers and overlays: cards, menus, popovers, tooltips, list panels, toasts, and frames.
- **`modal`** (14px): Corner radius for modal surfaces: dialogs, sheets, and drawers.

**Control dimensions** (no DESIGN.md field; they decide how a control's own parts are drawn): Control dimensions: the four behaviour-named axes a theme decides for its controls (field, choice, track, handle). Themes override only the axes that differ.
- **`field`**: `box`
- **`choice`**: `well`
- **`track`**: `sunk`
- **`handle`**: `circle`

## Motion & Micro-interaction

Interactive spring and timing physics roles: fast, default, slow, and the state fade.

- **`enter`** (420ms, `cubic-bezier(0.333333, 1, 0.666667, 1)`): Default surface entrance transition.
- **`fast`** (spring: stiffness=1218, damping=70 — omitted from YAML `motion` because DESIGN.md `Motion` only accepts `duration`/`delay`/`timingFunction`): Quickest response: small control toggles and thumbs.
- **`default`** (spring: stiffness=520, damping=34 — omitted from YAML `motion` because DESIGN.md `Motion` only accepts `duration`/`delay`/`timingFunction`): Everyday feedback: presses, releases and modest movement.
- **`slow`** (spring: stiffness=320, damping=30 — omitted from YAML `motion` because DESIGN.md `Motion` only accepts `duration`/`delay`/`timingFunction`): Slowest: large surfaces and long-travel layout movement.
- **`state`** (120ms, `cubic-bezier(0.333333, 1, 0.666667, 1)`): State fade: how fast hover, press and choice states come and go (upstream nsh-gallery-ui's hover wash, 120 ms ease-out).
- **Press & ripple** (`press-scale: 0.97`, `pressed-opacity: 0.7`, `ripple: false`): Interaction state opacities, press scale, and ripple switch.
- **Timing curves:** Named timing curves shared across themes.

## Voice & Content Strategy

Voice & Content Strategy is intentionally omitted: this theme defines visual tokens, surface finishes, typography metrics, and motion physics only; product copy, tone, capitalization, and terminology belong to the host application.

## Components

The neutral of each field a finish role can have, written once for the roles that have it: a flat surface states no gradient, an opaque one no backdrop blur and no material, a layer no height of its own, a press that keeps the resting colours states no swap, and a top or bottom edge with no colour of its own takes the role's border color. A theme that states one writes the token (its own finishes.shared, or an appearance's) and it wins; the extension only says what the neutral is where no token states it, and a role carries only the fields it lists in `finishFields`.

- **`finish.card`**: A surface that holds content: a card, a section.
- **`finish.inset`**: A well cut into a surface: an inset, a field, a track, a groove.
- **`finish.channel`**: The channel a group of choices sits in: a segmented control's track.
- **`finish.raised`** (backdropFilter: `none`): A control on a surface: a button, a chip, a pill.
- **`finish.plate`**: A labelled block chosen inside a well: the selected tab, a segmented control's thumb.
- **`finish.overlay`** (backdropFilter: `none`): A panel floating over the page: a menu, a toast.
- **`finish.modal`**: A surface the page waits for: a dialog, a sheet.
- **`finish.inverse`** (backdropFilter: `none`): The page's inverse: an inverse surface, a tooltip.
- **`finish.glass`** (backdropFilter: `blur(20px)`): A translucent surface: what is behind it shows through.
- **`finish.accent`**: The accent's own surface, with its ink.
- **`finish.fill`**: A run's fill: a progress bar's bar, a slider's range, a meter's column.
- **`finish.knob`**: A knob: a switch's thumb, a slider's handle. Its checked state, `checked-*`, is the knob while its control is on.
- **`finish.hover`**: A control under the pointer.
- **`finish.pressed`**: A control held down.
- **`finish.disabled`**: A control that cannot be used.
- **Disabled handling** (content=0.5, fill=false): Disabled content opacity multiplier and whether containers switch to a dedicated disabled fill.

## Do's and Don'ts

- **Do:** Read all colors, radii, typography, and surface finishes through theme roles (`colors.*`, `shape.*`, `font.*`, `finish.*`) rather than literals in component code.
- **Do:** Read theme getters inside JSX render expressions or reactive effects so runtime theme switching (`selectTheme`) and light/dark appearance changes take effect on the next frame.
- **Do:** Use `rounded(shape.<role>, inset)` for concentric nested radii inside cards, switches, and segmented controls.
- **Do:** Preserve the citrus accent (`primary` / `primary-foreground`) for primary actions, active runs, and focus highlights.
- **Do:** Use `inset` wells inside cards and `raised` surfaces for controls sitting on cards, paired with continuous squircle corners (`shape.curve: "continuous"`).
- **Do:** Apply tactile spring press feedback (`state.press-scale: 0.97`, `motion.default` / `motion.slow`).
- **Don't:** Never write color literals (`#...`, `rgb()`, `oklch()`) in component, lib, or demo-adapter code.
- **Don't:** Never store `colors.*`, `finish.*`, or `shape.*` values in module-level constants; they freeze on theme or appearance switches.
- **Don't:** Never add a finish field a role does not use: the fields of `finish.<role>` are the ones `packages/theme/finish-fields.ts` lists, and every theme states them the same way.
- **Don't:** Do not flatten shadows or remove inner highlights on `card`, `raised`, `inset`, or `pill` finishes.
- **Don't:** Do not merge distinct semantic finishes (`light` vs `accent`, `thumb` vs `raised`, `knob` vs `handle`).
