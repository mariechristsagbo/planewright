// Runs rea-bundle.mjs on synthetic REA records in a temporary directory. No REA call is made and
// no website is contacted.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rea-bundle.mjs');
const dir = mkdtempSync(join(tmpdir(), 'pw-rea-bundle-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const id = (digit) => `ev_${'0'.repeat(63)}${digit}`;
const record = (digit) => ({
  evidence_id: id(digit),
  subject: null,
  provider: { id: 'rea-cdp-browser', name: 'Observation', version: '2' },
  operation: 'list_browser_targets',
  authority: 'external-service',
  predicate_type: 'rea.browser-targets',
  environment: null,
  normalized_result: { targets: [{ url: 'https://example.test/#SECRET' }] },
});
const write = (name, value) => {
  const file = join(dir, name);
  writeFileSync(file, JSON.stringify(value));
  return file;
};
const bundle = (...args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: dir });

describe('rea-bundle.mjs', () => {
  it('bundles CLI envelopes and bare records, printing counts only', () => {
    const cli = write('cli.json', { ok: true, data: record(2), meta: {} });
    const bare = write('bare.json', record(1));
    const out = join(dir, 'bundle.json');
    const run = bundle(out, cli, bare);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe(`wrote ${out} (2 records)\n`);
    expect(`${run.stdout}${run.stderr}`.includes('SECRET')).toBe(false);
    const written = JSON.parse(readFileSync(out, 'utf8'));
    expect(written.records.map((r) => r.evidence_id)).toEqual([id(1), id(2)]);
  });

  it('refuses a failed CLI call, naming the file and writing nothing', () => {
    const failed = write('failed.json', { ok: false, error: { code: 'provider_timeout' } });
    const out = join(dir, 'none.json');
    const run = bundle(out, write('one.json', record(3)), failed);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('failed.json: The REA CLI output does not report ok: true');
    expect(existsSync(out)).toBe(false);
  });

  it('refuses a file that is not JSON without quoting it', () => {
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{"url":"https://example.test/#SECRET"');
    const run = bundle(join(dir, 'never.json'), bad);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('bad.json');
    expect(run.stderr.includes('SECRET')).toBe(false);
  });

  it('never replaces an existing output', () => {
    const out = write('existing.json', { keep: true });
    const run = bundle(out, write('two.json', record(4)));
    expect(run.status).not.toBe(0);
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual({ keep: true });
  });

  it('needs an output and at least one record', () => {
    const run = bundle(join(dir, 'lonely.json'));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('Usage: rea-bundle.mjs <output.json> <record.json...>');
  });
});
