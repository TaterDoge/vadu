// A number input: the well, its text and its step buttons (`numberInputClasses`, `numberInputText`,
// `numberInputSteps`) and the `NumberInput` that wears them.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import { ChevronDown, ChevronUp, type IconNode, Minus, Plus } from 'lucide';
import type { InputStyle, ViewStyle } from 'nsh';
import { platform, signal, split, Text } from 'nsh';
import {
  NumberInput as BaseNumberInput,
  type NumberInputProps as BaseNumberInputProps,
} from 'nsh/base';

import {
  fieldCornerClass,
  fieldDrawn,
  fieldEdgeClass,
} from '../../lib/ui/field-look';
import { Icon } from '../../lib/ui/icons';
import { colors, control, terminal } from '../../lib/ui/theme';
import { type Live } from '../../lib/ui/utils';
import { edgeClass, fieldLook as fieldWellLook, fieldSize } from './input';

const pointer = platform.desktop;

/** The step buttons' feedback: lit under the pointer, darker while pressed, faded where a step does nothing. */
const press = terminal
  ? 'justify-center disabled:opacity-50'
  : 'items-center justify-center transition-colors duration-100 motion-reduce:transition-none enabled:hover:bg-accent active:bg-surface disabled:opacity-50';

/**
 * A number input's parts as classes (`NumberInput`'s `class` and its
 * buttons'): `frame` the well (32 high with a pointer, 44 on a touch
 * screen; a stronger edge under the pointer, the focus edge while its field
 * edits), `stepBefore` / `stepAfter` − before the field and + after it,
 * `pair` / `pairButton` the increment over the decrement at the well's end.
 * `width` is a button's width class (`w-8`). In a terminal the input is one band
 * a row high, its steppers at the band's end.
 */
export const numberInputClasses = {
  /** The well: its corners and edge are the theme's field, read where it is drawn. */
  get frame(): string {
    if (terminal) return 'h-4 flex-row items-stretch pl-2 disabled:opacity-50';
    const field = fieldDrawn(control('field'));
    return [
      pointer ? 'h-8' : 'h-11',
      fieldCornerClass(field),
      'flex-row items-stretch overflow-hidden',
      fieldEdgeClass(field),
      edgeClass({
        rest: 'border-input',
        hover: 'border-faint',
        hoverVariant: 'enabled:hover',
      }),
    ].join(' ');
  },
  press,
  stepBefore: (width: string) => `${width} ${press} border-r border-line`,
  stepAfter: (width: string) => `${width} ${press} border-l border-line`,
  pair: (width: string) => `${width} border-l border-line`,
  pairButton: (top: boolean) =>
    `flex-1 ${press}${top ? ' border-b border-line' : ''}`,
};

/**
 * A number input's frame props (`style`, `hoverStyle`, `focusWithinStyle`, `disabledStyle`, and
 * `class` in a terminal): aligns the well with the field's recipe so step buttons share the theme's
 * field fill, corners, edge widths, and smooth focus halo.
 */
export function numberInputLook(o?: {
  disabled?: Live<boolean>;
  focused?: Live<boolean>;
}) {
  if (terminal) {
    return {
      get class(): string {
        return numberInputClasses.frame;
      },
      // The band's ground, which a class cannot name (`colors.field` became the field's recipe).
      style: { backgroundColor: control('field').ground } as ViewStyle,
      hoverStyle: undefined as ViewStyle | undefined,
      focusWithinStyle: undefined as ViewStyle | undefined,
      disabledStyle: undefined as ViewStyle | undefined,
    };
  }
  return fieldWellLook({
    disabled: o?.disabled,
    focused: o?.focused,
    style: () => ({
      height: fieldSize.height,
      alignItems: 'stretch',
      overflow: 'hidden',
    }),
  });
}

/** A number input's field (`inputStyle`): the label size, tabular figures; at the end of a terminal's band, as a column of numbers reads. */
export function numberInputText(): InputStyle {
  return {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    fontSize: fieldSize.font,
    color: colors.foreground,
    placeholderColor: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
    ...(terminal ? { textAlign: 'right' as const } : {}),
  };
}

/** A step button's text glyph in a terminal, which draws no icons. */
const stepGlyphs = new Map<IconNode, string>([
  [Plus, '+'],
  [Minus, '−'],
]);

/** A step button's glyph: the icon in the muted text color; a terminal's text glyph. */
export function NumberStep(props: { icon: IconNode; size: number }) {
  const glyph = terminal ? stepGlyphs.get(props.icon) : undefined;
  if (glyph)
    return <Text style={{ color: colors.mutedForeground }}>{glyph}</Text>;
  return (
    <Icon icon={props.icon} size={props.size} tint={colors.mutedForeground} />
  );
}

/**
 * A number input's step buttons (spread them on `NumberInput`): − before
 * the field and + after it (`split`), or a pair of chevrons at the well's
 * end (`pair`); in a terminal always − and + at the band's end, each in a
 * slot of three Cells. `width` is a button's width class, `glyphSize` its glyph's size.
 */
export function numberInputSteps(
  kind: 'split' | 'pair',
  width: string,
  glyphSize: number,
) {
  if (terminal) {
    return {
      controlsRight: true,
      controlsClass: 'flex-row',
      decrementButtonClass: `w-6 shrink-0 flex-row items-center ${press}`,
      incrementButtonClass: `w-6 shrink-0 flex-row items-center ${press}`,
      decrementButton: <NumberStep icon={Minus} size={glyphSize} />,
      incrementButton: <NumberStep icon={Plus} size={glyphSize} />,
    };
  }
  if (kind === 'split') {
    return {
      decrementButtonClass: numberInputClasses.stepBefore(width),
      incrementButtonClass: numberInputClasses.stepAfter(width),
      decrementButton: <NumberStep icon={Minus} size={glyphSize} />,
      incrementButton: <NumberStep icon={Plus} size={glyphSize} />,
    };
  }
  // A chevron at a plus's size reads larger: the pair's glyphs are two points smaller.
  const chevron = glyphSize - 2;
  return {
    controlsRight: true,
    controlsClass: numberInputClasses.pair(width),
    incrementButtonClass: numberInputClasses.pairButton(true),
    decrementButtonClass: numberInputClasses.pairButton(false),
    incrementButton: <NumberStep icon={ChevronUp} size={chevron} />,
    decrementButton: <NumberStep icon={ChevronDown} size={chevron} />,
  };
}

/**
 * `nsh/base`'s NumberInput in the look of `numberInputClasses` / `numberInputSteps`. Every base
 * prop passes through; `class`, `inputStyle` and the step props go over the look's.
 */
export type NumberInputProps = BaseNumberInputProps & {
  /** Default `pair`: chevrons at the end. `split`: − before the field and + after it. */
  steps?: 'split' | 'pair';
};

/** A number field with step buttons. */
export function NumberInput(props: NumberInputProps) {
  const [, rest] = split(props, [
    'steps',
    'class',
    'style',
    'hoverStyle',
    'focusWithinStyle',
    'disabledStyle',
    'onFocus',
    'onBlur',
    'inputStyle',
    'controlsRight',
    'controlsClass',
    'decrementButtonClass',
    'incrementButtonClass',
    'decrementButton',
    'incrementButton',
  ]);
  const focused = signal(false);
  const look = numberInputLook({
    disabled: () => !!props.disabled,
    focused: () => focused(),
  });
  const kind = props.steps ?? 'pair';
  // Upstream's widths: a pair of chevrons sits in a narrower lane (`w-6` / `w-9`) than a − and
  // + either side of the field (`w-8` / `w-11`).
  const lanes =
    kind === 'pair'
      ? { desktop: 'w-6', touch: 'w-9' }
      : { desktop: 'w-8', touch: 'w-11' };
  const width = pointer ? lanes.desktop : lanes.touch;
  const glyphSize = pointer ? 14 : 16;
  const buttons = numberInputSteps(kind, width, glyphSize);
  const cls = () =>
    look.class
      ? props.class
        ? `${look.class} ${props.class}`
        : look.class
      : props.class;
  return (
    <BaseNumberInput
      {...rest}
      onFocus={() => {
        focused.set(true);
        props.onFocus?.();
      }}
      onBlur={() => {
        focused.set(false);
        props.onBlur?.();
      }}
      class={cls()}
      style={[look.style ?? null, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      focusWithinStyle={[
        look.focusWithinStyle ?? null,
        props.focusWithinStyle ?? null,
      ]}
      disabledStyle={[look.disabledStyle ?? null, props.disabledStyle ?? null]}
      inputStyle={[numberInputText(), props.inputStyle ?? null]}
      controlsRight={props.controlsRight ?? buttons.controlsRight}
      controlsClass={props.controlsClass ?? buttons.controlsClass}
      decrementButtonClass={
        props.decrementButtonClass ?? buttons.decrementButtonClass
      }
      incrementButtonClass={
        props.incrementButtonClass ?? buttons.incrementButtonClass
      }
      decrementButton={props.decrementButton ?? buttons.decrementButton}
      incrementButton={props.incrementButton ?? buttons.incrementButton}
    />
  );
}
