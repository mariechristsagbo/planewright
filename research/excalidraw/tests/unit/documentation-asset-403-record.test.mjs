// Checks the correction of the access record: the HTTP 403 responses to assets before s64 that the
// gates of their sessions let pass, found on 2026-11-06 by reading every retained record for 403
// responses. s49's manifest is in the committed index; the 403 of s16's two script chunks only in
// REA's raw record, which the committed index has as failed requests.
import { describe, expect, it } from 'vitest';

import { RE, doc, evidence, flat, read } from './r76-evidence.mjs';

const network = (file, name) => evidence(file).sessions.find((s) => s.session === name).network;
const CHUNKS = ['/assets/CodeMirrorEditor-', '/assets/codemirror.chunk-'];
const chunk = (path) => CHUNKS.findIndex((prefix) => String(path ?? '').startsWith(prefix));
const section = (title) =>
  flat(read(`${RE}/checkpoint.md`).split(`## ${title}\n`)[1].split(/^## /mu)[0]);

describe('the asset 403s that the earlier gates passed', () => {
  it('state the two manifest responses of s49 with HTTP 403 before the verification page of s50', () => {
    const manifest = network('sessions-s37-s50.json', 's49-mobile-mermaid-generate').filter(
      (n) => n.type === 'manifest',
    );
    expect(manifest.map((n) => [n.status, n.count])).toEqual([[403, 2]]);
    for (const name of ['methodology.md', 'limitations.md', 'network-analysis.md']) {
      expect(doc(name), name).toContain('the manifest got HTTP 403 twice');
    }
    expect(section('Mobile control batch (s37–s50)')).toContain('the manifest got HTTP 403 twice');
    expect(section('Blockers and residuals')).toContain('the manifest got HTTP 403 twice');
    expect(doc('methodology.md')).not.toContain("the first was s64's locale chunk");
  });

  it('state that s12 and s16 wrote the two chunks as failed, and that REA kept the 403 of s16', () => {
    for (const [file, name] of [
      ['sessions-s12-s14.json', 's12-mobile-draw-rea'],
      ['sessions-s15-s16.json', 's16-mobile-generation-reload'],
    ]) {
      const failed = network(file, name).filter((n) => n.event === 'request-failed');
      expect(failed.map((n) => chunk(n.path)).sort(), name).toEqual([0, 1]);
    }
    for (const name of ['s48-mobile-mermaid-undo', 's49-mobile-mermaid-generate']) {
      const served = network('sessions-s37-s50.json', name).filter((n) => chunk(n.path) >= 0);
      expect(
        served.map((n) => [n.status, n.fromServiceWorker]),
        name,
      ).toEqual([
        [200, true],
        [200, true],
      ]);
    }
    for (const name of ['limitations.md', 'network-analysis.md']) {
      expect(doc(name), name).toContain('kept HTTP 403 for the two script chunks');
    }
    expect(section('Blockers and residuals')).toContain('kept HTTP 403 for the two script chunks');
    expect(section('Mobile follow-up (s15–s16)')).toContain('REA recorded HTTP 403 for those 2');
    const raw = doc('limitations.md').split('Facts read only from raw records')[1];
    expect(raw).toContain("the HTTP 403 of the two script chunks in s16, which only REA's raw");
  });
});
