import { dirname, join, normalize } from 'node:path';

/** What a link target resolves to: the Markdown text of a file, a directory, or nothing. */
export type LinkTarget =
  | { readonly kind: 'file'; readonly text: string }
  | { readonly kind: 'directory' }
  | { readonly kind: 'missing' };

/** Reads a repository-relative path for the link check. */
export type ReadTarget = (path: string) => LinkTarget;

const FENCE = /^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$/gmu;
const INLINE_CODE = /`[^`\n]*`/gu;
const INLINE_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:\s+(\S+)/gmu;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gmu;
const SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;

/** Blanks fenced code blocks, keeping line breaks so that later matches keep their lines. */
function withoutFences(markdown: string): string {
  return markdown.replace(FENCE, (block) => block.replace(/[^\n]/gu, ' '));
}

/** Returns the GitHub-style anchors of a document's headings, with -1, -2 for repeats. */
export function headingAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const [, heading = ''] of withoutFences(markdown).matchAll(HEADING)) {
    const base = heading
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
      .replaceAll(' ', '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${String(count)}`);
  }
  return anchors;
}

/** Lists the relative link targets of a document: inline links, images and definitions. */
export function relativeTargets(markdown: string): string[] {
  const text = withoutFences(markdown).replace(INLINE_CODE, '');
  const targets = [...text.matchAll(INLINE_LINK), ...text.matchAll(REFERENCE_DEFINITION)].map(
    ([, target = '']) => target.replace(/^<|>$/gu, ''),
  );
  return targets.filter((target) => !SCHEME.test(target));
}

/** Decodes a target's file part, or returns undefined when its percent-encoding is malformed. */
function decodePath(file: string): string | undefined {
  try {
    const decoded = decodeURIComponent(file);
    return decoded.includes('\0') ? undefined : decoded;
  } catch {
    return undefined;
  }
}

/** Resolves a target's file part against its source, or names why it cannot be followed. */
function resolveTarget(source: string, file: string): { path: string } | { problem: string } {
  const decoded = decodePath(file);
  if (decoded === undefined) {
    return { problem: 'malformed percent-encoding' };
  }
  const path = normalize(join(dirname(source), decoded));
  const outside = path === '..' || path.startsWith('../');
  return outside ? { problem: 'outside the repository' } : { path };
}

/** Names what is wrong with one link, or returns undefined when it resolves. */
function linkProblem(source: string, target: string, read: ReadTarget): string | undefined {
  const [file = '', anchor] = target.split('#');
  const resolved = file === '' ? { path: source } : resolveTarget(source, file);
  if ('problem' in resolved) {
    return `broken link ${target} (${resolved.problem})`;
  }
  const found = read(resolved.path);
  const checksAnchor = anchor !== undefined && anchor !== '' && resolved.path.endsWith('.md');
  const anchorMissing =
    checksAnchor && (found.kind !== 'file' || !headingAnchors(found.text).has(anchor));
  return found.kind === 'missing' || anchorMissing ? `broken link ${target}` : undefined;
}

/**
 * Lists the relative links of `source` whose file or heading anchor does not exist. A target
 * that resolves outside the repository or has malformed percent-encoding is reported without
 * being read.
 */
export function findBrokenLinks(source: string, read: ReadTarget): string[] {
  const own = read(source);
  if (own.kind !== 'file') {
    return [`${source}: the document itself cannot be read`];
  }
  return relativeTargets(own.text)
    .map((target) => linkProblem(source, target, read))
    .filter((problem): problem is string => problem !== undefined)
    .map((problem) => `${source}: ${problem}`);
}
