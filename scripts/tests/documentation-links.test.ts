import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findBrokenLinks } from '../lib/markdown-links.ts';
import type { LinkTarget } from '../lib/markdown-links.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Tracked and new, unignored Markdown files, so a document is checked before its first commit.
const DOCUMENTS = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '*.md'],
  { cwd: ROOT, encoding: 'utf8' },
)
  .split('\0')
  .filter((path) => path.length > 0);

function readTarget(path: string): LinkTarget {
  try {
    const absolute = join(ROOT, path);
    if (statSync(absolute).isDirectory()) {
      return { kind: 'directory' };
    }
    return { kind: 'file', text: readFileSync(absolute, 'utf8') };
  } catch {
    return { kind: 'missing' };
  }
}

describe('repository documentation', () => {
  it('includes the architecture and decision records', () => {
    expect(DOCUMENTS).toContain('docs/architecture/overview.md');
    expect(DOCUMENTS).toContain('docs/adr/README.md');
  });

  it.each(DOCUMENTS)('%s has no broken relative link or heading anchor', (path) => {
    expect(findBrokenLinks(path, readTarget)).toEqual([]);
  });
});
