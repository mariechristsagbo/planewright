# ADR 0001: Record architecture decisions

- Status: Accepted
- Date: 2026-11-04

## Context

Planewright is built incrementally through issues and pull requests, often with AI assistance.
Decisions made early, such as the toolchain, the package boundaries and the reference policy,
must stay understandable to later contributors who were not present when they were made.

## Decision

Significant technical decisions are recorded as numbered Markdown files in `docs/adr`, each with
a status, a date, the context, the decision and its consequences. An ADR is added in the same
pull request as the change it justifies.

## Consequences

- Reviewers can check changes against recorded decisions.
- Raising a guardrail threshold or reversing a decision requires a new or superseding ADR.
