---
version: alpha
name: 'NSH Gallery'
description: 'NSH Gallery: graphite dark and paper light surfaces with citrus lime (`#c6ef6a`) primary fill, continuous squircle corners, ease-out timing motion, and layered surface finishes.'
colors:
  scrim: '#00000073'
  media: '#10131a'
  on-media: '#ffffff'
  light:
    background: '#f6f6f9'
    card: '#ffffff'
    popover: '#f8f8fb'
    muted: '#eeeff2'
    surface: '#f3f4f7'
    foreground: '#101319'
    muted-foreground: '#5f636a'
    faint: '#9a9da3'
    primary: '#c6ef6a'
    primary-foreground: '#13160c'
    secondary: '#f3f4f7'
    accent: '#e8eaec'
    brand: '#4a840a'
    border: '#cacbcd'
    line: '#e4e4e7'
    input: '#c1c2c4'
    ring: '#a3a8b2'
    info: '#3d63d1'
    success: '#138a5a'
    warning: '#b26a00'
    destructive: '#d43a4a'
  dark:
    background: '#16191f'
    card: '#1f2228'
    popover: '#1f2228'
    muted: '#2a2d33'
    surface: '#33353b'
    foreground: '#eeeff1'
    muted-foreground: '#9a9ea5'
    faint: '#6b6f76'
    primary: '#c4ec6a'
    primary-foreground: '#13160c'
    secondary: '#33353b'
    accent: '#303339'
    brand: '#c8f26d'
    border: '#31343a'
    line: '#2d3036'
    input: '#393c42'
    ring: '#5d636e'
    info: '#7ea8ff'
    success: '#45d49a'
    warning: '#ffb547'
    destructive: '#ff6170'
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
  fast:
    duration: 150ms
    delay: 0ms
    timingFunction: 'cubic-bezier(0.333333, 1, 0.666667, 1)'
  default:
    duration: 250ms
    delay: 0ms
    timingFunction: 'cubic-bezier(0.333333, 1, 0.666667, 1)'
  slow:
    duration: 350ms
    delay: 0ms
    timingFunction: 'cubic-bezier(0.333333, 1, 0.666667, 1)'
  state:
    duration: 120ms
    delay: 0ms
    timingFunction: 'cubic-bezier(0.333333, 1, 0.666667, 1)'
components:
  button-primary:
    backgroundColor: '{colors.light.primary}'
    textColor: '{colors.light.primary-foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    height: '{spacing.height.md}'
    padding: '{spacing.density.gap}'
  button-secondary:
    backgroundColor: '{colors.light.surface}'
    textColor: '{colors.light.foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    height: '{spacing.height.md}'
    padding: '{spacing.density.gap}'
  card:
    backgroundColor: '{colors.light.card}'
    textColor: '{colors.light.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.container}'
    padding: '{spacing.density.pad}'
  input-field:
    backgroundColor: '{colors.light.card}'
    textColor: '{colors.light.foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    height: '{spacing.height.md}'
    padding: '{spacing.control.padding}'
  menu-popover:
    backgroundColor: '{colors.light.popover}'
    textColor: '{colors.light.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.container}'
    padding: '{spacing.control.padding}'
  dialog:
    backgroundColor: '{colors.light.card}'
    textColor: '{colors.light.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.modal}'
    padding: '{spacing.density.pad}'
  tooltip:
    backgroundColor: '{colors.light.card}'
    textColor: '{colors.light.foreground}'
    typography: '{typography.detail}'
    rounded: '{rounded.container}'
---

# NSH Gallery

## Overview

NSH Gallery: graphite dark and paper light surfaces with citrus lime (`#c6ef6a`) primary fill, continuous squircle corners, ease-out timing motion, and layered surface finishes.

## Colors

- **`background`**: light `#f6f6f9`, dark `#16191f`
- **`card`**: light `#ffffff`, dark `#1f2228`
- **`popover`**: light `#f8f8fb`, dark `#1f2228`
- **`muted`**: light `#eeeff2`, dark `#2a2d33`
- **`surface`**: light `#f3f4f7`, dark `#33353b`
- **`foreground`**: light `#101319`, dark `#eeeff1`
- **`muted-foreground`**: light `#5f636a`, dark `#9a9ea5`
- **`faint`**: light `#9a9da3`, dark `#6b6f76`
- **`primary`**: light `#c6ef6a`, dark `#c4ec6a`
- **`primary-foreground`**: light `#13160c`, dark `#13160c`
- **`secondary`**: light `#f3f4f7`, dark `#33353b`
- **`accent`**: light `#e8eaec`, dark `#303339`
- **`brand`**: light `#4a840a`, dark `#c8f26d`
- **`border`**: light `#cacbcd`, dark `#31343a`
- **`line`**: light `#e4e4e7`, dark `#2d3036`
- **`input`**: light `#c1c2c4`, dark `#393c42`
- **`ring`**: light `#a3a8b2`, dark `#5d636e`
- **`info`**: light `#3d63d1`, dark `#7ea8ff`
- **`success`**: light `#138a5a`, dark `#45d49a`
- **`warning`**: light `#b26a00`, dark `#ffb547`
- **`destructive`**: light `#d43a4a`, dark `#ff6170`

## Typography

- Uses system `font-sans` / `font-mono` unless configured in `theme.json` (`font-sans`, `font-mono`).
- **`caption`**: 11px / 16px, weight 400, letter-spacing 0px
- **`detail`**: 12px / 16px, weight 400, letter-spacing 0px
- **`body`**: 13px / 20px, weight 400, letter-spacing 0px
- **`label`**: 14px / 20px, weight 500, letter-spacing 0px
- **`title`**: 16px / 24px, weight 600, letter-spacing 0px
- **`headline`**: 20px / 28px, weight 600, letter-spacing 0px
- **`display`**: 26px / 32px, weight 600, letter-spacing 0px

## Layout

- Control heights (pointer): 24px / 28px / 32px; touch hit target: 44px.

## Elevation & Depth

Tactile layered elevation: inner top-edge highlights (`inset`), 1px hairline borders, contact + cast drop shadows (`card`, `overlay`, `modal`, `inverse`), and translucent frosted glass (`glass`).

## Shapes

- Radii: control 8px, container 12px, modal 14px (`curve: "continuous"`).

## Motion & Micro-interaction

- Press scale: `0.97`, state transition: 120ms `out-cubic`, theme switch: `fade` (200ms).

## Voice & Content Strategy

Voice & Content Strategy is intentionally omitted; copy and tone belong to the host application.

## Components

Components read semantic `surface()`, `feedback`, `motion`, and `control()` primitives.

## Do's and Don'ts

- **Do:** Read colors, surfaces, feedback, and controls via `@shadcn-nsh/theme` rather than hardcoded literals.
- **Do:** Preserve the citrus accent (`primary` / `primary-foreground`) for primary actions, active runs, and focus highlights.
- **Do:** Use `inset` wells inside cards and `raised` surfaces for controls sitting on cards, paired with continuous squircle corners.
- **Do:** Apply tactile press feedback (`feedback.press.scale: 0.97` eased by `motion.state`).
- **Don't:** Branch on theme IDs inside UI components.
- **Don't:** Do not flatten shadows or remove inner highlights on `card`, `raised`, `inset`, or `plate` surfaces.
