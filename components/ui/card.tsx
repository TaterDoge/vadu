// A card: the look (`cardLook`) and the seven parts that wear it.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { TextProps, TextStyle, ViewProps, ViewStyle } from 'nsh';
import { split, Text, View } from 'nsh';

import { density, sectionSurface } from '../../lib/ui/surface';
import {
  colors,
  font,
  surface,
  terminal,
  TERMINAL_GAP,
} from '../../lib/ui/theme';

/** The padding a card's parts keep from its edge, and the gap between them (reactive to theme switches). */
const pad = () => density.pad;
const gap = () => density.gap + 4;

/** The space between a card's title, description and action. */
const headGap = 6;

/** A card's seven parts as the styles they wear: spread each one. */
export interface CardLook {
  /** The surface: the card's fill, a hairline edge, the density's corners, clipped. */
  readonly card: ViewStyle;
  /** Title, description and action: title and description in the first column,
   * the action at the trailing edge of the first row. */
  readonly header: ViewStyle;
  /** The card's title: a step larger than body, semibold, the text colour. */
  readonly title: TextStyle;
  /** The line under the title: body size in the muted colour. */
  readonly description: TextStyle;
  /** The control at the trailing edge, beside title and description. */
  readonly action: ViewStyle;
  /** What the card is about: a column of parts a `gap` apart. */
  readonly content: ViewStyle;
  /** What goes under the content: a wrapping row, centred, `8` apart. */
  readonly footer: ViewStyle;
}

/**
 * A card's look, after shadcn/ui's secondary card and the gallery's `Card`
 * (`sectionSurface`): the theme's card finish — its ground, its edge where the
 * finish draws one, its shadow where one is stated — and the density's corners
 * (10 with a pointer, 16 on a touch screen); a column of parts a `gap` apart,
 * padded `density.pad` (14 / 16) at
 * the top and the bottom, each part padded by it on the sides. The header is
 * a grid of two columns: the title over the description in the first, the
 * action at the trailing edge spanning both. The title is `density.body + 2`
 * points, semibold; the description one step down in the muted colour. In the
 * terminal the surface's own border is the card's, its padding the parts', and
 * the parts keep no padding of their own.
 */
export function cardLook(): CardLook {
  return {
    get card(): ViewStyle {
      return {
        ...sectionSurface(),
        ...(terminal
          ? { gap: TERMINAL_GAP }
          : { paddingVertical: pad(), overflow: 'hidden', gap: gap() }),
        flexDirection: 'column',
      };
    },
    get header(): ViewStyle {
      return {
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gridAutoRows: 'min-content',
        alignItems: 'start',
        columnGap: 12,
        rowGap: headGap,
        paddingHorizontal: terminal ? 0 : pad(),
      };
    },
    get title(): TextStyle {
      return {
        gridColumnStart: 1,
        // No type role has this size: the body size plus 2.
        fontSize: density.body + 2,
        fontWeight: font.weight('title'),
        color: colors.foreground,
      };
    },
    get description(): TextStyle {
      return {
        gridColumnStart: 1,
        fontSize: density.body,
        color: colors.mutedForeground,
      };
    },
    get action(): ViewStyle {
      return {
        gridColumnStart: 2,
        gridRowStart: 1,
        gridRowEnd: 3,
        justifySelf: 'end',
        alignItems: 'flex-end',
      };
    },
    get content(): ViewStyle {
      return {
        paddingHorizontal: terminal ? 0 : pad(),
        ...(terminal ? {} : { gap: gap() }),
        flexDirection: 'column',
      };
    },
    get footer(): ViewStyle {
      return {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: terminal ? 0 : pad(),
      };
    },
  };
}

/**
 * A card: a flat surface holding related content, the way shadcn/ui's `Card`
 * does. Every `nsh` view prop passes through; `style` goes over the look's.
 * Compose it from `CardHeader` (its `CardTitle`, `CardDescription` and
 * `CardAction`), `CardContent` and `CardFooter`.
 */
export type CardProps = ViewProps;

/** The card's first block: its title, its description, and its action. */
export type CardHeaderProps = ViewProps;

/** The card's title, drawn as text in the title's type. */
export type CardTitleProps = TextProps;

/** A quieter line under the title. */
export type CardDescriptionProps = TextProps;

/** A control at the header's trailing edge (a button, a badge). */
export type CardActionProps = ViewProps;

/** The card's body. `flush` lets what it holds meet the card's side and bottom edges. */
export type CardContentProps = ViewProps & {
  /**
   * Drop the side padding and pull the body through the card's bottom padding, so a picture
   * meets the rim and the card's radius clips it. The header stays padded. Off in the terminal,
   * where the card has no padding of its own.
   */
  flush?: boolean;
};

/** The card's last row, for actions. */
export type CardFooterProps = ViewProps;

/** A card's surface. */
export function Card(props: CardProps) {
  const [, rest] = split(props, ['style', 'hoverStyle', 'children']);
  const look = cardLook();
  return (
    <View
      {...rest}
      {...surface('card').platformProps}
      style={[look.card, props.style ?? null]}
      hoverStyle={props.hoverStyle}
    >
      {props.children}
    </View>
  );
}

/** A card's header: `CardTitle`, `CardDescription` and `CardAction` inside it. */
export function CardHeader(props: CardHeaderProps) {
  const [, rest] = split(props, ['style', 'children']);
  return (
    <View {...rest} style={[cardLook().header, props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** A card's title. */
export function CardTitle(props: CardTitleProps) {
  const [, rest] = split(props, ['style', 'children']);
  return (
    <Text {...rest} style={[cardLook().title, props.style ?? null]}>
      {props.children}
    </Text>
  );
}

/** A quieter line under a card's title. */
export function CardDescription(props: CardDescriptionProps) {
  const [, rest] = split(props, ['style', 'children']);
  return (
    <Text {...rest} style={[cardLook().description, props.style ?? null]}>
      {props.children}
    </Text>
  );
}

/** A control at a card header's trailing edge. */
export function CardAction(props: CardActionProps) {
  const [, rest] = split(props, ['style', 'children']);
  return (
    <View {...rest} style={[cardLook().action, props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** A card's body. `flush` meets the card's side and bottom edges; the card clips to its radius. */
export function CardContent(props: CardContentProps) {
  const [, rest] = split(props, ['style', 'children', 'flush']);
  return (
    <View
      {...rest}
      style={[
        cardLook().content,
        props.flush && !terminal
          ? { paddingHorizontal: 0, marginBottom: -pad() }
          : null,
        props.style ?? null,
      ]}
    >
      {props.children}
    </View>
  );
}

/** A card's last row. */
export function CardFooter(props: CardFooterProps) {
  const [, rest] = split(props, ['style', 'children']);
  return (
    <View {...rest} style={[cardLook().footer, props.style ?? null]}>
      {props.children}
    </View>
  );
}
