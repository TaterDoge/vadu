// Icons: lucide's nodes drawn on a canvas, the check mark as one color's SVG, and any icon as an
// image (`iconImage`) for what takes one (a native menu item).

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  type IconNode,
} from 'lucide';
import { Canvas, Image, Path2D, Text } from 'nsh';

import {
  drawIcon,
  ICON_BOX,
  ICON_WEIGHT,
  type IconCanvas,
  iconImage,
} from './icon-drawing';
import { terminal } from './theme';

// The image form of an icon, which a native menu item takes: apart from NSH, in `icon-drawing.ts`,
// so a unit test reads the SVG it writes.
export { iconImage, type IconImageOptions } from './icon-drawing';

/** SVG path data parsed once per `d` (an icon is redrawn whenever it lays out). */
const parsed = new Map<string, Path2D>();

/** The path for `d`: the platform parses the SVG data the first time an icon needs it. */
function pathOf(d: string) {
  let path = parsed.get(d);
  if (!path) {
    path = new Path2D(d);
    parsed.set(d, path);
  }
  return path;
}

/** The icons that point along the line (forward, back): mirrored from right to left. */
const directional: ReadonlySet<IconNode> = new Set<IconNode>([
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
]);

/** What `Icon` draws: a lucide node, the side of its box, and the color and weight of its stroke. */
export type IconProps = {
  /** The icon itself, as lucide exports it (`import { ChevronDown } from "lucide"`). */
  icon: IconNode;
  /** The side of its square, in points (20 by default). */
  size?: number;
  /** Its color: the stroke, and the fill when `fill` is set. */
  tint: string;
  /** The stroke in the icon's 24-unit box (2 by default, lucide's own). */
  weight?: number;
  /** Fill the shape in `tint` instead of stroking it (a solid icon, such as `Play`). */
  fill?: boolean;
};

/**
 * An icon, stroked in `tint` at `size`: a lucide node drawn in its 24-unit box, so it reads the
 * same size and weight as everywhere else lucide is used. In the terminal, which draws no icons,
 * a check is a mark (`✓`); any other icon shows nothing there.
 */
export function Icon(props: IconProps) {
  const size = props.size ?? 20;
  // The terminal draws no icons; a check is a mark there too (a chosen
  // option, the command in effect, a step done), so it keeps its glyph.
  if (terminal && props.icon === Check)
    return <Text style={{ color: props.tint }}>✓</Text>;
  return (
    <Canvas
      class={directional.has(props.icon) ? 'rtl:-scale-x-100' : undefined}
      style={{ pointerEvents: 'none', width: size, height: size }}
      draw={(cx, { width }) => {
        cx.scale(width / ICON_BOX, width / ICON_BOX);
        cx.strokeStyle = props.tint;
        cx.fillStyle = props.tint;
        cx.lineWidth = props.weight ?? ICON_WEIGHT;
        cx.lineCap = 'round';
        cx.lineJoin = 'round';
        drawIcon(props.icon, cx as IconCanvas<Path2D>, {
          fill: props.fill,
          path: pathOf,
        });
      }}
    />
  );
}

/**
 * An icon-only control's content: the icon, or in the terminal, which draws
 * no icons, `label` as text in the icon's tint (a short word: the control's
 * accessibility label keeps its full name).
 */
export function IconLabel(props: { label: string } & Omit<IconProps, 'fill'>) {
  return terminal ? (
    <Text style={{ color: props.tint }}>{props.label}</Text>
  ) : (
    <Icon
      icon={props.icon}
      size={props.size}
      tint={props.tint}
      weight={props.weight}
    />
  );
}

/**
 * The image's ink when nothing colors it: a template image takes `CheckMark`'s `tintColor`, so this
 * is no color of the interface and not a theme literal.
 */
const TEMPLATE_INK = '#000'; // color: template ink a drawing is recoloured from, never painted

/** A check mark drawn as SVG, in `tint`; `weight` is the stroke in its 24-unit box (2 by default). */
export function CheckMark(props: {
  size?: number;
  tint: string;
  weight?: number;
}) {
  const size = props.size ?? 20;
  return (
    <Image
      src={iconImage(Check, {
        weight: props.weight ?? ICON_WEIGHT,
        ink: TEMPLATE_INK,
      })}
      style={{
        pointerEvents: 'none',
        width: size,
        height: size,
        tintColor: props.tint,
      }}
    />
  );
}
