// What sections, wells and rows look like: density, surfaces, and rows whose hover fill bleeds.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { AndroidProps, ViewStyle } from 'nsh';
import { computed, platform, Text, token, View, windowSize } from 'nsh';

import { type Live, read } from './live-value';
import { pressRipple } from './press';
import {
  colors,
  type ControlMetrics,
  dimmed,
  finish,
  focusRing,
  font,
  reactive,
  rounded,
  shape,
  stroke,
  style,
  terminal,
  TERMINAL_COLUMN,
  TERMINAL_GAP,
  TERMINAL_ROW,
  tier,
} from './theme';

const pointer = platform.desktop;

/**
 * The page's density: compact with a pointer (desktops), roomier on a touch
 * screen. Section titles, surfaces, rows and their padding take these, so a
 * demo's sections read the same on every page. The sizes of the text are the
 * theme's typography roles (`title`, `detail`, `body`), `row` the tallest of
 * its three heights, the rest its `dimension.size.density`; read from the
 * theme in use, so a theme switch redraws what reads them.
 */
export const density = reactive<{
  title: number;
  note: number;
  body: number;
  row: number;
  pad: number;
  gap: number;
}>(['title', 'note', 'body', 'row', 'pad', 'gap'], () => {
  const { typography, dimension } = style();
  return {
    title: typography.title.fontSize[tier],
    note: typography.detail.fontSize[tier],
    body: typography.body.fontSize[tier],
    row: dimension.size.height[tier].lg,
    ...dimension.size.density[tier],
  };
});

/** One tier's sizes of a list of controls (see `controlSize` for what each is). */
interface ControlSizeSet extends ControlMetrics {
  row: number;
  label: number;
  detail: number;
  control: number;
  check: number;
  tabs: number;
  line: number;
  clear: number;
}

/** The terminal's sizes, which stay in code: they are the character grid's, not a theme's. */
const terminalSizes: ControlSizeSet = {
  row: TERMINAL_ROW,
  padding: 0,
  gap: TERMINAL_COLUMN,
  label: 14,
  detail: 12,
  control: 3 * TERMINAL_COLUMN,
  check: 12,
  dot: 6,
  tabs: TERMINAL_ROW,
  line: TERMINAL_ROW,
  clear: 2 * TERMINAL_COLUMN,
  switch: 'small',
};

/**
 * The sizes of a list of controls (a settings list, a filter, a plan
 * picker). Rows, value lines and tab strips are the tallest of the theme's
 * three heights; a checkbox's or radio's side and a clear button are the
 * middle icon, a check mark the smallest. The terminal's rows are one Cell
 * row each, an indicator's box three Cells wide for its glyph (`[x]`).
 * `row` is a pressable row's least height, `line` a row of values', `tabs`
 * a tab strip's, `control` a checkbox's or radio's side, `check` its mark's,
 * `dot` a radio's dot, `clear` a clear button's side, `switch` the switch size
 * beside a row's label; `padding` and `gap` are the theme's control spacing.
 * `label` and `detail` are the theme's type roles of those names. Read from the
 * theme in use (the terminal's are the grid's), so a theme switch redraws
 * what reads them.
 */
export const controlSize = reactive<ControlSizeSet>(
  [
    'row',
    'padding',
    'gap',
    'label',
    'detail',
    'control',
    'check',
    'dot',
    'tabs',
    'line',
    'clear',
    'switch',
  ],
  () => {
    if (terminal) return terminalSizes;
    const { typography, dimension } = style();
    const { height } = dimension.size;
    const icons = dimension.icon;
    return {
      row: height[tier].lg,
      line: height[tier].lg,
      tabs: height[tier].lg,
      control: icons[tier].md,
      clear: icons[tier].md,
      check: icons[tier].sm,
      ...dimension.size.control[tier],
      label: typography.label.fontSize[tier],
      detail: typography.detail.fontSize[tier],
    };
  },
);

/** Options of `sectionSurface`. */
export interface SectionSurfaceOptions {
  /** Padded as a `Card`'s content (`density.pad`: 14 with a pointer, 16 on
   * a touch screen): rows (`listRow`) need it, their hover fill reaching
   * into it. Space other content with a `gap` (`density.gap`). */
  padded?: boolean;
}

/**
 * The flat surface a section's content sits on (a card's): the
 * card finish, one hairline edge, the container corners (`shape.container`). In the terminal a border whose
 * row and column on each side the padding fills out, so the content starts
 * one Cell inside it. Spread it into a view's `style`, then add the layout
 * (`overflow: "hidden"` for content that reaches its edges).
 */
export function sectionSurface(o?: SectionSurfaceOptions): ViewStyle {
  if (terminal) {
    return {
      borderWidth: stroke.hairline,
      borderColor: colors.border,
      paddingVertical: TERMINAL_ROW - 1,
      paddingHorizontal: 2 * TERMINAL_COLUMN - 1,
    };
  }
  return {
    backgroundColor: finish.card.backgroundColor,
    ...rounded(shape.container),
    borderWidth: stroke.hairline,
    borderColor: finish.card.borderColor,
    boxShadow: finish.card.boxShadow,
    ...(o?.padded ? { padding: density.pad } : {}),
  };
}

/**
 * A well inside a section (a preview, a panel of state, an image's frame):
 * the inset color a hair below the card, its hairline and inner shade, the
 * theme's `control` corners.
 */
export function insetSurface(): ViewStyle {
  return {
    backgroundColor: colors.inset,
    borderWidth: stroke.hairline,
    borderColor: colors.line,
    ...rounded(shape.control),
    ...finish.inset,
  };
}

/** A pill's corners: half the tallest it gets, so any height rounds to a pill. */
export const PILL_RADIUS = 999;

/** How far a row's hover fill reaches past its content on each side, and its
 * corners: none in the terminal, where a negative margin rounds away but
 * the padding stays a column, pushing the label in. */
const ROW_BLEED = terminal ? 0 : 8;

/** The room a stacked row leaves between its label and its control. */
const STACKED_GAP = 8;

/** The widest window that takes the phone's layout (a phone, or a narrow
 * desktop window), in points. */
const NARROW = 600;

/**
 * Whether the window is narrow, as a `computed`: one value and one subscription to the window for
 * every reader, instead of one read of `windowSize` per reader.
 *
 * Made here, at import, rather than on first read: a `computed` made inside a component belongs to
 * it and is disposed with it, and the first reader is always a component, so one made on first read
 * would go dead when that component unmounted and leave every later reader on the width it stopped
 * at.
 */
const narrow = computed(() => !terminal && windowSize().width < NARROW);

/**
 * Whether the window is narrow enough for the phone's layout, on every
 * tier: a row's wide control (`plainRow`'s `wide`, a combobox) goes under
 * its label. Never in a terminal, which wraps its rows instead. Reactive:
 * it follows the window's size.
 */
export const narrowWindow = () => narrow();

/** Options of `plainRow`. */
export interface PlainRowOptions {
  /** The first row of its list: no hairline above it. */
  first?: boolean;
  /** A row of values (`controlSize.line` high, no padding) rather than a control's. */
  dense?: boolean;
  /** Its control is as wide as it can be (a combobox): in a narrow window
   * (`narrowWindow`: a phone, or a narrow desktop window) the control goes
   * under its label, across the row, so the control's text is not cut
   * short. */
  wide?: boolean;
}

/**
 * A row of a list that takes no presses (a section's values, a row holding
 * a field): its items on one line, centered, a hairline above all but the
 * first (none in the terminal, whose rows are one row each). A `wide`
 * control goes under its label in a narrow window.
 */
export function plainRow(o?: PlainRowOptions): ViewStyle {
  const stacked = !!o?.wide && narrowWindow();
  return {
    minHeight: o?.dense ? controlSize.line : controlSize.row,
    flexDirection: stacked ? 'column' : 'row',
    alignItems: stacked ? 'stretch' : 'center',
    gap: stacked ? STACKED_GAP : controlSize.gap,
    paddingVertical: o?.dense ? 0 : controlSize.padding,
    borderTopWidth: o?.first || terminal ? 0 : 1,
    borderTopColor: colors.line,
  };
}

/** Options of `listRow`. */
export interface ListRowOptions {
  /** The first row of its list: no `RowDivider` above it, so no room for one. */
  first?: boolean;
  /** More room before the content (a child row under a "Select all"). */
  start?: number;
  /** No hover; dimmed to 50% (`disabledStyle`). Pass the same value to the control's `disabled`. */
  disabled?: Live<boolean | undefined>;
  /** More style (`flexDirection: "row-reverse"` for a switch at the trailing edge, `alignItems`), over the row's. */
  style?: Live<ViewStyle | undefined>;
}

/** The props `listRow` gives a pressable row. */
export interface ListRowLook {
  readonly style: ViewStyle;
  readonly hoverStyle: ViewStyle | undefined;
  readonly activeStyle: ViewStyle;
  readonly focusVisibleStyle: ViewStyle;
  readonly disabledStyle: ViewStyle;
  readonly android?: AndroidProps;
}

/**
 * A row that is a control (a `Switch`, `Checkbox`, `Radio` or an accordion's
 * trigger, its label included): spread it (`<Checkbox {...listRow()}>`).
 * At least `controlSize.row` high (40 with a pointer, 44 on a touch screen),
 * its items on one line. Under the pointer the theme's `accent` fills it,
 * reaching `ROW_BLEED` (8) past the content on both sides with rounded
 * corners, so the content stays where the section's padding puts it: put
 * rows on a padded surface (`sectionSurface({ padded: true })`). Pressed it
 * dims to 70%, natively; keyboard focus is `focusRing()`; disabled, 50% and
 * no hover. The hairline above a row that is not the first is a
 * `RowDivider` among its children; the point it takes stays in the padding,
 * so nothing moves.
 */
export function listRow(o?: ListRowOptions): ListRowLook {
  return {
    get style(): ViewStyle {
      return {
        minHeight: controlSize.row,
        flexDirection: 'row',
        alignItems: 'center',
        gap: controlSize.gap,
        paddingVertical: controlSize.padding,
        paddingTop: controlSize.padding + (o?.first || terminal ? 0 : 1),
        marginHorizontal: -ROW_BLEED,
        paddingStart: ROW_BLEED + (o?.start ?? 0),
        paddingEnd: ROW_BLEED,
        borderRadius: ROW_BLEED,
        ...(read(o?.style) ?? {}),
      };
    },
    get hoverStyle(): ViewStyle | undefined {
      return read(o?.disabled)
        ? undefined
        : { backgroundColor: token('accent') };
    },
    get activeStyle(): ViewStyle {
      return { opacity: dimmed.pressed };
    },
    get focusVisibleStyle(): ViewStyle {
      return focusRing();
    },
    get disabledStyle(): ViewStyle {
      return { opacity: dimmed.disabled };
    },
    get android(): AndroidProps | undefined {
      return pressRipple('foreground', o?.disabled);
    },
  };
}

/**
 * The hairline above a `listRow` that is not the first, among its children:
 * as long as the row's content, inset `ROW_BLEED` from the hover fill's
 * edge on both sides (none in the terminal, whose rows are one row each).
 */
export function RowDivider(props: { show: boolean }) {
  return (
    <If when={props.show && !terminal}>
      <View
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
          left: ROW_BLEED,
          right: ROW_BLEED,
          height: stroke.hairline,
          backgroundColor: colors.line,
        }}
      />
    </If>
  );
}

/** The terminal's labels' column, so the details after them line up. */
const LABEL_WIDTH = 16 * TERMINAL_COLUMN;

/**
 * The least a label keeps, with a pointer, beside a wide control (a
 * combobox, a select), which gives way first in a narrow window. A touch
 * screen's controls take their content's width, so the label takes the rest.
 */
const LABEL_MIN = 96;

/** The least a terminal's detail keeps beside its label: narrower, it wraps under it. */
const DETAIL_WIDTH = 24 * TERMINAL_COLUMN;

/**
 * A row's label and a quieter line under it (after it in the terminal):
 * `controlSize.label` in the text color, regular weight (`strong`: 600, the
 * row that leads others, as a "Select all"), the detail 12 points with a
 * pointer, 13 on a touch screen, muted, wrapping rather than cut short
 * beside a control. `width`: the terminal's label column.
 */
export function RowLabel(props: {
  label: string;
  detail?: string;
  strong?: boolean;
  width?: number;
}) {
  return (
    // A terminal's gap is in the label's column: a row's gaps give first
    // when its detail wraps, which would move the details off their column.
    <View
      style={
        terminal
          ? { flex: 1, flexDirection: 'row', flexWrap: 'wrap' }
          : { flex: 1, minWidth: pointer ? LABEL_MIN : undefined, gap: 2 }
      }
    >
      <Text
        style={{
          minWidth: terminal
            ? (props.width ?? LABEL_WIDTH) + TERMINAL_GAP
            : undefined,
          flexShrink: 0,
          fontSize: controlSize.label,
          fontWeight: props.strong ? font.weight('title') : font.weight('body'),
          color: colors.foreground,
        }}
      >
        {props.label}
      </Text>
      <If when={props.detail}>
        {/* It wraps rather than lose its end to `…`. Beside the label in a terminal:
            with less than DETAIL_WIDTH beside it, it goes under the label, as elsewhere. */}
        <Text
          style={{
            flexShrink: 1,
            ...(terminal ? { flexGrow: 1, flexBasis: DETAIL_WIDTH } : {}),
            fontSize: controlSize.detail,
            color: colors.mutedForeground,
          }}
        >
          {props.detail}
        </Text>
      </If>
    </View>
  );
}
