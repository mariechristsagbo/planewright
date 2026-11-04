# Security policy

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions or
pull requests.

Report them privately with GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability**, or go directly to
   <https://github.com/mariechristsagbo/planewright/security/advisories/new>.
3. Describe the issue, the affected component (`apps/web`, `apps/collab`, `packages/protocol`
   or the tooling), the commit you tested, reproduction steps and the impact you expect.

The report is visible only to you and the repository maintainers. It is the only supported
channel for security reports.

## What to expect

Planewright is maintained on a volunteer, best-effort basis. There is no guaranteed response or
fix timeline. Reports are triaged as maintainer time allows, and the maintainers will work with
you in the private advisory to confirm the issue, agree on a fix and coordinate disclosure.
Please give the maintainers a reasonable opportunity to address a confirmed issue before making
it public.

## Supported versions

Planewright has not published a release yet. Only the latest commit on the `main` branch is
considered for security fixes. This section will list supported release lines once releases
exist.

## Scope

In scope: code and configuration in this repository, including the web application, the
collaboration service, the shared protocol package, build tooling and GitHub Actions workflows.

Out of scope: vulnerabilities in third-party dependencies that are already publicly known (please
report those upstream; Dependabot tracks them here), and findings that require a compromised
developer machine.
