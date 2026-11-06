// Checks the mobile scenarios 86-88 of the final mobile batch (s83 on): Add link and Copy link to
// object from the element menu, with a self-authored link on a reserved .invalid host that is
// never followed (R-09), and Paste of a self-authored plain text (R-53). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const NAMES = {
  86: '86-element-menu-add-link-mobile',
  87: '87-copy-link-to-object-mobile',
  88: '88-paste-plain-text-mobile',
};
const load = (n) => JSON.parse(readFileSync(join(DIR, `${NAMES[n]}.json`), 'utf8'));
const ALL = Object.keys(NAMES);
const at = (step) => step.at?.join(',');
const roles = (steps) => steps.filter((s) => s.do === 'role').map((s) => s.name);
const heldItems = (steps) =>
  steps.flatMap((s, i) =>
    s.do === 'touchHold' ? [[at(s), s.ms, steps.slice(i).find((t) => t.do === 'role')?.name]] : [],
  );
const READS = new Set(['wait', 'scene', 'appState', 'screenshot', 'aria']);
// The kinds between step i and the next role step, and that role's name.
const untilRole = (steps, i) => {
  const next = steps.findIndex((s, k) => k > i && s.do === 'role');
  return [steps.slice(i + 1, next).map((s) => s.do), steps[next]?.name];
};
const CLIPBOARD = ['grantClipboard', 'clipboard', 'clipboardItems', 'clipboardUrl'];
CLIPBOARD.push('clipboardWrite');

describe('scenarios 86-88', () => {
  it.each(ALL)(
    '%s names only driver steps and asserts the portrait metrics first and last',
    (n) => {
      const body = load(n);
      const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
      for (const step of body.steps) expect(known.has(step.do), step.do).toBe(true);
      expect(body.runLast).toBeUndefined();
      expect(body.continueOnError).toBe(n !== '86');
      expect(body.steps[0].do).toBe('assertMetrics');
      expect(body.steps.at(-1)).toEqual(body.steps[0]);
    },
  );

  it.each(ALL)('%s never navigates, reaches a file or a generation entry, or clicks left', (n) => {
    const { steps } = load(n);
    const kinds = steps.map((s) => s.do);
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'selector');
    refused.push('clipboardItems', 'wheel', 'drag', 'path');
    // Only 86 draws; 87 and 88 work on what 86 left.
    if (n !== '86') refused.push('touchDrag');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    const never = ['Insert image', 'Text to diagram AI', 'Mermaid to Excalidraw', 'Web Embed'];
    never.push('Wireframe to code AI', 'Live collaboration', 'Cut', 'Copy');
    for (const name of never) expect(roles(steps)).not.toContain(name);
    for (const s of steps.filter((t) => t.do === 'click')) expect(s.button).toBe('right');
  });

  it.each(ALL)('%s reads each label once, under its own number', (n) => {
    const { steps } = load(n);
    const reads = steps.filter((s) => s.label).map((s) => `${s.do}:${s.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const s of steps.filter((t) => t.label)) expect(s.label.startsWith(`${n}-`)).toBe(true);
    const saved = steps.filter((s) => s.do === 'aria' || s.do === 'screenshot');
    for (const s of saved) expect(s.save ?? s.name).toMatch(new RegExp(`^m${n}-\\d\\d-`, 'u'));
  });

  it('types only the link in 86 and reaches the clipboard only in 87 and 88', () => {
    const typed = (n) => load(n).steps.filter((s) => s.do === 'type');
    expect(typed(86).map((s) => s.text)).toEqual(['https://example.invalid/planewright-r09']);
    expect([typed(87), typed(88)]).toEqual([[], []]);
    const kinds = (n) =>
      load(n)
        .steps.filter((s) => CLIPBOARD.includes(s.do))
        .map((s) => s.do);
    expect(kinds(86)).toEqual([]);
    expect(kinds(87)).toEqual(['grantClipboard', 'clipboard', 'clipboardUrl']);
    expect(kinds(88)).toEqual(['grantClipboard', 'clipboardWrite', 'clipboard']);
    expect([load(87).steps[1], load(88).steps[1]]).toEqual([
      { do: 'grantClipboard' },
      { do: 'grantClipboard' },
    ]);
  });
});

describe('the link of 86', () => {
  const { steps } = load(86);
  const typedAt = steps.findIndex((s) => s.do === 'type');

  it('types only right after the unnamed textbox, which only Add link can open', () => {
    expect(steps[typedAt - 2]).toEqual({ do: 'role', role: 'textbox', exact: true });
    expect(steps[typedAt - 1].do).toBe('wait');
    const add = steps.findIndex((s) => s.name === 'Add link');
    expect(untilRole(steps, add)).toEqual([
      ['wait', 'aria', 'screenshot', 'scene', 'appState'],
      undefined,
    ]);
    expect(steps.slice(typedAt + 1, typedAt + 3)).toEqual([
      { do: 'wait', ms: 300 },
      { do: 'key', key: 'Enter' },
    ]);
    expect(steps.filter((s) => s.do === 'key')).toHaveLength(1);
  });

  it('types a link whose reserved .invalid host can never resolve', () => {
    const url = new URL(steps[typedAt].text);
    expect([url.protocol, url.hostname, url.pathname]).toEqual([
      'https:',
      'example.invalid',
      '/planewright-r09',
    ]);
    expect(url.search + url.hash + url.port).toBe('');
  });

  it("draws A and L first and holds only on L's left stroke, clear of its link icon", () => {
    const drags = steps.filter((s) => s.do === 'touchDrag').map((s) => [...s.from[0], ...s.to[0]]);
    expect(drags).toEqual([
      [40, 230, 100, 320],
      [200, 230, 320, 290],
    ]);
    expect(heldItems(steps)).toEqual([['200,252', 800, 'Add link']]);
    const taps = steps.filter((s) => s.do === 'tap').map(at);
    expect([...new Set(taps)].sort()).toEqual(['218,812', '330,640']);
  });

  it('presses Undo and then Redo after the link, with only reads between', () => {
    const undo = steps.findIndex((s) => s.name === 'Undo');
    expect(undo).toBeGreaterThan(typedAt);
    expect(untilRole(steps, undo)).toEqual([['wait', 'scene', 'appState'], 'Redo']);
    expect(roles(steps)).toEqual(['Add link', undefined, 'Undo', 'Redo']);
  });
});

describe('the copy of 87 and the paste of 88', () => {
  it('87 reads the clipboard, the link and the page URL right after Copy link to object', () => {
    const { steps } = load(87);
    expect(heldItems(steps)).toEqual([
      ['200,252', 800, 'Copy link to object'],
      ['200,252', 800, 'Delete'],
    ]);
    const copy = steps.findIndex((s) => s.name === 'Copy link to object');
    expect(steps.slice(copy + 1, copy + 7).map((s) => [s.do, s.label])).toEqual([
      ['wait', undefined],
      ['clipboard', '87-copy-link'],
      ['clipboardUrl', '87-copy-link'],
      ['url', '87-copy-link'],
      ['focus', '87-copy-link'],
      ['appState', '87-copy-link'],
    ]);
    expect(steps.some((s) => s.do === 'touchDrag' || s.do === 'type')).toBe(false);
  });

  it('88 writes a self-authored plain text, pastes it from the canvas menu and undoes it', () => {
    const { steps } = load(88);
    const write = steps.find((s) => s.do === 'clipboardWrite');
    expect(write).toEqual({ do: 'clipboardWrite', text: 'Planewright plain text' });
    expect(steps.filter((s) => s.do === 'click').map(at)).toEqual(['300,380']);
    const paste = steps.findIndex((s) => s.name === 'Paste');
    expect(steps[paste - 2]).toEqual({ do: 'click', at: [300, 380], button: 'right' });
    expect(roles(steps)).toEqual(['Paste', 'Undo', 'Redo', 'Undo']);
    for (const name of ['Paste', 'Undo', 'Redo']) {
      const i = steps.findIndex((s) => s.name === name);
      expect(untilRole(steps, i)[0].every((kind) => READS.has(kind))).toBe(true);
    }
  });
});
