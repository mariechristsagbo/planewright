import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The index of the architecture decision records lists each record once, by its file, with the
// title and the status that the record itself gives, so that the commit that accepts a proposed
// record changes both (docs/adr/README.md).

const ADR = join(import.meta.dirname, '..', '..', 'docs', 'adr');
const INDEX = readFileSync(join(ADR, 'README.md'), 'utf8');
const RECORDS = readdirSync(ADR)
  .filter((name) => /^\d{4}-[a-z0-9-]+\.md$/u.test(name))
  .sort();

interface Entry {
  readonly title: string;
  readonly status: string;
}

/** A record's title, from its `# ADR NNNN: Title` heading, and its `- Status:` line. */
function recordEntry(name: string): { [Key in keyof Entry]: Entry[Key] | undefined } {
  const text = readFileSync(join(ADR, name), 'utf8');
  return {
    title: /^# ADR \d{4}: (.+)$/mu.exec(text)?.[1],
    status: /^- Status: (.+)$/mu.exec(text)?.[1],
  };
}

/** The index's rows by the file each links to; a file listed twice is listed under `twice`. */
function indexRows(markdown: string): { rows: Map<string, Entry>; twice: string[] } {
  const rows = new Map<string, Entry>();
  const twice: string[] = [];
  const row = /^\| \[\d{4}\]\(([^)]+)\) +\| (.+?) +\| (.+?) +\|$/gmu;
  for (const [, file = '', title = '', status = ''] of markdown.matchAll(row)) {
    if (rows.has(file)) twice.push(file);
    rows.set(file, { title, status });
  }
  return { rows, twice };
}

describe('the index of architecture decision records', () => {
  const { rows, twice } = indexRows(INDEX);

  it('lists every record once and nothing else', () => {
    expect(RECORDS.length).toBeGreaterThan(0);
    expect(twice).toEqual([]);
    expect([...rows.keys()].sort()).toEqual(RECORDS);
  });

  it.each(RECORDS)('gives %s the title and the status that the record gives', (name) => {
    const entry = recordEntry(name);
    expect(entry.title).toBeDefined();
    expect(entry.status).toBeDefined();
    expect(rows.get(name)).toEqual(entry);
  });
});
