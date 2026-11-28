// An accordion: the disclosure look (`disclosureTriggerLook`, `DisclosureChevron`, `disclosurePanel`)
// at the top, and the parts that wear it below.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import { ChevronDown, ChevronRight } from 'lucide';
import type { JSX, ViewStyle } from 'nsh';
import { split, View } from 'nsh';
import {
  Accordion as BaseAccordion,
  AccordionHeader as BaseAccordionHeader,
  type AccordionHeaderProps as BaseAccordionHeaderProps,
  AccordionItem as BaseAccordionItem,
  type AccordionItemProps as BaseAccordionItemProps,
  AccordionPanel as BaseAccordionPanel,
  type AccordionPanelProps as BaseAccordionPanelProps,
  type AccordionProps as BaseAccordionProps,
  AccordionTrigger as BaseAccordionTrigger,
  type AccordionTriggerProps as BaseAccordionTriggerProps,
} from 'nsh/base';

import { Icon } from '../../lib/ui/icons';
import {
  controlSize,
  listRow,
  type ListRowOptions,
  RowLabel,
} from '../../lib/ui/surface';
import { colors } from '../../lib/ui/theme';
import { joinClass } from '../../lib/ui/utils';

/** Options of `disclosureTriggerLook`: a row's (`listRow`). */
export type DisclosureTriggerOptions = ListRowOptions;

/**
 * A trigger's props (spread them on an `AccordionTrigger`, or on the row
 * that flips a `Collapsible`): the list's row (`listRow`: its height, the
 * `accent` hover fill reaching past the content, pressed, focus and disabled
 * states; a `RowDivider` among its children above all but the first), with
 * the `group` class, so an accordion's `DisclosureChevron` turns with
 * `group-aria-expanded:`.
 */
export function disclosureTriggerLook(o?: DisclosureTriggerOptions) {
  const row = listRow(o);
  return {
    class: 'group',
    get style(): ViewStyle {
      return row.style;
    },
    get hoverStyle(): ViewStyle | undefined {
      return row.hoverStyle;
    },
    get activeStyle(): ViewStyle {
      return row.activeStyle;
    },
    get focusVisibleStyle(): ViewStyle {
      return row.focusVisibleStyle;
    },
    get disabledStyle(): ViewStyle {
      return row.disabledStyle;
    },
  };
}

/** The chevron's options. */
type DisclosureChevronProps = {
  /** Its own chevron points along the row and turns down as it opens (a collapsible's). */
  open?: boolean;
  /** Follow the trigger's `aria-expanded` instead (an accordion's). */
  accordion?: boolean;
};

/**
 * The chevron at a trigger's trailing edge, muted, the size of a row's
 * icons (`controlSize.check`). A collapsible's (default) points along the
 * row and turns down as it opens (`open`), in a lane as wide as its stroke
 * (half its box), so it ends where the values below it end. An accordion's
 * (`accordion`) points down and turns up with its trigger's `aria-expanded`
 * (the trigger's `group` class), in its whole box. Both turn on a short
 * transition (200 ms in an accordion, 150 ms in a collapsible), at once with
 * reduced motion.
 */
export function DisclosureChevron(props: DisclosureChevronProps) {
  const icon = controlSize.check;
  return props.accordion ? (
    <View
      class="transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none"
      style={{
        width: icon,
        height: icon,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon icon={ChevronDown} size={icon} tint={colors.mutedForeground} />
    </View>
  ) : (
    <View
      class="transition-transform duration-150 motion-reduce:transition-none"
      style={{
        width: icon / 2,
        alignItems: 'center',
        rotate: props.open ? '90deg' : '0deg',
      }}
    >
      <Icon icon={ChevronRight} size={icon} tint={colors.mutedForeground} />
    </View>
  );
}

/** Options of `disclosurePanel`. */
export interface DisclosurePanelOptions {
  /** Room before the content: to line it up with the title, past a leading icon. */
  start?: number;
  /** Room after the content: as much as `start` keeps a row's hover fill (`listRow`) off both
   * edges of the revealed region, which clips what reaches past it. */
  end?: number;
  /** The gap between its lines, default 6. */
  gap?: number;
}

/**
 * A panel's content under its trigger (a view inside an `AccordionPanel`, or
 * a `Collapsible`'s `content`): padded at the bottom, 12 points with a
 * pointer, 14 on a touch screen. The padding is the content's, not the
 * panel's: a revealed panel is zero high while closed.
 */
export function disclosurePanel(o?: DisclosurePanelOptions): ViewStyle {
  return {
    paddingStart: o?.start ?? 0,
    paddingEnd: o?.end ?? 0,
    paddingBottom: controlSize.padding + 6,
    gap: o?.gap ?? 6,
  };
}

/** `nsh/base`'s Accordion. Every base prop passes through. */
export type AccordionProps = BaseAccordionProps;

/** One section. */
export type AccordionItemProps = BaseAccordionItemProps;

/** The heading around `AccordionTrigger`. */
export type AccordionHeaderProps = BaseAccordionHeaderProps;

/**
 * Expands the item. String children are the title; a trailing chevron is always drawn, and
 * children of the app's own (an icon, a title and a summary, a badge) sit before it in one row.
 * Row options (`first`, `start`) feed `disclosureTriggerLook`.
 */
export type AccordionTriggerProps = Omit<
  BaseAccordionTriggerProps,
  'children'
> & {
  /**
   * The row, in order, before the chevron: a string is the title's text (a `RowLabel`, taking the
   * room left), anything else is drawn as given. More than one child is laid out beside it — a
   * leading icon, the title and a badge share the row.
   */
  children?: string | JSX.Element | (string | JSX.Element)[];
  first?: boolean;
  start?: number;
  /**
   * This trigger takes no presses and dims, without disabling its item (its panel's own controls
   * keep working). A disabled trigger is drawn as a row of its own rather than the item's button,
   * so screen readers hear a disabled button without the item's expanded state.
   */
  disabled?: boolean;
};

/**
 * The open section. `reveal` defaults on; panel padding is on an inner view.
 */
export type AccordionPanelProps = BaseAccordionPanelProps & {
  /** Lines up with content past a leading icon in the trigger. */
  start?: number;
  /** Room after the content (`disclosurePanel`'s `end`). */
  end?: number;
  gap?: number;
};

/** The stack of items. */
export function Accordion(props: AccordionProps) {
  return <BaseAccordion {...props} />;
}

/** One section. */
export function AccordionItem(props: AccordionItemProps) {
  const [, rest] = split(props, ['style', 'children']);
  return (
    <BaseAccordionItem
      {...rest}
      style={[{ alignSelf: 'stretch' }, props.style ?? null]}
    >
      {props.children}
    </BaseAccordionItem>
  );
}

/** The heading around the trigger. */
export function AccordionHeader(props: AccordionHeaderProps) {
  return <BaseAccordionHeader {...props} />;
}

/** Title row with a chevron that turns as the item opens. */
export function AccordionTrigger(props: AccordionTriggerProps) {
  const [, rest] = split(props, [
    'children',
    'first',
    'start',
    'disabled',
    'class',
    'style',
    'hoverStyle',
    'activeStyle',
    'focusVisibleStyle',
    'disabledStyle',
  ]);
  const look = disclosureTriggerLook({
    first: props.first,
    start: props.start,
    disabled: () => Boolean(props.disabled),
  });
  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexGrow: 1,
        gap: controlSize.gap,
      }}
    >
      {(() => {
        // Read once, here where the title is drawn (`marker.tsx` reads in the same shape): a
        // string is a `RowLabel` (it takes the room left), anything else keeps its own width.
        const kids = props.children;
        const parts = Array.isArray(kids) ? kids : [kids];
        return (
          <Each of={parts} key="index">
            {(part) => {
              const child = part();
              return typeof child === 'string' ? (
                <RowLabel label={child} strong />
              ) : (
                <If when={child != null}>{child}</If>
              );
            }}
          </Each>
        );
      })()}
      <DisclosureChevron accordion />
    </View>
  );
  // The look's states are read here, where the row is drawn, not gathered in the body: its row
  // height is the theme's (`listRow`), so the row follows a theme chosen after it was mounted.

  // A trigger of its own disabled is a row, not the item's button: `nsh/base` stops the presses of
  // a disabled item, and takes nothing from a trigger that only dims.
  if (props.disabled) {
    return (
      <View
        accessible
        role="button"
        accessibilityLabel={props.accessibilityLabel ?? undefined}
        accessibilityState={{ disabled: true }}
        class={joinClass(look.class, props.class)}
        style={[look.style, props.style ?? null]}
        hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
        activeStyle={[look.activeStyle, props.activeStyle ?? null]}
        focusVisibleStyle={[
          look.focusVisibleStyle,
          props.focusVisibleStyle ?? null,
        ]}
        disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
      >
        {row}
      </View>
    );
  }
  return (
    <BaseAccordionTrigger
      {...rest}
      class={joinClass(look.class, props.class)}
      style={[look.style, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look.activeStyle, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    >
      {row}
    </BaseAccordionTrigger>
  );
}

/** Revealed content with `disclosurePanel` padding inside. */
export function AccordionPanel(props: AccordionPanelProps) {
  const [, rest] = split(props, [
    'style',
    'children',
    'reveal',
    'start',
    'end',
    'gap',
  ]);
  return (
    <BaseAccordionPanel
      {...rest}
      reveal={props.reveal ?? true}
      style={props.style}
    >
      <View
        style={disclosurePanel({
          start: props.start,
          end: props.end,
          gap: props.gap,
        })}
      >
        {props.children}
      </View>
    </BaseAccordionPanel>
  );
}
