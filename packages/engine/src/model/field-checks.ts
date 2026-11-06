import { TAU } from '../math/angle.ts';
import { isColor } from './color.ts';
import type { Point } from './elements.ts';
import { isElementId, isFileId, isGroupId } from './ids.ts';
import {
  branded,
  integerIn,
  listOf,
  nullable,
  numberIn,
  oneOf,
  record,
  refine,
  text,
} from './json-check.ts';
import type { Check, Issues } from './json-check.ts';
import { LIMITS } from './limits.ts';
import { isOrderKey } from './order-key.ts';
import { pointExtent, pointsAreNormalized } from './points.ts';
import {
  CORNERS,
  FILL_PATTERNS,
  FONT_FAMILIES,
  SKETCH_LEVELS,
  STROKE_DASHES,
  TEXT_ALIGNS,
} from './style.ts';
import type { Fill, FontSpec, Stroke, Style, TextBlock } from './style.ts';

// The checks for the model's field types (docs/architecture/engine/domain-model.md#invariants-and-limits).

export const color = branded(isColor, 'malformed-color');
export const elementId = branded(isElementId, 'malformed-id');
export const groupId = branded(isGroupId, 'malformed-id');
export const fileId = branded(isFileId, 'malformed-file-id');
export const orderKey = branded(isOrderKey, 'malformed-order-key');

export const coordinate = numberIn({ min: -LIMITS.coordinate, max: LIMITS.coordinate });
export const size = numberIn({ min: 0, max: LIMITS.size });
/** Opacity, pressures and attachment anchors. */
export const unit = numberIn({ min: 0, max: 1 });
export const rotation = numberIn({ min: 0, max: TAU, below: true });
export const revision = integerIn(0, Number.MAX_SAFE_INTEGER);

// A scheme is case-insensitive; anything else, such as javascript:, data: or file:, is refused.
const SAFE_LINK = /^(?:https?|mailto):/i;

export const link = refine(text(LIMITS.link), (value, path, issues) => {
  if (!SAFE_LINK.test(value)) {
    issues.push({ path, problem: 'unsafe-link' });
  }
});

/** Line breaks are '\n' only; a '\r' would be repaired by nobody, so it is refused. */
const blockText = refine(text(LIMITS.text), (value, path, issues) => {
  if (value.includes('\r')) {
    issues.push({ path, problem: 'carriage-return' });
  }
});

const stroke = record<Stroke>({
  color,
  width: numberIn({ min: 0, max: LIMITS.strokeWidth, above: true }),
  dash: oneOf(STROKE_DASHES),
});

const fill = record<Fill>({ color, pattern: oneOf(FILL_PATTERNS) });

export const style = record<Style>({
  stroke,
  fill: nullable(fill),
  opacity: unit,
  corners: oneOf(CORNERS),
  sketch: oneOf(SKETCH_LEVELS),
});

const font = record<FontSpec>({
  family: oneOf(FONT_FAMILIES),
  size: numberIn(LIMITS.fontSize),
  lineHeight: numberIn(LIMITS.lineHeight),
});

export const textBlock = record<TextBlock>({ text: blockText, font, align: oneOf(TEXT_ALIGNS) });

// A point lies within the size limit of its element's origin; the list check below makes it exact.
const offset = numberIn({ min: -LIMITS.size, max: LIMITS.size });
const point = record<Point>({ x: offset, y: offset });

function normalisedWithinSize(points: readonly Point[], path: string, issues: Issues): void {
  if (!pointsAreNormalized(points)) {
    issues.push({ path, problem: 'not-normalised' });
    return;
  }
  const { width, height } = pointExtent(points);
  if (width > LIMITS.size || height > LIMITS.size) {
    issues.push({ path, problem: 'out-of-range' });
  }
}

/** `min` to `max` points, normalised to a smallest x and y of 0, whose extent is a valid size. */
export const points = (min: number, max: number): Check<readonly Point[]> =>
  refine(listOf(point, { min, max }), normalisedWithinSize);
