import { execFileSync } from 'node:child_process';

import { validateBranchName } from './lib/branch-name.ts';

function currentBranch(): string {
  const fromArgument = process.argv[2];
  if (fromArgument !== undefined && fromArgument.length > 0) {
    return fromArgument;
  }
  const fromCi = process.env['GITHUB_HEAD_REF'];
  if (fromCi !== undefined && fromCi.length > 0) {
    return fromCi;
  }
  try {
    // Unlike `rev-parse`, `symbolic-ref` also works on a branch without commits.
    return execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'HEAD';
  }
}

const branch = currentBranch();
if (branch === 'HEAD') {
  console.log('Detached HEAD: branch-name validation skipped.');
} else {
  const result = validateBranchName(branch);
  if (result.valid) {
    console.log(
      `Branch "${branch}" ${result.exempt ? 'is exempt from' : 'satisfies'} the naming rule.`,
    );
  } else {
    console.error(`Invalid branch name "${branch}". ${result.reason}`);
    process.exitCode = 1;
  }
}
