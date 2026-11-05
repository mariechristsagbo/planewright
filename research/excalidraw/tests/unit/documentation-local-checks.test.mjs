// Checks the retained output of the local-only checks (isolation-check.sh and selftest.sh)
// against the checkpoint statuses that rest on it. Every retained log is read, so a later run
// cannot hide a failed earlier one. Moved here from documentation-sixth-review.test.mjs.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const RE = 'docs/reverse-engineering';

describe('the retained local check output', () => {
  const DIR = `${RE}/local-checks`;
  // Every retained log of one script, so a later run cannot hide behind an earlier one.
  const logs = (prefix) =>
    readdirSync(join(ROOT, DIR))
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name) => ({ name, text: read(`${DIR}/${name}`) }));
  // check-masks.mjs prints its own PASS line per capture inside one self-test check.
  const checks = (text) =>
    text.split('\n').filter((line) => /^PASS /u.test(line) && !/^PASS \S+\.png /u.test(line));

  it('backs the loopback and cleanup statuses with committed PASS lines', () => {
    const runs = [
      ...logs('isolation-check-').map((log) => ({ ...log, count: 11 })),
      ...logs('selftest-').map((log) => ({ ...log, count: 19 })),
    ];
    expect(runs.length).toBeGreaterThanOrEqual(4);
    for (const { name, text, count } of runs) {
      expect(text, name).toMatch(/^# exit=0$/mu);
      expect(text, name).toMatch(/^failures: 0$/mu);
      expect(text, name).not.toMatch(/^FAIL/mu);
      expect(checks(text), name).toHaveLength(count);
      const head = /^# head=([0-9a-f]{40})$/mu.exec(text)[1].slice(0, 7);
      expect(name, name).toContain(head);
      expect(flat(read(`${RE}/checkpoint.md`)), name).toContain(`on ${head}`);
    }
    const status = (name) =>
      flat(
        read(`${RE}/checkpoint.md`)
          .split('\n')
          .find((line) => line.startsWith(`| ${name}`)),
      );
    const ports = status('CDP and driver ports loopback-only');
    expect(ports).toContain('isolation-check.sh passed 11 of 11');
    expect(ports).toContain('selftest.sh 19 of 19');
    expect(ports).toContain('(local-checks/)');
    expect(ports).toMatch(/s1–s4[^.]*default Docker bridge[^.]*reachable from other containers/u);
    expect(status('Owned processes and profiles cleaned up')).toContain('local-checks');
  });
});
