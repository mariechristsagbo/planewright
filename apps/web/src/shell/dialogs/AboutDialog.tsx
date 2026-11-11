import { PROTOCOL_VERSION } from '@planewright/protocol';

import { BUILD_STATUS, FOUNDATION_CONTENTS, NOT_YET_IMPLEMENTED } from '../../foundation.ts';
import { ModalDialog } from './ModalDialog.tsx';

// About this build (ADR 0012, D5): what P0's page said around the editor, in one dialog that the
// Pre-release tag opens, so that the canvas can fill the window. The words are P0's.

const REPOSITORY_URL = 'https://github.com/mariechristsagbo/planewright';

function NotYetImplemented() {
  return (
    <section aria-labelledby="missing-heading">
      <h3 id="missing-heading">Not implemented yet</h3>
      <ul>
        {NOT_YET_IMPLEMENTED.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <p>
        Behavioural investigation comes before feature work. Features are delivered through tracked
        GitHub issues and reviewed pull requests.
      </p>
    </section>
  );
}

function FoundationContents() {
  return (
    <section aria-labelledby="contents-heading">
      <h3 id="contents-heading">What this build contains</h3>
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

/** The pre-release sentence, what is not implemented, what the build contains, and its notes. */
export function AboutDialog({ onClose }: { readonly onClose: () => void }) {
  return (
    <ModalDialog id="about-this-build" title="About this build" onClose={onClose}>
      <p>{BUILD_STATUS}</p>
      <NotYetImplemented />
      <FoundationContents />
      <p>
        Protocol version {PROTOCOL_VERSION} (pre-release). MIT licensed.{' '}
        <a href={REPOSITORY_URL}>Source on GitHub</a>.
      </p>
      <p>Planewright is an independent project and is not affiliated with Excalidraw.</p>
    </ModalDialog>
  );
}
