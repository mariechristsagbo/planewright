import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { DEFAULT_FILE_SIZE_LIMITS, findFileSizeViolations } from './lib/file-size.ts';
import type { FileStats } from './lib/file-size.ts';

function trackedFiles(): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
    },
  );
  return output.split('\0').filter((path) => path.length > 0 && existsSync(path));
}

function statsFor(path: string): FileStats {
  const content = readFileSync(path);
  const lines = content.length === 0 ? 0 : content.toString('utf8').split('\n').length;
  return { path, bytes: content.length, lines };
}

const files = trackedFiles().map(statsFor);
const violations = findFileSizeViolations(files);

if (violations.length > 0) {
  console.error('File-size guardrail violations:');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exitCode = 1;
} else {
  const { maxBytes, maxSourceLines } = DEFAULT_FILE_SIZE_LIMITS;
  console.log(
    `File-size guardrail satisfied for ${String(files.length)} files (max ${String(maxBytes)} bytes, ${String(maxSourceLines)} source lines).`,
  );
}
