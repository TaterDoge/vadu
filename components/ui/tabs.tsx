// Tabs: the looks (`tabsLook`, `underlineTabsLook`, `TabTitle`) and the parts that wear them.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { IconNode } from 'lucide';
import type { JSX, StyleProp, ViewStyle } from 'nsh';
import { computed, context, platform, signal, split, Text, View } from 'nsh';
import {
  Tab as BaseTab,
  type TabProps as BaseTabProps,
  Tabs as BaseTabs,
  type TabsProps as BaseTabsProps,
} from 'nsh/base';

import { Icon } from '../../lib/ui/icons';
import { controlSize } from '../../lib/ui/surface';
import {
  CAPSULE_RADIUS,
  colors,
  control,
  feedback,
  follow,
  font,
  motion,
  rounded,
  shape,
  stroke,
  surface,
  terminal,
} from '../../lib/ui/theme';
import { type Live, read } from '../../lib/ui/utils';

const pointer = platform.desktop;

/** The state of one tab or segment, read where the look is applied. */
export interface TabState {
  selected: Live<boolean | undefined>;
  disabled?: Live<boolean | undefined>;
}

/** The props a tab's or segment's look gives it (a `Tab`, a `Radio`). */
export interface TabLook {
  readonly style: ViewStyle;
  readonly hoverStyle: ViewStyle | undefined;
  readonly activeStyle?: ViewStyle;
  readonly focusVisibleStyle: ViewStyle;
  readonly disabledStyle: ViewStyle;
}

/**
 * Under the pointer, a tab that is neither selected (its thumb shows) nor disabled. Exported for the
 * segmented control, which wears a `TabLook` and marks its own selected segment the same way.
 */
export const hoverOf = (state: TabState) =>
  read(state.selected) || read(state.disabled)
    ? undefined
    : feedback.hoverStyle();

/** Options of `tabsLook`. */
export interface TabsLookOptions {
  /** Span the strip, the tabs sharing its width (always on a touch screen). */
  fill?: Live<boolean>;
}

/** Whether a strip spans the row: on a touch screen, or with `fill`. */
const spreadOf = (o?: TabsLookOptions) => !pointer || !!read(o?.fill);

/**
 * A tab strip's look: a track `controlSize.tabs` high (the theme's tallest control) sunk into the
 * surface with a hairline edge, and the selected tab a capsule inside it reading `surface("plate")`
 * (the theme's labelled block chosen inside a well), the mark and the track concentric — the
 * capsule one step inside the track's capsule. The track is as wide as its tabs with a pointer,
 * the tabs at their labels; `fill` spans the row, the tabs sharing it (as a touch screen always
 * does). The mark springs to the next one natively, and a tab's own box is the mark's, so the
 * pointer's hover lands exactly where the mark does. `tab(state)`: a tab's props (hover on the
 * others, the focus ring, dimmed while disabled). Pair each tab with a `TabTitle`.
 */
export function tabsLook(o?: TabsLookOptions) {
  // The track's padding, and the room the mark keeps inside it: both the same step, so a tab's own
  // box is the mark's box — the one the pointer's hover paints.
  const inset = 3;
  // The track's corner, and the mark's one step inside it — concentric: `tabs.track.corner` (`full`
  // snaps to half the strip's height), with the curve the theme states for corners (`shape.curve`).
  const radius = () => {
    const c = control('tabs').corner;
    return c === CAPSULE_RADIUS ? controlSize.tabs / 2 : c;
  };
  const corners = (step = 0) => rounded(radius(), step);
  const plate = () => surface('plate').style;
  const plateBorderWidth = () => {
    const edge = plate().borderColor;
    return edge === undefined || edge === 'transparent' ? 0 : stroke.control;
  };
  return {
    get style(): ViewStyle {
      const track = control('tabs');
      return {
        height: controlSize.tabs,
        flexDirection: 'row',
        alignSelf: spreadOf(o) ? 'stretch' : 'flex-start',
        gap: 2,
        padding: inset,
        ...corners(),
        borderWidth: track.edge === null ? 0 : stroke.control,
        borderColor: track.edge ?? 'transparent',
        backgroundColor: track.face ?? 'transparent',
        boxShadow: surface('inset').style.boxShadow,
      };
    },
    get indicatorStyle(): ViewStyle {
      return {
        // The mark spans the selected tab along the row itself; across it, the track's own padding and
        // this inset are the same step, so the mark takes exactly the tab's box — the one the
        // pointer's hover paints.
        top: inset,
        bottom: inset,
        ...corners(inset),
        borderWidth: plateBorderWidth(),
        ...plate(),
      };
    },
    tab(state: TabState): TabLook {
      return {
        get style(): ViewStyle {
          return {
            ...(spreadOf(o) ? { flex: 1 } : { flexShrink: 0 }),
            // The mark's side pad: the same fixed 8 as the underlined strip's (§12 M7).
            paddingHorizontal: TAB_PAD,
            ...corners(inset),
            borderWidth: plateBorderWidth(),
            borderColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          };
        },
        get hoverStyle() {
          return hoverOf(state);
        },
        get focusVisibleStyle() {
          return feedback.focusRing();
        },
        get disabledStyle(): ViewStyle {
          return { opacity: feedback.disabled.contentOpacity };
        },
      };
    },
  };
}

/** The pad at a tab's sides. */
const TAB_PAD = 8;

/** The line an underlined strip draws: 2 points, the accent, over the whole tab. */
const TAB_LINE = 2;

/**
 * An underlined tab strip's look: tabs as wide as their labels
 * (`controlSize.tabs` high), a 2-point accent line (`indicatorStyle`) at the
 * strip's bottom that travels and stretches to the selected tab, over a
 * hairline (`rule`, a view under the strip: outside a scroll view holding
 * it, so its clipping never cuts the line). `tab(state)`: a tab's props
 * (hover on the others, a press that dims, the focus ring, dimmed while
 * disabled).
 */
export function underlineTabsLook() {
  return {
    get style(): ViewStyle {
      return { flexDirection: 'row', gap: 2, paddingTop: 3 };
    },
    get indicatorStyle(): ViewStyle {
      return {
        bottom: 0,
        height: TAB_LINE,
        borderRadius: TAB_LINE / 2,
        backgroundColor: colors.brand,
      };
    },
    get rule(): ViewStyle {
      return {
        pointerEvents: 'none',
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: stroke.hairline,
        backgroundColor: colors.line,
      };
    },
    tab(state: TabState): TabLook {
      return {
        get style(): ViewStyle {
          return {
            height: controlSize.tabs,
            paddingHorizontal: TAB_PAD,
            marginBottom: 4,
            ...rounded(shape.control),
            borderWidth: stroke.control,
            borderColor: 'transparent',
            justifyContent: 'center',
          };
        },
        get hoverStyle() {
          return hoverOf(state);
        },
        get activeStyle(): ViewStyle {
          return { opacity: feedback.passive.pressedOpacity };
        },
        get focusVisibleStyle() {
          return feedback.focusRing();
        },
        get disabledStyle(): ViewStyle {
          return { opacity: feedback.disabled.contentOpacity };
        },
      };
    },
  };
}

/** A tab title's icon: 14 points square. */
const TAB_ICON = 14;

/** The room a tab title's icon takes: the icon and the gap after it. */
export const TAB_ICON_ROOM = TAB_ICON + 6;

/**
 * A tab's label (and icon, and a count in a capsule): the text color while
 * selected, fading in as the indicator arrives (`motion.default`), the icon's
 * two tints crossing over. It keeps its natural width (never truncated) and
 * reports it without the icon (`onWidth`): the same whether the icon shows
 * or not, so a row deciding on its icons by it never flips back.
 * `underline`: a terminal marks the selected tab of an underlined strip by
 * underlining its label, where the strip's indicator, thinner than a Cell,
 * does not show.
 */
export function TabTitle(props: {
  name: string;
  selected: boolean;
  count?: number;
  icon?: IconNode;
  underline?: boolean;
  onWidth?: (bare: number) => void;
}) {
  const on = follow(() => (props.selected ? 1 : 0), motion.default);
  // An underlined strip's label takes the accent, a filled one the page's ink.
  const listVariant = ListVariantContext();
  const chosenInk = () =>
    listVariant === 'line' || props.underline
      ? colors.brand
      : colors.foreground;
  const away = on.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <View
      onLayout={({ bounds }) =>
        props.onWidth?.(bounds.size.width - (props.icon ? TAB_ICON_ROOM : 0))
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}
    >
      <If when={props.icon}>
        <View style={{ width: TAB_ICON, height: TAB_ICON }}>
          <View style={{ position: 'absolute', opacity: away }}>
            <Icon
              icon={props.icon!}
              size={TAB_ICON}
              tint={colors.mutedForeground}
            />
          </View>
          <View style={{ position: 'absolute', opacity: on }}>
            <Icon icon={props.icon!} size={TAB_ICON} tint={chosenInk()} />
          </View>
        </View>
      </If>
      <Text
        // The tab strip is a fixed height: the text follows the system size, but only so far.
        maxFontSizeMultiplier={1.2}
        style={{
          numberOfLines: 1,
          // No type role has this size: a tab's label is 13 in both tiers (`label` is 14 / 15).
          fontSize: 13,
          fontWeight: font.weight('label'),
          color: on.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.mutedForeground, chosenInk()],
          }),
          textDecorationLine:
            terminal && props.underline && props.selected
              ? 'underline'
              : 'none',
        }}
      >
        {props.name}
      </Text>
      <If when={props.count !== undefined}>
        <View
          style={{
            minWidth: 18,
            height: 16,
            paddingHorizontal: 5,
            ...rounded(shape.control),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: surface('inset').style.backgroundColor,
            borderWidth: stroke.control,
            borderColor: colors.line,
          }}
        >
          <Text
            maxFontSizeMultiplier={1.2}
            style={{
              // No type role has this size: a tab's count is 10.
              fontSize: 10,
              fontWeight: font.weight('title'),
              color: colors.mutedForeground,
              fontVariant: ['tabular-nums'],
            }}
          >
            {props.count}
          </Text>
        </View>
      </If>
    </View>
  );
}

/** Pill track (`default`) or underlined (`line`) tab list. */
export type TabsListVariant = 'default' | 'line';

/**
 * Composition root: the selected tab value, then lists and panels. `nsh/base`
 * has no value-holding root — the list is {@link TabsList}.
 */
export type TabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  children?: JSX.Element;
  class?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** `nsh/base`'s Tabs (the tablist). Base props pass through. */
export type TabsListProps = BaseTabsProps & {
  variant?: TabsListVariant;
  /** Span the row, the tabs sharing its width (a touch screen always does). */
  fill?: Live<boolean>;
};

/** A tab in the list. String children become the label. */
export type TabsTriggerProps = Omit<BaseTabProps, 'selected' | 'children'> & {
  value: string;
  children?: string | JSX.Element;
};

/** Panel for one `value`. Hidden while another value is selected. */
export type TabsContentProps = {
  value: string;
  children?: JSX.Element;
  class?: string | null;
  style?: StyleProp<ViewStyle>;
};

type TabsContextValue = {
  value: () => string;
  onValueChange: (value: string) => void;
  orientation: () => 'horizontal' | 'vertical';
};

const TabsContext = context<TabsContextValue | null>(null);
const ListVariantContext = context<TabsListVariant>('default');

function useTabs() {
  return TabsContext();
}

/** Composition root: selected value, then list and content. */
export function Tabs(props: TabsProps) {
  const [, rest] = split(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'orientation',
    'children',
    'class',
    'style',
  ]);
  const uncontrolled = signal(props.value ?? props.defaultValue ?? '');
  const value = () => (props.value != null ? props.value : uncontrolled());
  const orientation = () => props.orientation ?? 'horizontal';

  return (
    <TabsContext.Provider
      value={{
        value,
        orientation,
        onValueChange: (next) => {
          if (props.value == null) uncontrolled.set(next);
          props.onValueChange?.(next);
        },
      }}
    >
      <View
        {...rest}
        class={props.class ?? undefined}
        style={[
          {
            // The list, then the panel, a gap apart — a row of the two when the list is vertical.
            flexDirection: orientation() === 'vertical' ? 'row' : 'column',
            alignItems: 'stretch',
            gap: 8,
          },
          props.style ?? null,
        ]}
      >
        {props.children}
      </View>
    </TabsContext.Provider>
  );
}

function listLook(variant: TabsListVariant, fill?: Live<boolean>) {
  return variant === 'line' ? underlineTabsLook() : tabsLook({ fill });
}

/** The tab list: a pill track or an underline, with the traveling indicator. */
export function TabsList(props: TabsListProps) {
  const [, rest] = split(props, [
    'variant',
    'fill',
    'style',
    'indicatorStyle',
    'children',
  ]);
  const variant = () => props.variant ?? 'default';
  const look = computed(() => listLook(variant(), () => !!props.fill));

  const list = (
    <ListVariantContext.Provider value={variant()}>
      <BaseTabs
        {...rest}
        indicatorStyle={[look().indicatorStyle, props.indicatorStyle ?? null]}
        style={[look().style, props.style ?? null]}
      >
        {props.children}
      </BaseTabs>
    </ListVariantContext.Provider>
  );

  if (variant() !== 'line') return list;
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <View testID="tabs-rule" style={underlineTabsLook().rule} />
      {list}
    </View>
  );
}

/** A tab in the list. Selection follows the root {@link Tabs} value. */
export function TabsTrigger(props: TabsTriggerProps) {
  const ctx = useTabs();
  const variant = ListVariantContext();
  const [, rest] = split(props, [
    'value',
    'children',
    'style',
    'hoverStyle',
    'activeStyle',
    'focusVisibleStyle',
    'disabledStyle',
    'selectedStyle',
    'onPress',
  ]);
  const look = computed(() => listLook(variant));
  const selected = () => (ctx ? ctx.value() === props.value : false);
  const tab = computed(() =>
    look().tab({
      selected: () => selected(),
      disabled: () => !!props.disabled,
    }),
  );

  return (
    <BaseTab
      {...rest}
      selected={selected()}
      onPress={() => {
        ctx?.onValueChange(props.value);
        props.onPress?.();
      }}
      style={[tab().style, props.style ?? null]}
      hoverStyle={[tab().hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[tab().activeStyle ?? null, props.activeStyle ?? null]}
      focusVisibleStyle={[
        tab().focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[tab().disabledStyle, props.disabledStyle ?? null]}
      selectedStyle={props.selectedStyle}
    >
      {(() => {
        // Read once, here where the tab is drawn (`marker.tsx` reads in the same shape): a
        // string is `TabTitle`, anything else as it is.
        const kids = props.children;
        return typeof kids === 'string' ? (
          <TabTitle name={kids} selected={selected()} />
        ) : (
          kids
        );
      })()}
    </BaseTab>
  );
}

/** Content for one value. Hidden, not unmounted, while another value is selected. */
export function TabsContent(props: TabsContentProps) {
  const ctx = useTabs();
  const shown = () => (ctx ? ctx.value() === props.value : false);
  return (
    <View
      class={props.class ?? undefined}
      style={[{ display: shown() ? 'flex' : 'none' }, props.style ?? null]}
    >
      {props.children}
    </View>
  );
}
