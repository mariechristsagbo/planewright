<!--
Pull request title: a Conventional Commit header, for example `feat(web): add selection box`.
It becomes the squash-merge commit message, so CI lints it with commitlint.
Branch name: <type>/<issue>-<kebab-summary>, for example `feat/12-selection-box`.
Delete guidance comments as you fill the template. Write "N/A" with a reason instead of
deleting a section.
-->

## Summary

<!-- What does this change do, in one or two sentences? -->

## Linked issue

Closes #<!-- issue number; every pull request must reference an issue -->

## Type of change

- [ ] `feat` — new user-facing capability
- [ ] `fix` — bug fix
- [ ] `perf` — performance improvement
- [ ] `refactor` — no behaviour change
- [ ] `test` — tests only
- [ ] `docs` — documentation only
- [ ] `build` / `ci` / `chore` — tooling, dependencies or automation
- [ ] Breaking change (describe the migration below)

## Motivation and context

<!-- Why is this change needed? Which acceptance criteria from the issue does it satisfy? -->

## Behavioural reference and investigation evidence

<!--
For features modelled on observed reference behaviour, link the investigation issue and the
evidence under docs/investigation/. Explain where Planewright intentionally differs.
-->

- Investigation issue:
- Evidence:
- Intentional differences:

## Implementation notes

<!-- Design decisions, trade-offs, alternatives rejected, and any new or updated ADR. -->

## Independent implementation attestation

- [ ] This change contains no source code, assets, fonts, icons or text copied from Excalidraw or any other third-party project, and adds no `@excalidraw/*` dependency.
- [ ] Any third-party dependency added is necessary, actively maintained, licence-compatible with MIT and recorded in the lockfile.
- [ ] Reference applications were used only to observe behaviour, as described in `docs/adr/0003-clean-room-reference-policy.md`.

## Testing

<!-- List what you ran and the result. Paste failing output if something is known to fail. -->

| Check                                          | Result |
| ---------------------------------------------- | ------ |
| `npm run format:check`                         |        |
| `npm run lint`                                 |        |
| `npm run typecheck`                            |        |
| `npm run test:unit`                            |        |
| `npm run test:integration`                     |        |
| `npm run test:e2e`                             |        |
| `npm run build`                                |        |
| `npm run guardrails`                           |        |
| `npm run secrets:scan`                         |        |
| `npm run audit:deps` (if dependencies changed) |        |

New or changed tests:

-

Manual verification steps (browsers, devices, collaboration scenarios):

1.

## Screenshots or recordings

<!-- Required for visible UI changes: before and after, light and dark schemes where relevant. -->

## Accessibility

- [ ] Keyboard operable, with visible focus
- [ ] Meaningful names and roles for assistive technology
- [ ] Respects reduced-motion and colour-contrast requirements
- [ ] N/A — no user-facing change

## Performance

<!-- Rendering, bundle size, memory or network impact. Include measurements for hot paths. -->

## Security and privacy

<!--
Input validation, untrusted data from files or the network, WebSocket message handling,
authentication or authorisation, data retention, new secrets or configuration.
-->

## Documentation and changelog

- [ ] README, `docs/` or code comments updated where behaviour or setup changed
- [ ] `CHANGELOG.md` updated under **Unreleased** for user-visible changes
- [ ] ADR added or updated for architectural decisions

## Breaking changes and migration

<!-- Describe what breaks and how users or contributors migrate. Write "None" otherwise. -->

## Rollback plan

<!-- How to revert or disable this change safely if it causes problems after merge. -->

## Reviewer checklist

- [ ] Branch name and pull request title follow the conventions
- [ ] Commits are atomic Conventional Commits
- [ ] CI is green, or failures are explained above
- [ ] Scope matches the linked issue; unrelated changes are split out

## AI assistance disclosure

<!-- If an AI agent authored or substantially assisted with this change, say which and how it was reviewed. -->
