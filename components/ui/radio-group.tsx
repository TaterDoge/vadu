// A radio group: the look (`RadioRing`) and the `Radio` / `RadioGroup` that wear it.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { JSX, ViewStyle } from 'nsh';
import { split, View } from 'nsh';
import {
  Radio as BaseRadio,
  RadioGroup as BaseRadioGroup,
  type RadioGroupProps as BaseRadioGroupProps,
  type RadioProps as BaseRadioProps,
} from 'nsh/base';

import {
  colors,
  feedback,
  follow,
  press,
  terminal,
  TERMINAL_ROW,
} from '../../lib/ui/theme';
import { AsText, joinClass } from '../../lib/ui/utils';
import {
  choiceEdge,
  ChoiceLight,
  choiceLook,
  choiceScales,
  choiceSink,
  type ChoiceSize,
  choiceTileLook,
  choiceWell,
} from './checkbox';

/**
 * A radio's ring, among the `Radio`'s children (give the radio `class="group"`, so the ring
 * responds to row hover/press): outer diameter, dot diameter, stroke, interior well, whether the
 * face turns over or the ring stays a ring, and its mark all come from the theme's choice recipe
 * (`control("choice")`), read here so the ring follows `selectTheme`.
 */
export function RadioRing(props: {
  on: boolean;
  scale?: number;
  disabled?: boolean;
}) {
  const scale = props.scale ?? 1;
  const look = () => choiceLook();
  const size = () => Math.round(look().box * scale);
  const height = () => (terminal ? TERMINAL_ROW : size());
  /** The dot: the mark the theme draws inside the ring, at this tier. */
  const dot = () => Math.round(look().mark * scale);
  const border = () => choiceEdge(look());
  /** A theme that leaves the box empty draws its mark as the ring itself, and keeps the edge while on. */
  const ringOnly = () => look().radioCheckedStyle === null;
  const wellStyle = () =>
    choiceWell({ look: look(), disabled: props.disabled });
  const ringBorderColor = () => {
    if (props.on && !ringOnly() && !props.disabled) return 'transparent';
    if (ringOnly() && props.on) return colors.primary;
    return wellStyle().borderColor ?? colors.border;
  };
  const on = follow(() => (props.on ? 1 : 0));
  const dotStyle = (): ViewStyle => ({
    width: dot(),
    height: dot(),
    borderRadius: dot() / 2,
    backgroundColor: ringOnly() ? colors.primary : colors.primaryForeground,
    opacity: on,
    transform: [
      { scale: on.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
    ],
  });
  return (
    <View
      class={press.scale < 1 ? choiceSink : undefined}
      style={{
        width: size(),
        height: height(),
        borderRadius: size() / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: border(),
        ...wellStyle(),
        borderColor: ringBorderColor(),
      }}
    >
      {look().radioCheckedStyle === null ? null : (
        <ChoiceLight
          on={on}
          radius={size() / 2}
          border={border()}
          fill={look().radioCheckedStyle}
        />
      )}
      <View style={dotStyle()} />
    </View>
  );
}

/**
 * `nsh/base`'s RadioGroup. Every base prop passes through.
 */
export type RadioGroupProps = BaseRadioGroupProps;

/** A radio group's root. The app owns which option is checked. */
export function RadioGroup(props: RadioGroupProps) {
  return <BaseRadioGroup {...props} />;
}

/** A radio's variants: `default` a sunk ring, `tile` the whole surface the control. */
export type RadioVariant = 'default' | 'tile';

/**
 * `nsh/base`'s Radio in the look of `RadioRing` (or `choiceTileLook` when `variant` is `tile`).
 * Every base prop passes through; the style props go over the look's. A string child is the label.
 */
export type RadioProps = Omit<BaseRadioProps, 'children'> & {
  /** Default `default`: a sunk ring beside the label. `tile`: the whole surface is the control. */
  variant?: RadioVariant;
  /**
   * Its ring ahead of the label (the default). `false` draws only what the radio's props
   * and children give it: a segment of a `segmentedLook` track (`segmentedLook().segment`
   * for the radio, its `thumbStyle` as the checked style, its `label` for the text), where
   * the track and the thumb are the control.
   */
  indicator?: boolean;
  /** `sm` (0.8), `default` (1) or `lg` (1.25) times the page's control size. */
  size?: ChoiceSize;
  /** A string is the label; anything else is drawn as given. A string label is also the
   * radio's name for screen readers, unless `accessibilityLabel` says otherwise. */
  children?: string | JSX.Element;
};

/** One option in a `RadioGroup` (shadcn `RadioGroupItem`). The ring sits ahead of the label. */
export function Radio(props: RadioProps) {
  const [, rest] = split(props, [
    'variant',
    'indicator',
    'size',
    'children',
    'class',
    'style',
    'hoverStyle',
    'activeStyle',
    'focusVisibleStyle',
    'disabledStyle',
  ]);
  const tile = props.variant === 'tile';
  const scale = choiceScales[props.size ?? 'default'];
  const look = tile
    ? choiceTileLook(() => !!props.checked, {
        disabled: () => !!props.disabled,
      })
    : undefined;
  return (
    <BaseRadio
      {...rest}
      class={joinClass('group', props.class)}
      style={[look?.style ?? null, props.style ?? null]}
      hoverStyle={[look?.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look?.activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look ? look.focusVisibleStyle : feedback.focusRing(),
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={
        look
          ? [look.disabledStyle, props.disabledStyle ?? null]
          : (props.disabledStyle ?? {
              opacity: feedback.disabled.contentOpacity,
            })
      }
    >
      <If when={props.indicator ?? true}>
        <RadioRing
          on={!!props.checked}
          scale={scale}
          disabled={!!props.disabled}
        />
      </If>
      {/* The page's ink, read here so it follows the appearance: a bare Text is nsh's black. */}
      <AsText style={{ color: colors.foreground }}>{props.children}</AsText>
    </BaseRadio>
  );
}

/** shadcn name for {@link Radio}. */
export const RadioGroupItem = Radio;
