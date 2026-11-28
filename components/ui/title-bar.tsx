// A desktop window's title bar and the window controls it holds: the bar that drags a window whose
// title bar is hidden, the window buttons of a frameless window, and the edges that resize it.

import { Plus, X } from 'lucide';
import type { ViewProps, ViewStyle } from 'nsh';
import { signal, split, View } from 'nsh';
import {
  currentWindow,
  isAvailable,
  type ResizeEdge,
  titleBar,
  type WindowControl,
  type WindowRef,
} from 'nsh/desktop';

import { Icon } from '../../lib/ui/icons';
import { alpha, colors, stroke, surface, tints } from '../../lib/ui/theme';
import { type Live, read } from '../../lib/ui/utils';

/** How tall a title bar is when the window reports no height of its own. */
export const TITLE_BAR_HEIGHT = 40;

/** The side of a traffic light. */
export const TRAFFIC_LIGHT = 12;

/** How wide a caption button is: the bar's height, a little wider. */
export const CAPTION_BUTTON = 46;

/** The gap between two traffic lights. */
const lightGap = 8;

/** The room a title bar keeps between its content and the system's window buttons. */
const barPad = 12;

/** A resize strip's thickness, and the corner its own strip takes. */
const resizeEdge = 5;
const resizeCorner = 12;

/** A window's controls as the platform draws them: `traffic-lights`, macOS's three discs at the
 * leading end of the bar; `caption`, Windows' and Linux's cells at its trailing end. */
export type WindowControlsVariant = 'traffic-lights' | 'caption';

/**
 * The boxes the resize strips take in a window: the four edges between the corners, and the four
 * corners.
 *
 * physical: a window's edges are the platform's, not the text direction's — the left edge stays
 * left in a right-to-left interface, and so does the strip that resizes it.
 */
const resizeBoxes: Record<ResizeEdge, ViewStyle> = {
  top: { top: 0, left: resizeCorner, right: resizeCorner, height: resizeEdge },
  bottom: {
    bottom: 0,
    left: resizeCorner,
    right: resizeCorner,
    height: resizeEdge,
  },
  left: { left: 0, top: resizeCorner, bottom: resizeCorner, width: resizeEdge },
  right: {
    right: 0,
    top: resizeCorner,
    bottom: resizeCorner,
    width: resizeEdge,
  },
  topLeft: { top: 0, left: 0, width: resizeCorner, height: resizeCorner },
  topRight: { top: 0, right: 0, width: resizeCorner, height: resizeCorner },
  bottomLeft: { bottom: 0, left: 0, width: resizeCorner, height: resizeCorner },
  bottomRight: {
    bottom: 0,
    right: 0,
    width: resizeCorner,
    height: resizeCorner,
  },
};

/** The words assistive technologies read for a window button: macOS's names for the traffic
 * lights, Windows' and Linux's for the caption buttons. */
const lightLabel: Record<WindowControl, string> = {
  close: 'Close',
  minimize: 'Minimize',
  maximize: 'Zoom',
};

const cellLabel: Record<WindowControl, string> = {
  close: 'Close',
  minimize: 'Minimize',
  maximize: 'Maximize',
};

/**
 * The traffic lights' hues: macOS's own, fixed whatever the theme (they say which system the window
 * is on, not which theme the app wears — the one place this library writes colours, `ARCHITECTURE.md`
 * P3). The glyph's ink is half-black over them, their hairline edge an eighth of it, and an inactive
 * window's discs a light wash of the theme's ink.
 */
const lightTone: Record<WindowControl, string> = {
  close: '#FF5F57', // color: macOS's fixed traffic-light hue
  minimize: '#FEBC2E', // color: macOS's fixed traffic-light hue
  maximize: '#28C840', // color: macOS's fixed traffic-light hue
};

/** The ink drawn on a traffic light: black at half, as macOS draws it. */
export const lightInk = alpha('#000000', 0.5); // color: the traffic lights' own ink, the same under every theme

/** The hairline round a traffic light: black at an eighth, as macOS draws it. */
export const lightEdge = alpha('#000000', 0.12); // color: the traffic lights' own ink, the same under every theme

/** A title bar's parts as the styles they wear: spread each one. */
export interface TitleBarLook {
  /** The bar: a row that drags the window, `TITLE_BAR_HEIGHT` tall or the height the system's
   * title bar has, padded clear of the system's window buttons, on the inset fill with a hairline
   * under it. */
  root(): ViewStyle;
  /** The window buttons' row: the traffic lights' group, or the caption buttons' cells. */
  controls(variant: WindowControlsVariant): ViewStyle;
  /** A traffic light: a disc in its tone, grey while the window is in the background. */
  light(control: WindowControl, active: boolean): ViewStyle;
  /** The box a traffic light's glyph is drawn in, shown while the pointer is over the lights. */
  glyph(shown: boolean): ViewStyle;
  /** A caption button's cell, which fills the bar's height. */
  cell(): ViewStyle;
  /** A resize strip, at the edge or corner of the window it is in. */
  resize(edge: ResizeEdge): ViewStyle;
}

/** Read the enclosing window handle synchronously during component setup, or `null` outside one. */
function activeWindow(): WindowRef | null {
  if (!isAvailable) return null;
  try {
    return currentWindow();
  } catch {
    return null;
  }
}

/**
 * A title bar's look, from the platform: macOS's traffic lights in the system's hues on the bar of
 * an inset fill, or Windows' and Linux's caption cells at the trailing end, the glyphs' ink over
 * them and the close cell washing the danger tint while the pointer is on it. The bar keeps
 * `barPad` (12 points) beside the system's window buttons — the traffic lights on macOS, the
 * caption buttons on Windows and Linux — so a hidden title bar's own content starts after them.
 *
 * `titleBar()` is the area the system's window buttons take: it is zero while the system's title
 * bar shows and in a frameless window, so a bar of `TITLE_BAR_HEIGHT` (40 points) is drawn there.
 * Pass `win` captured during setup so reactive styles do not call `currentWindow()` inside effects.
 */
export function titleBarLook(win?: WindowRef | null): TitleBarLook {
  const bar = () => {
    if (win) return win.titleBar();
    try {
      return titleBar();
    } catch {
      return { height: 0, left: 0, right: 0 };
    }
  };
  return {
    root: (): ViewStyle => {
      const area = bar();
      return {
        height: area.height || TITLE_BAR_HEIGHT,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingStart: area.left + barPad,
        paddingEnd: area.right + barPad,
        backgroundColor: surface('inset').style.backgroundColor,
        borderBottomWidth: stroke.hairline,
        borderBottomColor: colors.line,
      };
    },
    controls: (variant: WindowControlsVariant): ViewStyle =>
      variant === 'caption'
        ? { flexDirection: 'row', alignSelf: 'stretch' }
        : { flexDirection: 'row', alignItems: 'center', gap: lightGap },
    light: (control: WindowControl, active: boolean): ViewStyle => ({
      width: TRAFFIC_LIGHT,
      height: TRAFFIC_LIGHT,
      borderRadius: TRAFFIC_LIGHT / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: active
        ? lightTone[control]
        : alpha(colors.foreground, 0.14),
      borderWidth: stroke.hairline,
      borderColor: lightEdge,
      transitionProperty: 'colors',
      transitionDuration: 120,
    }),
    glyph: (shown: boolean): ViewStyle => ({
      alignItems: 'center',
      justifyContent: 'center',
      opacity: shown ? 1 : 0,
      transitionProperty: 'opacity',
      transitionDuration: 120,
    }),
    cell: (): ViewStyle => ({
      width: CAPTION_BUTTON,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      transitionProperty: 'background-color',
      transitionDuration: 120,
    }),
    resize: (edge: ResizeEdge): ViewStyle => ({
      position: 'absolute',
      ...resizeBoxes[edge],
    }),
  };
}

/** A title bar's props: every `nsh` view prop passes through; `style` goes over the look's. */
export type TitleBarProps = ViewProps;

/**
 * A desktop window's title bar: the row that drags the window while its title bar is hidden
 * (`desktop={{ windowDrag: true }}`), a double click zooming or maximizing it, padded clear of
 * the system's window buttons and `TITLE_BAR_HEIGHT` tall where the window reports no height of
 * its own. Its children are the app's — a logo, the document's name, a search field, a button —
 * and the views inside that take presses (a field, a button) stay clickable.
 *
 * It draws nothing where there is no window of the app's own (the web, phones): a browser's page
 * has the browser's window, and a phone has no title bar to hide.
 */
export function TitleBar(props: TitleBarProps) {
  // No window, no bar: this is chrome for a window the app draws itself.
  if (!isAvailable) return null;
  const [, rest] = split(props, ['style']);
  const win = activeWindow();
  return (
    <View
      {...rest}
      desktop={{ windowDrag: true }}
      style={[titleBarLook(win).root(), props.style ?? null]}
    >
      {props.children}
    </View>
  );
}

/** A window's controls' props: every `nsh` view prop passes through; `style` goes over the
 * look's. */
export type WindowControlsProps = ViewProps & {
  /** Default `traffic-lights`. */
  variant?: WindowControlsVariant;
};

/**
 * The window buttons of a frameless window (`frame: "none"`), which the app draws itself:
 * `traffic-lights`, macOS's close, minimize and zoom discs at the leading end of the bar — their
 * glyphs shown while the pointer is over them, grey while the window is in the background — or
 * `caption`, Windows' and Linux's minimize, maximize and close cells filling the bar's height at
 * its trailing end, the close cell washing the danger tint while the pointer is on it.
 *
 * Each button is the system's button, not a picture of one: the platform hit-tests it as that
 * button (Windows 11's snap layouts over maximize) and carries out the press, and assistive
 * technologies see a button with its name. The window it acts on is the one the bar renders in.
 */
export function WindowControls(props: WindowControlsProps) {
  const [, rest] = split(props, ['variant', 'style']);
  // The glyphs show while the pointer is over the lights, as the system's do: one signal for the
  // three of them, so moving along the group keeps them in.
  const over = signal(false);
  if ((props.variant ?? 'traffic-lights') === 'caption')
    return (
      <View
        {...rest}
        style={[titleBarLook().controls('caption'), props.style ?? null]}
      >
        <Cell control="minimize" />
        <Cell control="maximize" />
        <Cell control="close" />
      </View>
    );
  return (
    <View
      {...rest}
      onMouseEnter={() => over.set(true)}
      onMouseLeave={() => over.set(false)}
      style={[titleBarLook().controls('traffic-lights'), props.style ?? null]}
    >
      <Light control="close" shown={over} />
      <Light control="minimize" shown={over} />
      <Light control="maximize" shown={over} />
    </View>
  );
}

/** The eight edges and corners, in the order they are drawn. */
const edges: ResizeEdge[] = [
  'top',
  'bottom',
  'left',
  'right',
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
];

/**
 * The edges and corners of a frameless window, which resize it: eight strips over the window's
 * border, the four corners 12 points square and the edges 5 thick between them. Draw it as the
 * last child of the window's root, which is the box the strips sit at the edges of.
 */
export function WindowResizeEdges() {
  return (
    <>
      <Each of={edges}>
        {(edge) => (
          <View
            desktop={{ windowResize: edge() }}
            style={titleBarLook().resize(edge())}
          />
        )}
      </Each>
    </>
  );
}

/** A traffic light: its disc, the window's own button, and the glyph shown while the pointer is
 * over the lights. */
function Light(props: { control: WindowControl; shown: Live<boolean> }) {
  const look = titleBarLook();
  const win = activeWindow();
  return (
    <View
      desktop={{ windowControl: props.control }}
      role="button"
      accessibilityLabel={lightLabel[props.control]}
      style={[
        look.light(props.control, win ? (win.state()?.focused ?? true) : true),
      ]}
    >
      <View style={[look.glyph(read(props.shown) === true)]}>
        {lightGlyph(props.control)}
      </View>
    </View>
  );
}

/** A caption button: its cell, the window's own button, and its glyph in the bar's ink. */
function Cell(props: { control: WindowControl }) {
  const look = titleBarLook();
  return (
    <View
      desktop={{ windowControl: props.control }}
      role="button"
      accessibilityLabel={cellLabel[props.control]}
      hoverStyle={{
        backgroundColor:
          props.control === 'close'
            ? tints.destructive
            : alpha(colors.foreground, 0.06),
      }}
      style={[look.cell()]}
    >
      {captionGlyph(props.control)}
    </View>
  );
}

/** A traffic light's glyph, in the system's ink: close's cross, minimize's bar and zoom's plus. */
function lightGlyph(control: WindowControl) {
  const ink = lightInk;
  switch (control) {
    case 'close':
      return <Icon icon={X} size={8} tint={ink} weight={2} />;
    case 'minimize':
      return (
        <View
          style={{
            width: 6,
            height: 1.5,
            borderRadius: 1,
            backgroundColor: ink,
          }}
        />
      );
    case 'maximize':
      return <Icon icon={Plus} size={8} tint={ink} weight={2} />;
  }
}

/** A caption button's glyph, in the bar's ink: minimize's bar, maximize's box and close's cross. */
function captionGlyph(control: WindowControl) {
  switch (control) {
    case 'close':
      return <Icon icon={X} size={12} tint={colors.foreground} weight={1.25} />;
    case 'minimize':
      return (
        <View
          style={{ width: 10, height: 1, backgroundColor: colors.foreground }}
        />
      );
    case 'maximize':
      return (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 1.5,
            borderWidth: stroke.hairline,
            borderColor: colors.foreground,
          }}
        />
      );
  }
}
