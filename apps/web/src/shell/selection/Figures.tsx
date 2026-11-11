import { KIND_NAMES } from '../../a11y/names.ts';
import { Icon } from '../icons.tsx';
import { KIND_GLYPHS } from '../kind-glyphs.ts';
import { figuresOf } from './geometry.ts';
import type { SelectionGeometry } from './geometry.ts';

// What the selection panel and the Details sheet share (the v0.2 plan's S6): the heading with the
// kind's glyph and name, or the count, and the read-only figures.

/** The heading's glyph and words: the kind's, or the multiple glyph and the count. */
function headingOf(geometry: SelectionGeometry) {
  return geometry.type === 'multiple'
    ? { glyph: 'multiple' as const, name: `${String(geometry.count)} elements` }
    : { glyph: KIND_GLYPHS[geometry.kind], name: KIND_NAMES[geometry.kind] };
}

/** The selection's heading: its glyph, hidden from assistive technology, and its name. */
export function SelectionHeading({
  id,
  geometry,
}: {
  readonly id: string;
  readonly geometry: SelectionGeometry;
}) {
  const { glyph, name } = headingOf(geometry);
  return (
    <h2 id={id} className="selection-heading">
      <Icon name={glyph} size={16} />
      <span>{name}</span>
    </h2>
  );
}

/**
 * The figures as static text in a description list, no field among them: each term in the chrome's
 * face, a short one read by its word, and each value in JetBrains Mono (ADR 0012, decision 8).
 */
export function Figures({ geometry }: { readonly geometry: SelectionGeometry }) {
  return (
    <dl className="selection-figures">
      {figuresOf(geometry).map(({ term, value, word }) => (
        <div key={term} className="selection-figure">
          <dt>
            {word === null ? (
              term
            ) : (
              <>
                <span aria-hidden="true">{term}</span>
                <span className="visually-hidden">{word}</span>
              </>
            )}
          </dt>
          <dd className="selection-value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The footnote that says what the build does not do. */
export function StyleFootnote() {
  return <p className="selection-footnote">Style controls are not in this build.</p>;
}
