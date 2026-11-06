import { describe, expect, it } from 'vitest';

import { findBrokenLinks, headingAnchors, relativeTargets } from '../lib/markdown-links.ts';
import type { LinkTarget, ReadTarget } from '../lib/markdown-links.ts';

function reader(files: Readonly<Record<string, string>>, directories: string[] = []): ReadTarget {
  return (path): LinkTarget => {
    const text = files[path];
    if (text !== undefined) {
      return { kind: 'file', text };
    }
    return directories.includes(path) ? { kind: 'directory' } : { kind: 'missing' };
  };
}

describe('headingAnchors', () => {
  it('derives GitHub anchors and numbers repeated headings', () => {
    const anchors = headingAnchors(
      '# Engine `core` (P0)\n## Notes\n## Notes\n### B-28a Export, defaults & theme ##\n',
    );
    expect([...anchors]).toEqual([
      'engine-core-p0',
      'notes',
      'notes-1',
      'b-28a-export-defaults--theme',
    ]);
  });

  it('ignores headings inside fenced code blocks', () => {
    expect([...headingAnchors('```md\n# Not a heading\n```\n# Real\n')]).toEqual(['real']);
  });
});

describe('relativeTargets', () => {
  it('keeps relative inline links, images and reference definitions', () => {
    const markdown = [
      'See [a](a.md#part "title"), ![b](img/b.png) and [c](<c.md>).',
      '[d]: ../d.md',
      '[web](https://example.com), [mail](mailto:x@example.com), [proto](//cdn.example.com/x)',
    ].join('\n');
    expect(relativeTargets(markdown)).toEqual(['a.md#part', 'img/b.png', 'c.md', '../d.md']);
  });

  it('skips links inside code spans and fenced blocks', () => {
    expect(relativeTargets('`[x](gone.md)`\n```\n[y](gone.md)\n```\n[z](here.md)')).toEqual([
      'here.md',
    ]);
  });
});

describe('findBrokenLinks', () => {
  const files = {
    'docs/a.md': '# Title\n## Part one\n[self](#part-one) [b](b.md#intro) [dir](sub)',
    'docs/b.md': '# Intro\n',
  };

  it('accepts existing files, directories and anchors', () => {
    expect(findBrokenLinks('docs/a.md', reader(files, ['docs/sub']))).toEqual([]);
  });

  it('reports missing files, missing anchors and own missing anchors', () => {
    const broken = {
      'docs/a.md': '# A\n[x](missing.md) [y](b.md#nowhere) [z](#gone) [w](../docs/b.md#intro)',
      'docs/b.md': '# Intro\n',
    };
    expect(findBrokenLinks('docs/a.md', reader(broken))).toEqual([
      'docs/a.md: broken link missing.md',
      'docs/a.md: broken link b.md#nowhere',
      'docs/a.md: broken link #gone',
    ]);
  });

  it('reports an anchor on a directory and an unreadable source', () => {
    const withDirectory = { 'docs/a.md': '[d](sub.md#top)' };
    expect(findBrokenLinks('docs/a.md', reader(withDirectory, ['docs/sub.md']))).toEqual([
      'docs/a.md: broken link sub.md#top',
    ]);
    expect(findBrokenLinks('docs/none.md', reader({}))).toEqual([
      'docs/none.md: the document itself cannot be read',
    ]);
  });

  it('decodes percent-encoded paths and ignores anchors on non-Markdown files', () => {
    const encoded = { 'docs/a.md': '[s](my%20file.md) [j](data.json#key)' };
    const target = { ...encoded, 'docs/my file.md': '# S\n', 'docs/data.json': '{}' };
    expect(findBrokenLinks('docs/a.md', reader(target))).toEqual([]);
  });
});
