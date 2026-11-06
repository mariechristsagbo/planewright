/** One row of the engine requirements trace. */
export interface Requirement {
  readonly id: string;
  readonly disposition: string;
  readonly phase: string;
}

/** Which issues deliver each requirement, and which requirements the roadmap defers. */
export interface RoadmapPlan {
  readonly delivered: ReadonlyMap<string, readonly string[]>;
  readonly deferred: ReadonlyMap<string, string>;
}

/** The research documents whose identifiers the architecture may cite. */
export interface ResearchSources {
  readonly behaviour: string;
  readonly residual: string;
  readonly hypotheses: string;
}

export interface TraceInput {
  readonly requirements: string;
  readonly roadmap: string;
  readonly documents: readonly { readonly path: string; readonly text: string }[];
  readonly research: ResearchSources;
}

export const DISPOSITIONS: readonly string[] = ['Adopt', 'Decide', 'Differ'];

const REQUIREMENT_ROW = /^\| (REQ-[A-Z]\d{2}) +\|.*\| ([A-Za-z]+) +\| (P\d) +\|$/gmu;
const REQUIREMENT_ID = /\bREQ-[A-Z]\d{2}\b/gu;
const RESEARCH_ID = /\b(?:B-\d{2}a?|R-\d{2}|A-\d{2})\b/gu;
const ISSUE_HEADING = /^### (ENG-\d{2})\b/mu;
// No `m` flag: `$` must mean the end of the section, so a wrapped field is read whole.
const REQUIREMENTS_FIELD = /(?:^|\n)- \*\*Requirements:\*\*([\s\S]*?)(?=\n- \*\*|\n\n|$)/u;
const DEFERRED_ROW = /^\| (REQ-[A-Z]\d{2}) +\| (P\d) +\|/gmu;

function unique(text: string, pattern: RegExp): string[] {
  return [...new Set(text.match(pattern) ?? [])].sort();
}

/** Parses the requirement rows of the trace: identifier, disposition and phase. */
export function parseRequirements(markdown: string): Requirement[] {
  return [...markdown.matchAll(REQUIREMENT_ROW)].map(
    ([, id = '', disposition = '', phase = '']) => ({
      id,
      disposition,
      phase,
    }),
  );
}

/** Collects the identifiers that the research documents define. */
export function researchIds(sources: ResearchSources): Set<string> {
  const ids = [
    ...sources.behaviour.matchAll(/^### (B-\d{2}a?) /gmu),
    ...sources.residual.matchAll(/^\| (R-\d{2}) +\|/gmu),
    ...sources.hypotheses.matchAll(/^\| (A-\d{2}) +\|/gmu),
  ].map(([, id = '']) => id);
  return new Set(ids);
}

function addDelivery(delivered: Map<string, string[]>, issue: string, section: string): void {
  const field = REQUIREMENTS_FIELD.exec(section)?.[1] ?? '';
  for (const id of unique(field, REQUIREMENT_ID)) {
    delivered.set(id, [...(delivered.get(id) ?? []), issue]);
  }
}

/** Reads each ENG issue's requirements field and the deferred-requirements table. */
export function parseRoadmap(markdown: string): RoadmapPlan {
  const delivered = new Map<string, string[]>();
  const parts = markdown.split(ISSUE_HEADING);
  for (let index = 1; index < parts.length; index += 2) {
    addDelivery(delivered, parts[index] ?? '', parts[index + 1] ?? '');
  }
  const deferredPart = markdown.split(/^## Deferred requirements$/mu)[1] ?? '';
  const deferred = new Map(
    [...deferredPart.matchAll(DEFERRED_ROW)].map(([, id = '', phase = '']) => [id, phase]),
  );
  return { delivered, deferred };
}

function rowProblems(requirements: readonly Requirement[]): string[] {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const { id, disposition } of requirements) {
    if (seen.has(id)) problems.push(`${id} is listed twice`);
    if (!DISPOSITIONS.includes(disposition)) problems.push(`${id} has disposition ${disposition}`);
    seen.add(id);
  }
  return problems;
}

function citationProblems(input: TraceInput, requirementIds: ReadonlySet<string>): string[] {
  const research = researchIds(input.research);
  return input.documents.flatMap(({ path, text }) => [
    ...unique(text, RESEARCH_ID)
      .filter((id) => !research.has(id))
      .map((id) => `${path} cites unknown research ID ${id}`),
    ...unique(text, REQUIREMENT_ID)
      .filter((id) => !requirementIds.has(id))
      .map((id) => `${path} cites unknown requirement ${id}`),
  ]);
}

function planProblem(requirement: Requirement, plan: RoadmapPlan): string | undefined {
  const issues = plan.delivered.get(requirement.id) ?? [];
  const deferredPhase = plan.deferred.get(requirement.id);
  if (requirement.phase !== 'P0') {
    if (issues.length > 0)
      return `${requirement.id} is ${requirement.phase} but ${issues.join(', ')} delivers it`;
    if (deferredPhase !== requirement.phase)
      return `${requirement.id} is ${requirement.phase} but deferred as ${deferredPhase ?? 'nothing'}`;
    return undefined;
  }
  if (deferredPhase !== undefined) return `${requirement.id} is P0 but deferred`;
  if (issues.length !== 1)
    return `${requirement.id} is P0 and delivered by ${issues.length > 0 ? issues.join(', ') : 'no issue'}`;
  return undefined;
}

/** Lists every traceability problem between the requirements, the roadmap and the documents. */
export function traceabilityProblems(input: TraceInput): string[] {
  const requirements = parseRequirements(input.requirements);
  const plan = parseRoadmap(input.roadmap);
  const ids = new Set(requirements.map(({ id }) => id));
  const planProblems = requirements
    .map((requirement) => planProblem(requirement, plan))
    .filter((problem): problem is string => problem !== undefined);
  return [...rowProblems(requirements), ...citationProblems(input, ids), ...planProblems];
}
