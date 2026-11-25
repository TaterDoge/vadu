// An empty state: a centered block that says there is nothing here yet, and what to do about it.

import { colors, rounded, TERMINAL_ROW, terminal, font, shape } from "../../lib/ui/theme";
import type { TextProps, TextStyle, ViewProps, ViewStyle } from "nsh";
import { split, Text, token, View } from "nsh";

import { density } from "../../lib/ui/surface";

/** An empty state's media: `default`, the app's own art or icon as it is; `icon`, a tinted square behind it. */
export type EmptyMediaVariant = "default" | "icon";

/** An empty state's parts as the styles they wear: spread each one. */
export interface EmptyLook {
  /** The block: a centered column that takes the room its parent leaves it. */
  root(): ViewStyle;
  /** The media and the words under it, a step apart from them. */
  header(): ViewStyle;
  /** The media's box: nothing at all, or a square of the muted fill with the corners of a surface. */
  media(variant: EmptyMediaVariant): ViewStyle;
  /** The line that says there is nothing here. */
  title(): TextStyle;
  /** The line under it, in the muted ink. */
  description(): TextStyle;
  /** What the reader can do about it: a button or two, a field, a link. */
  content(): ViewStyle;
}

/** How big the icon in an empty state's media is drawn: the `icon` variant's own step. */
export const EMPTY_ICON = 24;

/** The side of the `icon` variant's square: one row of a list, a surface's padding either side. */
const mediaSide = 40;

/** The room inside the block, and between the header and what the reader can do. */
const pad = 24;
const gap = 16;

/** How wide the words and the actions get: a column of text does not run on. */
const column = 384;

/** The words and the actions: a column centered in the block, no wider than `column`. */
const centered = (step: number): ViewStyle => ({
  flexDirection: "column",
  alignItems: "center",
  gap: step,
  maxWidth: column,
  width: "100%",
});

/**
 * An empty state's look, after shadcn/ui's `Empty`: a column centered in the room its parent
 * leaves, padded 24 (none in the terminal, where the block is its lines), its header a step of 8
 * apart from its content, the words no wider than 384 points. The title is medium, a step above
 * the body's size; the description is the body's, in the muted ink, centered. The media is either
 * the app's own (an avatar, an illustration) or the `icon` variant: a square of the muted fill with
 * a surface's corners and an `EMPTY_ICON` icon in it. Either way it sits a step above the title.
 */
export function emptyLook(): EmptyLook {
  return {
    root: (): ViewStyle => ({
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: terminal ? TERMINAL_ROW : gap,
      padding: terminal ? 0 : pad,
      flexGrow: 1,
      minWidth: 0,
      width: "100%",
    }),
    header: (): ViewStyle => centered(8),
    media: (variant: EmptyMediaVariant): ViewStyle => ({
      marginBottom: 8,
      alignItems: "center",
      justifyContent: "center",
      ...(variant === "icon"
        ? {
            width: mediaSide,
            height: mediaSide,
            ...rounded(shape.control),
            backgroundColor: token("muted"),
          }
        : {}),
    }),
    title: (): TextStyle => ({
      // No type role has this size: the body size plus 2.
      fontSize: density.body + 2,
      fontWeight: font.weight("label"),
      color: colors.foreground,
      textAlign: "center",
    }),
    description: (): TextStyle => ({
      fontSize: density.body,
      // A description reads as prose: 1.5 times its size, which `body.line` (19 / 21, a dialog's) is not.
      lineHeight: Math.round(density.body * 1.5),
      color: colors.mutedForeground,
      textAlign: "center",
    }),
    content: (): ViewStyle => centered(gap),
  };
}

/** An empty state's props: every `nsh` view prop passes through; `style` goes over the look's. */
export type EmptyProps = ViewProps;

/** The media and the words under it: `EmptyMedia`, `EmptyTitle`, `EmptyDescription`. */
export type EmptyHeaderProps = ViewProps;

/** The media's box. Besides `variant`, every `nsh` view prop passes through. */
export type EmptyMediaProps = ViewProps & {
  /** Default `default`: the app's own art. `icon` puts a square of the muted fill behind it. */
  variant?: EmptyMediaVariant;
};

/** The line that says there is nothing here. */
export type EmptyTitleProps = TextProps;

/** The line under the title, a step quieter. */
export type EmptyDescriptionProps = TextProps;

/** What the reader can do about it: buttons, a field, a link. */
export type EmptyContentProps = ViewProps;

/**
 * An empty state, after shadcn/ui's `Empty`: a centered column that takes the room its parent
 * leaves it (`flexGrow: 1`), padded 24. Its parts go in order — `EmptyHeader` holding
 * `EmptyMedia`, `EmptyTitle` and `EmptyDescription`, then `EmptyContent` for what the reader can do
 * about it. In the terminal the block is its lines: no padding, and one Cell row between them.
 */
export function Empty(props: EmptyProps) {
  const [, rest] = split(props, ["style"]);
  return (
    <View {...rest} style={[emptyLook().root(), props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** The media and the words under it, a column centered in the block. */
export function EmptyHeader(props: EmptyHeaderProps) {
  const [, rest] = split(props, ["style"]);
  return (
    <View {...rest} style={[emptyLook().header(), props.style ?? null]}>
      {props.children}
    </View>
  );
}

/**
 * The art over the words: the app's own (an `Avatar`, an illustration, an `Icon` drawn large), or
 * `variant="icon"` for a square of the muted fill with an `EMPTY_ICON` icon in it.
 */
export function EmptyMedia(props: EmptyMediaProps) {
  const [, rest] = split(props, ["variant", "style"]);
  return (
    <View {...rest} style={[emptyLook().media(props.variant ?? "default"), props.style ?? null]}>
      {props.children}
    </View>
  );
}

/** The line that says there is nothing here: medium, a step above the body's size. */
export function EmptyTitle(props: EmptyTitleProps) {
  const [, rest] = split(props, ["style"]);
  return (
    <Text {...rest} style={[emptyLook().title(), props.style ?? null]}>
      {props.children}
    </Text>
  );
}

/** The line under the title: the body's size, in the muted ink, centered. */
export function EmptyDescription(props: EmptyDescriptionProps) {
  const [, rest] = split(props, ["style"]);
  return (
    <Text {...rest} style={[emptyLook().description(), props.style ?? null]}>
      {props.children}
    </Text>
  );
}

/** What the reader can do about it: a button or two, a field, a link, a gap of 16 apart. */
export function EmptyContent(props: EmptyContentProps) {
  const [, rest] = split(props, ["style"]);
  return (
    <View {...rest} style={[emptyLook().content(), props.style ?? null]}>
      {props.children}
    </View>
  );
}
