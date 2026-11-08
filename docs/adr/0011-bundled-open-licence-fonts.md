# ADR 0011: Bundled open-licence fonts behind the three font families

- Status: Proposed
- Date: 2026-11-08

## Context

A text names one of three Planewright families, `sans`, `hand` and `mono`, and stores its measured
width and height, so that a document lays out and hit-tests without its fonts
([domain model](../architecture/engine/domain-model.md#text), [ADR 0005](0005-document-model.md)).
The engine measures through its `TextMeasurer` port, which the web app implements with a 2D
context's `measureText`, and the canvas renderer draws with the same context font. Until the text
issue (ENG-12) the families mapped to the generic `sans-serif`, `cursive` and `monospace`, whose
fonts differ from one machine to the next, so the same text would store a different size on each.

The fonts must be Planewright's own choice under an open licence that allows bundling them with a
web application, and never the reference application's
([ADR 0003](0003-clean-room-reference-policy.md)). P0 texts use `sans` only; the font picker that
offers the other two families is P1.

## Decision

1. **The fonts.** `sans` is Inter, `hand` is Patrick Hand and `mono` is JetBrains Mono, each in its
   regular (400) weight. They were chosen for legibility at small sizes, a hand-written look that
   stays readable, and clear monospaced glyphs. All three are under the SIL Open Font License 1.1,
   and none of their licences reserves a font name. None is a font that the baseline records in
   the reference application (B-06 names Nunito, which is not used).
2. **The files.** Each family is one WOFF2 file of the font's Latin subset, taken from the
   Fontsource 5.3.0 release of that font, with the font's licence text beside it in
   `apps/web/public/fonts/`, so that the licence is served with the font. They are static assets,
   not a dependency: no package is added.
3. **The names.** The web app declares each file with `@font-face` as `Planewright Sans`,
   `Planewright Hand` and `Planewright Mono`, followed by the generic family as a fallback. The
   canvas renderer owns that mapping, draws with it and exports it, and the web app's text measurer
   and text area use the same mapping, so drawing, measuring and editing agree.
4. **Loading.** The page loads the three faces before it creates the editor, so the first text is
   measured in its font. A face that fails to load leaves its generic fallback, and the page still
   starts.

## Alternatives considered

- **Generic families only.** Rejected: each machine measures and draws with a different font, so a
  stored size depends on where the text was typed.
- **Full Unicode coverage.** Rejected for P0: the files would grow many times over. Characters
  outside the Latin subset are drawn and measured in the generic fallback.
- **Variable fonts or several weights.** Rejected: P0 texts have one weight.
- **A font package as a dependency.** Rejected: the repository adds no dependency for static files,
  and a package would bring every subset and weight.

## Consequences

- The web app ships three files of about 23 KB each and their licences; the OFL lets them be
  bundled and redistributed with the licence and copyright notice, and forbids selling the fonts
  alone.
- A text with characters outside the Latin subset stores a size measured partly in the fallback
  font.
- Texts measured before a font finished loading would keep that size. In P0 the page loads its
  fonts before any text exists; measuring stored texts again when a font finishes loading arrives
  with the documents that persistence (ENG-13) loads.
- Changing a font changes the measured size of new and edited texts only; stored sizes stay as
  they were measured.
