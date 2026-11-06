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

function isBroken(source: string, target: string, read: ReadTarget): boolean {
  const [file = '', anchor] = target.split('#');
  const path = file === '' ? source : normalize(join(dirname(source), decodeURIComponent(file)));
  const resolved = read(path);
  if (resolved.kind === 'missing') {
    return true;
  }
  const checksAnchor = anchor !== undefined && anchor !== '' && path.endsWith('.md');
  return checksAnchor && (resolved.kind !== 'file' || !headingAnchors(resolved.text).has(anchor));
}

/** Lists the relative links of `source` whose file or heading anchor does not exist. */
export function findBrokenLinks(source: string, read: ReadTarget): string[] {
  const own = read(source);
  if (own.kind !== 'file') {
    return [`${source}: the document itself cannot be read`];
  }
  return relativeTargets(own.text)
    .filter((target) => isBroken(source, target, read))
    .map((target) => `${source}: broken link ${target}`);
}
