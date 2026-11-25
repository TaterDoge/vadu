// A separator: a hairline between two groups of content, the look (`separatorLook`) and the
// `Separator` that wears it.

import type { ViewProps, ViewStyle } from 'nsh';
import { split, View } from 'nsh';

import { colors, stroke } from '../../lib/ui/theme';

/**
 * Which way a separator runs: `horizontal` (across the content, between one block and the next)
 * or `vertical` (down it, between two words of a row).
 */
export type SeparatorOrientation = 'horizontal' | 'vertical';

/**
 * A separator's look: a hairline one point thick in the theme's edge color (`colors.border`),
 * across the content as `horizontal`, as tall as its row as `vertical`, and never shrunk by a
 * tight row. Spread it on a `View` of your own, or lay your boxes out by it.
 */
export function separatorLook(
  orientation: SeparatorOrientation = 'horizontal',
): ViewStyle {
  return {
    flexShrink: 0,
    backgroundColor: colors.border,
    ...(orientation === 'vertical'
      ? { width: stroke.hairline, alignSelf: 'stretch' }
      : { height: stroke.hairline, alignSelf: 'stretch', width: '100%' }),
  };
}

/**
 * A separator's props. Besides `orientation` and `decorative`, every `nsh` view prop passes
 * through (`style`, `accessibilityLabel`, `role`, …); `style` goes over the look's.
 */
export type SeparatorProps = Omit<ViewProps, 'children'> & {
  /** Default `horizontal`: across the content. `vertical` runs down it, as tall as its row. */
  orientation?: SeparatorOrientation;
  /**
   * Default `true`: a line drawn for the eye only, hidden from screen readers. `false` exposes it
   * so they can reach it — `nsh` has no `separator` role, so it is a `group` (a boundary between
   * groups of related content); give it an `accessibilityLabel` saying what it divides.
   */
  decorative?: boolean;
};

/**
 * A separator, after shadcn/ui's: one point thick, in the theme's edge color, as wide as its
 * container across or as tall as its row down. It draws no text and takes no presses;
 * `orientation` is the way it runs. Decorative by default — a separator is usually a line of the
 * layout, and a screen reader should walk from one group of content to the next without stopping
 * on it; `decorative={false}` keeps it in the accessibility tree.
 */
export function Separator(props: SeparatorProps) {
  const [, rest] = split(props, ['orientation', 'decorative', 'style']);
  const decorative = props.decorative !== false;
  return (
    <View
      role={decorative ? undefined : 'group'}
      accessible={decorative ? undefined : true}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      {...rest}
      style={[
        separatorLook(props.orientation ?? 'horizontal'),
        props.style ?? null,
      ]}
    />
  );
}
