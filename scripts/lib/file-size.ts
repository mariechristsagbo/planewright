export interface FileStats {
  readonly path: string;
  readonly bytes: number;
  readonly lines: number;
}

export interface FileSizeLimits {
  readonly maxBytes: number;
  readonly maxSourceLines: number;
  readonly sourceExtensions: readonly string[];
  readonly exempt: readonly string[];
}

export const DEFAULT_FILE_SIZE_LIMITS: FileSizeLimits = {
  maxBytes: 256 * 1024,
  maxSourceLines: 400,
  sourceExtensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html'],
  exempt: ['package-lock.json'],
};

function isSource(path: string, limits: FileSizeLimits): boolean {
  return limits.sourceExtensions.some((extension) => path.endsWith(extension));
}

/** Lists human-readable violations of the repository file-size guardrail. */
export function findFileSizeViolations(
  files: readonly FileStats[],
  limits: FileSizeLimits = DEFAULT_FILE_SIZE_LIMITS,
): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (limits.exempt.includes(file.path)) {
      continue;
    }
    if (file.bytes > limits.maxBytes) {
      violations.push(
        `${file.path}: ${String(file.bytes)} bytes exceeds the ${String(limits.maxBytes)}-byte limit`,
      );
    }
    if (isSource(file.path, limits) && file.lines > limits.maxSourceLines) {
      violations.push(
        `${file.path}: ${String(file.lines)} lines exceeds the ${String(limits.maxSourceLines)}-line limit`,
      );
    }
  }
  return violations;
}
