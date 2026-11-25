// The inset track a toolbar and a toggle group share.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import type { ViewStyle } from 'nsh';

import {
  colors,
  rounded,
  shape,
  stroke,
  terminal,
  TERMINAL_GAP,
} from './theme';

/** Options of `toolbarTrack`. */
export interface ToolbarTrackOptions {
  /** A column of tools (a `Toolbar`'s `axis="vertical"`). */
  vertical?: boolean;
}

/**
 * The inset track a toolbar or a `ToggleGroup` sits in: its tools in a row
 * (a column when `vertical`) 2 points apart, 3 points inside its edge, on
 * the inset with the border's edge. A terminal sets each tool as its label
 * two columns apart and wraps a row too narrow for them.
 */
export function toolbarTrack(o?: ToolbarTrackOptions): ViewStyle {
  return {
    flexDirection: o?.vertical ? 'column' : 'row',
    alignItems: o?.vertical && terminal ? 'flex-start' : 'center',
    gap: terminal ? TERMINAL_GAP : 2,
    flexWrap: terminal && !o?.vertical ? 'wrap' : undefined,
    padding: 3,
    ...rounded(shape.control),
    borderWidth: stroke.control,
    borderColor: colors.border,
    backgroundColor: colors.inset,
  };
}
