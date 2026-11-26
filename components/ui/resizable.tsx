// Resizable panels: `resizableHandleLook` and the group / panel that wear it.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import { split } from 'nsh';
import {
  ResizablePanel as BasePanel,
  ResizablePanelGroup as BaseGroup,
  type ResizablePanelGroupProps as BaseGroupProps,
  type ResizablePanelProps as BasePanelProps,
} from 'nsh/base';

import { joinClass } from '../../lib/ui/class-names';

/**
 * The thumb of a resize handle (`handleThumbClass`), as gpui-component
 * draws it: none at rest, so the hairlines stay quiet; a faint pill grows
 * in under the pointer, and a long solid one while pressed or dragged.
 */
export const handleThumb =
  'h-11 w-[3px] rounded-full bg-muted-foreground opacity-0 scale-y-0 transition duration-150 ease-out group-hover:opacity-40 group-hover:scale-y-[0.45] group-active:opacity-90 group-active:scale-y-100';

/** A resize handle's hairline, which stays as it is (its thumb shows where
 * to drag): `across` a row of panels, `along` a column. */
export const resizableHandle = {
  across: 'h-full w-px bg-border',
  along: 'h-px w-full bg-border',
  thumb: handleThumb,
};

/** A `ResizablePanelGroup`'s handles (spread it): the hairline across a
 * `horizontal` group's row, along a `vertical` one's column, and the
 * thumb. */
export function resizableHandleLook(axis: 'horizontal' | 'vertical') {
  return {
    handleClass:
      axis === 'horizontal' ? resizableHandle.across : resizableHandle.along,
    handleThumbClass: handleThumb,
  };
}

/** What a resize handle announces when its group is given no label of its own. */
export const RESIZE_HANDLE_LABEL = 'Resize';

/** Every prop of `nsh/base` ResizablePanelGroup, plus the handle's look. */
export type ResizablePanelGroupProps = BaseGroupProps;

/** Every prop of `nsh/base` ResizablePanel. */
export type ResizablePanelProps = BasePanelProps;

/** Panels in a row or column. Dragging a handle stays in base; this paints the hairline and thumb. */
export function ResizablePanelGroup(props: ResizablePanelGroupProps) {
  const [, rest] = split(props, [
    'class',
    'style',
    'axis',
    'handleClass',
    'handleStyle',
    'handleThumbClass',
    'handleThumbStyle',
    'handleAccessibilityLabel',
  ]);
  const axis = props.axis === 'vertical' ? 'vertical' : 'horizontal';
  const look = resizableHandleLook(axis);
  return (
    <BaseGroup
      {...rest}
      axis={props.axis}
      handleAccessibilityLabel={
        props.handleAccessibilityLabel ?? RESIZE_HANDLE_LABEL
      }
      class={props.class}
      style={props.style}
      handleClass={joinClass(look.handleClass, props.handleClass)}
      handleStyle={props.handleStyle}
      handleThumbClass={joinClass(
        look.handleThumbClass,
        props.handleThumbClass,
      )}
      handleThumbStyle={props.handleThumbStyle}
    />
  );
}

/** One panel. `visible={false}` is the collapsed state. */
export function ResizablePanel(props: ResizablePanelProps) {
  const [, rest] = split(props, ['class', 'style']);
  return <BasePanel {...rest} class={props.class} style={props.style} />;
}
