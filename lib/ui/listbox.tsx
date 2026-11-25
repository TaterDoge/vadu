// Shared list looks: popup, rows, search, chevron, clear — used by select, combobox, calendar, date-picker.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import { Check, ChevronRight, X } from 'lucide';
import type { JSX, ViewStyle } from 'nsh';
import { platform, Text, View } from 'nsh';
import type { SelectEntry, SelectGroup } from 'nsh/base';

import { Icon } from './icons';
import {
  backdrop,
  itemRadius,
  itemSpacing,
  listPadding,
  popInStyles,
  rowVerticalPad,
} from './popup';
import { controlSize } from './surface';
import {
  colors,
  cornerCurve,
  finish,
  font,
  rounded,
  shape,
  stroke,
  terminal,
} from './theme';

const pointer = platform.desktop;

/** Options of `listboxPopup` and `listboxProps`. */
export interface ListboxPopupOptions {
  /** With a pointer, at least this wide (the titles whole); a sheet spans the window anyway. */
  minWidth?: number;
  /** The room around what the popup holds, in place of a list's (`listPadding`): a calendar's. */
  padding?: number;
}

/** The room under a sheet's last row, on a touch screen (the window's bottom edge). */
const SHEET_FOOT = 34;

/**
 * The list's surface: with a pointer a popup at the trigger that extends
 * it (the floating finish every popup wears, the theme's container corners, the
 * list's padding: `listPadding`) and comes in as a menu does (`popInStyles`: a fade,
 * 96% to full size, 4 points of slide, 150 ms); on a touch screen a sheet
 * at the bottom, its top corners rounded, at most 70% of the window high,
 * which slides up on its own. Not the raised finish: that is a control's,
 * and a theme may make it a tint over what is behind it (Solid Glass),
 * which a list floating over the page cannot be.
 */
export function listboxPopup(o?: ListboxPopupOptions): ViewStyle {
  return pointer
    ? {
        ...rounded(shape.container),
        borderWidth: stroke.hairline,
        ...(o?.padding === undefined ? listPadding() : { padding: o.padding }),
        ...finish.overlay,
        ...(o?.minWidth ? { minWidth: o.minWidth } : {}),
        ...popInStyles().style,
      }
    : {
        backgroundColor: colors.card,
        borderTopLeftRadius: shape.modal,
        borderTopRightRadius: shape.modal,
        ...cornerCurve,
        ...(o?.padding === undefined ? listPadding() : { padding: o.padding }),
        paddingBottom: SHEET_FOOT,
        maxHeight: '70%',
      };
}

/** The list's popup in its first frame (its `popupStartingStyle`), from which `listboxPopup`'s transition brings it in; none on a touch screen. */
export function listboxPopupStarting(): ViewStyle | undefined {
  return pointer ? popInStyles().starting : undefined;
}

/**
 * A row of the list, its look on the row (`itemClass`; its corners are
 * `listboxProps`'s `itemStyle`, concentric with the popup's): lit in the brand
 * tint while highlighted (`focus:`, the keys or the pointer on it), the fill
 * fading between rows as the highlight moves, dimmed while disabled. Every
 * state is the row's class (`group`), so the list draws a row's content once
 * per item and the highlight moves without drawing.
 */
export const optionClass =
  'group transition-colors duration-100 motion-reduce:transition-none focus:bg-brand-tint active:opacity-70 disabled:opacity-50';

/**
 * What a select's or combobox's list takes besides its items (spread it):
 * 4 points from the trigger, 8 from the window's edges, the popup or sheet,
 * the scrim behind a sheet, the rows' look and corners (`itemRadius`).
 */
export function listboxProps(o?: ListboxPopupOptions) {
  return {
    offset: 4,
    margin: 8,
    get popupStyle() {
      return listboxPopup(o);
    },
    get popupStartingStyle() {
      return listboxPopupStarting();
    },
    get backdropStyle() {
      return backdrop();
    },
    itemClass: optionClass,
    get itemStyle(): ViewStyle {
      return rounded(itemRadius());
    },
  };
}

/**
 * The chevron of a trigger: its icon box takes only the room of its stroke
 * (half the box) in the row, so it turns about its own center; it points
 * down, and up while the list is open.
 */
export function Chevron(props: { open: boolean; hidden?: boolean }) {
  return (
    <View
      class="transition-transform duration-150 motion-reduce:transition-none"
      style={{
        display: props.hidden ? 'none' : 'flex',
        marginHorizontal: -controlSize.check / 4,
        transform: [{ rotate: props.open ? '-90deg' : '90deg' }],
      }}
    >
      <Icon
        icon={ChevronRight}
        size={controlSize.check}
        tint={colors.mutedForeground}
      />
    </View>
  );
}

/** A trigger's 1-point border. */
const TRIGGER_BORDER = 1;

/** A trigger's text inset, and its padding at the end (the side the chevron or the clear button
 * sits on): a row's text inset in the list (`inset + pad`), so a chosen row lies title on title
 * over the trigger. */
export const triggerPadding = (): number => itemSpacing.inset + itemSpacing.pad;

/** The clear button's inset from a trigger's end: centered where the chevron's lane is. The button is in the
 * select's view, outside the trigger, so its inset counts the trigger's 1-point border too. */
export const clearInset = (): number =>
  TRIGGER_BORDER +
  triggerPadding() +
  controlSize.check / 4 -
  controlSize.clear / 2;

/** Options of `clearButtonLook`. */
export interface ClearButtonOptions {
  /** Over a `Picker`'s end, where its chevron was (a select's, a date picker's); in the row otherwise (a combobox's). */
  over?: boolean;
}

/**
 * A clear button's look (spread it with `cleanable` and the app's
 * `clearButtonAccessibilityLabel`): a round target lit under the pointer, an
 * × in the muted color (a terminal's text ×, set after the value).
 */
export function clearButtonLook(o?: ClearButtonOptions) {
  return {
    clearButtonClass:
      'items-center justify-center rounded-full enabled:hover:bg-foreground/8 active:bg-track',
    get clearButtonStyle(): ViewStyle | undefined {
      return terminal
        ? undefined
        : o?.over
          ? {
              position: 'absolute',
              top: (controlSize.line - controlSize.clear) / 2,
              end: clearInset(),
              width: controlSize.clear,
              height: controlSize.clear,
            }
          : { width: controlSize.clear, height: controlSize.clear };
    },
    get clearButton() {
      return terminal ? (
        <Text style={{ color: colors.mutedForeground }}>×</Text>
      ) : (
        <Icon
          icon={X}
          size={controlSize.clear - 6}
          tint={colors.mutedForeground}
        />
      );
    },
  };
}

/** A row's least height: the title alone, and with a line under it; compact with a pointer (shadcn's
 * `SelectItem`, `py-1.5` around a 20-point line), a finger's target on a touch screen. A row grows
 * past it when its content (`detail`) needs the room, with `rowVerticalPad` around it. */
const rowHeights = {
  pointer: { title: 32, detail: 40 },
  touch: { title: 44, detail: 52 },
} as const;

/**
 * A row's content (`renderItem`): the title, bolder with a check while
 * chosen (`group-selected:`); `lead` before it (a flag, a dot, a face, an
 * icon), `detail` under it, `note` after it.
 */
export function OptionRow(props: {
  item: SelectEntry;
  note?: string;
  lead?: JSX.Element;
  detail?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: (pointer ? rowHeights.pointer : rowHeights.touch)[
          props.detail ? 'detail' : 'title'
        ],
        paddingVertical: rowVerticalPad(),
        // With the popup's inset, the trigger's text inset (`triggerPadding`): a select's chosen row lies over the trigger, title on title.
        paddingHorizontal: itemSpacing.pad,
      }}
    >
      {props.lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          class="group-selected:font-semibold font-normal"
          style={{
            numberOfLines: 1,
            fontSize: font.size('body'),
            color: colors.foreground,
          }}
        >
          {props.item.title}
        </Text>
        <If when={props.detail}>
          <Text
            style={{
              numberOfLines: 1,
              fontSize: font.size('detail'),
              color: colors.mutedForeground,
            }}
          >
            {props.detail}
          </Text>
        </If>
      </View>
      <If when={props.note}>
        <Text
          style={{
            fontSize: font.size('detail'),
            color: colors.faint,
            fontVariant: ['tabular-nums'],
          }}
        >
          {props.note}
        </Text>
      </If>
      <View
        class="group-selected:opacity-100 opacity-0"
        style={{ width: 16, alignItems: 'center' }}
      >
        <Icon icon={Check} size={14} tint={colors.brand} />
      </View>
    </View>
  );
}

/** A group's heading in a list (`renderGroup`): quiet, in sentence case. */
export function ListboxHeader(props: { group: SelectGroup }) {
  return (
    <Text
      style={{
        // No type role has this size: a group's heading is 12 in both tiers.
        fontSize: 12,
        fontWeight: font.weight('title'),
        color: colors.mutedForeground,
        paddingHorizontal: itemSpacing.pad,
        paddingTop: 8,
        paddingBottom: 4,
      }}
    >
      {props.group.title}
    </Text>
  );
}

/** What a list shows while its search matches nothing (`empty`). */
export function ListboxEmpty(props: { label: string }) {
  return (
    <Text
      style={{
        paddingVertical: 20,
        textAlign: 'center',
        // No type role has this size: a list's empty note is 14 in both tiers.
        fontSize: 14,
        color: colors.mutedForeground,
      }}
    >
      {props.label}
    </Text>
  );
}

/** A list's footer under a hairline (`footerStyle`), and its text. */
export const listboxFooter = {
  get style(): ViewStyle {
    return {
      marginTop: 6,
      paddingTop: 6,
      paddingHorizontal: itemSpacing.pad,
      borderTopWidth: stroke.hairline,
      borderColor: colors.border,
    };
  },
  get text() {
    // No type role has this size: a list's note is 12 in both tiers.
    return { fontSize: 12, color: colors.mutedForeground };
  },
};

/**
 * The search well at the top of a list (spread it on a searchable
 * `Select`): the field color in a recess, 32 high with a pointer, 40 on a
 * touch screen, 6 points above the rows; the text and a muted placeholder
 * as token classes, so they follow the theme.
 */
export function listboxSearch() {
  return {
    searchClass: `${pointer ? 'text-sm' : 'text-base'} text-foreground placeholder:text-muted-foreground`,
    get searchStyle(): ViewStyle {
      return {
        height: pointer ? 32 : 40,
        paddingHorizontal: itemSpacing.pad,
        marginBottom: 6,
        ...rounded(shape.control),
        borderWidth: stroke.hairline,
        backgroundColor: colors.field,
        ...finish.inset,
        borderColor: colors.input,
      };
    },
  };
}
