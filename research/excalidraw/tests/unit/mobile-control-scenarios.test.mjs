// Checks the mobile control scenarios 37-40, written from the names and positions that s22, s34
// and s37 saved: they name only driver steps, assert the portrait metrics first and last, never
// navigate, emulate, reload or reach the clipboard or files, click buttons only by an exact name
// those sessions listed, send touch input apart from 40's typed word and hex code, and lay out
// the handles (R-36), the shape choice and alignments (R-24, R-51), the arrow types and Edit arrow
// (R-30) and the colour, Duplicate, text and freehand controls (R-10, R-11) as their descriptions
// say. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;

const HANDLES = '37-handles-multi-resize-mobile';
const SHAPES = '38-shape-choice-align-mobile';
const ARROWS = '39-arrow-type-edit-mobile';
const COLOURS = '40-colour-duplicate-text-draw-mobile';
const ALL = [HANDLES, SHAPES, ARROWS, COLOURS];
const PORTRAIT = {
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3,
  screenWidth: 390,
  screenHeight: 844,
  orientationType: 'portrait-primary',
  orientationAngle: 0,
  maxTouchPoints: 5,
  coarsePointer: true,
  canvasBacking: true,
};
// Selection, Draw, Rectangle, Arrow and Text in the bottom toolbar.
const TOOLBAR = ['81,812', '127,812', '218,812', '263,812', '309,812'];
const BUTTONS = {
  [HANDLES]: [],
  [SHAPES]: ['Diamond', 'Ellipse', 'Actions', 'Align right', 'Align bottom', 'Center horizontally'],
  [ARROWS]: ['Arrow type', 'Edit arrow'],
  [COLOURS]: ['Stroke', 'Blue — s', 'Shade', 'Actions', 'Duplicate', 'Show font picker'].concat(
    'Background',
  ),
};
const KEYBOARD = ['key', 'keyDown', 'keyUp', 'type'];
const roles = (name) => stepsOf(name).filter((step) => step.do === 'role');

describe('the mobile control scenarios', () => {
  it.each(ALL)('%s names only steps that the driver has', (name) => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of stepsOf(name)) expect(known.has(step.do), step.do).toBe(true);
  });

  it.each(ALL)('%s asserts the portrait metrics first and last and is not runLast', (name) => {
    const steps = stepsOf(name);
    expect(steps[0]).toEqual({ do: 'assertMetrics', expect: PORTRAIT });
    expect(steps.at(-1)).toEqual({ do: 'assertMetrics', expect: PORTRAIT });
    expect(scenario(name).runLast).toBeUndefined();
  });

  it.each(ALL)(
    '%s never navigates, reloads, emulates or reaches the clipboard or files',
    (name) => {
      const kinds = stepsOf(name).map((step) => step.do);
      const refused = ['emulate', 'colorScheme', 'goto', 'fixture', 'reload', 'download', 'url'];
      refused.push('grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog');
      for (const kind of refused) expect(kinds).not.toContain(kind);
    },
  );

  it.each(ALL)('%s uses no mouse and clicks buttons only by an exact saved name', (name) => {
    const kinds = stepsOf(name).map((step) => step.do);
    for (const kind of ['click', 'move', 'drag', 'path', 'wheel', 'selector']) {
      expect(kinds).not.toContain(kind);
    }
    const buttons = roles(name).filter((step) => step.role === 'button');
    for (const step of buttons) expect(step.exact).toBe(true);
    const names = buttons.map((step) => step.name).filter((n) => !['Undo', 'Redo'].includes(n));
    expect([...new Set(names)].sort()).toEqual([...BUTTONS[name]].sort());
  });

  it.each(ALL)('%s touches the canvas between the bars, or a toolbar tool', (name) => {
    for (const step of stepsOf(name)) {
      const points =
        step.do === 'tap' ? [step.at] : step.do === 'touchDrag' ? [...step.from, ...step.to] : [];
      for (const [x, y] of points) {
        if (y > 740) expect(TOOLBAR).toContain(`${x},${y}`);
        else expect(x >= 0 && x <= 390 && y >= 60, `${x},${y}`).toBe(true);
      }
    }
  });

  it.each(ALL)('%s gives every probe and every saved capture its own label', (name) => {
    const labels = stepsOf(name).flatMap((step) =>
      step.label ? [`${step.do}:${step.label}`] : step.save ? [`aria:${step.save}`] : [],
    );
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('keyboard input in the mobile control scenarios', () => {
  it('is absent from 37, 38 and 39', () => {
    for (const name of [HANDLES, SHAPES, ARROWS]) {
      for (const kind of KEYBOARD) expect(stepsOf(name).map((s) => s.do)).not.toContain(kind);
    }
  });

  it('in 40 is the hex code after a tap on the hex box, and one word after a Text tool tap', () => {
    const steps = stepsOf(COLOURS);
    const keyed = steps.flatMap((step, i) => (KEYBOARD.includes(step.do) ? [i] : []));
    expect(keyed.map((i) => steps[i])).toEqual([
      { do: 'key', key: 'Control+a' },
      { do: 'type', text: '123abc' },
      { do: 'key', key: 'Enter' },
      { do: 'type', text: 'Plan' },
    ]);
    const box = { do: 'role', role: 'textbox', name: 'Stroke', exact: true };
    expect(steps.slice(keyed[0] - 2, keyed[0])).toEqual([box, { do: 'wait', ms: 300 }]);
    const taps = steps.slice(0, keyed[3]).filter((s) => s.do === 'tap');
    expect(taps.slice(-2).map((s) => s.at)).toEqual([
      [309, 812],
      [60, 300],
    ]);
    expect(roles(COLOURS).filter((s) => s.role !== 'button')).toEqual([box]);
  });
});

// The rectangle that a Rectangle-tool drag drew: [x, y, width, height].
const drawnBy = (step) => {
  const [[x0, y0]] = step.from;
  const [[x1, y1]] = step.to;
  return [x0, y0, x1 - x0, y1 - y0];
};

describe('the handle scenario (R-36)', () => {
  const steps = stepsOf(HANDLES);
  const drags = steps.filter((s) => s.do === 'touchDrag');

  it('starts each single-element handle drag 4 px outside the handle it names', () => {
    const at = ([x, y, w, h]) => ({
      sw: [x - 4, y + h + 4],
      ne: [x + w + 4, y - 4],
      w: [x - 4, y + h / 2],
      s: [x + w / 2, y + h + 4],
    });
    const handles = ['sw', 'ne', 'w', 's'];
    handles.forEach((handle, k) => {
      const [box, drag] = [drawnBy(drags[2 * k]), drags[2 * k + 1]];
      expect(drag.from[0], handle).toEqual(at(box)[handle]);
      const probe = steps.indexOf(drag) + 2;
      expect(steps[probe]).toEqual({ do: 'scene', label: `37-${handle}` });
    });
  });

  it("starts the pair's drag 6 px outside the corner of both rectangles and undoes it", () => {
    const [a, b] = drags.slice(8, 10).map(drawnBy);
    const corner = [Math.max(a[0] + a[2], b[0] + b[2]), Math.max(a[1] + a[3], b[1] + b[3])];
    const [box, resize] = drags.slice(10, 12);
    expect(box.from[0][0] < Math.min(a[0], b[0]) && box.to[0][1] > corner[1]).toBe(true);
    expect(resize.from[0]).toEqual([corner[0] + 6, corner[1] + 6]);
    const after = roles(HANDLES).map((s) => s.name);
    expect(after).toEqual(['Undo', 'Redo', 'Undo', 'Redo']);
  });
});

describe('the shape-choice and alignment scenario (R-24, R-51)', () => {
  const steps = stepsOf(SHAPES);

  it('picks Diamond and Ellipse right after a tap on the Rectangle tool, then draws', () => {
    for (const shape of ['Diamond', 'Ellipse']) {
      const at = steps.findIndex((s) => s.name === shape);
      const before = steps.slice(0, at).filter((s) => s.do === 'tap');
      expect(before.at(-1).at, shape).toEqual([218, 812]);
      const next = steps.slice(at + 1).find((s) => s.do !== 'wait');
      expect(next.do, shape).toBe('touchDrag');
    }
  });

  it('applies each alignment to a fresh box selection of all three shapes, then Undo', () => {
    const shapes = steps
      .filter((s) => s.do === 'touchDrag')
      .slice(1, 3)
      .map(drawnBy);
    for (const name of ['Align right', 'Align bottom', 'Center horizontally']) {
      const at = steps.findIndex((s) => s.name === name);
      const inputs = steps.slice(at - 6, at).filter((s) => s.do !== 'wait');
      expect(
        inputs.map((s) => s.do),
        name,
      ).toEqual(['tap', 'touchDrag', 'role']);
      const [[x0, y0]] = inputs[1].from;
      const [[x1, y1]] = inputs[1].to;
      for (const [x, y, w, h] of shapes)
        expect(x > x0 && y > y0 && x + w < x1 && y + h < y1).toBe(true);
      expect(steps.slice(at + 1).find((s) => s.do === 'role').name).toBe('Undo');
    }
  });
});

// The first tap after an index.
const nextTap = (steps, index) => steps.slice(index + 1).find((s) => s.do === 'tap');

describe('the arrow-type and Edit arrow scenario (R-30)', () => {
  const steps = stepsOf(ARROWS);

  it("touches each of s34's three radio centres once, each from a freshly opened popover", () => {
    const opens = steps.flatMap((s, i) => (s.name === 'Arrow type' ? [i] : []));
    const radios = opens.map((i) => nextTap(steps, i).at);
    expect(radios).toEqual([
      [70, 690],
      [150, 690],
      [110, 690],
    ]);
    for (const i of opens.slice(1)) {
      const taps = steps.slice(i - 4, i).filter((s) => s.do === 'tap');
      expect(taps.map((s) => s.at)).toEqual([
        [350, 600],
        [180, 560],
      ]);
    }
  });

  it('undoes an added point, and the end-point drag made with Edit arrow', () => {
    const order = roles(ARROWS).map((s) => s.name);
    expect(order).toEqual(
      ['Arrow type', 'Arrow type', 'Undo', 'Redo', 'Arrow type'].concat([
        'Undo',
        'Redo',
        'Edit arrow',
        'Undo',
      ]),
    );
    const edit = steps.findIndex((s) => s.name === 'Edit arrow');
    const drag = steps.slice(edit).find((s) => s.do === 'touchDrag');
    expect(drag.from).toEqual([[300, 560]]);
  });
});
