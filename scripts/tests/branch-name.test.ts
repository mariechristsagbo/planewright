import config from '@commitlint/config-conventional';
import { describe, expect, it } from 'vitest';

import { BRANCH_TYPES, validateBranchName } from '../lib/branch-name.ts';

describe('validateBranchName', () => {
  it.each(['feat/12-selection-box', 'fix/3-a', 'docs/104-adr-0004-rendering', 'ci/7-cache-npm'])(
    'accepts %s',
    (name) => {
      expect(validateBranchName(name)).toEqual({ valid: true, exempt: false });
    },
  );

  it.each(['main', 'dependabot/npm_and_yarn/vite-8.4.0'])('exempts %s', (name) => {
    expect(validateBranchName(name)).toEqual({ valid: true, exempt: true });
  });

  it.each([
    'feature/12-selection-box',
    'feat/selection-box',
    'feat/012-selection-box',
    'feat/12-Selection-Box',
    'feat/12-selection--box',
    'feat/12-selection-box-',
    'feat/12_selection_box',
    'feat/12-',
    'Feat/12-selection-box',
    'feat/12-selection-box/extra',
  ])('rejects %s', (name) => {
    expect(validateBranchName(name).valid).toBe(false);
  });

  it('rejects names longer than the limit', () => {
    expect(validateBranchName(`feat/1-${'a'.repeat(80)}`)).toMatchObject({ valid: false });
  });

  it('uses the same types as commitlint', () => {
    const typeEnum = config.rules['type-enum'] as [number, string, string[]];
    expect([...BRANCH_TYPES].sort()).toEqual([...typeEnum[2]].sort());
  });
});
