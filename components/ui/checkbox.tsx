// A checkbox: the look (`checkboxLook` and its companions) and the `Checkbox` that wears it.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import { Check, type IconNode, Minus } from 'lucide';
import type { AndroidProps, AnimatedValue, JSX, ViewStyle } from 'nsh';
import { reduceMotion, split, View } from 'nsh';
import {
  Checkbox as BaseCheckbox,
  type CheckboxProps as BaseCheckboxProps,
} from 'nsh/base';

import { AsText } from '../../lib/ui/as-text';
import { joinClass } from '../../lib/ui/class-names';
import { Icon } from '../../lib/ui/icons';
import { type Live, read } from '../../lib/ui/live-value';
import {
  type ChoiceLook,
  choiceLook,
  type Fill,
  HIT_TARGET,
} from '../../lib/ui/look';
import { pressRipple, pressSink } from '../../lib/ui/press';
import { controlSize } from '../../lib/ui/surface';
import {
  alpha,
  colors,
  control,
  dimmed,
  finish,
  focusRing,
  follow,
  isDark,
  rounded,
  shape,
  stateLayerColor,
  stroke,
  terminal,
  TERMINAL_ROW,
  tier,
  tints,
} from '../../lib/ui/theme';

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
}

/** A box's or ring's size: `scale` times the page's; one row high in the
 * terminal, where it is a glyph three Cells wide. */
const dims = (scale = 1) => ({
  control: Math.round(controlSize.control * scale),
  height: terminal ? TERMINAL_ROW : Math.round(controlSize.control * scale),
  check: Math.round(controlSize.check * scale),
});

/**
 * A fill the recipe names, as the style keys it draws: a finish's whole layer (its fill, its shade,
 * its edge), a palette role, or a brand tint.
 */
export const fillOf = (fill: Fill): ViewStyle => {
  switch (fill.kind) {
    case 'finish':
      return { ...finish[fill.role] };
    case 'colour':
      return { backgroundColor: colors[fill.role] };
    case 'tint':
      return { backgroundColor: tints.brand };
  }
};

/** The colour a fill paints, where a part takes one by name (an edge). */
const colourOf = (fill: Fill): string => {
  switch (fill.kind) {
    case 'finish':
      return finish[fill.role].borderColor ?? colors.border;
    case 'colour':
      return colors[fill.role];
    case 'tint':
      return tints.brand;
  }
};

/**
 * The edge's width a choice recipe states: its own number, or the control stroke where it names the
 * scale. Zero where the form draws no edge.
 */
export const choiceEdge = (look: ChoiceLook): number => {
  const width = look.edge?.width ?? 0;
  return typeof width === 'number' ? width : stroke.control;
};

/** The form's corner in points, per tier. */
export const choiceCorner = (look: ChoiceLook): number => look.corner[tier];

/** The fill of a box or ring that is off: spread it after the box's
 * `borderWidth` (a quick setting's icon lights up from it too, under a
 * `ChoiceLight`). Light, the field's well; dark, a step above the card
 * (shadcn's `dark:bg-input/30`) inside an edge a step brighter than a
 * field's, so an empty box still stands out, dimmed too: `disabled`, its
 * edge twice as strong, so the row's half opacity leaves it as strong as an
 * enabled box's (the mark and the label fade, the box stays drawn).
 *
 * Which face, edge and shade a form paints is its recipe's (`choiceLook`): WinUI's flat track
 * face, M3's empty middle with its outline, or the well's own — the library's, whose ground changes
 * with the appearance because no role names "the field under the inset shade". */
export const choiceWell = (o?: {
  disabled?: boolean;
  look?: ChoiceLook;
}): ViewStyle => {
  const look = o?.look ?? choiceLook('well');
  const shade = look.shade === null ? 'none' : finish[look.shade].boxShadow;
  const edge = look.edge === null ? colors.border : colourOf(look.edge.fill);
  if (look.form === 'inset') {
    return {
      ...(look.face === null ? {} : fillOf(look.face)),
      backgroundImage: 'none',
      borderColor: edge,
      boxShadow: shade,
    };
  }
  if (look.form === 'outline') {
    return {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      borderColor: edge,
      boxShadow: shade,
    };
  }
  return isDark()
    ? {
        backgroundColor: alpha(colors.input, 0.3),
        backgroundImage: 'none',
        borderColor: alpha(colors.foreground, o?.disabled ? 0.4 : 0.2),
        boxShadow: shade,
      }
    : {
        backgroundColor: colors.field,
        backgroundImage: 'none',
        borderColor: colors.input,
        boxShadow: shade,
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
        backgroundColor: stateLayerColor(
          'hover',
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
 * the theme's choice recipe (`choiceLook(control().choice)`), its box the icon scale's `md`
 * (16 points with a pointer, 20 on a touch screen), its corner the recipe's (`round`: a circle),
 * sinking to 90% while its row (the `group`) is pressed. `CheckboxMark` fills it.
 */
export function checkboxLook(o?: ChoiceOptions): CheckboxLook {
  return {
    indicatorClass: choiceSink,
    get indicatorStyle(): ViewStyle {
      const { control: box, height } = dims(o?.scale);
      const look = choiceLook(control().choice);
      const corner = Math.round(choiceCorner(look) * (o?.scale ?? 1));
      return {
        width: box,
        height,
        borderRadius: o?.round ? box / 2 : corner,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: choiceEdge(look),
        ...choiceWell({ look, disabled: !!read(o?.disabled) }),
      };
    },
  };
}

/**
 * The fill of a box or ring that is on, over the empty one and covering its edge: it fades in and out
 * as the value changes. Gradients do not interpolate, so the finish fades whole rather than its
 * colors.
 */
export function ChoiceLight(props: {
  on: AnimatedValue;
  radius: number;
  border?: number;
  /** The face the recipe turns over to (`ChoiceLook.checked`); the accent's where it states none. */
  fill?: Fill;
}) {
  const b = props.border ?? stroke.control;
  return (
    <View
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        top: -b,
        left: -b,
        right: -b,
        bottom: -b,
        borderRadius: props.radius,
        borderWidth: stroke.control,
        ...fillOf(props.fill ?? { kind: 'finish', role: 'accent' }),
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
 * spring of its own (`motion.fast`) and grows in from 75%, so a check
 * turning into a dash crosses over on a fill that stays; at once with
 * reduced motion.
 */
export function CheckboxMark(
  props: { mark: CheckboxMarkKind } & ChoiceOptions,
) {
  const { control: box, height, check: checkSize } = dims(props.scale);
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
        size={checkSize}
        tint={colors.primaryForeground}
        weight={MARK_WEIGHT}
      />
    </View>
  );
  const cb = choiceLook(control().choice);
  const border = choiceEdge(cb);
  const innerW = box - 2 * border;
  const innerH = height - 2 * border;
  // One view as large as the box inside its border holds the layers: the
  // slot's content sits in a holder view sized to it, so layers placed only
  // absolutely made it 0 × 0 and the fill a speck at the box's middle.
  return (
    <View style={{ width: innerW, height: innerH }}>
      {cb.target !== null ? (
        <ChoiceTarget
          target={Math.round(HIT_TARGET * (props.scale ?? 1))}
          innerW={innerW}
          innerH={innerH}
          checked={!!props.mark}
        />
      ) : null}
      <ChoiceLight
        on={on}
        radius={
          props.round
            ? box / 2
            : Math.round(choiceCorner(cb) * (props.scale ?? 1))
        }
        border={border}
        fill={cb.checked ?? undefined}
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
  readonly android?: AndroidProps;
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
        backgroundColor: on ? tints.brand : colors.raised,
        boxShadow: on ? 'none' : finish.raised.boxShadow,
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
      return { opacity: dimmed.disabled };
    },
    get android(): AndroidProps | undefined {
      return pressRipple(
        lit() ? 'accent-foreground' : 'foreground',
        o?.disabled,
      );
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
    'indicatorClass',
    'indicatorStyle',
    'indicator',
  ]);
  const scale = choiceScales[props.size ?? 'default'];
  const options: ChoiceOptions = {
    scale,
    round: props.round,
    disabled: () => !!props.disabled,
  };
  const look = checkboxLook(options);
  return (
    <BaseCheckbox
      {...rest}
      class={joinClass('group', props.class)}
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
