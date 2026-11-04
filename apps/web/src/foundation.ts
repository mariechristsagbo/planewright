export interface FoundationItem {
  readonly name: string;
  readonly detail: string;
}

/** Facts about what this foundation build contains; keep in sync with the README. */
export const FOUNDATION_CONTENTS: readonly FoundationItem[] = [
  {
    name: 'Web shell',
    detail: 'React and Vite application that renders this status page only.',
  },
  {
    name: 'Collaboration service skeleton',
    detail:
      'Node.js WebSocket service with a health endpoint and a hello handshake; it exchanges no drawing data.',
  },
  {
    name: 'Shared protocol package',
    detail: 'Pre-release wire protocol definitions used by both the web shell and the service.',
  },
  {
    name: 'Quality gates',
    detail:
      'Formatting, linting, strict type checking, tests, build, dependency audit, guardrails and secret scanning.',
  },
];

export const NOT_YET_IMPLEMENTED: readonly string[] = [
  'Drawing canvas and rendering engine',
  'Shapes, text, selection and editing tools',
  'Saving, loading and exporting drawings',
  'Real-time collaboration',
];
