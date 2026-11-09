import type { DocumentState } from './document.ts';
import type { Attachment, Box, Element, Point } from './elements.ts';
import { compareCodeUnits, compareDrawingOrder } from './order-key.ts';
import { CURRENT_SCHEMA, FORMAT } from './schema.ts';
import type { Style, TextBlock } from './style.ts';

// Every object is rebuilt with its keys in a fixed order and only the model's fields, so the same
// document always gives the same text, whatever order its maps and objects were filled in.

const same = <T>(value: T): T => value;

/** `{ [key]: encode(value) }`, or nothing when the optional value is absent. */
const optional = <K extends string, V, E>(key: K, value: V | undefined, encode: (value: V) => E) =>
  (value === undefined ? {} : { [key]: encode(value) }) as Readonly<Partial<Record<K, E>>>;

const point = ({ x, y }: Point) => ({ x, y });

const box = ({ x, y, width, height }: Box) => ({ x, y, width, height });

const style = ({ stroke, fill, opacity, corners, sketch }: Style) => ({
  stroke: { color: stroke.color, width: stroke.width, dash: stroke.dash },
  fill: fill === null ? null : { color: fill.color, pattern: fill.pattern },
  opacity,
  corners,
  sketch,
});

const textBlock = ({ text, font, align }: TextBlock) => ({
  text,
  font: { family: font.family, size: font.size, lineHeight: font.lineHeight },
  align,
});

const attachment = ({ target, anchor }: Attachment) => ({ target, anchor: point(anchor) });

/** A box kind's size, or a point kind's points and, for freehand, its pressures. */
function extent(element: Element) {
  if (!('points' in element)) {
    return { width: element.width, height: element.height };
  }
  const pressures = element.kind === 'freehand' ? element.pressures : undefined;
  return {
    points: element.points.map(point),
    ...optional('pressures', pressures, (values) => [...values]),
  };
}

/** The fields that only some kinds have, after the common ones. */
function kindFields(element: Element) {
  if ('points' in element) {
    return element.kind === 'arrow'
      ? {
          ...optional('start', element.start, attachment),
          ...optional('end', element.end, attachment),
          heads: { start: element.heads.start, end: element.heads.end },
          route: element.route,
          ...optional('label', element.label, textBlock),
        }
      : {};
  }
  switch (element.kind) {
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
      return optional('label', element.label, textBlock);
    case 'text':
      return { content: textBlock(element.content) };
    case 'note':
      return { label: textBlock(element.label) };
    case 'image':
      return { file: element.file, ...optional('crop', element.crop, box) };
    case 'frame':
      return { name: element.name };
  }
}

/** One element as the document format writes it: its fields in a fixed order, nothing else. */
export const encodeElement = (element: Element) => ({
  id: element.id,
  kind: element.kind,
  order: element.order,
  x: element.x,
  y: element.y,
  ...extent(element),
  rotation: element.rotation,
  style: style(element.style),
  locked: element.locked,
  ...optional('group', element.group, same),
  ...optional('link', element.link, same),
  ...kindFields(element),
  rev: element.rev,
});

/**
 * The document as JSON text: elements in drawing order and groups by identifier, without white
 * space and without the in-memory revision. The document must be valid, as every document that
 * the codec or the scene store holds is.
 */
export function encodeDocument(document: DocumentState): string {
  const groups = [...document.groups.values()]
    .sort((a, b) => compareCodeUnits(a.id, b.id))
    .map(({ id, parent }) => ({ id, ...optional('parent', parent, same) }));
  const elements = [...document.elements.values()].sort(compareDrawingOrder).map(encodeElement);
  return JSON.stringify({
    format: FORMAT,
    schema: CURRENT_SCHEMA,
    canvas: { background: document.canvas.background },
    groups,
    elements,
  });
}
