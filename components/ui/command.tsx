// Command: palette parts (`commandClasses`, `CommandRow`) and the `Command` that wears them.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import { Check, type IconNode, Search } from 'lucide';
import type { InputStyle, StyleProp, ViewStyle } from 'nsh';
import { platform, split, Text, View } from 'nsh';
import {
  Command as BaseCommand,
  type CommandEntry,
  type CommandGroup,
  type CommandItem,
  type CommandProps as BaseCommandProps,
  type CommandRef,
} from 'nsh/base';

import { Icon } from '../../lib/ui/icons';
import {
  itemRadius,
  itemSpacing,
  listPadding,
  rowVerticalPad,
} from '../../lib/ui/popup';
import { controlSize } from '../../lib/ui/surface';
import { colors, control, font, rounded, terminal } from '../../lib/ui/theme';
import { joinClass } from '../../lib/ui/utils';
import { Kbd } from './kbd';

const desktop = platform.desktop;

/**
 * A palette row's sizes: the theme's tallest control height, 32 with a pointer, and the theme's
 * detail type size. Read where the row is drawn, so a theme switch redraws them.
 */
const size = {
  get row() {
    return controlSize.row;
  },
  get rowSm() {
    return desktop ? 32 : controlSize.row;
  },
  get detail() {
    return controlSize.detail;
  },
};

/**
 * The classes of a palette's parts. The highlight is a tint inside the row:
 * the rows fill the list's width, whose scroll view clips what reaches past
 * its sides.
 */
export const commandClasses = {
  /** The palette's frame. */
  root: 'overflow-hidden rounded-(--radius-container) border border-border bg-card',
  /**
   * The row of the search icon, the field and the spinner. A terminal's
   * field is a raised band: the band spans the row, as the rows' do, and
   * its own padding sets its text where theirs starts.
   */
  searchBar: `flex-row flex-nowrap items-center gap-2 border-b border-border ${terminal ? '' : 'px-3'}`,
  /** The search field. */
  search: `min-w-0 flex-1 ${terminal ? 'px-2 ' : ''}${desktop ? 'h-11 text-sm' : 'h-12 text-base'} text-foreground placeholder:text-muted-foreground`,
  /** A section's header: its sides are `commandStyles.group`'s. */
  group: 'pt-2.5 pb-1',
  /** Between two sections: its sides are `commandStyles.separator`'s. */
  separator: 'my-1 h-px bg-border',
  /** A row: quiet until hovered, focused per `list.item.highlight`, dimmed while disabled; its
   * corners are `commandStyles.item`'s. */
  get item(): string {
    return (
      'group transition-colors duration-100 motion-reduce:transition-none ' +
      `hover:bg-accent ${control('list').highlightClass(false)} active:opacity-70 disabled:opacity-50`
    );
  },
};

/**
 * The theme's list spacing on a palette's parts (`itemSpacing`): the rows' scroll view padded by
 * `listPadding`, a row's corners concentric with the frame (`itemRadius`), a section's header
 * set where the rows' text starts, a separator spanning the list. A terminal's rows span the frame,
 * their text one Cell in.
 */
export const commandStyles = {
  get list(): ViewStyle {
    return listPadding();
  },
  get item(): ViewStyle {
    return rounded(itemRadius());
  },
  get group(): ViewStyle {
    return { paddingHorizontal: itemSpacing.pad };
  },
  get separator(): ViewStyle {
    return { marginHorizontal: -itemSpacing.inset };
  },
};

/** A shortcut's keys, as hints show them here (`entry.shortcutLabel`): the library's one keycap, `kbd`'s. */
export function CommandKeys(props: { label: string }) {
  return <Kbd>{props.label}</Kbd>;
}

/** A section's heading: small capitals in the faint color. */
export function CommandHeading(props: { group: CommandGroup }) {
  return (
    // Small capitals: an 11-point header, tracked out a little to read as a label.
    <Text
      style={{
        // No type role has this size: a group's heading is 11 on every screen, tracked out.
        fontSize: 11,
        fontWeight: font.weight('title'),
        letterSpacing: 0.6,
        color: colors.faint,
      }}
    >
      {props.group.heading.toLocaleUpperCase()}
    </Text>
  );
}

/**
 * A row's content: an icon, the label (and a `detail` under it), a `note`
 * at the end, the shortcut's keys with a pointer, and a check for the
 * item in effect. The icon and label take the brand color while
 * highlighted (`group-focus:`).
 */
export function CommandRow(props: {
  entry: CommandEntry;
  icon?: IconNode;
  detail?: string;
  note?: string;
}) {
  return (
    <View
      style={{
        // A second line of text takes the row past its least height, so the row asks for density's height.
        minHeight: props.detail ? size.row : size.rowSm,
        paddingVertical: rowVerticalPad(),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: itemSpacing.pad,
      }}
    >
      {props.icon ? (
        <Icon icon={props.icon} size={16} tint={colors.mutedForeground} />
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text
          style={{
            fontSize: font.size('body'),
            color: colors.foreground,
            numberOfLines: 1,
          }}
        >
          {props.entry.label}
        </Text>
        {props.detail ? (
          <Text
            style={{
              fontSize: size.detail,
              color: colors.mutedForeground,
              numberOfLines: 1,
            }}
          >
            {props.detail}
          </Text>
        ) : null}
      </View>
      {props.note ? (
        <Text
          style={{
            fontSize: size.detail,
            color: colors.faint,
            fontVariant: ['tabular-nums'],
          }}
        >
          {props.note}
        </Text>
      ) : null}
      {desktop && props.entry.shortcutLabel ? (
        <CommandKeys label={props.entry.shortcutLabel} />
      ) : null}
      {props.entry.checked ? (
        <Icon icon={Check} size={14} tint={colors.foreground} />
      ) : null}
    </View>
  );
}

/** What a palette shows while nothing matches. */
export function CommandEmpty(props: { label: string }) {
  return (
    <Text
      style={{
        paddingVertical: 24,
        textAlign: 'center',
        // No type role has this size: an empty note's 13 in both tiers.
        fontSize: 13,
        color: colors.mutedForeground,
      }}
    >
      {props.label}
    </Text>
  );
}

/** Every prop of `nsh/base` Command. */
export type CommandProps = BaseCommandProps;

/** A command of the palette (`items`), from `nsh/base`. */
export type { CommandItem };

/** A row as `renderItem` draws it: what it is, never its state, from `nsh/base`. */
export type { CommandEntry };

/** A section's header as `renderGroup` draws it, from `nsh/base`. */
export type { CommandGroup };

/** The palette's ref (`focus`, `highlight`, `matchedCount`), from `nsh/base`. */
export type { CommandRef };

/**
 * The search bar's row, inline. `commandClasses.searchBar` already says `flex-row`, but the bar
 * is built only while `searchable` is on (`nsh/base` wraps it in `when`), and a bar created
 * after mount can miss that class and stack the icon over the field. The inline row does not.
 */
export function commandSearchBarStyle(): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
  };
}

/**
 * The search field beside the icon: it takes the room left in the row, and its text and
 * placeholder read in the theme's foreground and muted foreground. A class's
 * `placeholder:` does not set `placeholderColor`, so without this the macOS field draws the
 * placeholder at half the text color — near black on a dark card when the text color has not
 * landed either.
 */
export function commandSearchStyle(): InputStyle {
  return {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    color: colors.foreground,
    placeholderColor: colors.mutedForeground,
  };
}

/** The caller's style over the shell's, or the shell's alone when the caller passes nothing. */
function over<T>(under: T, top: StyleProp<T> | undefined): StyleProp<T> {
  return top == null ? under : [under, top];
}

/** A command palette: search field over virtualized, natively filtered rows. */
export function Command(props: CommandProps) {
  const [, rest] = split(props, [
    'class',
    'searchBarClass',
    'searchBarStyle',
    'searchClass',
    'searchStyle',
    'listClass',
    'listStyle',
    'itemClass',
    'itemStyle',
    'groupClass',
    'groupStyle',
    'separatorClass',
    'separatorStyle',
    'renderItem',
    'renderGroup',
    'empty',
    'placeholder',
    'searchPrefix',
    'style',
  ]);
  return (
    <BaseCommand
      {...rest}
      class={joinClass(commandClasses.root, props.class)}
      searchBarClass={joinClass(commandClasses.searchBar, props.searchBarClass)}
      searchBarStyle={over(commandSearchBarStyle(), props.searchBarStyle)}
      searchClass={joinClass(commandClasses.search, props.searchClass)}
      searchStyle={over(commandSearchStyle(), props.searchStyle)}
      listClass={props.listClass}
      listStyle={over(commandStyles.list, props.listStyle)}
      itemClass={joinClass(commandClasses.item, props.itemClass)}
      itemStyle={over(commandStyles.item, props.itemStyle)}
      groupClass={joinClass(commandClasses.group, props.groupClass)}
      groupStyle={over(commandStyles.group, props.groupStyle)}
      separatorClass={joinClass(commandClasses.separator, props.separatorClass)}
      separatorStyle={over(commandStyles.separator, props.separatorStyle)}
      placeholder={props.placeholder ?? 'Type a command or search…'}
      searchPrefix={
        props.searchPrefix === undefined ? (
          <Icon icon={Search} size={16} tint={colors.mutedForeground} />
        ) : (
          props.searchPrefix
        )
      }
      renderItem={
        props.renderItem === undefined
          ? (entry) => <CommandRow entry={entry} />
          : props.renderItem
      }
      renderGroup={
        props.renderGroup === undefined
          ? (group) => <CommandHeading group={group} />
          : props.renderGroup
      }
      empty={
        props.empty === undefined ? (
          <CommandEmpty label="No results." />
        ) : (
          props.empty
        )
      }
      style={props.style}
    />
  );
}
