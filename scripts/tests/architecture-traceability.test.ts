import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseRequirements, parseRoadmap, traceabilityProblems } from '../lib/traceability.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const ENGINE = 'docs/architecture/engine';
const ADR = 'docs/adr';

// The engine documents and the ADRs that the architecture added (0004 onwards).
const DOCUMENTS = [
  ...readdirSync(join(ROOT, ENGINE))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `${ENGINE}/${name}`),
  ...readdirSync(join(ROOT, ADR))
    .filter((name) => /^\d{4}-/u.test(name) && Number(name.slice(0, 4)) >= 4)
    .map((name) => `${ADR}/${name}`),
].map((path) => ({ path, text: read(path) }));

const REQUIREMENTS = read(`${ENGINE}/requirements.md`);
const ROADMAP = read(`${ENGINE}/roadmap.md`);

describe('canvas-engine architecture traceability', () => {
  it('parses every requirement row and every engine issue', () => {
    const rows = REQUIREMENTS.split('\n').filter((line) => line.startsWith('| REQ-'));
    expect(rows.length).toBeGreaterThan(0);
    expect(parseRequirements(REQUIREMENTS)).toHaveLength(rows.length);
    const issues = ROADMAP.split('\n').filter((line) => line.startsWith('### ENG-'));
    const plan = parseRoadmap(ROADMAP);
    const planned = new Set([...plan.delivered.values()].flat());
    expect(issues.length).toBeGreaterThan(0);
    expect(plan.delivered.size).toBeGreaterThan(0);
    expect(planned.size).toBeLessThanOrEqual(issues.length);
    expect(DOCUMENTS.map(({ path }) => path)).toContain(
      'docs/adr/0010-collaboration-ready-change-model.md',
    );
  });

  it('cites only existing identifiers and plans every requirement exactly once', () => {
    const problems = traceabilityProblems({
      requirements: REQUIREMENTS,
      roadmap: ROADMAP,
      documents: DOCUMENTS,
      research: {
        behaviour: read('docs/reverse-engineering/behavior-analysis.md'),
        residual: read('docs/reverse-engineering/residual-matrix.md'),
        hypotheses: read('docs/reverse-engineering/architecture-hypotheses.md'),
      },
    });
    expect(problems).toEqual([]);
  });
});
