// A text field: the size, edge and text every field shares (`fieldSize`, `edgeClass`, `fieldLook`,
// `fieldText`) and the `Input` that wears them as `inputLook`.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { InputStyle, ViewStyle } from 'nsh';
import { platform, signal, split } from 'nsh';
import {
  Input as BaseInput,
  type InputProps as BaseInputProps,
} from 'nsh/base';

import {
  fieldCornerClass,
  fieldCorners,
  fieldDrawn,
  fieldEdgeClass,
  fieldEdgeWidths,
  fieldFocusLine,
} from '../../lib/ui/indicator';
import { type Live, read } from '../../lib/ui/live-value';
// `fieldLook` is the well's own look in this file; the recipe's is read as `fieldRecipe`.
import { fieldLook as fieldRecipe } from '../../lib/ui/look';
import { createRejectShake } from '../../lib/ui/motion';
import {
  colors,
  control,
  dimmed,
  finish,
  font,
  terminal,
  TERMINAL_COLUMN,
  TERMINAL_ROW,
} from '../../lib/ui/theme';

const pointer = platform.desktop;

/**
 * A text field's sizes, shared by every single-line field and picker
 * trigger (an input, a number input, a select, a combobox, a palette's
 * trigger): 32 points high, text 14 and 10 points in from its edges with a
 * pointer (shadcn's `text-sm`); 46 high, text 15 and 14 in on a touch screen. In the
 * terminal a field is three rows (its border's and the text's), the text one
 * Cell inside the border's own column.
 */
export const fieldSize = terminal
  ? // The terminal's text is the character grid's size, not a type role's.
    { height: 3 * TERMINAL_ROW, font: 13, pad: 2 * TERMINAL_COLUMN - 1 }
  : {
      height: pointer ? 32 : 46,
      /** The `label` role: 14 with a pointer, 15 on a touch screen. */
      get font() {
        return font.size('label');
      },
      pad: pointer ? 10 : 14,
    };

/** A field's variants: `default` the field's fill and edge, `ghost` neither until the keys are in it. */
export type InputVariant = 'default' | 'ghost';

/** Options of `fieldLook` and `inputLook`. */
export interface FieldLookOptions {
  /**
   * `default`: the field's fill and edge. `ghost`: nothing at rest — no fill, no edge — with
   * the text and the placeholder as they are and the focus ring kept (a search field, a title
   * that turns into a field); disabled and invalid still show.
   */
  variant?: Live<InputVariant | undefined>;
  /** Edged in the danger tone, its focus edge too. */
  invalid?: Live<boolean>;
  /** Read-only: lies flat (no recess) on a quieter edge. */
  readonly?: Live<boolean>;
  /** Disabled: flat on the quieter edge, as read-only; `disabledStyle` dims it. */
  disabled?: Live<boolean>;
  /** Several lines: the content starts at the top, in a box at least one line tall. */
  multiline?: Live<boolean>;
  /** Layout over the look (a width, a height, a margin; on an input its text too), or a function reading it. */
  style?: Live<InputStyle>;
}

/** Options of `edgeClass`. */
interface EdgeOptions {
  /** The edge at rest: a border color class (`border-input`). */
  rest: string;
  /** The edge under the pointer (`border-faint`), none for a field that takes no hover. */
  hover?: string;
  /** The variant the hover takes (`hover`, `enabled:hover`). */
  hoverVariant?: string;
  /** The focus tone: the accent, or the danger tone while invalid. */
  invalid?: boolean;
  /**
   * `focus:` for a well that has the keys itself, `focus-within:` (the default) for one around what has them,
   * `focus-visible:` for a button drawn as a field (its focus shows only after a key).
   */
  focus?: 'focus' | 'focus-within' | 'focus-visible';
}

/**
 * A well's edge as classes: at rest, stronger under the pointer, and while
 * it (or a view in it) has the keys the accent, the border and the outline
 * together, hovered or not; in the terminal the border is the field's line,
 * so it takes the accent alone. A preset that draws a line (`underline`,
 * `box-underline`) takes the accent on that edge, `focus.width` wide, in
 * place of the ring, and its box (if it has one) keeps its color.
 */
export function edgeClass(o: EdgeOptions): string {
  const tone = o.invalid ? 'destructive' : 'brand';
  const focus = o.focus ?? 'focus-within';
  const hover = o.hoverVariant ?? 'hover';
  const indicator = fieldDrawn(fieldRecipe(control().field)).form;
  // A field's own edge is the input one, and the preset redraws it: a line in the muted foreground,
  // or a hairline box whose bottom edge stays the input color (and keeps it under the pointer, as
  // WinUI's does). Another color (the danger tone, a flat or a ghost field) is the field's own, and
  // the box and its bottom edge both keep it.
  const own = o.rest === 'border-input';
  const line = indicator !== 'box';
  const rest =
    !own || indicator === 'box'
      ? o.rest
      : indicator === 'underline'
        ? 'border-muted-foreground'
        : 'border-border border-b-input';
  // The line's color, and the accent under the pointer and with the keys: a line preset lights its
  // bottom edge alone.
  const edge = `${line ? 'border-b' : 'border'}-${tone}`;
  const hoverEdge = own && indicator === 'box-underline' ? undefined : o.hover;
  return [
    rest,
    hoverEdge ? `${hover}:${hoverEdge} ${hover}:${focus}:${edge}` : '',
    `${focus}:${edge}`,
    line ? fieldFocusLine(focus) : '',
    terminal || line
      ? ''
      : `outline-2 -outline-offset-1 outline-${tone}/0 ${focus}:outline-${tone}`,
    'transition-colors duration-150 motion-reduce:transition-none',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * A field's edge: the danger tone while invalid, the line (no hover) while read-only or disabled,
 * and nothing at rest while `ghost` (its focus edge, from `edgeClass`, stays).
 */
function fieldEdge(o: FieldLookOptions | undefined): string {
  const invalid = !!read(o?.invalid);
  const ghost = (read(o?.variant) ?? 'default') === 'ghost';
  const flat = !!read(o?.readonly) || !!read(o?.disabled);
  if (invalid) return edgeClass({ rest: 'border-destructive', invalid });
  if (ghost) return edgeClass({ rest: 'border-transparent' });
  return flat
    ? edgeClass({ rest: 'border-line' })
    : edgeClass({ rest: 'border-input', hover: 'border-faint' });
}

function frame(o: FieldLookOptions | undefined): ViewStyle {
  const ghost = (read(o?.variant) ?? 'default') === 'ghost';
  const flat = !!read(o?.readonly) || !!read(o?.disabled);
  const field = fieldRecipe(control().field);
  return {
    ...fieldCorners(field),
    ...fieldEdgeWidths(field),
    backgroundColor: ghost ? 'transparent' : colors.field,
    // Recessed while editable; a read-only, disabled or ghost field lies flat. Its edge is
    // `fieldEdge`'s classes.
    ...(flat || ghost ? {} : finish.inset),
  };
}

/**
 * The well around a field's input (and its prefix, suffix, icons): spread
 * it on the view holding them. Its states (`class`): a stronger edge under
 * the pointer (none while invalid, read-only or disabled), the focus edge
 * while the input in it has the keys; 50% while disabled.
 */
export function fieldLook(o?: FieldLookOptions) {
  return {
    get class(): string {
      return fieldEdge(o);
    },
    get style(): InputStyle {
      return {
        flexDirection: 'row',
        alignItems: read(o?.multiline) ? 'flex-start' : 'center',
        ...frame(o),
        ...read(o?.style),
      };
    },
    get disabledStyle(): ViewStyle {
      return { opacity: dimmed.disabled };
    },
  };
}

/** Options of `fieldText`. */
export interface FieldTextOptions {
  /** Read-only: the value keeps the text color, as shadcn's read-only input (the well lies flat: `fieldLook`). */
  readonly?: boolean;
  /** Several lines: a least height and the padding above and below instead of a set height. */
  multiline?: boolean;
  /** Inside a `fieldLook` well, whose 1-point edge is part of the field's height: the text is that much shorter, so the
   * whole field is as tall as a lone input, a select or a number input. */
  inWell?: boolean;
}

/**
 * An input's text in a field: the field's size and padding, the text color
 * (read-only too: the flat well tells it apart, and disabled dims to 50%),
 * the placeholder in the muted color (shadcn's `muted-foreground`), the
 * caret and selection in the accent. Call it where the style is read, so it
 * follows the theme.
 */
export function fieldText(o?: FieldTextOptions): InputStyle {
  // The well's edge above and below.
  const edge = o?.inWell && !terminal ? 2 : 0;
  const box = terminal
    ? o?.multiline
      ? {
          minHeight: 3 * TERMINAL_ROW,
          paddingTop: TERMINAL_ROW - 1,
          paddingBottom: TERMINAL_ROW - 1,
        }
      : { height: 3 * TERMINAL_ROW }
    : o?.multiline
      ? pointer
        ? {
            minHeight: fieldSize.height - edge,
            paddingTop: 7 - edge / 2,
            paddingBottom: 7 - edge / 2,
          }
        : {
            minHeight: fieldSize.height - edge,
            paddingTop: 13 - edge / 2,
            paddingBottom: 13 - edge / 2,
          }
      : { height: fieldSize.height - edge };
  return {
    flex: 1,
    paddingHorizontal: fieldSize.pad,
    fontSize: fieldSize.font,
    color: colors.foreground,
    placeholderColor: colors.mutedForeground,
    caretColor: colors.brand,
    selectionColor: colors.brand,
    ...box,
  };
}

/** The room a multiline field keeps around the text it reports: padding above and below, and the
 * well's own edge (the terminal's edge is a cell, already inside the row). */
export function multilineFieldPad(): number {
  const text = fieldText({ multiline: true });
  const room = (value: string | number | undefined) =>
    typeof value === 'number' ? value : 0;
  return room(text.paddingTop) + room(text.paddingBottom) + (terminal ? 0 : 2);
}

/**
 * How tall a multiline field is for a reported content height: the text plus `multilineFieldPad`,
 * and no taller than `maxLines` field-heights (five, about the notes a form keeps on screen).
 */
export function grownFieldHeight(contentHeight: number, maxLines = 5): number {
  return Math.min(
    contentHeight + multilineFieldPad(),
    maxLines * fieldSize.height,
  );
}

/**
 * A lone `<Input>`'s props (`<Input {...inputLook()} />`): the well and its
 * states (`fieldLook`) and the text in it (`fieldText`) on the input itself.
 */
export function inputLook(o?: FieldLookOptions) {
  const look = fieldLook(o);
  return {
    get class(): string {
      return look.class;
    },
    get style(): InputStyle {
      const text = fieldText({
        readonly: !!read(o?.readonly),
        multiline: !!read(o?.multiline),
      });
      // A lone input is its own well: the text takes no `flex`, which a field's text has for the
      // parts beside it.
      return {
        ...frame(o),
        ...text,
        flex: undefined,
        ...read(o?.style),
      } as InputStyle;
    },
    disabledStyle: look.disabledStyle,
  };
}

/**
 * A time field's well, the same one in `TimeField` and in the date picker's time row: a number input's frame, the
 * field's segments inside. It sits in the calendar's popup, so in dark it is shadcn's input there (`bg-input/30`, a
 * shade over the popup) rather than the field color, which is the page's and would read as a hole. Its corners and
 * edge are the preset's, so read it where it is used: the preset is the theme's, which changes at runtime.
 */
export function timeFieldClass(): string {
  const field = fieldRecipe(control().field);
  return [
    pointer ? 'h-8 px-2' : 'h-11 px-3',
    fieldCornerClass(field),
    terminal
      ? 'items-center bg-field'
      : 'items-center bg-field dark:bg-input/30',
    fieldEdgeClass(field),
    edgeClass({
      rest: 'border-input',
      hover: 'border-faint',
      hoverVariant: 'enabled:hover',
    }),
  ].join(' ');
}

/**
 * `nsh/base`'s Input in the look of `inputLook`. Every base prop passes through; `class`, `style`
 * and `disabledStyle` go over the look's. Focus and hover edges are classes on the look.
 *
 * One field, one line or several: with `multiline` the content starts at the top of a box at least
 * one line tall, and Return writes a line break. `grow` sizes that box from `onContentSizeChange`
 * (`grownFieldHeight`); without it, `fieldText` keeps only a least height and the app sets the rest.
 */
export type InputProps = BaseInputProps & {
  /** Default `default`: the field's fill and edge. `ghost`: nothing at rest, the focus ring kept. */
  variant?: InputVariant;
  /** Edged in the danger tone, its focus edge too. */
  invalid?: boolean;
  /**
   * Multiline only. `true` grows with the text up to five lines; a number is that cap. The height
   * is set as the text reports it, with no transition, so reduced motion has nothing to turn off.
   * A `style` `height` still wins.
   */
  grow?: boolean | number;
  /**
   * Shakes the field each time this becomes a new number (a submit the value failed). `invalid`
   * only recolours the edge, so a second rejection has to change this. Less motion plays nothing.
   */
  reject?: number;
};

/** A text field. The well and the text are `inputLook`. */
export function Input(props: InputProps) {
  const [, rest] = split(props, [
    'variant',
    'invalid',
    'class',
    'style',
    'disabledStyle',
    'grow',
    'reject',
    'onContentSizeChange',
  ]);
  const look = inputLook({
    variant: () => props.variant,
    invalid: () => !!props.invalid,
    readonly: () => !!props.readonly,
    disabled: () => !!props.disabled,
    multiline: () => !!props.multiline,
  });
  const contentHeight = signal(0);
  const shake = createRejectShake(() => props.reject);
  const grown = (): InputStyle | null => {
    const lines = props.grow === true ? 5 : props.grow;
    if (
      !props.multiline ||
      lines === undefined ||
      lines === false ||
      contentHeight() === 0
    )
      return null;
    return { height: grownFieldHeight(contentHeight(), lines) };
  };
  return (
    <BaseInput
      {...rest}
      onContentSizeChange={(event) => {
        if (props.grow && props.multiline) contentHeight.set(event.size.height);
        props.onContentSizeChange?.(event);
      }}
      class={props.class ? `${look.class} ${props.class}` : look.class}
      style={[look.style, grown(), shake.style(), props.style ?? null]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    />
  );
}
