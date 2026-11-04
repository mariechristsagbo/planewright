import { PROTOCOL_VERSION } from '@planewright/protocol';

import { FOUNDATION_CONTENTS, NOT_YET_IMPLEMENTED } from './foundation.ts';

const REPOSITORY_URL = 'https://github.com/mariechristsagbo/planewright';

function FoundationContents() {
  return (
    <section aria-labelledby="contents-heading">
      <h2 id="contents-heading">What this foundation contains</h2>
      <dl>
        {FOUNDATION_CONTENTS.map((item) => (
          <div key={item.name}>
            <dt>{item.name}</dt>
            <dd>{item.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function NotYetImplemented() {
  return (
    <section aria-labelledby="missing-heading">
      <h2 id="missing-heading">Not implemented yet</h2>
      <ul>
        {NOT_YET_IMPLEMENTED.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <p>
        Behavioural investigation comes before feature work. Features will be delivered through
        tracked GitHub issues and reviewed pull requests.
      </p>
    </section>
  );
}

export function App() {
  return (
    <div className="page">
      <header>
        <h1>Planewright</h1>
        <p className="status" role="status">
          Foundation only — this build is not a drawing editor.
        </p>
      </header>
      <main>
        <p>
          Planewright is an independently engineered open-source infinite canvas for drawing and
          diagrams. This page confirms that the repository foundation builds and runs; it does not
          offer any drawing functionality.
        </p>
        <FoundationContents />
        <NotYetImplemented />
      </main>
      <footer>
        <p>
          Protocol version {PROTOCOL_VERSION} (pre-release). MIT licensed.{' '}
          <a href={REPOSITORY_URL}>Source on GitHub</a>.
        </p>
        <p>Planewright is an independent project and is not affiliated with Excalidraw.</p>
      </footer>
    </div>
  );
}
