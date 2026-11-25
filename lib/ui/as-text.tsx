// A control's children drawn as its text, where the control draws them.

import type { JSX, StyleProp, TextStyle } from 'nsh';
import { Text } from 'nsh';

/** What `AsText` takes: the `Text` a string child draws in, its class and its style. */
export type AsTextProps = {
  class?: string;
  style?: StyleProp<TextStyle>;
  children?: string | number | JSX.Element;
};

/**
 * One child, drawn as its control's text: a string or number is a `Text`; an array draws its
 * items this way (each string or number a `Text` of its own, an icon as it is); a getter (a child
 * that changes, `{label()}` among other children) is followed the same way where it is drawn;
 * anything else (an element) is drawn as given.
 */
function draw(
  kids: JSX.Element,
  textClass?: string,
  style?: StyleProp<TextStyle>,
): JSX.Element {
  if (typeof kids === 'string' || typeof kids === 'number') {
    return (
      <Text class={textClass} style={style}>
        {kids}
      </Text>
    );
  }
  if (Array.isArray(kids)) {
    return kids.map((kid) => draw(kid, textClass, style));
  }
  if (typeof kids === 'function') {
    const getter = kids as () => JSX.Element;
    return () => draw(getter(), textClass, style);
  }
  return kids;
}

/**
 * A control's children, drawn as its text: each string or number among them is a `Text` in
 * the control's label style, and everything else is drawn as it is — an element the control
 * lays out itself, or a child that changes, which arrives as a getter the renderer follows. A
 * component, so its props are getters, read where they are applied: place it where the children
 * are drawn, `<AsText style={look()}>{props.children}</AsText>`, and the one read of
 * `props.children` is the child position — a look in `style` is re-read on every style the
 * `Text` applies, and a child that reads a signal updates where it is drawn
 * (`references/nsh/website/docs/jsx-and-components.md`, "read it once, in the place where the
 * children go"). A control hands screen readers its name through `accessibilityLabel`; a view
 * with none is read as the texts inside it, which is what the children drawn here say.
 */
export function AsText(props: AsTextProps) {
  return (
    <>
      {(() => {
        // Read once, here where the children are drawn: each string or number becomes text,
        // anything else stays as it is.
        return draw(props.children, props.class, props.style);
      })()}
    </>
  );
}
