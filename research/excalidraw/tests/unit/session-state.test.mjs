// Exercises the driver state that must survive a restart, in a temporary session directory.
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { memoryState, openSessionState } from '../../lib/session-state.mjs';

const dir = mkdtempSync(join(tmpdir(), 'pw-state-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('openSessionState', () => {
  it('creates an empty state file readable only by the current user', () => {
    const file = join(dir, 'fresh.json');
    const state = openSessionState(file);
    expect(state.runLastStarted()).toEqual([]);
    expect(state.halted()).toBeNull();
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ runLast: [], halted: null });
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('gives a reopened state the runLast names and the first halt reason', () => {
    const file = join(dir, 'restart.json');
    const first = openSessionState(file);
    first.startRunLast('08-collaboration-desktop');
    first.halt('the page opened a popup.');
    first.halt('a later reason is ignored.');
    const reopened = openSessionState(file);
    expect(reopened.runLastStarted()).toEqual(['08-collaboration-desktop']);
    expect(reopened.halted()).toBe('the page opened a popup.');
  });

  it.each([
    ['not JSON', '{'],
    ['a list', '[]'],
    ['a bad runLast', '{"runLast":"08","halted":null}'],
    ['a bad halt reason', '{"runLast":[],"halted":1}'],
  ])('refuses to start from a state file that is %s', (_label, text) => {
    const file = join(dir, 'bad.json');
    writeFileSync(file, text);
    expect(() => openSessionState(file)).toThrow(/malformed/u);
    expect(readFileSync(file, 'utf8')).toBe(text);
  });
});

describe('memoryState', () => {
  it('keeps the same rules without a file', () => {
    const state = memoryState();
    state.halt('first');
    state.halt('second');
    state.startRunLast('a');
    expect(state.halted()).toBe('first');
    expect(state.runLastStarted()).toEqual(['a']);
  });
});
