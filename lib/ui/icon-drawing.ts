// A lucide icon drawn away from a view: as canvas calls (`drawIcon`, what `Icon` draws) and as an SVG
// `data:` URL (`iconImage`, for a native menu item's, a tray's or an `Image`'s icon). Free of imports
// but lucide's types, so a unit test reads what it draws without NSH.

import type { IconNode } from 'lucide';

/** lucide's box: 24 units square, its viewBox and the unit a stroke's weight is measured in. */
export const ICON_BOX = 24;

/** lucide's own stroke: 2 of the box's 24 units, round ends and joins. */
export const ICON_WEIGHT = 2;

/** One element of an `IconNode`: its tag and its SVG attributes. */
type IconElement = IconNode[number];

/** How a path's SVG data becomes something the canvas can stroke or fill. */
type IconPathOf<P> = (d: string) => P;

/**
 * The canvas calls an icon makes (a `CanvasRenderingContext2D` subset, so the two agree), with
 * `P` whatever a stroke's path is: the platform's `Path2D` in the app, a note of the data in a test.
 */
export interface IconCanvas<P> {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    start: number,
    end: number,
  ): void;
  roundRect(x: number, y: number, w: number, h: number, radius?: number): void;
  stroke(path?: P): void;
  fill(path?: P): void;
}

/** A full turn, the end angle of a closed circle or an ellipse. */
const TURN = Math.PI * 2;

/** The shapes lucide writes besides paths and point lines. */
const SHAPES: ReadonlySet<string> = new Set([
  'circle',
  'ellipse',
  'rect',
  'line',
]);

/** An attribute as a number: lucide writes them as strings. */
const attrNumber = (attrs: IconElement[1], name: string, fallback = 0) => {
  const value = attrs[name];
  return value == null ? fallback : Number(value);
};

/** A `points` attribute as flat x, y coordinates. */
const coordinates = (attrs: IconElement[1]) => {
  const value = String(attrs.points ?? '').trim();
  return value === '' ? [] : value.split(/[\s,]+/).map(Number);
};

/** One element, on a path of its own: stroked, or filled in the same color (`fill`). */
function drawElement<P>(
  tag: string,
  attrs: IconElement[1],
  canvas: IconCanvas<P>,
  options: { fill: boolean; path: IconPathOf<P> },
) {
  const paint = () => (options.fill ? canvas.fill() : canvas.stroke());

  // A path is drawn from its own data, which the platform parses.
  if (tag === 'path') {
    const d = String(attrs.d ?? '');
    if (d === '') return;
    const drawn = options.path(d);
    if (options.fill) canvas.fill(drawn);
    else canvas.stroke(drawn);
    return;
  }

  // A line through points, closed for a polygon: too few of them draw nothing.
  if (tag === 'polyline' || tag === 'polygon') {
    const points = coordinates(attrs);
    if (points.length < 4) return;
    canvas.beginPath();
    canvas.moveTo(points[0], points[1]);
    for (let i = 2; i + 1 < points.length; i += 2)
      canvas.lineTo(points[i], points[i + 1]);
    if (tag === 'polygon') canvas.closePath();
    paint();
    return;
  }

  // A shape with a curve of its own. Anything else (lucide has no other tags) draws nothing.
  if (!SHAPES.has(tag)) return;
  canvas.beginPath();
  switch (tag) {
    case 'circle':
      canvas.arc(
        attrNumber(attrs, 'cx'),
        attrNumber(attrs, 'cy'),
        attrNumber(attrs, 'r'),
        0,
        TURN,
      );
      break;
    case 'ellipse':
      canvas.ellipse(
        attrNumber(attrs, 'cx'),
        attrNumber(attrs, 'cy'),
        attrNumber(attrs, 'rx'),
        attrNumber(attrs, 'ry'),
        0,
        0,
        TURN,
      );
      break;
    case 'rect':
      // lucide's rects carry one radius, `rx` (`ry` repeats it): a rounded corner on all four.
      canvas.roundRect(
        attrNumber(attrs, 'x'),
        attrNumber(attrs, 'y'),
        attrNumber(attrs, 'width'),
        attrNumber(attrs, 'height'),
        attrNumber(attrs, 'rx', attrNumber(attrs, 'ry')),
      );
      break;
    case 'line':
      canvas.moveTo(attrNumber(attrs, 'x1'), attrNumber(attrs, 'y1'));
      canvas.lineTo(attrNumber(attrs, 'x2'), attrNumber(attrs, 'y2'));
      break;
  }
  paint();
}

/**
 * Draws `icon` (a lucide `IconNode`) with canvas calls, each element on a path of its own:
 * stroked, or filled in the same color with `fill` (the solid icons, such as `Play`). `path` says
 * how a `d` becomes a drawable path: `new Path2D(d)` in the app, a recorder's note in a test.
 */
export function drawIcon<P>(
  icon: IconNode,
  canvas: IconCanvas<P>,
  options: { fill?: boolean; path: IconPathOf<P> },
): void {
  const fill = options.fill === true;
  for (const [tag, attrs] of icon)
    drawElement(tag, attrs, canvas, { fill, path: options.path });
}

/** One element of a lucide node as an SVG element; an attribute lucide leaves out is left out. */
function svgElement(tag: string, attrs: IconNode[number][1]) {
  const written = Object.entries(attrs)
    .filter(([, value]) => value != null)
    .map(([name, value]) => `${name}="${String(value)}"`)
    .join(' ');
  return `<${tag} ${written}/>`;
}

/** What `iconImage` writes besides the icon itself. */
export type IconImageOptions = {
  /** The stroke in the icon's 24-unit box (2 by default, lucide's own). */
  weight?: number;
  /**
   * The stroke's color: `currentColor` by default, so whatever draws the image colors it (a menu,
   * in its text color). A fixed ink makes the image a template image instead, which `tintColor`
   * recolors: `#000` for that, never the interface's own color.
   */
  ink?: string;
};

/**
 * `icon` (a lucide `IconNode`) as an SVG `data:` URL: the image form a native menu item's `icon`
 * takes (`Menu.popup`'s items, the menu bar's, the tray's), which take an image rather than a view.
 * Its stroke is `currentColor` unless `ink` pins it, so a menu draws it in its own text color.
 */
export function iconImage(
  icon: IconNode,
  options: IconImageOptions = {},
): string {
  const stroke = options.ink ?? 'currentColor';
  const weight = options.weight ?? ICON_WEIGHT;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_BOX}" height="${ICON_BOX}" viewBox="0 0 ${ICON_BOX} ${ICON_BOX}" fill="none" stroke="${stroke}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round">${icon.map(([tag, attrs]) => svgElement(tag, attrs)).join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
