import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const PORTS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'packages/engine/src/ports',
);

const isExported = (statement: ts.Statement): boolean =>
  ts.canHaveModifiers(statement) &&
  (ts.getModifiers(statement) ?? []).some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword);

/** Each top-level statement of a module that exports something, as `<kind> <name>`. */
function exportsOf(text: string): string[] {
  const source = ts.createSourceFile('ports.ts', text, ts.ScriptTarget.ES2024);
  return source.statements
    .filter((statement) => ts.isExportDeclaration(statement) || isExported(statement))
    .map((statement) => {
      const kind = ts.SyntaxKind[statement.kind];
      const name = ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
      return name ? `${kind} ${statement.name.text}` : kind;
    });
}

describe('the ports module', () => {
  it('declares only the Clock, Scheduler and IdSource ports, as types', () => {
    const declarations = readdirSync(PORTS)
      .flatMap((name) => exportsOf(readFileSync(join(PORTS, name), 'utf8')))
      .sort();
    expect(declarations).toEqual([
      'InterfaceDeclaration Clock',
      'InterfaceDeclaration IdSource',
      'InterfaceDeclaration Scheduler',
      'TypeAliasDeclaration Cancel',
    ]);
  });

  it('reports a value or a re-export as such', () => {
    const text = [
      'export const clock = 1;',
      "export * from './other.ts';",
      'export interface TextMeasurer { measure(): number }',
      'interface Internal { x: number }',
    ].join('\n');
    expect(exportsOf(text)).toEqual([
      'FirstStatement',
      'ExportDeclaration',
      'InterfaceDeclaration TextMeasurer',
    ]);
  });
});
