// Checks the stop rule for verification pages and protection responses against the committed
// session indexes: the two desktop loads that met the page (s13, s14) and the 37 s between them,
// the pauses before the mobile checks of s51 and s65, that no desktop session ran after s14, and
// that the methodology, the limitations and the readiness record state the rule as the sessions
// applied it.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RE, ROOT, doc, evidence, flat, read } from './r76-evidence.mjs';

const indexed = () =>
  readdirSync(join(ROOT, RE, 'evidence'))
    .filter((name) => /^sessions(?:-s\d+-s\d+)?\.json$/u.test(name))
    .flatMap((name) => evidence(name).sessions);
const named = (short) => indexed().find((s) => s.session.startsWith(`${short}-`));
const number = (s) => Number(/^s(\d+)-/u.exec(s.session)[1]);
const documents = (short) =>
  named(short)
    .network.filter((n) => n.type === 'document')
    .map((n) => n.status);
// Seconds from the last step of one session to the first step of the next.
const pause = (from, to) =>
  (Date.parse(named(to).steps.first) - Date.parse(named(from).steps.last)) / 1000;
const rule = () =>
  flat(
    read(`${RE}/methodology.md`)
      .split('## Verification pages and protection responses\n')[1]
      .split(/^## /mu)[0],
  );

describe('the desktop loads that met the verification page', () => {
  it('state that s14 loaded the page again 37 s after s13 and that the batch stopped after it', () => {
    expect([documents('s13'), documents('s14')]).toEqual([[403], [403]]);
    const seconds = Math.floor(pause('s13', 's14'));
    expect(seconds).toBe(37);
    expect(rule()).toContain(
      `s14, the next desktop session the batch had planned, loaded the page ${String(seconds)} s ` +
        "after s13's last step, met the same page, and only then did the batch stop",
    );
    expect(rule()).toContain('Under the rule above, which these sessions led to, s14 would not');
    for (const name of ['limitations.md', 'readiness.md'])
      expect(doc(name), name).toContain(
        `loaded the desktop page ${String(seconds)} s after s13 had met it`,
      );
  });

  it('show no desktop session after s14, and record that none runs in this phase', () => {
    const later = indexed().filter((s) => number(s) > 14);
    expect(later.length).toBe(70);
    for (const s of later) {
      const [first] = s.steps.metrics;
      expect([first.maxTouchPoints, first.devicePixelRatio, first.screenWidth], s.session).toEqual([
        5, 3, 390,
      ]);
    }
    expect(rule()).toContain('No desktop load ran again');
    for (const name of ['methodology.md', 'limitations.md', 'readiness.md', 'checkpoint.md'])
      expect(doc(name), name).toMatch(
        /decision taken autonomously within the maintainer's scope[^.]*no further desktop load check runs in this phase/u,
      );
  });
});

describe('the pauses before the fresh mobile checks', () => {
  it('state the pauses after s50 and s64, each an hour or more', () => {
    expect([documents('s50'), documents('s51')]).toEqual([[403, 200], [200]]);
    // s51 loaded the page once and sent no input.
    const kinds = named('s51').steps.byKind;
    expect(kinds).toMatchObject({ goto: 1, assertMetrics: 1 });
    const input = ['tap', 'touchDrag', 'touchHold', 'touchPath', 'click', 'role', 'key', 'type'];
    expect(Object.keys(kinds).filter((kind) => input.includes(kind))).toEqual([]);
    const s51 = Math.round(pause('s50', 's51') / 60);
    expect(rule()).toContain(`After ${String(s51)} min, s51 (2026-11-06, 00:39 UTC) was one load`);
    const s65 = pause('s64', 's65');
    const [hours, minutes] = [Math.floor(s65 / 3600), Math.round((s65 % 3600) / 60)];
    expect(rule()).toContain(`After ${String(hours)} h ${String(minutes)} min, s65 ran under`);
    expect(doc('readiness.md')).toContain(
      `s51 checked mobile ${String(s51)} min after s50 met the page there, and s65 resumed ` +
        `${String(hours)} h ${String(minutes)} min after s64's asset 403`,
    );
    for (const [from, to] of [
      ['s14', 's15'],
      ['s50', 's51'],
      ['s64', 's65'],
    ])
      expect(pause(from, to), `${from} to ${to}`).toBeGreaterThanOrEqual(3600);
    expect(rule()).toContain('Only after a pause of an hour or more may a new session run');
  });
});

describe('the rule in the documents', () => {
  it('stop at once, with no reload, client change or wait, and no longer claim no retry', () => {
    expect(rule()).toContain(
      'On detection the session stops: no reload or second load inside it, no change of user ' +
        'agent or of any other client setting, no waiting for the page to pass, and no input',
    );
    expect(doc('methodology.md')).toContain(
      'no verification page or other protection response was bypassed (see [Verification pages ' +
        'and protection responses](#verification-pages-and-protection-responses))',
    );
    const names = readdirSync(join(ROOT, RE)).filter((name) => name.endsWith('.md'));
    for (const name of names) {
      expect(doc(name), name).not.toMatch(/no load was retried|retry or waiting it out/u);
    }
    expect(doc('readiness.md')).toMatch(
      /Objective limitation: verification page\.[^]*the desktop parts of these open rows stay open, not done/u,
    );
  });
});
