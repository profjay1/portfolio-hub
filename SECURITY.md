# Security policy

## Reporting a vulnerability
Please report vulnerabilities **privately** using GitHub's "Report a vulnerability" button on the Security tab of this repository. Do not open a public issue.

Include what you found, how to reproduce it, and the potential impact. This is a solo-maintained project: I aim to acknowledge reports within a few days and to fix confirmed issues promptly, but response times are best-effort.

## Scope
The deployed Portfolio Hub and this repository's code and configuration. Out of scope: denial-of-service testing, social engineering, and third-party services.

## Supported versions
Only the latest release on `main` is supported.

## Security practices in this repository
Branch rulesets, required checks, secret scanning with push protection, dependency updates via Dependabot, least-privilege CI permissions, and a documented threat model (see `docs/architecture/security.md` once published).
