// Checks what the documents cite for the later build of the R-76 sessions (s8–s11): the main
// index-*.js chunk that the driver netlogs request in every session, derived from the committed
// index, and the REA initial-page inspections that name it.
import { describe, expect, it } from 'vitest';

import { doc, evidence, session } from './r76-evidence.mjs';

const MAIN = /^\/assets\/index-[^/]+\.js$/u;
const NETLOG =
  'the one index-*.js script that every s1–s7 netlog requests is requested in no s8–s11 ' +
  'netlog, and every s8–s11 netlog requests another one (evidence/sessions.json)';

// The index-*.js scripts a session's netlog requests from the page origin.
const scripts = (name) =>
  new Set(
    session(name)
      .network.filter(
        (e) =>
          e.event === 'request' && e.origin === 'https://excalidraw.com' && e.type === 'script',
      )
      .map((e) => e.path)
      .filter((path) => MAIN.test(path ?? '')),
  );
// The scripts that every one of the sessions requests.
const shared = (names) =>
  names.map(scripts).reduce((all, next) => new Set([...all].filter((path) => next.has(path))));
const number = (name) => Number(/^s(\d+)-/u.exec(name)[1]);

describe('the later build of s8–s11', () => {
  const names = () => evidence('sessions.json').sessions.map((s) => s.session);
  const early = () => names().filter((name) => number(name) <= 7);
  const late = () => names().filter((name) => number(name) >= 8);

  it('rests on one shared main chunk in s1–s7 and another in s8–s11', () => {
    const [before, after] = [shared(early()), shared(late())];
    expect([before.size, after.size]).toEqual([1, 1]);
    const [old, current] = [[...before][0], [...after][0]];
    for (const name of late()) expect(scripts(name).has(old), name).toBe(false);
    for (const name of early()) expect(scripts(name).has(current), name).toBe(false);
    const main = (file) =>
      evidence(file).scripts.filter((s) => /\/index-[^/]+\.js$/u.test(s.url))[0].url;
    expect(main('rea-inspect-initial.summary.json')).toMatch(new RegExp(`${old}$`, 'u'));
    expect(main('rea-inspect-initial-s8-desktop-r76-12.summary.json')).toMatch(
      new RegExp(`${current}$`, 'u'),
    );
  });

  it('is cited from the netlog in the checkpoint and the limitations, not from REA alone', () => {
    const checkpoint = doc('checkpoint.md');
    expect(checkpoint).toContain(`s8–s11 ran a later build than s1–s7: ${NETLOG}`);
    expect(checkpoint).not.toContain('the main chunk listed by REA has another name');
    expect(doc('limitations.md')).toContain(
      `The ${NETLOG.slice('the '.length)}; the REA initial-page inspections list`,
    );
  });
});
