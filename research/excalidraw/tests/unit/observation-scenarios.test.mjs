// Checks the scenarios of the observation batch (17-23): they name only driver steps, assert the
// metrics first, never navigate or emulate, keep each export alone in its session, keep the
// Export to Link secret out of captures, and bound the generation requests. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
// Every step of a scenario, with the steps of each trigger after their parent.
const flatSteps = (name) =>
  scenario(name).steps.flatMap((step) => [
    step,
    ...(Array.isArray(step.trigger) ? step.trigger : []),
  ]);
const named = (name, value) => flatSteps(name).filter((step) => step.name === value);

const DESKTOP = [
  '17-export-svg-only-desktop',
  '18-export-png-only-desktop',
  '20-export-link-desktop',
  '21-generation-desktop',
  '23-modifier-drawing-nudge-desktop',
];
const MOBILE = ['19-export-svg-mobile', '22-generation-dialogs-mobile'];
const ALL = [...DESKTOP, ...MOBILE];

describe('the observation-batch scenarios', () => {
  it.each(ALL)('%s names only steps that the driver has', (name) => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of flatSteps(name)) expect(known.has(step.do), step.do).toBe(true);
  });

  it.each(ALL)(
    '%s asserts the metrics first, never emulates or navigates, and is not runLast',
    (name) => {
      const { steps, runLast } = scenario(name);
      expect(steps[0].do).toBe('assertMetrics');
      expect(steps[0].expect.devicePixelRatio).toBe(MOBILE.includes(name) ? 3 : 1);
      expect(runLast).toBeUndefined();
      const kinds = flatSteps(name).map((step) => step.do);
      for (const kind of ['emulate', 'colorScheme', 'goto', 'fixture'])
        expect(kinds).not.toContain(kind);
    },
  );

  it.each(ALL)('%s gives every probe its own label', (name) => {
    const labels = flatSteps(name).flatMap((step) =>
      step.label ? [`${step.do}:${step.label}`] : [],
    );
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('09 asks for a portrait-primary screen at angle 0 before its first navigation', () => {
    const { steps } = scenario('09-mobile-initial');
    expect(steps[0].do).toBe('emulate');
    expect(steps[0].screenOrientation).toEqual({ type: 'portraitPrimary', angle: 0 });
    expect(steps.findIndex((step) => step.do === 'goto')).toBeGreaterThan(0);
  });

  it.each(['09-mobile-initial', ...MOBILE])(
    '%s expects a portrait-primary screen at angle 0 in every metrics assertion',
    (name) => {
      const asserts = flatSteps(name).filter((step) => step.do === 'assertMetrics');
      expect(asserts.length).toBeGreaterThan(0);
      for (const step of asserts) {
        expect(step.expect.orientationType).toBe('portrait-primary');
        expect(step.expect.orientationAngle).toBe(0);
      }
    },
  );

  it.each(ALL)('%s never grants or reads the clipboard, picks a file or drops one', (name) => {
    const kinds = flatSteps(name).map((step) => step.do);
    for (const kind of ['grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog'])
      expect(kinds).not.toContain(kind);
  });
});

describe('the export scenarios (R-64)', () => {
  it.each([
    ['17-export-svg-only-desktop', 'Export to SVG', 'Export to PNG'],
    ['18-export-png-only-desktop', 'Export to PNG', 'Export to SVG'],
    ['19-export-svg-mobile', 'Export to SVG', 'Export to PNG'],
  ])('%s clicks %s once and never %s', (name, clicked, never) => {
    expect(named(name, clicked)).toHaveLength(1);
    expect(named(name, never)).toHaveLength(0);
    const after = scenario(name).steps.findIndex((step) => step.do === 'download');
    expect(scenario(name).steps[after + 1]).toEqual({ do: 'wait', ms: 3000 });
  });
});

describe('the Export to Link scenario (R-56)', () => {
  const name = '20-export-link-desktop';

  it('clicks Export to Link exactly once', () => {
    expect(named(name, 'Export to Link')).toHaveLength(1);
  });

  it('refuses every screenshot while any dialog is open', () => {
    const shots = flatSteps(name).filter((step) => step.do === 'screenshot');
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) expect(shot.refuseIf).toContain('[role=dialog]');
  });
});

describe('the generation scenarios (R-63)', () => {
  it('press Generate once at most, on desktop only', () => {
    expect(named('21-generation-desktop', 'Generate')).toHaveLength(1);
    expect(named('22-generation-dialogs-mobile', 'Generate')).toHaveLength(0);
  });

  it('type only the two synthetic texts, and nothing on mobile', () => {
    const typed = (n) =>
      flatSteps(n)
        .filter((step) => step.do === 'type')
        .map((step) => step.text);
    expect(typed('21-generation-desktop')).toEqual([
      'flowchart LR\n  plan --> build --> test',
      'A flowchart with three steps: plan, build, test',
    ]);
    expect(typed('22-generation-dialogs-mobile')).toEqual([]);
  });

  it.each(['21-generation-desktop', '22-generation-dialogs-mobile'])(
    '%s clicks no control that signs in, saves a key or accepts terms',
    (name) => {
      const names = flatSteps(name).flatMap((step) =>
        typeof step.name === 'string' ? [step.name] : [],
      );
      for (const value of names)
        expect(value).not.toMatch(/sign|log ?in|key|accept|agree|subscribe/iu);
    },
  );
});

describe('the modifier and nudge scenario (R-31, R-37)', () => {
  it('drags with Shift and Alt and nudges with the arrow keys, then undoes', () => {
    const steps = flatSteps('23-modifier-drawing-nudge-desktop');
    const modifiers = steps.filter((step) => step.do === 'drag').map((step) => step.modifiers);
    expect(modifiers).toEqual([['Shift'], ['Alt'], ['Shift']]);
    const keys = steps.filter((step) => step.do === 'key').map((step) => step.key);
    expect(keys).toEqual(expect.arrayContaining(['ArrowRight', 'Shift+ArrowRight', 'Control+z']));
  });
});
