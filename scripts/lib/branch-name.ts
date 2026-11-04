/** Conventional Commit types; must match the `type-enum` rule of @commitlint/config-conventional. */
export const BRANCH_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
] as const;

export const MAX_BRANCH_NAME_LENGTH = 80;

/** Branches that are not created by contributors and therefore skip the naming rule. */
const EXEMPT_BRANCHES: readonly RegExp[] = [/^main$/, /^dependabot\/.+/];

const BRANCH_PATTERN = new RegExp(
  `^(?:${BRANCH_TYPES.join('|')})/[1-9][0-9]*-[a-z0-9]+(?:-[a-z0-9]+)*$`,
);

export type BranchNameResult =
  | { readonly valid: true; readonly exempt: boolean }
  | { readonly valid: false; readonly reason: string };

export function validateBranchName(name: string): BranchNameResult {
  if (EXEMPT_BRANCHES.some((pattern) => pattern.test(name))) {
    return { valid: true, exempt: true };
  }
  if (name.length > MAX_BRANCH_NAME_LENGTH) {
    return {
      valid: false,
      reason: `Branch names must be at most ${String(MAX_BRANCH_NAME_LENGTH)} characters.`,
    };
  }
  if (!BRANCH_PATTERN.test(name)) {
    return {
      valid: false,
      reason: `Branch names must look like <type>/<issue>-<kebab-summary>, for example "feat/12-selection-box", where <type> is one of: ${BRANCH_TYPES.join(', ')}.`,
    };
  }
  return { valid: true, exempt: false };
}
