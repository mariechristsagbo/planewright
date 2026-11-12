import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// What the web app's style-sheet tests share: a style sheet's text, its rules and their
// declarations, read as written rather than as a browser computes them.

const STYLES = join(import.meta.dirname, '..', '..', 'apps', 'web', 'src', 'styles');

/** A rule of a style sheet: its selector and the text of its declarations. */
export interface Rule {
  readonly selector: string;
  readonly body: string;
}

/** A declaration's property and its value, with the value's white space collapsed. */
export interface Declaration {
  readonly property: string;
  readonly value: string;
}

/** The text of a style sheet in `apps/web/src/styles`. */
export const styleSheet = (name: string): string => readFileSync(join(STYLES, name), 'utf8');

/** The rules of a style sheet without its comments, in the order written. */
export function rulesOf(css: string): Rule[] {
  const plain = css.replaceAll(/\/\*[\s\S]*?\*\//gu, '');
  return [...plain.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map(([, selector = '', body = '']) => ({
    selector: selector.trim(),
    body,
  }));
}

/** The declarations of a rule's body, in the order written. */
export function declarationsOf(body: string): Declaration[] {
  return body
    .split(';')
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .map((text) => {
      const colon = text.indexOf(':');
      return {
        property: text.slice(0, colon).trim(),
        value: text
          .slice(colon + 1)
          .replaceAll(/\s+/gu, ' ')
          .trim(),
      };
    });
}

/** A style sheet's @media blocks, each query with the rules inside it. */
export function mediaBlocks(css: string): { query: string; body: string }[] {
  const text = css.replaceAll(/\/\*[\s\S]*?\*\//gu, '');
  const blocks: { query: string; body: string }[] = [];
  for (let at = text.indexOf('@media '); at >= 0; at = text.indexOf('@media ', at + 1)) {
    const open = text.indexOf('{', at);
    let depth = 1;
    let end = open + 1;
    for (; depth > 0 && end < text.length; end += 1) {
      if (text[end] === '{') depth += 1;
      if (text[end] === '}') depth -= 1;
    }
    blocks.push({
      query: text.slice(at + '@media '.length, open).trim(),
      body: text.slice(open, end),
    });
  }
  return blocks;
}

/** The value of each custom property that tokens.css declares, by its name. */
export const tokenValues = (css: string = styleSheet('tokens.css')): Map<string, string> =>
  new Map(
    rulesOf(css).flatMap(({ body }) =>
      declarationsOf(body).map(({ property, value }) => [property, value] as const),
    ),
  );
