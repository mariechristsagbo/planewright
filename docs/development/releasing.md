# Releases

A Planewright release is an annotated Git tag `vX.Y.Z` on a commit of `main` and a GitHub release
of that tag, whose body is the version's notes in [`docs/releases`](../releases). No package is
published. This document holds the rules that every release follows, the records of versions 0.1.0
and 0.2.0 (issue #67) and the checklist of their publication.

## Rules for every release

- **Asked for.** A maintainer asks for the release in an issue; no tag or release is made otherwise
  ([AGENTS.md](../../AGENTS.md), rule 5).
- **Versions.** Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). They
  stay 0.x until the milestone v1.0.0, Stable Reconstruction, so a version may change what an
  earlier one did.
- **Target.** The tag points to a commit of `main` that holds every change the version releases.
  The CI and CodeQL runs of that commit's push succeeded at their first attempt, and no
  code-scanning or secret-scanning alert is open.
- **Records.** The [changelog](../../CHANGELOG.md) has a section `## [X.Y.Z] - YYYY-MM-DD` for the
  version, dated the day, in UTC, on which the target reached `main`, with a link definition, and
  `docs/releases/vX.Y.Z.md` holds its notes, published word for word as the release's body. The
  notes' links are absolute, since a release page cannot resolve a relative path.
- **By hand, before each release.** The JavaScript heap of budget B14 is measured on the target's
  production build ([what ENG-15 decided](../architecture/engine/quality.md#what-eng-15-decided)),
  and a manual screen-reader pass is made
  ([testing strategy](../architecture/engine/quality.md#testing-strategy)). Both are recorded in
  this document before the tag is made. Versions 0.1.0 and 0.2.0 are the only exception to the
  second, by the maintainer's waiver [below](#the-screen-reader-pass-of-v010-and-v020).
- **Tags.** A tag is annotated and unsigned, since the repository has no signing key and no rule
  asks for signatures, and its message names its target's CI and CodeQL runs. Tags are pushed by
  name, never with `--tags` or `--force`, and a pushed tag is never moved or deleted without the
  maintainer's decision. No workflow runs on a tag: CI and CodeQL run on pushes to `main`, pull
  requests, a manual dispatch and a weekly schedule.
- **GitHub releases.** A release is titled `Planewright vX.Y.Z — <milestone name>`, is neither a
  draft nor a pre-release, has no generated notes and no files, and the newest version is the
  latest release.
- **Packages.** Every `package.json` of the repository is private at version `0.0.0`, and stays so:
  the workspace packages are source-only and never published, nothing reads their version, and a
  release is known by its tag alone. Bumping them would change six files and the lockfile for no
  reader.

## Versions 0.1.0 and 0.2.0

The maintainer authorised both publications in issue #67 on 2026-11-11, once every prerequisite it
lists is verified, with no further confirmation.

| Version | Release title                            | Tag target                                                                                                     | Date       |
| ------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- |
| v0.1.0  | `Planewright v0.1.0 — Engine Core`       | `1f8188fe2177f1d91237168c79d4e7cebbae9ebd`, the last commit of P0 (pull request #48, issue #41)                | 2026-11-10 |
| v0.2.0  | `Planewright v0.2.0 — Editor Experience` | the last commit of the pull request that added this document, as `main` holds it after the pull request merged | 2026-11-13 |

Version 0.1.0 is a historical release: its tag is made with version 0.2.0's, on the commit that
`main` held when the milestone v0.1.0 closed on 2026-11-10, and the files at that commit still say
that no release had been published. Neither version has a pre-release identifier, such as alpha,
beta or rc, and neither GitHub release is marked as a pre-release. The editor's Pre-release tag
([ADR 0012](../adr/0012-v02-editor-chrome.md), D5) stays, since it says what the build lacks. The
notes are [`v0.1.0.md`](../releases/v0.1.0.md) and [`v0.2.0.md`](../releases/v0.2.0.md).

### B14 on both targets

| Production build                           | After loading | Most with the history full | Heap snapshot | Budget        |
| ------------------------------------------ | ------------- | -------------------------- | ------------- | ------------- |
| v0.1.0, `1f8188f`                          | 17.3 MB       | 51.1 MB                    | 56.9 MB       | ≤ 150 MB, met |
| v0.2.0, `8e768b1` and this document's head | 17.1 MB       | 52.2 MB                    | 58.5 MB       | ≤ 150 MB, met |

Measured on 2026-11-13, on a developer machine, from each commit's production build served by
`vite preview`, in Chromium 156.0.8078.4 at 1280 × 720, by a script through the DevTools protocol
rather than by a person in the developer tools, as the first measurement at `54425f4` was. The
drawing held the performance scenes' 10,000 elements of seed 14, all in view and stored all
selected, as the browser tests' `storeScene` stores a scene. Eighty presses of the right arrow key
on the canvas then nudged them, each press its own undo entry of about 2.27 MB in the history's
estimate, so that from the 23rd press on the history held its 50 MB and dropped its oldest entries;
afterwards the stored drawing had the first element 80 units to the right, and the page had logged
no error. After 0, 10, 20, 30, 40, 50, 60 and 80 presses, garbage was collected twice and the
heap's used size read; the table gives the first reading and the largest. A heap snapshot after the
80 presses gives the sum of its nodes' own sizes.

The pull request that adds this document changes no file that the web app's build reads. At its
head, the production build equals `8e768b1`'s in every file but the source map, whose paths to the
dependencies name the folder that the build ran in: the 11 other files give the digest below, so
version 0.2.0's B14 is the one measured on `8e768b1`.

```sh
(cd apps/web/dist && find . -type f ! -name '*.map' | LC_ALL=C sort | xargs sha256sum | sha256sum)
# c87e758e8fc4712ddd5ca84a74c4e314b43b6ad095c61cd4a9e8641bd77137db  -
```

### The screen-reader pass of v0.1.0 and v0.2.0

No manual screen-reader pass was made before version 0.1.0 or version 0.2.0. On 2026-11-13 the
maintainer waived it for this pair alone, in
[a comment on issue #67](https://github.com/mariechristsagbo/planewright/issues/67#issuecomment-6846541485):

> Maintainer decision (2026-11-13): I explicitly waive the pre-release manual screen-reader pass for
> the historical `v0.1.0` and the first `v0.2.0` publication. I will perform the manual
> VoiceOver/NVDA/TalkBack test after production deployment. This waiver applies only to this
> release pair; all automated accessibility gates remain mandatory, and the post-deployment manual
> result must be recorded as follow-up evidence. Publication and deployment may proceed after a
> fresh exact-head preflight.

So:

- the rule that a manual screen-reader pass is recorded before each release stands for every later
  release;
- the automated accessibility checks of the unit and end-to-end tests, which assert roles, names,
  the focus order and its indicators, contrast, target sizes and reduced motion, stay mandatory:
  they passed on version 0.1.0's target, and step 2 of the checklist requires them on version
  0.2.0's;
- the maintainer makes the pass with VoiceOver, NVDA and TalkBack on the production deployment of
  version 0.2.0, issue #90, and its result is recorded there, where an acceptance criterion tracks
  it; if issue #90 closes before the result is recorded, a follow-up issue tracks the pass until it
  is;
- the release notes of both versions say that no pass was made before them.

## Publication checklist

The session that publishes the two versions follows these steps after this document's pull request
had one bounded independent review, its findings were settled, and it was merged by Rebase and
Merge with every commit kept. Issue #67 stays open until step 8. Any check that fails stops the
session before the next step, and the session reports it on issue #67; [rollback](#rollback)
says what follows.

```sh
REPO=mariechristsagbo/planewright
V010=1f8188fe2177f1d91237168c79d4e7cebbae9ebd
MESSAGES=<a folder outside the repository for the tags' messages>
```

1. **The target of v0.2.0.** Fetch, bring the local `main` level with `origin/main` and read the
   target:

   ```sh
   git fetch origin --prune
   git switch main && git merge --ff-only origin/main
   T=$(git rev-parse origin/main)
   git status --porcelain                                             # nothing
   TZ=UTC git log -1 --format=%cd --date=format-local:%Y-%m-%d "$T"   # 2026-11-13
   ```

   `T` must be the pull request's last commit as merged: its commits pair with those of
   `refs/pull/<number>/head` in order by `git patch-id --stable`, the two trees are equal, and no
   commit follows `T` on `main`. The day must be the changelog's date of version 0.2.0; if it is
   not, a pull request of its own corrects the date in the changelog and this document first, and
   its commit becomes the target.

2. **The gates on `T`.**
   - The CI and CodeQL runs of the push of `T`
     (`gh api "repos/$REPO/actions/runs?head_sha=$T"`) succeeded at their first attempt, and so did
     every job of the CI run but Branch and commit conventions, which a push skips.
   - `npm ci`, then `npm run validate`, `npm run test:e2e` and `npm run audit:deps` pass at `T`.
   - `gh api "repos/$REPO/code-scanning/alerts?state=open" --jq length` and the same for
     `secret-scanning` give `0`.
   - After `npm run validate`, the digest of the production build
     [above](#b14-on-both-targets) is `c87e758e…77137db`. If it is not, B14 is measured again on
     `T` with the method above and recorded before any tag is made.

3. **Nothing published yet.**

   ```sh
   git ls-remote --tags origin                    # nothing
   git tag -l 'v*'                                # nothing
   gh api "repos/$REPO/releases" --jq length      # 0
   git cat-file -t "$V010"                        # commit
   git merge-base --is-ancestor "$V010" "$T" && echo ancestor
   ```

4. **The tags.** Write each message to a file outside the repository, with no line starting with
   `#`. The message of v0.1.0 is its release title, a blank line, then this paragraph:

   ```text
   A historical release: the P0 milestone Engine Core as main held it when
   the milestone closed on 2026-11-10, at the last commit of P0 (pull
   request #48, issue #41), tagged with v0.2.0 under issue #67. CI run
   42831203394 and CodeQL run 42831203630 succeeded on this commit. B14 on
   its production build: 17.3 MB after loading, at most 51.1 MB with the
   history full, 56.9 MB in a heap snapshot.
   ```

   The message of v0.2.0 is its release title, a blank line, then this paragraph with the runs of
   step 2 and the counts of their jobs:

   ```text
   The v0.2 editor chrome of ADR 0012, slices S1 to S13, with the README's
   screenshots and the empty-canvas note's fix, on v0.1.0's engine, at the
   last commit of the pull request that added the release records of
   issue #67, as main holds it after the rebase merge. CI run <CI run> and
   CodeQL run <CodeQL run> succeeded on this commit at their first
   attempt: <n> end-to-end tests and <m> Vitest test files passed. B14 on
   its production build: 17.1 MB after loading, at most 52.2 MB with the
   history full, 58.5 MB in a heap snapshot.
   ```

   ```sh
   git tag -a --no-sign --cleanup=verbatim -F "$MESSAGES/v0.1.0.txt" v0.1.0 "$V010"
   git tag -a --no-sign --cleanup=verbatim -F "$MESSAGES/v0.2.0.txt" v0.2.0 "$T"
   git cat-file -t v0.1.0                         # tag
   git rev-parse 'v0.1.0^{commit}'                # $V010
   git cat-file -p v0.1.0 | head -4               # object $V010, type commit, tag v0.1.0, tagger
   git push --atomic origin refs/tags/v0.1.0 refs/tags/v0.2.0
   ```

   The checks of `v0.1.0` are made for `v0.2.0` too, with `T`.

5. **The tags as GitHub holds them.** `git ls-remote origin 'refs/tags/v0.*'` prints four lines:
   `refs/tags/v0.1.0` with the local tag object, `git rev-parse v0.1.0`, then `refs/tags/v0.1.0^{}`
   with `V010`, and the same for v0.2.0 with `T`. Then, for each tag:

   ```sh
   gh api "repos/$REPO/git/ref/tags/v0.1.0" --jq '.object.type, .object.sha'   # tag, its object
   gh api "repos/$REPO/git/tags/<its object>" --jq '.tag, .object.type, .object.sha'
   # v0.1.0, commit, $V010
   ```

6. **The GitHub releases,** v0.1.0 first, so that v0.2.0 ends as the latest:

   ```sh
   gh release create v0.1.0 --repo "$REPO" --verify-tag --title 'Planewright v0.1.0 — Engine Core' \
     --notes-file docs/releases/v0.1.0.md --latest=false
   gh release create v0.2.0 --repo "$REPO" --verify-tag --title 'Planewright v0.2.0 — Editor Experience' \
     --notes-file docs/releases/v0.2.0.md --latest
   ```

   No `--draft`, `--prerelease`, `--generate-notes`, `--target` or file. `--verify-tag` refuses a
   tag that GitHub lacks instead of making a lightweight one.

7. **The releases as GitHub holds them.** For each tag,
   `gh api "repos/$REPO/releases/tags/v0.1.0"` gives the exact title, the tag, `draft` and
   `prerelease` false, and a body equal to its notes file, read through the JSON rather than a
   printed line. `gh api "repos/$REPO/releases" --jq length` gives `2`,
   `gh api "repos/$REPO/releases/latest" --jq .tag_name` gives `v0.2.0`, `main` is still `T`, and no
   workflow run started for the tags.

8. **Closing.** A comment on issue #67 gives the targets, the tag objects, the releases' addresses,
   the runs and the readback; its checklist is ticked where that evidence meets it, and it is closed
   as completed. The milestone v0.2.0 is closed after that verification and only with no open issue
   in it: issue #90, the production deployment, is in it, so the milestone closes when issue #90
   closes, unless the maintainer moves issue #90 first.

9. **Afterwards.** Issue #90 deploys version 0.2.0 to production from the tag `v0.2.0`, and the
   maintainer then makes the screen-reader pass
   [above](#the-screen-reader-pass-of-v010-and-v020).

## Rollback

- **Before a tag is pushed,** `git tag -d v0.1.0 v0.2.0` removes the local tags; nothing is public,
  and the session starts again at step 1 once the cause is fixed.
- **If a check of steps 1 to 3 fails,** no tag is made, and `main` describes releases that do not
  exist yet. The maintainer decides between a fix in a pull request of its own, whose commit then
  becomes version 0.2.0's target, with its date and this document's table changed in it, and a
  revert of this document's pull request in a pull request.
- **A failed push** of the two tags is atomic and pushes neither: `git ls-remote --tags origin`
  shows it, and the push is retried once.
- **After the tags are pushed,** a wrong tag is reported on issue #67 and is moved or deleted only
  by the maintainer's decision.
- **After the releases are made,** a wrong title or body is corrected by editing the release, which
  leaves its tag alone; a release is deleted only by the maintainer's decision.
- **The deployment's rollback** belongs to issue #90.
