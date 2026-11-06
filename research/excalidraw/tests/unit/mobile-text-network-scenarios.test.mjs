// Checks the mobile scenarios 41-44: the text controls (R-10, R-40), the Mermaid insert's undo and
// one Text to diagram generation (R-63), and one Export to Link upload (R-56). They name only
// driver steps, assert the portrait metrics first and last, never navigate, emulate, reload or
// reach the clipboard or files, click only by exact names that s16, s37 and s41 saved, follow no
// link, type only self-authored text, send at most one generation and one upload, and keep the
// upload's link out of every capture and every unsaved ARIA preview. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;

const TEXT = '41-text-align-font-mobile';
const MERMAID = '42-mermaid-undo-mobile';
const GENERATE = '43-text-to-diagram-mobile';
const LINK = '44-export-link-mobile';
const ALL = [TEXT, MERMAID, GENERATE, LINK];
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
// Rectangle and Text in the bottom toolbar, and the main menu button.
const CHROME = ['218,812', '309,812', '28,28'];
const PROMPT = 'Start typing your diagram idea here... (Shift + Enter for new line)';
const NAMES = {
  [TEXT]: ['button:Text align', 'button:Show font picker', 'button:Nunito'],
  [MERMAID]: ['button:More tools', 'menuitem:Mermaid to Excalidraw', 'button:Insert'].concat(
    'button:Close',
  ),
  [GENERATE]: ['button:More tools', 'menuitem:Text to diagram AI', `textbox:${PROMPT}`].concat(
    'button:Insert',
    'button:Close',
  ),
  [LINK]: ['menuitem:Save to...', 'button:Export to Link', 'button:Close'],
};
const roles = (name) => stepsOf(name).filter((step) => step.do === 'role');
const kindsOf = (name) => stepsOf(name).map((step) => step.do);

describe('the mobile text, generation and link scenarios', () => {
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

  it.each(ALL)('%s uses no mouse and clicks only exact saved names, never a link', (name) => {
    for (const kind of ['click', 'move', 'drag', 'path', 'wheel', 'selector']) {
      expect(kindsOf(name)).not.toContain(kind);
    }
    for (const step of roles(name)) expect(step.exact).toBe(true);
    const named = roles(name)
      .map((step) => `${step.role}:${step.name}`)
      .filter((n) => !['button:Undo', 'button:Redo'].includes(n));
    expect([...new Set(named)].sort()).toEqual([...NAMES[name]].sort());
  });

  it.each(ALL)('%s touches the canvas between the bars, a toolbar tool or the menu', (name) => {
    for (const step of stepsOf(name)) {
      const points =
        step.do === 'tap' ? [step.at] : step.do === 'touchDrag' ? [...step.from, ...step.to] : [];
      for (const [x, y] of points) {
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

describe('typing and requests in the text and generation scenarios', () => {
  it('41 types one word after a Text tool tap, and undoes the font straight after', () => {
    const steps = stepsOf(TEXT);
    expect(keyboard(TEXT)).toEqual([{ do: 'type', text: 'Plan' }]);
    const typed = steps.findIndex((s) => s.do === 'type');
    const taps = steps.slice(0, typed).filter((s) => s.do === 'tap');
    expect(taps.map((s) => s.at)).toEqual([
      [309, 812],
      [60, 300],
    ]);
    const font = steps.findIndex((s) => s.name === 'Nunito');
    const next = steps.slice(font + 1).find((s) => !['wait', 'scene', 'appState'].includes(s.do));
    expect(next.name).toBe('Undo');
  });

  it('42 types nothing and taps Insert once', () => {
    expect(keyboard(MERMAID)).toEqual([]);
    expect(roles(MERMAID).filter((s) => s.name === 'Insert')).toHaveLength(1);
  });

  it('43 types one prompt into the named box and submits it with one Enter', () => {
    const steps = stepsOf(GENERATE);
    expect(keyboard(GENERATE)).toEqual([
      { do: 'type', text: 'A flowchart with three steps: plan, build, test' },
      { do: 'key', key: 'Enter' },
    ]);
    const typed = steps.findIndex((s) => s.do === 'type');
    expect(steps[typed - 2]).toEqual({ do: 'role', role: 'textbox', name: PROMPT, exact: true });
    const enter = steps.findIndex((s) => s.key === 'Enter');
    expect(steps[enter + 1].ms).toBeGreaterThanOrEqual(20000);
    expect(JSON.stringify(steps)).not.toMatch(/Generate|Sign|consent/iu);
  });
});

describe('the Export to Link scenario (R-56)', () => {
  const steps = stepsOf(LINK);
  const exportAt = steps.findIndex((s) => s.name === 'Export to Link');

  it('uploads once, types nothing and never touches the other Save to... entries', () => {
    expect(roles(LINK).filter((s) => s.name === 'Export to Link')).toHaveLength(1);
    expect(keyboard(LINK)).toEqual([]);
    expect(JSON.stringify(steps)).not.toMatch(/Save to file|"Export"|Excalidraw\+/u);
  });

  it('refuses every capture while a dialog is open and saves every ARIA read', () => {
    const shots = steps.filter((s) => s.do === 'screenshot');
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) expect(shot.refuseIf).toEqual(['[role=dialog]']);
    for (const read of steps.filter((s) => s.do === 'aria')) expect(read.save).toBeTruthy();
  });

  it('reads the URL shape before and after the upload and the storage on both sides', () => {
    const urls = steps.flatMap((s, i) => (s.do === 'url' ? [i] : []));
    expect(urls.filter((i) => i < exportAt)).toHaveLength(1);
    expect(urls.filter((i) => i > exportAt)).toHaveLength(2);
    const storage = steps.flatMap((s, i) => (s.do === 'storage' ? [i] : []));
    expect(storage.map((i) => i > exportAt)).toEqual([false, true]);
  });
});
