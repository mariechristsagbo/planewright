import type { Ref } from 'react';

/** The persistent Pre-release tag, which opens About this build (ADR 0012, D5). */
export function PrereleaseTag({
  ref,
  onOpen,
}: {
  readonly ref: Ref<HTMLButtonElement>;
  readonly onOpen: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className="prerelease-tag"
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      Pre-release
    </button>
  );
}
