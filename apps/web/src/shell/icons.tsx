import type { ReactElement } from 'react';

import { GLYPHS } from './glyphs.ts';
import type { IconName, Primitive } from './glyphs.ts';

// The Icon component, which draws one of the chrome's original glyphs (glyphs.ts; ADR 0012,
// decision 3) 1.5 px wide in currentColor, with round caps and joins.

/** The SVG element that draws one primitive. */
function shape(primitive: Primitive, key: number): ReactElement {
  switch (primitive[0]) {
    case 'line': {
      const [, x1, y1, x2, y2] = primitive;
      return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} />;
    }
    case 'rect': {
      const [, x, y, width, height, radius] = primitive;
      return <rect key={key} x={x} y={y} width={width} height={height} rx={radius} />;
    }
    case 'circle':
      return <circle key={key} cx={primitive[1]} cy={primitive[2]} r={primitive[3]} />;
    case 'ellipse': {
      const [, cx, cy, rx, ry] = primitive;
      return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} />;
    }
    case 'polyline':
      return <polyline key={key} points={primitive.slice(1).join(' ')} />;
    case 'polygon':
      return <polygon key={key} points={primitive.slice(1).join(' ')} />;
    case 'dot':
      return (
        <circle
          key={key}
          cx={primitive[1]}
          cy={primitive[2]}
          r={1}
          fill="currentColor"
          stroke="none"
        />
      );
    case 'path':
      return <path key={key} d={primitive[1]} />;
  }
}

/**
 * One glyph at a size in CSS pixels, 20 by default, drawn in the text colour. It is decoration:
 * the control that shows it carries the name, so it is hidden from assistive technology.
 */
export function Icon({ name, size = 20 }: { readonly name: IconName; readonly size?: number }) {
  return (
    <svg
      data-glyph={name}
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name].map(shape)}
    </svg>
  );
}
