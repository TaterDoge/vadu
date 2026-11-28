// An alert: a notice in a bordered surface, its icon beside its title and its note.

import type { TextProps, TextStyle, ViewProps, ViewStyle } from 'nsh';
import { context, split, Text, View } from 'nsh';

import { density } from '../../lib/ui/surface';
import {
  alpha,
  colors,
  font,
  rounded,
  shape,
  stroke,
} from '../../lib/ui/theme';
import { AsText } from '../../lib/ui/utils';

/** An alert's variants: `default`, the card's surface in the text color; `destructive`, the danger tone's ink. */
export type AlertVariant = 'default' | 'destructive';

/** An alert's parts as the styles they wear: spread each one. */
export interface AlertLook {
  /** The surface: a grid of the icon's column and the text's, a hairline edge. */
  root(): ViewStyle;
  /** The title's line: the text column of the first row, and its type. */
  title(variant: AlertVariant): TextStyle;
  /** The note's place: the text column, the row after the title's (beside the icon when there is
   * no title), its lines a gap apart. */
  descriptionFrame(): ViewStyle;
  /** The note's type, for the text of a string note. */
  descriptionText(variant: AlertVariant): TextStyle;
}

/**
 * The variant the parts under an `Alert` wear. shadcn hands it down with CSS (the root's text
 * color, which the title and the note inherit); a native text inherits nothing, so the root hands
 * it down itself.
 */
const AlertVariantContext = context<AlertVariant>('default');

/** The room inside an alert, and the gap between its icon and its text. */
const pad = 16;
const iconGap = 12;

/** How big an icon in an alert is drawn: the step a note's glyph takes. */
export const ALERT_ICON = 16;

/**
 * An alert's look, after shadcn/ui's `Alert`: the card's surface with one hairline edge and the
 * theme's inset corners, padded 16 by 12, a grid of two columns — the caller's icon at the leading
 * edge, the text beside it a gap of 12 apart — its title in the body's size and medium, and the
 * note a step down in the muted color. `destructive` puts the notice in the danger tone: the title
 * on it, the note at nine tenths.
 *
 * shadcn gives the text the room of the icon's column only when there is one (`has-[>svg]`); a
 * view has no such selector, so the text keeps the gutter either way, and an alert without an icon
 * starts 12 points in from its padding.
 */
export function alertLook(): AlertLook {
  return {
    root: (): ViewStyle => ({
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      columnGap: iconGap,
      rowGap: 2,
      alignItems: 'start',
      paddingHorizontal: pad,
      paddingVertical: 12,
      borderWidth: stroke.hairline,
      borderColor: colors.border,
      ...rounded(shape.control),
      backgroundColor: colors.card,
    }),
    title: (variant: AlertVariant): TextStyle => ({
      gridColumnStart: 2,
      gridRowStart: 1,
      fontSize: density.body,
      fontWeight: font.weight('label'),
      color: variant === 'destructive' ? colors.destructive : colors.foreground,
      numberOfLines: 1,
    }),
    descriptionFrame: (): ViewStyle => ({
      // No row of its own, as shadcn's `col-start-2`: under a title it takes the next row, and
      // without one it sits beside the icon.
      gridColumnStart: 2,
      display: 'grid',
      rowGap: 4,
      justifyItems: 'start',
    }),
    descriptionText: (variant: AlertVariant): TextStyle => ({
      fontSize: density.body,
      color:
        variant === 'destructive'
          ? alpha(colors.destructive, 0.9)
          : colors.mutedForeground,
    }),
  };
}

/**
 * An alert's props: a notice for the whole of a page or a form, read out when it appears
 * (`role="alert"`). Besides `variant`, every `nsh` view prop passes through; `style` goes over the
 * look's.
 */
export type AlertProps = ViewProps & {
  /** Default `default`: the card's surface. `destructive` puts the notice in the danger tone. */
  variant?: AlertVariant;
};

/** An alert's title: one line, in the notice's ink. */
export type AlertTitleProps = TextProps;

/** An alert's note: a sentence, or the app's own blocks in a column. */
export type AlertDescriptionProps = ViewProps;

/**
 * A notice of the whole page or form, after shadcn/ui's `Alert`: the card's surface, a hairline
 * edge, the inset corners, an icon at the leading edge and the title with its note beside it.
 * `variant="destructive"` says the notice is about a failure, and the parts under it wear the
 * danger tone. Write the icon first (an `Icon` of `ALERT_ICON` points in the notice's ink; the
 * terminal draws no icons), then `AlertTitle` and `AlertDescription`.
 */
export function Alert(props: AlertProps) {
  const [, rest] = split(props, ['variant', 'style']);
  return (
    <AlertVariantContext.Provider value={props.variant ?? 'default'}>
      <View
        {...rest}
        role="alert"
        style={[alertLook().root(), props.style ?? null]}
      >
        {props.children}
      </View>
    </AlertVariantContext.Provider>
  );
}

/** An alert's title, one line above its note: `destructive` puts it in the danger tone. */
export function AlertTitle(props: AlertTitleProps) {
  const [, rest] = split(props, ['style']);
  return (
    <Text
      {...rest}
      style={[alertLook().title(AlertVariantContext()), props.style ?? null]}
    >
      {props.children}
    </Text>
  );
}

/**
 * An alert's note, under its title or, with none, beside the icon: a string is drawn in the note's
 * type and ink; anything else (a list of lines, a link) is laid out as given, a small gap apart, in
 * the ink the app gives it.
 */
export function AlertDescription(props: AlertDescriptionProps) {
  const [, rest] = split(props, ['style', 'children']);
  return (
    <View
      {...rest}
      style={[alertLook().descriptionFrame(), props.style ?? null]}
    >
      <AsText style={alertLook().descriptionText(AlertVariantContext())}>
        {props.children}
      </AsText>
    </View>
  );
}
