// Checks the two scenarios added for the second fresh-profile runs (R-76): 07c repeats only the
// dark-theme switch of 07, so that 15 can run after 00 in a fresh session, and 16 reads storage
// key names and nothing else. No browser is started.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const names = () => readdirSync(DIR).map((file) => file.replace(/\.json$/u, ''));
const labels = (name) =>
  scenario(name)
    .steps.map((step) => step.label)
    .filter(Boolean);

// Steps that navigate, change emulation, load content or write a capture.
const ACTIVE = new Set([
  'emulate',
  'colorScheme',
  'goto',
  'reload',
  'fixture',
  'screenshot',
  'aria',
  'download',
  'fileChooser',
  'dropFile',
  'acceptDialog',
]);

describe('the R-76 scenarios', () => {
  it.each(['07c-dark-theme-switch-desktop', '16-storage-inventory'])(
    '%s names only steps that the driver has',
    (name) => {
      const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
      for (const step of scenario(name).steps) expect(known.has(step.do), step.do).toBe(true);
    },
  );
});

describe('07c, the dark-theme switch before 15', () => {
  const steps = () => scenario('07c-dark-theme-switch-desktop').steps;

  it('asserts the desktop metrics first, with the expectation that 15 uses', () => {
    expect(steps()[0]).toEqual(scenario('15-element-surfaces-dark-desktop').steps[0]);
  });

  it('repeats only the input of 07 that switches the theme', () => {
    const input = steps().filter((step) => ['click', 'key', 'wait'].includes(step.do));
    expect(input).toEqual(scenario('07-dark-theme-desktop').steps.slice(1, 4));
    expect(input.map((step) => step.key).filter(Boolean)).toEqual(['Alt+Shift+d']);
  });

  it('reads the theme back and neither navigates, emulates nor captures', () => {
    expect(steps().filter((step) => ACTIVE.has(step.do))).toEqual([]);
    expect(steps().slice(-2)).toEqual([{ do: 'rootStyle' }, { do: 'appState', label: '07c-dark' }]);
  });

  it('uses a probe label that no other scenario uses', () => {
    expect(labels('07c-dark-theme-switch-desktop')).toEqual(['07c-dark']);
    for (const name of names().filter((n) => !n.startsWith('07c-'))) {
      expect(labels(name), name).not.toContain('07c-dark');
    }
  });
});

describe('16, the storage inventory', () => {
  it('holds one storage step: no input, no navigation and no label', () => {
    expect(scenario('16-storage-inventory').steps).toEqual([{ do: 'storage' }]);
  });

  it('is not runLast, so the collaboration lock refuses it once 08 has started', () => {
    expect(scenario('16-storage-inventory')).not.toHaveProperty('runLast');
  });
});
