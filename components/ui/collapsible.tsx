// A collapsible: `nsh/base`'s Collapsible in the disclosure look of `accordion.tsx` — a trigger row
// and the panel it reveals.

import type { JSX, StyleProp, ViewStyle } from 'nsh';
import { context, split, View } from 'nsh';
import {
  Collapsible as BaseCollapsible,
  type CollapsibleProps as BaseCollapsibleProps,
  type OpenChangeReason,
} from 'nsh/base';

import {
  createOpenState,
  createSlot,
  type OpenState,
  type Slot,
} from '../../lib/ui/open-state';
import { RowDivider, RowLabel } from '../../lib/ui/surface';
import {
  DisclosureChevron,
  disclosurePanel,
  type DisclosurePanelOptions,
  disclosureTriggerLook,
} from './accordion';

/** Why a collapsible opened or closed (`onOpenChange`'s `reason`): `nsh/base`'s `OpenChangeReason`, under this part's name. */
export type CollapsibleOpenChangeReason = OpenChangeReason;

/** The root: it owns whether the panel is open, and the trigger slot. */
export type CollapsibleProps = {
  /** Controlled; leave it out and the root keeps the state (`defaultOpen`). */
  open?: boolean | null;
  defaultOpen?: boolean;
  children?: JSX.Element;
  /** Told whenever it opens or closes, and why. */
  onOpenChange?: (event: {
    open: boolean;
    reason: CollapsibleOpenChangeReason;
  }) => void;
};

/** `nsh/base` Collapsible as content. `children` become the revealed panel. */
export type CollapsibleContentProps = Omit<
  BaseCollapsibleProps,
  'open' | 'content' | 'children'
> & {
  children?: JSX.Element;
  panel?: DisclosurePanelOptions;
};

/** Toggles open: a disclosure row, not a `Button`. String children are the title. */
export type CollapsibleTriggerProps = {
  /** A string is the title's text; anything else is drawn as given, before the chevron. */
  children?: string | JSX.Element | (string | JSX.Element)[];
  /**
   * The chevron at its trailing edge: `along` (default) points along the row and turns down as it
   * opens, `down` points down and turns up like an accordion's, for a collapsible that reads as a
   * section of one.
   */
  chevron?: 'along' | 'down';
  disabled?: boolean;
  class?: string | null;
  style?: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  activeStyle?: StyleProp<ViewStyle>;
  focusVisibleStyle?: StyleProp<ViewStyle>;
  disabledStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string | null;
  /** The first row of its surface: no divider above it. Every other trigger draws one, inside the
   * row, so its hover fill meets the line. */
  first?: boolean;
  start?: number;
};

type CollapsibleContextValue = OpenState & {
  trigger: Slot<JSX.Element>;
};

const CollapsibleContext = context<CollapsibleContextValue | null>(null);

function useCollapsible() {
  const ctx = CollapsibleContext();
  if (!ctx)
    throw new Error('Collapsible parts must be used within <Collapsible>');
  return ctx;
}

/** Owns open state for `CollapsibleTrigger` and `CollapsibleContent`. */
export function Collapsible(props: CollapsibleProps) {
  const state = createOpenState<CollapsibleOpenChangeReason>(props);
  const trigger = createSlot<JSX.Element>();
  return (
    <CollapsibleContext.Provider value={{ ...state, trigger }}>
      {props.children}
    </CollapsibleContext.Provider>
  );
}

/** Registers the disclosure row; `CollapsibleContent` renders it as the base child. */
export function CollapsibleTrigger(props: CollapsibleTriggerProps) {
  const ctx = useCollapsible();
  // The trigger is an element, as an app hands one to `nsh/base` (`trigger={<View …>}`, the shape
  // upstream's demos use): built once, here, and placed by the content without building it again
  // on every layout. Its children are read where they are drawn, below, so a child that reads a
  // signal stays live.
  const look = disclosureTriggerLook({
    first: props.first,
    start: props.start,
    disabled: () => Boolean(props.disabled),
  });
  const disabled = Boolean(props.disabled);
  ctx.trigger.set(
    <View
      accessible
      role="button"
      accessibilityLabel={props.accessibilityLabel ?? undefined}
      accessibilityState={{ expanded: ctx.open(), disabled }}
      class={props.class ? `${look.class} ${props.class}` : look.class}
      onPress={disabled ? undefined : () => ctx.setOpen(!ctx.open())}
      style={[look.style, props.style ?? null]}
      hoverStyle={[look.hoverStyle ?? null, props.hoverStyle ?? null]}
      activeStyle={[look.activeStyle, props.activeStyle ?? null]}
      focusVisibleStyle={[
        look.focusVisibleStyle,
        props.focusVisibleStyle ?? null,
      ]}
      disabledStyle={[look.disabledStyle, props.disabledStyle ?? null]}
    >
      <RowDivider show={!props.first} />
      <View style={{ flexDirection: 'row', alignItems: 'center', flexGrow: 1 }}>
        {(() => {
          // Read once, here where the row is drawn (`marker.tsx` reads in the same shape): a
          // string is the row's label, anything else presses where it lies.
          const kids = props.children;
          return typeof kids === 'string' ? (
            <RowLabel label={kids} strong />
          ) : (
            <View style={{ flexGrow: 1, flexShrink: 1 }}>{kids}</View>
          );
        })()}
        <DisclosureChevron
          accordion={props.chevron === 'down'}
          open={ctx.open()}
        />
      </View>
    </View>,
  );
  return null;
}

/** The collapsible region; the registered trigger is the base child. */
export function CollapsibleContent(props: CollapsibleContentProps) {
  const ctx = useCollapsible();
  const trigger = ctx.trigger.get();
  const [, rest] = split(props, ['style', 'children', 'reveal', 'panel']);
  const panel = props.panel;
  return (
    <BaseCollapsible
      {...rest}
      open={ctx.open()}
      reveal={props.reveal ?? true}
      style={[{ alignItems: 'stretch' }, props.style ?? null]}
      content={<View style={disclosurePanel(panel)}>{props.children}</View>}
    >
      {trigger ?? <View />}
    </BaseCollapsible>
  );
}
