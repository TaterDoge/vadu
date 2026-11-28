// A checkbox: the look (`checkboxLook` and its companions) and the `Checkbox` that wears it.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import { Check, type IconNode, Minus } from 'lucide';
import type { AnimatedValue, JSX, ViewStyle } from 'nsh';
import { reduceMotion, split, View } from 'nsh';
import {
  Checkbox as BaseCheckbox,
  type CheckboxProps as BaseCheckboxProps,
} from 'nsh/base';

import { Icon } from '../../lib/ui/icons';
import { pressSink } from '../../lib/ui/motion';
import {
  colors,
  control,
  feedback,
  focusRing,
  follow,
  metrics,
  press,
  rounded,
  shape,
  stroke,
  surface,
  terminal,
  TERMINAL_ROW,
  tints,
} from '../../lib/ui/theme';
import type { ResolvedControlMap } from '../../lib/ui/theme';
import { AsText, joinClass, type Live, read } from '../../lib/ui/utils';

/** A choice control resolved recipe (`control("choice")`). */
export type ChoiceLook = ResolvedControlMap['choice'];

/** What a checkbox's box shows: a check, a dash (indeterminate) or nothing. */
export type CheckboxMarkKind = 'check' | 'dash' | null;

/** Options of `checkboxLook` and `CheckboxMark`; a radio's ring takes the same `scale` and `disabled`. */
export interface ChoiceOptions {
  /** Times the page's size (`controlSize.control`): 0.8, 1 or 1.25 (`ChoiceSize`'s `sm`,
   * `default`, `lg`). */
  scale?: number;
  /** A round box (a task's, as reminders draw it). */
  round?: boolean;
  /** Disabled, as the control is (`checkboxLook`): its edge stays drawn under the row's half opacity in dark. A
   * function is read where the look is applied. */
  disabled?: Live<boolean>;
  /** True while checked or indeterminate, so the resting unchecked border does not bleed around `ChoiceLight`. */
  lit?: Live<boolean>;
}

/** A box's or ring's size: `scale` times the page's; one row high in the
 * terminal, where it is a glyph three Cells wide. */
const dims = (scale = 1) => ({
  control: Math.round(control('choice').box * scale),
  height: terminal ? TERMINAL_ROW : Math.round(control('choice').box * scale),
  check: Math.round((terminal ? 12 : metrics.icon.sm) * scale),
});

/** The choice resting recipe, read where the control is drawn so it follows `selectTheme`. */
export const choiceLook = (): ChoiceLook => control('choice');

/** The choice corner in points. */
export const choiceCorner = (look: ChoiceLook): number => look.corner;

/**
 * The edge's width a choice states: its own points, zero where the theme draws no edge.
 */
export const choiceEdge = (look: ChoiceLook): number => look.edgeWidth;

/**
 * The fill of a box or ring that is off, as the theme's `choice.*` slots state it: a face where it
 * paints that layer, an edge in the colour the theme gives (a stronger one on a disabled box), and
 * the `boxShadow` of the finish its face hangs off. An empty box still stands out: light, the
 * field's well; dark, a step above the card (`color:input@0.3` in the base theme's slots).
 */
export const choiceWell = (o?: {
  disabled?: boolean;
  look?: ChoiceLook;
}): ViewStyle => {
  const look = o?.look ?? choiceLook();
  return {
    backgroundColor: look.face ?? 'transparent',
    backgroundImage: 'none',
    borderColor:
      (o?.disabled === true ? look.disabledEdgeColor : look.edgeColor) ??
      'transparent',
    boxShadow: look.shadeShadow,
  };
};

/**
 * Centered circular state-layer halo for M3 checkboxes and radios (40dp target around 18dp/20dp indicator).
 * Zero layout impact and opacity 0 at rest; lights up with theme hover overlay on group hover/press.
 */
export function ChoiceTarget(props: {
  target: number;
  innerW: number;
  innerH: number;
  checked: boolean;
}) {
  return (
    <View
      class="pointer-events-none rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-active:opacity-100 motion-reduce:transition-none"
      style={{
        position: 'absolute',
        width: props.target,
        height: props.target,
        start: (props.innerW - props.target) / 2,
        top: (props.innerH - props.target) / 2,
        backgroundColor: feedback.hoverLayerColor(
          props.checked ? 'primary' : 'foreground',
        ),
      }}
    />
  );
}

/** A layer over the whole of its parent, its content centered: layers that cross over in place. */
const centered = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/**
 * The press feedback of a box or a ring: it sinks to 90% while its row is
 * pressed (the row is the `group`: give it `class="group"`), and eases back;
 * still with reduced motion.
 */
export const choiceSink =
  'transition-transform duration-150 ease-out group-active:scale-90 motion-reduce:transition-none';

/** The props `checkboxLook` gives a `Checkbox`'s indicator. */
export interface CheckboxLook {
  readonly indicatorClass: string;
  readonly indicatorStyle: ViewStyle;
}

/**
 * A checkbox's box, as the props of `Checkbox`'s indicator (spread them:
 * `<Checkbox class="group" {...checkboxLook()} indicator={<CheckboxMark mark={..} />}>`):
 * the theme's choice slots (`choiceLook()`), its box `choice.box` (16 points
 * with a pointer, 20 on a touch screen, unless the theme states its own), its
 * corner the recipe's (`round`: a circle),
 * sinking to 90% while its row (the `group`) is pressed. `CheckboxMark` fills it.
 */
export function checkboxLook(o?: ChoiceOptions): CheckboxLook {
  /** A box whose chosen face is a palette colour turns its edge to that colour as it is chosen
   * (`choice.checked.face`, an edge equal to the fill): the fill sits inside the edge, so an edge
   * left in the empty box's colour would ring it. A class, so the indicator's `checked` state drives it. */
  const lit = () => read(o?.lit);
  return {
    get indicatorClass(): string {
      return press.scale < 1 ? choiceSink : '';
    },
    get indicatorStyle(): ViewStyle {
      const { control: box, height } = dims(o?.scale);
      const look = choiceLook();
      const corner = Math.round(choiceCorner(look) * (o?.scale ?? 1));
      return {
        width: box,
        height,
        borderRadius: o?.round ? box / 2 : corner,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: choiceEdge(look),
        ...choiceWell({ look, disabled: !!read(o?.disabled) }),
        ...(lit() && !read(o?.disabled) && look.checkedStyle !== null
          ? { borderColor: 'transparent' }
          : {}),
      };
    },
  };
}

/** A face that states no edge colour, or a transparent one, over a solid background. */
const edgeless = (face: ViewStyle): boolean =>
  typeof face.backgroundColor === 'string' &&
  (face.borderColor === undefined || face.borderColor === 'transparent');

/**
 * The fill of a box or ring that is on, over the empty one and covering its edge: it fades in and out
 * as the value changes. Gradients do not interpolate, so the finish fades whole rather than its
 * colors.
 */
export function ChoiceLight(props: {
  on: AnimatedValue;
  radius: number;
  border?: number;
  /** The face the recipe turns over to (`ChoiceLook.checkedStyle`); the accent where it states none. */
  fill?: ViewStyle | null;
}) {
  const b = () => props.border ?? stroke.control;
  const face = () => props.fill ?? surface('accent').style;
  return (
    <View
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        top: -b(),
        left: -b(),
        right: -b(),
        bottom: -b(),
        borderRadius: props.radius,
        borderWidth: stroke.control,
        ...face(),
        // A face with no edge of its own (a colour, or a finish whose edge is transparent) fills its
        // edge too: a transparent ring would let the empty box's edge show round the fill.
        ...(edgeless(face()) ? { borderColor: face().backgroundColor } : {}),
        opacity: props.on,
      }}
    />
  );
}

/** The stroke of a checkbox's check and dash (about 2 points at the desktop
 * size): the bold pen of every check that marks something done. */
const MARK_WEIGHT = 3.84;

/**
 * What a checkbox's box shows (its `indicator`): citrus with a check or a
 * dash, drawn with the same bold pen. Each part follows the value on a
 * timing of its own (`motion.fast`) and grows in from 75%, so a check
 * turning into a dash crosses over on a fill that stays; at once with
 * reduced motion.
 */
export function CheckboxMark(
  props: { mark: CheckboxMarkKind } & ChoiceOptions,
) {
  const look = () => choiceLook();
  const d = () => dims(props.scale);
  const border = () => choiceEdge(look());
  const innerW = () => d().control - 2 * border();
  const innerH = () => d().height - 2 * border();
  const radius = () =>
    props.round
      ? d().control / 2
      : Math.round(choiceCorner(look()) * (props.scale ?? 1));
  // Each part stays mounted while it fades out (unmounting it on the value
  // showed only the fade in).
  const on = follow(() => (props.mark ? 1 : 0));
  const check = follow(() => (props.mark === 'check' ? 1 : 0));
  const dash = follow(() => (props.mark === 'dash' ? 1 : 0));
  /** A mark: centered in the box, growing a little as it fades in. */
  const glyph = (amount: AnimatedValue, icon: IconNode) => (
    <View
      style={{
        ...centered,
        pointerEvents: 'none',
        opacity: amount,
        transform: [
          {
            scale: amount.interpolate({
              inputRange: [0, 1],
              outputRange: [0.75, 1],
            }),
          },
        ],
      }}
    >
      <Icon
        icon={icon}
        size={d().check}
        tint={surface('accent').ink}
        weight={MARK_WEIGHT}
      />
    </View>
  );
  // One view as large as the box inside its border holds the layers: the
  // slot's content sits in a holder view sized to it, so layers placed only
  // absolutely made it 0 × 0 and the fill a speck at the box's middle.
  return (
    <View style={{ width: innerW(), height: innerH() }}>
      <ChoiceLight
        on={on}
        // `ChoiceLight` expands over the indicator's border (`top/left/right/bottom: -b`), so it
        // wears the outer box's corner radius rather than subtracting `border`.
        radius={radius()}
        border={border()}
        fill={look().checkedStyle}
      />
      {glyph(check, Check)}
      {glyph(dash, Minus)}
    </View>
  );
}

/**
 * A choice control's size: what a checkbox's box or a radio's ring is drawn at, `sm` 0.8,
 * `default` 1, `lg` 1.25 times the page's control size. The look takes the number
 * (`ChoiceOptions.scale`); this is the shell's word for it.
 */
export type ChoiceSize = 'sm' | 'default' | 'lg';

/** What a `ChoiceSize` multiplies the page's control size by: 0.8, 1, 1.25. */
export const choiceScales: Record<ChoiceSize, number> = {
  sm: 0.8,
  default: 1,
  lg: 1.25,
};

/** Options of `choiceTileLook`. */
export interface ChoiceTileOptions {
  /** No hover and no press; dimmed to half. Pass the same value to the control's `disabled`. */
  disabled?: Live<boolean | undefined>;
  /** More style (a width, a gap), over the card's. */
  style?: Live<ViewStyle | undefined>;
}

/** The props `choiceTileLook` gives a choice card. */
export interface ChoiceTileLook {
  readonly style: ViewStyle;
  readonly hoverStyle: ViewStyle | undefined;
  readonly activeStyle: ViewStyle;
  readonly focusVisibleStyle: ViewStyle;
  readonly disabledStyle: ViewStyle;
}

/**
 * A choice card, whose whole surface is the checkbox or radio (spread it:
 * `<Checkbox {...choiceTileLook(() => on())} indicator={<CheckboxMark … />}>`, or
 * `<Radio {...choiceTileLook(() => on())}>`, the ring or box in its corner;
 * `on` is read where the look is applied, so a spread follows it): raised
 * while off, its edge the faint text color under the pointer; edged in the
 * accent over its tint while on, the change faded. It sinks to 97% while
 * pressed, natively (`pressSink`). Cards share a row (`flex: 1`).
 */
export function choiceTileLook(
  on: Live<boolean>,
  o?: ChoiceTileOptions,
): ChoiceTileLook {
  const sink = pressSink(0.97);
  const lit = () => !!read(on);
  return {
    get style(): ViewStyle {
      const on = lit();
      return {
        flex: 1,
        minWidth: 0,
        padding: 12,
        paddingTop: 14,
        ...rounded(shape.control),
        borderWidth: stroke.control,
        borderColor: on ? colors.brand : colors.border,
        backgroundColor: on ? tints.brand : colors.surface,
        boxShadow: on ? 'none' : surface('raised').style.boxShadow,
        transitionProperty:
          'transform, border-color, background-color, box-shadow',
        transitionDuration: reduceMotion() ? 0 : 150,
        transitionTimingFunction: 'ease-out',
        ...(read(o?.style) ?? {}),
      };
    },
    get hoverStyle(): ViewStyle | undefined {
      return read(o?.disabled) || lit()
        ? undefined
        : { borderColor: colors.faint };
    },
    get activeStyle(): ViewStyle {
      return sink.activeStyle;
    },
    get focusVisibleStyle(): ViewStyle {
      return focusRing();
    },
    get disabledStyle(): ViewStyle {
      return { opacity: feedback.disabled.contentOpacity };
    },
  };
}

/** The mark a checkbox's props show: a dash while it is indeterminate, a check when it is checked. */
const markOf = (
  props: Pick<BaseCheckboxProps, 'checked' | 'indeterminate'>,
): CheckboxMarkKind =>
  props.indeterminate ? 'dash' : props.checked ? 'check' : null;

/**
 * `nsh/base`'s Checkbox in the look of `checkboxLook`. Every base prop passes through; the
 * indicator props go over the look's. A string child is the label; anything else is drawn as given.
 */
export type CheckboxProps = Omit<BaseCheckboxProps, 'children'> & {
  /** `sm` (0.8), `default` (1) or `lg` (1.25) times the page's control size. */
  size?: ChoiceSize;
  /** A round box (a task's, as reminders draw it). */
  round?: boolean;
  /** A string is the label; anything else is drawn as given. A string label is also the
   * checkbox's name for screen readers, unless `accessibilityLabel` says otherwise. */
  children?: string | JSX.Element;
};

/** A checkbox. The row is the `group` the box sinks with while pressed. */
export function Checkbox(props: CheckboxProps) {
  const [, rest] = split(props, [
    'size',
    'round',
    'children',
    'class',
    'focusVisibleStyle',
    'disabledStyle',
    'indicatorClass',
    'indicatorStyle',
    'indicator',
  ]);
  const scale = choiceScales[props.size ?? 'default'];
  const options: ChoiceOptions = {
    scale,
    round: props.round,
    disabled: () => !!props.disabled,
    lit: () => !!markOf(props),
  };
  const look = checkboxLook(options);
  return (
    <BaseCheckbox
      {...rest}
      class={joinClass('group', props.class)}
      focusVisibleStyle={[focusRing(), props.focusVisibleStyle ?? null]}
      disabledStyle={
        props.disabledStyle ?? { opacity: feedback.disabled.contentOpacity }
      }
      indicatorClass={joinClass(look.indicatorClass, props.indicatorClass)}
      indicatorStyle={[look.indicatorStyle, props.indicatorStyle ?? null]}
      indicator={
        props.indicator ?? (
          <CheckboxMark
            // Read here, where the mark is made, so it follows a value the app changes.
            mark={markOf(props)}
            scale={scale}
            round={props.round}
          />
        )
      }
    >
      {/* The page's ink, read here so it follows the appearance: a bare Text is nsh's black. */}
      <AsText style={{ color: colors.foreground }}>{props.children}</AsText>
    </BaseCheckbox>
  );
}
