// Checks the mobile scenarios 45-47: the unnamed text and freehand radios and Autoshape (R-10,
// R-43), Delete, a fourth point, deleting a point and a group's alignment (R-11, R-30, R-51), and
// Add link (R-11). They name only driver steps, assert the portrait metrics first and last, never
// navigate, emulate, reload or reach the clipboard or files, click only by exact names that s22,
// s25, s34, s37, s41 and s46 saved (47's one textbox aside), touch the radios at the measured
// centres, press Undo straight after each change under test, and type only self-authored text. No
// browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;

const RADIOS = '45-text-freedraw-radios-autoshape-mobile';
const EDITS = '46-delete-points-group-align-mobile';
const LINK = '47-add-link-mobile';
const ALL = [RADIOS, EDITS, LINK];
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
const CHROME = ['81,812', '127,812', '218,812', '263,812', '309,812'];
const NAMES = {
  [RADIOS]: ['button:Text align', 'button:Stroke', 'button:Autoshape'],
  [EDITS]: ['button:Actions', 'button:Delete', 'button:Arrow type', 'button:Edit arrow'].concat(
    'button:Group selection',
    'button:Align left',
    'button:Align bottom',
  ),
  [LINK]: ['button:Actions', 'button:Add link', 'textbox:undefined'],
};
const roles = (name) => stepsOf(name).filter((step) => step.do === 'role');
const kindsOf = (name) => stepsOf(name).map((step) => step.do);
const pointsOf = (step) =>
  ({ tap: [step.at], touchDrag: [...(step.from ?? []), ...(step.to ?? [])] })[step.do] ??
  step.points ??
  [];

describe('the mobile radio, edit and link scenarios', () => {
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
      const refused = ['emulate', 'colorScheme', 'goto', 'fixture', 'reload', 'download'];
      refused.push('grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog');
      for (const kind of refused) expect(kindsOf(name)).not.toContain(kind);
    },
  );

  it.each(ALL)('%s uses no mouse and clicks only exact saved names', (name) => {
    for (const kind of ['click', 'move', 'drag', 'path', 'wheel', 'selector']) {
      expect(kindsOf(name)).not.toContain(kind);
    }
    for (const step of roles(name)) expect(step.exact).toBe(true);
    const named = roles(name)
      .map((step) => `${step.role}:${String(step.name)}`)
      .filter((n) => !['button:Undo', 'button:Redo'].includes(n));
    expect([...new Set(named)].sort()).toEqual([...NAMES[name]].sort());
  });

  it.each(ALL)('%s touches the canvas between the bars, or a toolbar tool', (name) => {
    for (const step of stepsOf(name)) {
      for (const [x, y] of pointsOf(step)) {
        if (y > 740 || y < 60) expect(CHROME).toContain(`${x},${y}`);
        else expect(x >= 0 && x <= 390, `${x},${y}`).toBe(true);
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

const keyboard = (name) =>
  stepsOf(name).filter((step) => ['key', 'keyDown', 'keyUp', 'type'].includes(step.do));
// The first step after `index` that is not a wait, a probe or a capture, none of which changes the
// selection.
const READS = new Set(['wait', 'scene', 'appState', 'aria', 'screenshot']);
const nextAction = (steps, index) => steps.slice(index + 1).find((s) => !READS.has(s.do));
const tapsAt = (name, at) =>
  stepsOf(name).flatMap((s, i) => (s.do === 'tap' && `${s.at}` === `${at}` ? [i] : []));

describe('the radios and Autoshape (45)', () => {
  const steps = stepsOf(RADIOS);
  const measured = [
    [88, 632],
    [128, 632],
    [168, 632],
    [208, 632],
    [88, 690],
    [128, 690],
    [168, 690],
    [62, 561],
    [101, 561],
    [141, 561],
    [62, 620],
    [101, 620],
  ];

  it('touches the radios only at the centres measured on the s46 and s41 captures', () => {
    const popover = steps.flatMap((s) =>
      s.do === 'tap' && s.at[0] < 250 && s.at[1] > 540 && s.at[1] < 700 ? [s.at] : [],
    );
    for (const at of popover) expect(measured.map(String)).toContain(String(at));
    expect(popover.map(String).sort()).toEqual(
      ['168,632', '208,632', '88,632', '128,690', '168,690', '141,561', '62,561', '101,620'].sort(),
    );
  });

  it('presses Undo straight after L, centre, bold, the second pressure and the Autoshape stroke', () => {
    for (const at of [
      [168, 632],
      [128, 690],
      [141, 561],
      [101, 620],
    ]) {
      expect(nextAction(steps, tapsAt(RADIOS, at)[0]).name).toBe('Undo');
    }
    expect(nextAction(steps, kindsOf(RADIOS).indexOf('touchPath')).name).toBe('Undo');
  });

  it('types one word after a Text tool tap and draws one closed touch path after Autoshape', () => {
    expect(keyboard(RADIOS)).toEqual([{ do: 'type', text: 'Plan' }]);
    const paths = steps.filter((s) => s.do === 'touchPath');
    expect(paths).toHaveLength(1);
    const [first, last] = [paths[0].points[0], paths[0].points.at(-1)];
    expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeLessThan(6);
    const at = steps.indexOf(paths[0]);
    expect(steps.slice(0, at).findLast((s) => s.do === 'role').name).toBe('Autoshape');
  });
});

describe('Delete, the points and the group alignment (46)', () => {
  const steps = stepsOf(EDITS);
  const index = (name) => steps.flatMap((s, i) => (s.name === name ? [i] : []));

  it('presses Undo straight after each Delete, the fourth point and each alignment', () => {
    for (const i of [...index('Delete'), ...index('Align left'), ...index('Align bottom')]) {
      expect(nextAction(steps, i).name).toBe('Undo');
    }
    const fourth = steps.findIndex((s) => s.do === 'touchDrag' && `${s.from}` === '120,220');
    expect(nextAction(steps, fourth).name).toBe('Undo');
    expect(index('Delete')).toHaveLength(2);
  });

  it('makes the arrow sharp before adding points, and deletes the point only in Edit arrow', () => {
    const sharp = tapsAt(EDITS, [70, 690])[0];
    const third = steps.findIndex((s) => s.do === 'touchDrag' && `${s.from}` === '180,250');
    expect(steps[sharp - 2].name).toBe('Arrow type');
    expect(sharp).toBeLessThan(third);
    const [, pointDelete] = index('Delete');
    expect(index('Edit arrow')[0]).toBeLessThan(pointDelete);
    expect(keyboard(EDITS)).toEqual([]);
  });
});

describe('Add link (47)', () => {
  const steps = stepsOf(LINK);

  it('stops at its first failed step and types only after clicking the textbox', () => {
    expect(scenario(LINK).continueOnError).toBe(false);
    const typed = steps.findIndex((s) => s.do === 'type');
    expect(steps[typed - 2]).toEqual({ do: 'role', role: 'textbox', exact: true });
    expect(keyboard(LINK)).toEqual([
      { do: 'type', text: 'https://example.com/planewright-r11' },
      { do: 'key', key: 'Enter' },
    ]);
  });

  it('adds the link once, undoes it straight after, and taps no element corner', () => {
    expect(roles(LINK).filter((s) => s.name === 'Add link')).toHaveLength(1);
    const enter = steps.findIndex((s) => s.key === 'Enter');
    expect(nextAction(steps, enter).name).toBe('Undo');
    const taps = steps.filter((s) => s.do === 'tap').map((s) => `${s.at}`);
    expect([...new Set(taps)].sort()).toEqual(['218,812', '350,600']);
  });
});
