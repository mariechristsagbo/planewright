import { describe, expect, it } from 'vitest';

import {
  parseRequirements,
  parseRoadmap,
  researchIds,
  traceabilityProblems,
} from '../lib/traceability.ts';
import type { ResearchSources, TraceInput } from '../lib/traceability.ts';

const RESEARCH: ResearchSources = {
  behaviour: '### B-01 Create\n### B-28a Export\n',
  residual: '| R-31 | Modifiers |\n| R-48 | Pan and zoom |\n',
  hypotheses: '| A-02 | Flat array |\n',
};

const REQUIREMENTS = [
  '| ID      | Requirement | Basis      | Disposition | Phase |',
  '| REQ-V01 | Wheel pans. | B-01       | Adopt       | P0    |',
  '| REQ-V02 | Zoom limit. | R-48       | Decide      | P0    |',
  '| REQ-M01 | Binding.    | A-02       | Differ      | P1    |',
].join('\n');

const ROADMAP = [
  '### ENG-01 First',
  '',
  '- **Requirements:** REQ-V01,',
  '  REQ-V02.',
  '- **Out of scope:** REQ-M01 is not delivered here.',
  '',
  '### ENG-02 Second',
  '',
  '- **Requirements:** none directly.',
  '',
  '## Deferred requirements',
  '',
  '| Requirement | Phase | Backlog item |',
  '| REQ-M01     | P1    | 9            |',
].join('\n');

function input(overrides: Partial<TraceInput> = {}): TraceInput {
  return {
    requirements: REQUIREMENTS,
    roadmap: ROADMAP,
    documents: [{ path: 'docs/a.md', text: 'B-01, B-28a, R-31, A-02 and REQ-V01.' }],
    research: RESEARCH,
    ...overrides,
  };
}

describe('parsers', () => {
  it('reads requirement rows, research identifiers and the roadmap plan', () => {
    expect(parseRequirements(REQUIREMENTS)).toEqual([
      { id: 'REQ-V01', disposition: 'Adopt', phase: 'P0' },
      { id: 'REQ-V02', disposition: 'Decide', phase: 'P0' },
      { id: 'REQ-M01', disposition: 'Differ', phase: 'P1' },
    ]);
    expect([...researchIds(RESEARCH)]).toEqual(['B-01', 'B-28a', 'R-31', 'R-48', 'A-02']);
    const plan = parseRoadmap(ROADMAP);
    expect([...plan.delivered]).toEqual([
      ['REQ-V01', ['ENG-01']],
      ['REQ-V02', ['ENG-01']],
    ]);
    expect([...plan.deferred]).toEqual([['REQ-M01', 'P1']]);
  });

  it('reads a roadmap without issues or a deferred table as empty', () => {
    const plan = parseRoadmap('# Nothing planned\n');
    expect(plan.delivered.size).toBe(0);
    expect(plan.deferred.size).toBe(0);
  });
});

describe('traceabilityProblems', () => {
  it('accepts a consistent trace', () => {
    expect(traceabilityProblems(input())).toEqual([]);
  });

  it('reports duplicate rows, unknown dispositions and unknown citations', () => {
    const requirements = `${REQUIREMENTS}\n| REQ-V01 | Again. | B-01 | Maybe | P0 |`;
    const documents = [{ path: 'docs/b.md', text: 'B-99, R-01, A-30 and REQ-Z09.' }];
    expect(traceabilityProblems(input({ requirements, documents }))).toEqual([
      'REQ-V01 is listed twice',
      'REQ-V01 has disposition Maybe',
      'docs/b.md cites unknown research ID A-30',
      'docs/b.md cites unknown research ID B-99',
      'docs/b.md cites unknown research ID R-01',
      'docs/b.md cites unknown requirement REQ-Z09',
    ]);
  });

  it('reports P0 requirements that are unplanned, planned twice or deferred', () => {
    const roadmap = ROADMAP.replace('REQ-V01,', 'REQ-V02,').concat('\n| REQ-V02     | P0    | 1 |');
    expect(traceabilityProblems(input({ roadmap }))).toEqual([
      'REQ-V01 is P0 and delivered by no issue',
      'REQ-V02 is P0 but deferred',
    ]);
    const twice = ROADMAP.replace('none directly.', 'REQ-V01.');
    expect(traceabilityProblems(input({ roadmap: twice }))).toEqual([
      'REQ-V01 is P0 and delivered by ENG-01, ENG-02',
    ]);
  });

  it('reports later-phase requirements that an issue delivers or that are not deferred', () => {
    const delivered = ROADMAP.replace('none directly.', 'REQ-M01.');
    expect(traceabilityProblems(input({ roadmap: delivered }))).toEqual([
      'REQ-M01 is P1 but ENG-02 delivers it',
    ]);
    const undeferred = ROADMAP.replace('| REQ-M01     | P1    | 9            |', '');
    expect(traceabilityProblems(input({ roadmap: undeferred }))).toEqual([
      'REQ-M01 is P1 but deferred as nothing',
    ]);
    const wrongPhase = ROADMAP.replace('| REQ-M01     | P1 ', '| REQ-M01     | P2 ');
    expect(traceabilityProblems(input({ roadmap: wrongPhase }))).toEqual([
      'REQ-M01 is P1 but deferred as P2',
    ]);
  });
});
