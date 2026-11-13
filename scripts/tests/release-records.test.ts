import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { relativeTargets } from '../lib/markdown-links.ts';

// The records of each release (docs/development/releasing.md): the changelog's sections, newest
// first under Unreleased, each dated and linked to its tag or its comparison with the one before;
// the notes in docs/releases, one file per version, published word for word as the GitHub
// release's body and so linking only to absolute addresses; the release procedure's table of
// versions, which repeats the changelog's dates and the targets the notes name; and the workspace
// packages, private at version 0.0.0, since a release publishes none of them.

const ROOT = join(import.meta.dirname, '..', '..');
const REPOSITORY = 'https://github.com/mariechristsagbo/planewright';
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const CHANGELOG = read('CHANGELOG.md');
const NOTES = 'docs/releases';

interface Section {
  readonly title: string;
  readonly date: string | undefined;
}

/** The changelog's second-level headings, `## [title]` with ` - date` after a released version. */
const SECTIONS: Section[] = [...CHANGELOG.matchAll(/^## (.*)$/gmu)].map(([, heading = '']) => {
  const match = /^\[(?<title>[^\]]+)\](?: - (?<date>.+))?$/u.exec(heading);
  return { title: match?.groups?.['title'] ?? heading, date: match?.groups?.['date'] };
});
const RELEASED = SECTIONS.slice(1);
const VERSIONS = RELEASED.map(({ title }) => title);
const dateOf = (version: string) => RELEASED.find(({ title }) => title === version)?.date;

/** Compares versions `x.y.z` by their numbers, as Semantic Versioning orders them. */
const order = (first: string, second: string): number => {
  const [a, b] = [first, second].map((version) => version.split('.').map(Number));
  const index = [0, 1, 2].find((place) => a?.[place] !== b?.[place]) ?? 0;
  return (a?.[index] ?? 0) - (b?.[index] ?? 0);
};

/** Whether a text is a real calendar day written as `YYYY-MM-DD`. */
const isDay = (text: string | undefined): boolean =>
  text !== undefined &&
  /^\d{4}-\d{2}-\d{2}$/u.test(text) &&
  new Date(`${text}T00:00:00Z`).toISOString().startsWith(text);

describe("the changelog's versions", () => {
  it('opens with Unreleased, then each version newest first, dated, without a pre-release part', () => {
    expect(SECTIONS[0]).toEqual({ title: 'Unreleased', date: undefined });
    expect(VERSIONS.filter((version) => !/^\d+\.\d+\.\d+$/u.test(version))).toEqual([]);
    expect(RELEASED.filter(({ date }) => !isDay(date))).toEqual([]);
    expect(VERSIONS).toEqual([...VERSIONS].sort((first, second) => order(second, first)));
    const dates = RELEASED.map(({ date }) => date ?? '');
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('holds the versions 0.2.0 and 0.1.0 that issue #67 publishes, the oldest last', () => {
    expect(VERSIONS.slice(-2)).toEqual(['0.2.0', '0.1.0']);
    expect([dateOf('0.2.0'), dateOf('0.1.0')]).toEqual(['2026-11-13', '2026-11-10']);
  });

  it('links Unreleased and each version to its comparison with the one before, the first to its tag', () => {
    const definitions = new Map(
      [...CHANGELOG.matchAll(/^\[([^\]]+)\]: (\S+)$/gmu)].map(([, label = '', url = '']) => [
        label.toLowerCase(),
        url,
      ]),
    );
    const expected = new Map(
      VERSIONS.map((version, index) => {
        const before = VERSIONS[index + 1];
        const url =
          before === undefined
            ? `${REPOSITORY}/releases/tag/v${version}`
            : `${REPOSITORY}/compare/v${before}...v${version}`;
        return [version, url];
      }),
    );
    expected.set('unreleased', `${REPOSITORY}/compare/v${VERSIONS[0] ?? ''}...HEAD`);
    expect(Object.fromEntries(definitions)).toEqual(Object.fromEntries(expected));
  });
});

describe('the release notes', () => {
  it(`keep one file in ${NOTES} for each version of the changelog, and no other`, () => {
    const files = readdirSync(join(ROOT, NOTES)).sort();
    expect(files).toEqual(VERSIONS.map((version) => `v${version}.md`).sort());
  });

  it.each(VERSIONS)(
    'v%s links only to absolute addresses, which its GitHub release can follow',
    (version) => {
      expect(relativeTargets(read(`${NOTES}/v${version}.md`))).toEqual([]);
    },
  );
});

/** The rows of the release procedure's table of versions: version, title, target and date. */
function procedureRows(): string[][] {
  const lines = read('docs/development/releasing.md').split('\n');
  const start = lines.findIndex((line) => line.startsWith('| Version | Release title'));
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(
      line
        .slice(1, -1)
        .split(' | ')
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

describe('the release procedure', () => {
  it("gives each version it records the changelog's date and a title naming the version", () => {
    const rows = procedureRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const [version = '', title = '', , date = ''] of rows) {
      expect(title).toMatch(
        new RegExp(`^\`Planewright ${version.replaceAll('.', '\\.')} — .+\`$`, 'u'),
      );
      expect(date).toBe(dateOf(version.slice(1)));
    }
  });

  it('names the same full target commit as the notes of the version', () => {
    const targets = procedureRows().flatMap(([version = '', , target = '']) =>
      [...target.matchAll(/\b[0-9a-f]{40}\b/gu)].map(([commit]) => [version, commit] as const),
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const [version, commit] of targets) {
      expect(read(`${NOTES}/${version}.md`)).toContain(commit);
    }
  });
});

describe('the workspace packages', () => {
  it('are each private at version 0.0.0, so that no release publishes one', () => {
    const workspaces = JSON.parse(read('package.json')) as { workspaces: string[] };
    const manifests = [
      'package.json',
      ...workspaces.workspaces.map((path) => `${path}/package.json`),
    ];
    const published = manifests.filter((path) => {
      const manifest = JSON.parse(read(path)) as { private?: unknown; version?: unknown };
      return manifest.private !== true || manifest.version !== '0.0.0';
    });
    expect(manifests.length).toBeGreaterThan(1);
    expect(published).toEqual([]);
  });
});
