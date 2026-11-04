import { readFile } from 'node:fs/promises';

import { findForbiddenPackages } from './lib/dependency-policy.ts';

const lockfile: unknown = JSON.parse(await readFile('package-lock.json', 'utf8'));
const violations = findForbiddenPackages(lockfile);

if (violations.length > 0) {
  console.error('Forbidden packages found in package-lock.json:');
  for (const name of violations) {
    console.error(`  - ${name}`);
  }
  console.error('See docs/adr/0003-clean-room-reference-policy.md.');
  process.exitCode = 1;
} else {
  console.log('Dependency policy satisfied: no forbidden packages in package-lock.json.');
}
