import type { Ref } from 'react';

import { PrereleaseTag } from './PrereleaseTag.tsx';

/**
 * The identity island at the top left (ADR 0012, decision 2): the wordmark, which the page's
 * hidden heading already names, so it is hidden from assistive technology, and the Pre-release
 * tag. S3 adds the mark and S4 the menu.
 */
export function IdentityIsland({
  tag,
  onAbout,
}: {
  readonly tag: Ref<HTMLButtonElement>;
  readonly onAbout: () => void;
}) {
  return (
    <div className="island identity-island" data-island="identity">
      <span className="wordmark" aria-hidden="true">
        Planewright
      </span>
      <PrereleaseTag ref={tag} onOpen={onAbout} />
    </div>
  );
}
