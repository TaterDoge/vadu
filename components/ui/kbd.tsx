// A keyboard key, alone or in a group of them, on `nsh`'s own View and Text.

import type { JSX, TextStyle, ViewProps, ViewStyle } from 'nsh';
import { split, token, View } from 'nsh';

import {
  colors,
  font,
  rounded,
  shape,
  stroke,
  terminal,
  TERMINAL_ROW,
} from '../../lib/ui/theme';
import { AsText } from '../../lib/ui/utils';

/** A key's look: the cap itself, the type on it, and a row of them. Spread each one. */
export interface KbdLook {
  /** The cap: at least as wide as tall, a light fill and a hairline edge. */
  readonly kbd: ViewStyle;
  /** The key's name on the cap: small, medium, and a step quieter than the page's text. */
  readonly text: TextStyle;
  /** A row of keys, a gap apart (`⌘ K` as two caps). */
  readonly group: ViewStyle;
}

/** The side of a key: one line of small type with room above and below it. */
const side = 24;

/**
 * A key's look, after shadcn/ui's `Kbd`: 24 points with a pointer (one Cell row in
 * the terminal), as wide as its name with a padding either side and at least a square, the theme's
 * small corners, a hairline edge and the `muted` fill, the name small (12 points), medium and in
 * the muted ink. The terminal draws no fill and no edge, its keys standing in the row as their
 * names in the monospaced face.
 */
export function kbdLook(): KbdLook {
  return {
    get kbd(): ViewStyle {
      return {
        height: terminal ? TERMINAL_ROW : side,
        minWidth: terminal ? undefined : side,
        paddingHorizontal: terminal ? 0 : 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        pointerEvents: 'none',
        ...(terminal ? {} : rounded(shape.control)),
        borderWidth: terminal ? 0 : stroke.control,
        borderColor: colors.line,
        backgroundColor: terminal ? 'transparent' : token('muted'),
      };
    },
    get text(): TextStyle {
      return {
        // No type role has this size: a key cap's 12, and the terminal's 14 is a character grid's.
        fontSize: terminal ? 14 : 12,
        fontWeight: font.weight('label'),
        color: colors.mutedForeground,
        // 修饰键符号需要独立字体，避免等宽字体缺字。
        fontFamily: terminal ? 'monospace' : token('font-key'),
        numberOfLines: 1,
      };
    },
    get group(): ViewStyle {
      return {
        flexDirection: 'row',
        alignItems: 'center',
        gap: terminal ? 0 : 4,
        flexShrink: 0,
      };
    },
  };
}

/** A key's props: a string is its name, drawn in the look's type; anything else (an icon) is drawn as given. */
export type KbdProps = Omit<ViewProps, 'children'> & {
  /** The key's name (`K`, `Esc`, `⌘`), or an icon. */
  children?: string | JSX.Element;
};

/** A row of keys: `⌘` and `K` as two caps, or one cap holding `Ctrl + B`. */
export type KbdGroupProps = ViewProps;

/**
 * A keyboard key, after shadcn/ui's: a small cap in the muted fill with a hairline edge, for the
 * stroke a shortcut takes. Every `nsh` view prop passes through; `style` goes over the look's. In
 * a terminal the key is its name in the monospaced face, with no cap around it.
 */
export function Kbd(props: KbdProps) {
  const [, rest] = split(props, ['children', 'style']);
  return (
    <View {...rest} style={[kbdLook().kbd, props.style ?? null]}>
      <AsText style={kbdLook().text}>{props.children}</AsText>
    </View>
  );
}

/** Keys side by side, a small gap apart: `⌘`, `⇧`, `K`. */
export function KbdGroup(props: KbdGroupProps) {
  const [, rest] = split(props, ['children', 'style']);
  return (
    <View {...rest} style={[kbdLook().group, props.style ?? null]}>
      {props.children}
    </View>
  );
}
