import type { Ref } from 'react';

import { Icon } from './icons.tsx';
import { PrereleaseTag } from './PrereleaseTag.tsx';

/**
 * The identity island at the top left (ADR 0012, decision 2): the mark, Planewright's original
 * glyph (decision 3), and the wordmark, which compact widths hide, both hidden from assistive
 * technology since the page's hidden heading already names Planewright, then the Pre-release
 * tag. S4 adds the menu.
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
      <span className="identity-mark" aria-hidden="true">
        <Icon name="mark" />
      </span>
      <span className="wordmark" aria-hidden="true">
        Planewright
      </span>
      <PrereleaseTag ref={tag} onOpen={onAbout} />
    </div>
  );
}
