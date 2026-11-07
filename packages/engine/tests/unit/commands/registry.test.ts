import { describe, expect, it } from 'vitest';

import type { KeyChord } from '../../../src/commands/chords.ts';
import { createCommandRegistry } from '../../../src/commands/registry.ts';
import type { Command, CommandId, CommandTarget } from '../../../src/commands/registry.ts';
import { press, US } from '../../support/layouts.ts';

// The command registry (ADR 0008, decision 6): one source of commands for the keymap, the tool bar
// and every other surface.

interface Counted extends Command {
  readonly runs: () => number;
}

function command(id: CommandId, shortcuts: readonly KeyChord[], enabled = true): Counted {
  let runs = 0;
  return {
    id,
    label: id,
    shortcuts,
    isEnabled: () => enabled,
    run: () => {
      runs += 1;
    },
    runs: () => runs,
  };
}

const TARGET = {} as CommandTarget;

describe('the command registry', () => {
  it('lists its commands in order and finds one by identifier', () => {
    const hand = command('tool.hand', [{ key: 'h' }]);
    const undo = command('history.undo', [{ key: 'z', mod: true }]);
    const registry = createCommandRegistry([hand, undo]);
    expect(registry.commands).toEqual([hand, undo]);
    expect(registry.get('history.undo')).toBe(undo);
    expect(() => registry.get('history.redo')).toThrow('No command history.redo is registered.');
  });

  it('refuses two commands with one identifier', () => {
    const commands = [command('tool.hand', []), command('tool.hand', [])];
    expect(() => createCommandRegistry(commands)).toThrow(
      'The command tool.hand is registered twice.',
    );
  });

  it('refuses two commands with one shortcut, so a key never means two things', () => {
    const commands = [
      command('tool.hand', [{ key: 'h' }]),
      command('tool.selection', [{ key: 'h' }]),
    ];
    expect(() => createCommandRegistry(commands)).toThrow(
      'The commands tool.hand and tool.selection share a shortcut.',
    );
  });

  it('lets two commands share a key with different modifiers', () => {
    const undo = command('history.undo', [{ key: 'z', mod: true }]);
    const redo = command('history.redo', [{ key: 'z', mod: true, shift: true }]);
    const registry = createCommandRegistry([undo, redo]);
    expect(registry.forKey(press(US, 'KeyZ', { mod: true }))).toBe(undo);
    expect(registry.forKey(press(US, 'KeyZ', { mod: true, shift: true }))).toBe(redo);
  });

  it('runs an enabled command and reports it done, and only reports a disabled one', () => {
    const on = command('history.undo', []);
    const off = command('history.redo', [], false);
    const registry = createCommandRegistry([on, off]);
    expect(registry.run('history.undo', TARGET)).toBe('done');
    expect(registry.run('history.redo', TARGET)).toBe('disabled');
    expect([on.runs(), off.runs()]).toEqual([1, 0]);
  });
});
