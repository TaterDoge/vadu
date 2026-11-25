// An input group: the field's frame around a control and the parts beside it (a leading icon, a
// trailing button, a unit), after shadcn/ui's InputGroup.

import type {
  InputRef,
  InputStyle,
  JSX,
  Signal,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'nsh';
import { context, signal, split, View } from 'nsh';
import {
  Input as BaseInput,
  type InputProps as BaseInputProps,
} from 'nsh/base';

import { AsText } from '../../lib/ui/as-text';
import { type Live, read } from '../../lib/ui/live-value';
import { colors, terminal, TERMINAL_COLUMN } from '../../lib/ui/theme';
import {
  Button,
  type ButtonProps,
  type ButtonSize,
  buttonSizes,
} from './button';
import { fieldLook, fieldSize, fieldText } from './input';

/** Options of `inputGroupLook`. */
export interface InputGroupLookOptions {
  /** Edged in the danger tone, its focus edge too (a field the app rejects), as `Input`'s. */
  invalid?: Live<boolean | undefined>;
  /** Disabled: flat on the quieter edge, dimmed to half; what it holds is disabled with it. */
  disabled?: Live<boolean | undefined>;
  /** More style (a radius, a padding, a width), over the look's. */
  style?: Live<ViewStyle | undefined>;
}

/**
 * A group's frame, as the props of the view holding its parts (spread them): the field's own look
 * (`fieldLook`) — the field's fill, its 1-point edge, and while a control in it has the keys a
 * 2-point edge in the accent with its ring; the danger tone while invalid; flat on the quieter
 * edge and dimmed while disabled — as wide as the room it is given. Its parts sit in one row,
 * wrapping so that a `block-start` or `block-end` addon takes a line of its own. Its corners are
 * `shape.control`, or the radius `style` gives it (`style={{ borderRadius: 22 }}`), which the
 * focus ring follows: the ring is drawn on the frame, not on the control.
 */
export function inputGroupLook(o?: InputGroupLookOptions) {
  const field = fieldLook({
    invalid: () => !!read(o?.invalid),
    disabled: () => !!read(o?.disabled),
  });
  return {
    get class(): string {
      return field.class;
    },
    get style(): ViewStyle {
      return {
        ...field.style,
        width: '100%',
        flexWrap: 'wrap',
        ...read(o?.style),
      };
    },
    disabledStyle: field.disabledStyle,
  };
}

/** Options of `inputGroupControlLook`. */
export interface InputGroupControlLookOptions {
  /** Several lines: the content starts at the top and the group grows with it. */
  multiline?: Live<boolean | undefined>;
  /** More style (a width, a text style), over the look's. */
  style?: Live<InputStyle | undefined>;
}

/**
 * A group's control, as the props of the input in it (spread them): the field's text — its size,
 * its padding, its placeholder, its caret and selection colors — and none of the frame: no fill,
 * no edge and no focus ring, because the group around it draws them. Its height is a lone field's
 * less the group's edge, so a group around one control is as tall as an `Input`.
 */
export function inputGroupControlLook(o?: InputGroupControlLookOptions) {
  return {
    get style(): InputStyle {
      return {
        ...fieldText({ multiline: !!read(o?.multiline), inWell: true }),
        backgroundColor: 'transparent',
        ...read(o?.style),
      };
    },
  };
}

/**
 * Where an addon sits: on the control's line before it (`inline-start`) or after it
 * (`inline-end`), or on a line of its own above it (`block-start`) or below it (`block-end`).
 * The group lays its parts out in the order they are written; an addon's `align` gives it the
 * inset that faces the frame's edge, and a block addon takes the whole line it is written on.
 */
export type InputGroupAddonAlign =
  'inline-start' | 'inline-end' | 'block-start' | 'block-end';

/**
 * An addon's look: a row (an icon by a word) that keeps its size beside the control, with
 * `fieldSize.pad` between its content and the frame's edge on the side it faces — the control
 * keeps its own padding on its side, as shadcn's do. A block addon spans its line, inset the
 * same on both sides, with the padding above (or below) that separates it from the control.
 */
export function inputGroupAddonLook(
  align: InputGroupAddonAlign = 'inline-start',
): ViewStyle {
  const pad = terminal ? TERMINAL_COLUMN : fieldSize.pad;
  const row: ViewStyle = {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: terminal ? 0 : 6,
  };
  switch (align) {
    case 'block-start':
      return { ...row, width: '100%', paddingHorizontal: pad, paddingTop: pad };
    case 'block-end':
      return {
        ...row,
        width: '100%',
        paddingHorizontal: pad,
        paddingBottom: pad,
      };
    case 'inline-end':
      return { ...row, paddingEnd: pad };
    default:
      return { ...row, paddingStart: pad };
  }
}

/** A group's text as the styles it wears: the row around it, and the text itself. */
export interface InputGroupTextLook {
  /** The row its icon and its words sit in. */
  readonly style: ViewStyle;
  /** The words: the field's size, in the muted color (shadcn's `text-muted-foreground`). */
  readonly label: TextStyle;
}

/** A group's text (a unit, a word beside an icon): a row in the field's type, muted. */
export function inputGroupTextLook(): InputGroupTextLook {
  return {
    get style(): ViewStyle {
      return {
        flexDirection: 'row',
        alignItems: 'center',
        gap: terminal ? 0 : 6,
      };
    },
    get label(): TextStyle {
      return { fontSize: fieldSize.font, color: colors.mutedForeground };
    },
  };
}

/** shadcn's sizes for a button inside a group: `xs`, `sm`, and the same two as a square. */
export type InputGroupButtonSize = 'xs' | 'sm' | 'icon-xs' | 'icon-sm';

/** What a group-button size takes from this library's scale: `xs` and `icon-xs` are a `sm`
 * button's height (24 points with a pointer, 36 on a touch screen), `sm` and `icon-sm` a
 * `default` one's (28 / 40). */
const groupButtonSize = (size: InputGroupButtonSize): ButtonSize =>
  size === 'sm' || size === 'icon-sm' ? 'default' : 'sm';

/** A square group button (`icon-xs`, `icon-sm`): the height of the button it takes, no side padding. */
const squareStyle = (size: InputGroupButtonSize): ViewStyle | null =>
  size.startsWith('icon')
    ? { width: buttonSizes[groupButtonSize(size)].height, paddingHorizontal: 0 }
    : null;

/** What a group's parts share: its control, so a press on an addon puts the keys in it. */
type InputGroupContextValue = {
  /** The control, once it is made. */
  input: Signal<InputRef | undefined>;
};

const InputGroupContext = context<InputGroupContextValue | null>(null);

function useInputGroup() {
  const group = InputGroupContext();
  if (!group)
    throw new Error('InputGroup parts must be used within <InputGroup>');
  return group;
}

/**
 * A group's frame: a field around a control and its addons, as `inputGroupLook` draws it. Every
 * view prop passes through; `class`, `style` and `disabledStyle` go over the look's.
 */
export type InputGroupProps = ViewProps & {
  /** Edged in the danger tone, its focus edge too (a field the app rejects). */
  invalid?: boolean;
};

/**
 * The frame around a group's parts. Its edges and its states come from the field's look, so a
 * control in it that has the keys lights the frame, not itself. `disabled` (a view's prop)
 * disables what it holds and dims it. Write the radius and the padding of a group on it
 * (`style={{ borderRadius: 22, padding: 6 }}`): the focus ring follows the radius.
 */
export function InputGroup(props: InputGroupProps) {
  const [, rest] = split(props, [
    'invalid',
    'class',
    'style',
    'disabledStyle',
    'children',
  ]);
  const input = signal<InputRef | undefined>(undefined);
  const look = inputGroupLook({
    invalid: () => !!props.invalid,
    disabled: () => !!props.disabled,
  });
  return (
    <InputGroupContext.Provider value={{ input }}>
      {/* The row wraps: a `block-start` or `block-end` addon is as wide as the group, so it takes
          a line of its own, above or below the control's (`inputGroupLook`). */}
      <View
        role="group"
        {...rest}
        class={props.class ? `${look.class} ${props.class}` : look.class}
        style={[look.style, props.style ?? null]}
        disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
      >
        {props.children}
      </View>
    </InputGroupContext.Provider>
  );
}

/**
 * A group's control: `nsh/base`'s `Input` with the field's text and none of its frame, the group
 * around it drawing the fill, the edge and the focus ring. Every base input prop passes through,
 * `ref` too (`ref.focus()` puts the keys in it, as shadcn's forwards its ref; the group holds the
 * input as well, to do the same from an addon); `style` goes over the look's.
 */
export type InputGroupInputProps = BaseInputProps;

/** The group holds the control's input (an addon's press focuses it), and so does the app's ref. */
function hold(
  group: InputGroupContextValue,
  ref: BaseInputProps['ref'],
  input: InputRef,
) {
  group.input.set(input);
  if (typeof ref === 'function') ref(input);
}

/** One line in a group. */
export function InputGroupInput(props: InputGroupInputProps) {
  const group = useInputGroup();
  const [, rest] = split(props, ['style', 'ref']);
  const look = inputGroupControlLook({ multiline: () => !!props.multiline });
  return (
    <BaseInput
      {...rest}
      ref={(input) => hold(group, props.ref, input)}
      style={[look.style, props.style ?? null]}
    />
  );
}

/**
 * A group's control over several lines: `nsh/base`'s `Input` with `multiline`, in the group's
 * text and none of its frame. Every base input prop passes through but `multiline`, `ref` too;
 * `style` goes over the look's.
 */
export type InputGroupTextareaProps = Omit<BaseInputProps, 'multiline'>;

/** Several lines in a group (a composer, a note). */
export function InputGroupTextarea(props: InputGroupTextareaProps) {
  const group = useInputGroup();
  const [, rest] = split(props, ['style', 'ref']);
  const look = inputGroupControlLook({ multiline: true });
  return (
    <BaseInput
      {...rest}
      multiline
      ref={(input) => hold(group, props.ref, input)}
      style={[look.style, props.style ?? null]}
    />
  );
}

/**
 * An addon: what sits beside a group's control — an icon, a word, a button. It takes presses
 * itself and puts the keys in the control, as shadcn's does, and it is not a stop of the
 * keyboard's (Tab goes to the control). A press on a button in it is the button's alone. Every
 * view prop passes through; `style` goes over the look's.
 */
export type InputGroupAddonProps = ViewProps & {
  /** Default `inline-start`. */
  align?: InputGroupAddonAlign;
};

/** What sits before or after the control, on its line or on one of its own. */
export function InputGroupAddon(props: InputGroupAddonProps) {
  const group = useInputGroup();
  const [, rest] = split(props, ['align', 'style', 'children']);
  return (
    <View
      focusable={false}
      onPress={() => group.input()?.focus()}
      {...rest}
      style={[inputGroupAddonLook(props.align), props.style ?? null]}
    >
      {props.children}
    </View>
  );
}

/**
 * A group's word or icon: a `Text` in the field's type in the muted color for a string child,
 * anything else (an icon) drawn as given. Every view prop passes through; `style` goes over the
 * look's.
 */
export type InputGroupTextProps = Omit<ViewProps, 'children'> & {
  /** A string is the word, in the field's type; anything else is drawn as given. */
  children?: string | JSX.Element;
};

/** A unit, a word, an icon beside a group's control. */
export function InputGroupText(props: InputGroupTextProps) {
  const look = inputGroupTextLook();
  const [, rest] = split(props, ['style', 'ref', 'children']);
  return (
    <View {...rest} style={[look.style, props.style ?? null]}>
      <AsText style={look.label}>{props.children}</AsText>
    </View>
  );
}

/**
 * A `Button` for a group. Every button prop passes through but `size`, which takes shadcn's sizes
 * for a group's button on this library's scale: `xs` is a `sm` button (24 points high with a
 * pointer, 36 on a touch screen), `sm` a `default` one (28 / 40), and `icon-xs` / `icon-sm` a
 * square of that height with no side padding. `variant` is a button's, `ghost` unless set, and the
 * style props go over the look's. A string child is the label; an icon alone needs an
 * `accessibilityLabel`.
 */
export type InputGroupButtonProps = Omit<ButtonProps, 'size'> & {
  /** Default `xs`. */
  size?: InputGroupButtonSize;
};

/** A button in a group: a trailing clear, a send. */
export function InputGroupButton(props: InputGroupButtonProps) {
  const [, rest] = split(props, ['size', 'style', 'children']);
  // Read where it is drawn, so the button follows `size`.
  const size = () => props.size ?? 'xs';
  return (
    <Button
      {...rest}
      variant={props.variant ?? 'ghost'}
      size={groupButtonSize(size())}
      style={[squareStyle(size()), props.style ?? null]}
    >
      {props.children}
    </Button>
  );
}
