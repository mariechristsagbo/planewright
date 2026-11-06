// Checks the mobile scenarios 52-55: live resizing (R-23), Find on canvas, the language list and the
// canvas background (R-05) and the Library sidebar (R-15). They name only driver steps, never
// navigate, reload or reach the clipboard, files or a link, and are not runLast. 52 sends no input
// and no user agent, and asserts the metrics it asked for after every change; 53 types only its
// self-authored words and only after its textbox click; 54 picks only Français and English; 55
// clicks only the Library and Close buttons. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;
const kindsOf = (name) => stepsOf(name).map((step) => step.do);

const LADDER = '52-responsive-ladder-mobile';
const FIND = '53-find-on-canvas-mobile';
const LANGUAGE = '54-language-background-mobile';
const LIBRARY = '55-library-sidebar-mobile';
const ALL = [LADDER, FIND, LANGUAGE, LIBRARY];
const metricsOf = (width, height, orientationType, orientationAngle) => ({
  innerWidth: width,
  innerHeight: height,
  devicePixelRatio: 3,
  screenWidth: width,
  screenHeight: height,
  orientationType,
  orientationAngle,
  maxTouchPoints: 5,
  coarsePointer: true,
  canvasBacking: true,
});
const ASSERT = { do: 'assertMetrics', expect: metricsOf(390, 844, 'portrait-primary', 0) };
const names = (name) =>
  stepsOf(name)
    .filter((step) => step.do === 'role')
    .map((step) => `${step.role}:${String(step.name)}`);

describe('the responsive and inventory scenarios', () => {
  it.each(ALL)('%s names only steps that the driver has and is not runLast', (name) => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of stepsOf(name)) expect(known.has(step.do), step.do).toBe(true);
    expect(scenario(name).runLast).toBeUndefined();
  });

  it.each(ALL)('%s never navigates, reloads or reaches the clipboard, files or a link', (name) => {
    const refused = ['goto', 'fixture', 'reload', 'download', 'selector', 'offline', 'colorScheme'];
    refused.push('grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog');
    for (const kind of refused) expect(kindsOf(name)).not.toContain(kind);
    for (const kind of ['click', 'move', 'drag', 'path', 'wheel']) {
      expect(kindsOf(name)).not.toContain(kind);
    }
    for (const step of stepsOf(name)) expect(step.role === 'link').toBe(false);
    for (const step of stepsOf(name).filter((s) => s.do === 'role')) expect(step.exact).toBe(true);
  });

  it.each(ALL)('%s asserts the portrait metrics first and last', (name) => {
    expect(stepsOf(name)[0]).toEqual(ASSERT);
    expect(stepsOf(name).at(-1)).toEqual(ASSERT);
  });

  it.each([FIND, LANGUAGE, LIBRARY])('%s does not emulate', (name) => {
    expect(kindsOf(name)).not.toContain('emulate');
  });
});

describe('the responsive ladder (52)', () => {
  const steps = stepsOf(LADDER);
  const changes = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'emulate');

  it('sends no input and no user agent, and keeps DPR 3, touch and the mobile flag', () => {
    for (const kind of ['tap', 'touchDrag', 'touchPath', 'type', 'key', 'role', 'selectOption']) {
      expect(kindsOf(LADDER)).not.toContain(kind);
    }
    expect(changes).toHaveLength(10);
    for (const [step] of changes) {
      expect('userAgent' in step).toBe(false);
      expect(step).toMatchObject({ deviceScaleFactor: 3, mobile: true, hasTouch: true });
    }
  });

  it('waits, reads and asserts what it asked for after every change, then reads the layout', () => {
    const kind = { portraitPrimary: 'portrait-primary', landscapePrimary: 'landscape-primary' };
    for (const [step, i] of changes) {
      const { type, angle } = step.screenOrientation;
      expect(steps.slice(i + 1, i + 3)).toEqual([{ do: 'wait', ms: 1000 }, { do: 'metrics' }]);
      expect(steps[i + 3]).toEqual({
        do: 'assertMetrics',
        expect: metricsOf(step.width, step.height, kind[type], angle),
      });
      expect(steps[i + 4].do).toBe('layout');
      expect(angle).toBe(step.width > step.height ? 90 : 0);
    }
    expect(changes.at(-1)[0]).toMatchObject({ width: 390, height: 844 });
  });
});

describe('Find on canvas (53), the language list (54) and the Library (55)', () => {
  it('53 stops at its first failure and types only its words, the search after its textbox click', () => {
    expect(scenario(FIND).continueOnError).toBe(false);
    const steps = stepsOf(FIND);
    const typed = steps.filter((step) => step.do === 'type');
    expect(typed.map((step) => step.text)).toEqual(['Plan', 'Planet', 'Plan']);
    const box = steps.findIndex((step) => step.role === 'textbox');
    expect(steps.indexOf(typed[2])).toBe(box + 2);
    expect(names(FIND)).toEqual(['menuitem:Find on canvas', 'textbox:undefined']);
  });

  it('54 picks only Français and English, and clicks only Canvas background', () => {
    const picks = stepsOf(LANGUAGE).filter((step) => step.do === 'selectOption');
    expect(picks.map((step) => step.label)).toEqual(['Français', 'English', 'English']);
    for (const step of picks) expect(step.role).toBe('combobox');
    expect(names(LANGUAGE)).toEqual(['button:Canvas background']);
  });

  it('55 clicks only the Library and Close buttons, and adds nothing to the library', () => {
    expect(new Set(names(LIBRARY))).toEqual(new Set(['button:Library', 'button:Close']));
    expect(kindsOf(LIBRARY)).not.toContain('type');
  });
});
