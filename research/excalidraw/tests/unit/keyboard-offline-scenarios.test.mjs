// Checks the mobile scenarios 49-51: keyboard-only traversal (R-27), and an offline start and the
// reconnection after one online load (R-57). They name only driver steps, never navigate or reach
// the clipboard or files, and are not runLast. 49 presses only Tab, Shift+Tab and Escape and reads
// the focus after each press; 50 goes offline before its one reload and sends no input after it;
// 51 asserts the metrics before its first input and goes back online once, after its drawing. No
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
const kindsOf = (name) => stepsOf(name).map((step) => step.do);

const WALK = '49-keyboard-tab-order-mobile';
const OFFLINE = '50-offline-reload-mobile';
const RECONNECT = '51-reconnect-mobile';
const ALL = [WALK, OFFLINE, RECONNECT];
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
const INPUT = ['tap', 'touchDrag', 'touchPath', 'type', 'key', 'role', 'selectOption'];
const ASSERT = { do: 'assertMetrics', expect: PORTRAIT };

describe('the keyboard and offline scenarios', () => {
  it.each(ALL)('%s names only steps that the driver has and is not runLast', (name) => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of stepsOf(name)) expect(known.has(step.do), step.do).toBe(true);
    expect(scenario(name).runLast).toBeUndefined();
  });

  it.each(ALL)('%s never navigates, emulates or reaches the clipboard, files or a link', (name) => {
    const refused = ['emulate', 'colorScheme', 'goto', 'fixture', 'download', 'selector'];
    refused.push('grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog');
    for (const kind of refused) expect(kindsOf(name)).not.toContain(kind);
    for (const step of stepsOf(name)) expect(step.role === 'link').toBe(false);
    for (const kind of ['click', 'move', 'drag', 'path', 'wheel']) {
      expect(kindsOf(name)).not.toContain(kind);
    }
  });

  it.each(ALL)('%s asserts the portrait metrics before its first input', (name) => {
    const steps = stepsOf(name);
    expect(steps[0]).toEqual(ASSERT);
    if (name !== OFFLINE) expect(steps.at(-1)).toEqual(ASSERT);
  });
});

describe('the keyboard walk (49)', () => {
  const steps = stepsOf(WALK);
  const keys = steps.filter((step) => step.do === 'key').map((step) => step.key);

  it('presses Tab 30 times, Shift+Tab 4 times and Escape once, and nothing that activates', () => {
    expect(keys).toEqual([...Array(30).fill('Tab'), ...Array(4).fill('Shift+Tab'), 'Escape']);
    for (const kind of ['tap', 'touchDrag', 'touchPath', 'type', 'role', 'reload', 'offline']) {
      expect(kindsOf(WALK)).not.toContain(kind);
    }
  });

  it('reads the focus before the first press and straight after every press, each label once', () => {
    expect(steps[1]).toEqual({ do: 'focus', label: '49-start' });
    steps.forEach((step, i) => {
      if (step.do !== 'key') return;
      const next = step.key === 'Escape' ? steps[i + 2] : steps[i + 1];
      expect(next.do, `after press ${String(i)}`).toBe('focus');
    });
    const labels = steps.filter((step) => step.do === 'focus').map((step) => step.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toHaveLength(36);
  });
});

describe('the offline start (50) and the reconnection (51)', () => {
  const offline = stepsOf(OFFLINE);
  const reconnect = stepsOf(RECONNECT);
  const at = (steps, kind) => steps.findIndex((step) => step.do === kind);

  it('50 goes offline once, before its one reload, and sends no input after the reload', () => {
    expect(offline.filter((step) => step.do === 'offline')).toEqual([
      { do: 'offline', value: true },
    ]);
    expect(kindsOf(OFFLINE).filter((kind) => kind === 'reload')).toHaveLength(1);
    expect(at(offline, 'offline')).toBeLessThan(at(offline, 'reload'));
    const after = kindsOf(OFFLINE).slice(at(offline, 'reload'));
    for (const kind of [...INPUT, 'assertMetrics']) expect(after).not.toContain(kind);
  });

  it('50 reads the connection online, offline and after the offline reload', () => {
    const labels = offline.filter((s) => s.do === 'connectivity').map((s) => s.label);
    expect(labels).toEqual(['50-online', '50-offline', '50-offline-reloaded']);
    const reloaded = offline.slice(at(offline, 'reload'));
    expect(reloaded.map((s) => s.do)).toEqual(expect.arrayContaining(['metrics', 'scene']));
  });

  it('51 never reloads, and goes back online once, after drawing offline', () => {
    expect(kindsOf(RECONNECT)).not.toContain('reload');
    expect(reconnect.filter((step) => step.do === 'offline')).toEqual([
      { do: 'offline', value: false },
    ]);
    const back = at(reconnect, 'offline');
    expect(at(reconnect, 'touchDrag')).toBeLessThan(back);
    for (const kind of INPUT) expect(kindsOf(RECONNECT).slice(back)).not.toContain(kind);
    const labels = reconnect.filter((s) => s.do === 'connectivity').map((s) => s.label);
    expect(labels).toEqual(['51-offline', '51-online-again']);
  });
});
