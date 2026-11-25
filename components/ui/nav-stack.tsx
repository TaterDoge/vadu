// A navigation stack: `nsh/base`'s NavStack and NavPage, and the header the desktops and the web
// draw — a back button, the title, a trailing slot — which iOS and Android take from the system
// instead. The looks are `navStackLook` and `navPageLook` below; the parts only wear them.

import { ChevronLeft } from 'lucide';
import type { JSX, TextStyle, ViewStyle } from 'nsh';
import { context, split, Text, View } from 'nsh';
import {
  NavPage as BaseNavPage,
  type NavPageProps as BaseNavPageProps,
  NavStack as BaseNavStack,
  type NavStackProps as BaseNavStackProps,
} from 'nsh/base';

import { Icon } from '../../lib/ui/icons';
import {
  colors,
  controlHeight,
  font,
  header,
  iconSize,
  stroke,
  tier,
} from '../../lib/ui/theme';
import { IconButton } from './button';

// The stack and its routes are `nsh/base`'s, with nothing drawn on them: one module to import a
// page's navigation from.
export {
  createNavStack,
  type NavStackChangeEvent,
  type NavStackState,
} from 'nsh/base';

const pointer = tier === 'pointer';

/** A page header is a bar, not a control row: shadcn's `h-12`, above a control height scale whose
 * tallest step is the row — the same call `sidebar.tsx`'s `TEAM_ROW` makes. */
const HEADER = 48;

/**
 * The page header's numbers: its `height` (a bar's: the theme's tallest height step, and never
 * shorter than `HEADER`), the `padding` either side and the `gap` between its items (the header's
 * own: shadcn's `px-3` and a 8-point gap, the frame's rather than a control's), and the sides of
 * its `title` (the theme's `title` type role) and of the back button's `glyph` (the theme's middle
 * icon).
 */
export const navPageSize = {
  get height() {
    return Math.max(controlHeight.lg, HEADER);
  },
  get padding() {
    return pointer ? 12 : 16;
  },
  gap: 8,
  get title() {
    return font.size('title');
  },
  get glyph() {
    return iconSize.md;
  },
};

/** The stack's parts as the styles they wear. */
export interface NavStackLook {
  /** The window's area the pages stand in, on the page's fill. */
  root(): ViewStyle;
}

/**
 * The look of a stack: nothing of its own, the fill of the page. The pages are the stack's, drawn
 * one at a time by `nsh/base`; the stack itself only says what its ground is.
 */
export function navStackLook(): NavStackLook {
  return {
    root: (): ViewStyle => ({
      flex: 1,
      backgroundColor: colors.background,
    }),
  };
}

/** A page's parts as the styles they wear, and the words for its header's content. */
export interface NavPageLook {
  /** The page: the window's area, on the page's fill. */
  page(): ViewStyle;
  /** The header the desktops and the web draw: a bar `navPageSize.height` tall on the page's fill,
   * a hairline under it, the room either side its padding leaves. */
  header(): ViewStyle;
  /** The header's title: `navPageSize.title`, semibold, in the page's text color, taking
   * the room the back button and the trailing slot leave. */
  title(): TextStyle;
  /** The back button's glyph: the side of its square and its tint, the accent — the system
   * header's tint, `header.headerStyle`, on the platform that has one. */
  backGlyph(): { size: number; tint: string };
}

/**
 * The look of a page. The header is the app's own on the desktops and the web — `nsh/base` draws
 * no title and no back button there — so it takes the roles the theme keeps for a header wherever
 * it comes from (`header.headerStyle`: the page's fill, the text color, the accent for the tint)
 * and a hairline of `colors.border` under it. iOS and Android draw the system header instead: this
 * look draws nothing there. The page is the fill the stack stands on.
 */
export function navPageLook(): NavPageLook {
  return {
    page: (): ViewStyle => ({
      flex: 1,
      backgroundColor: colors.background,
    }),
    header: (): ViewStyle => ({
      height: navPageSize.height,
      flexDirection: 'row',
      alignItems: 'center',
      gap: navPageSize.gap,
      paddingHorizontal: navPageSize.padding,
      backgroundColor: header.headerStyle.backgroundColor,
      borderBottomWidth: stroke.hairline,
      borderBottomColor: colors.border,
    }),
    title: (): TextStyle => ({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      fontSize: navPageSize.title,
      fontWeight: font.weight('title'),
      color: header.headerStyle.color,
      numberOfLines: 1,
    }),
    backGlyph: (): { size: number; tint: string } => ({
      size: navPageSize.glyph,
      tint: header.headerStyle.tintColor,
    }),
  };
}

/** What a page reads from the stack it stands in: how many pages it holds, and how to leave one. */
export type NavPageSlot = {
  /** The pages on the stack, the one shown included: more than one means a page to go back to. */
  pages: () => number;
  /** Leaves the page, as the header's back button does: the page's `onBackPress` first, then the pop
   * `popOnBack` allows. */
  back: () => void;
};

const NavPageSlotContext = context<NavPageSlot | null>(null);

/** A stack's props: its routes, the page shown, and the rest of `nsh/base`'s `NavStack`. */
export type NavStackProps<R> = BaseNavStackProps<R>;

/**
 * A stack of pages, one shown at a time, telling each page how deep the stack is and how to leave it.
 * Every prop of `nsh/base`'s [`NavStack`](https://nsh.dev/elements/nav-stack) passes through; `style`
 * goes over the look's. The slot is given around the stack, not around each page: `nsh/base` reads
 * what a route renders to find the `<NavPage>` it turns into a screen, so nothing may wrap it.
 */
export function NavStack<R>(props: NavStackProps<R>) {
  const [, rest] = split(props, ['children', 'style']);
  const look = navStackLook();
  return (
    <NavPageSlotContext.Provider
      value={{
        pages: () => props.state.routes().length,
        back: () => props.state.pop(),
      }}
    >
      <BaseNavStack {...rest} style={[look.root(), props.style ?? null]}>
        {props.children}
      </BaseNavStack>
    </NavPageSlotContext.Provider>
  );
}

/** `PageHeader`'s props: a page's title, its trailing item, and what its back button reads. */
export type PageHeaderProps = {
  /** The page's `title`: text on iOS and Android's system header, and this header's on the rest. */
  title?: string;
  /** The page's `headerRight`: the system header's trailing item, and this one's. */
  right?: JSX.Element;
  /** The page below this one, when there is one: the back button's press. */
  back?: () => void;
  /** Whether it has one: a page below the one shown. */
  above: () => boolean;
};

/**
 * The header the desktops and the web draw: the back button while `above()` says there is a page
 * below, the title, and the trailing slot. `NavPage` draws it for you; pass it to
 * `NavPage`'s `header` when a page's header is a header with something added to it, so Back keeps
 * the page's `onBackPress` and the stack's pop.
 */
export function PageHeader(props: PageHeaderProps) {
  const look = navPageLook();
  return (
    <View style={look.header()}>
      <If when={props.above()}>
        <IconButton accessibilityLabel="Back" onPress={() => props.back?.()}>
          <Icon
            icon={ChevronLeft}
            size={look.backGlyph().size}
            tint={look.backGlyph().tint}
          />
        </IconButton>
      </If>
      <Text style={look.title()}>{props.title ?? ''}</Text>
      <If when={props.right}>{props.right}</If>
    </View>
  );
}

/**
 * The page's header: the element drawn there, or a function of the page it heads, which gets the
 * slot the header `NavPage` draws for you reads — so a header of the app's own answers Back the way
 * that one does, without the page's `onBackPress` and the stack being threaded through it.
 *
 * A function, because `nsh/base` mounts the header in the page's own header host, where what the
 * page provides around its children does not reach: an element passed here reads the stack's slot,
 * not the page's.
 */
export type NavPageHeader = JSX.Element | ((page: NavPageSlot) => JSX.Element);

/**
 * A page of the stack. Every prop of `nsh/base`'s [`NavPage`](https://nsh.dev/elements/nav-page)
 * passes through but `header`, which also takes a function of the page; `style` goes over the
 * look's. On the desktops and the web it draws the page's header for you — the back button while
 * there is a page below, `title`, and `headerRight` at its trailing edge — unless `header` says what
 * to draw instead; iOS and Android show their system header, which takes `title` and `headerRight`
 * itself, and this one does not draw.
 */
export type NavPageProps = Omit<BaseNavPageProps, 'header'> & {
  header?: NavPageHeader;
};

/** A page of the stack: its `header` on the desktops and the web, its content below it. */
export function NavPage(props: NavPageProps) {
  const slot = NavPageSlotContext();
  const look = navPageLook();
  const [, rest] = split(props, ['header', 'style', 'children']);
  /** Whether a page stands below this one, so the header has a back button to offer. */
  const above = () => slot != null && slot.pages() > 1;
  /** Whether the page has a header to draw: a back button to offer, a title, or a trailing action. */
  const hasHeader = () =>
    props.title != null || props.headerRight != null || above();
  /** The user pressed back: `onBackPress` first, as the platform's back buttons do, then the pop
   * `popOnBack` allows. */
  const back = () => {
    props.onBackPress?.();
    if (props.popOnBack !== false) slot?.back();
  };
  // The page hands a header of the app's own what it reads to draw a back button of its own: the
  // same depth and the same press the drawn header uses (a custom one replaces it, not what it does).
  const pageSlot: NavPageSlot = { pages: () => slot?.pages() ?? 1, back };
  const own = props.header;
  // Read once, here where the header is drawn.
  const header =
    own == null ? (
      <If when={hasHeader()}>
        <PageHeader
          title={props.title}
          right={props.headerRight}
          back={slot ? back : undefined}
          above={above}
        />
      </If>
    ) : typeof own === 'function' ? (
      own(pageSlot)
    ) : (
      own
    );
  return (
    <BaseNavPage
      {...rest}
      header={header}
      style={[look.page(), props.style ?? null]}
    >
      {props.children}
    </BaseNavPage>
  );
}
