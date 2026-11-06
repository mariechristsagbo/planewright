import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

// Reads a target once and classifies the failure, so nothing is checked first and used later.
function readTarget(path: string): LinkTarget {
  try {
    return { kind: 'file', text: readFileSync(join(ROOT, path), 'utf8') };
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code === 'EISDIR') {
      return { kind: 'directory' };
    }
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { kind: 'missing' };
    }
    throw error;
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
