# Roadmap: Portfolio Hub

Each milestone ends with a tagged release, updated docs, and a teach-back session. Issues are small vertical slices.

| Milestone | Tag | Outcome |
|---|---|---|
| M0 Foundations | (none) | Repo, rules, CI skeleton, ADRs, Claude Code setup |
| M1 Walking skeleton | v0.1.0 | Angular + Spring + Postgres deployed over HTTPS on the VPS, health check live |
| M2 Identity | v0.2.0 | Admin login, token/cookie strategy, roles, throttling, security tests |
| M3 Projects | v0.3.0 | Admin CRUD, publish state, public catalogue, case-study pages |
| M4 Resume | v0.4.0 | Versioned resume upload, public download, download events |
| M5 Contact and events | v0.5.0 | Contact form, spam defence, admin inbox, email notification via events |
| M6 Hardening | v0.6.0 | Rate limits, security headers, CSP, dependency and container scanning, threat model |
| M7 Observability | v0.7.0 | Structured logs, metrics, dashboards, alerts, uptime checks |
| M8 Backup and recovery | v0.8.0 | Nightly encrypted backups, timed restore drill, DR runbook |
| M9 Polish | v1.0.0 | Architecture docs, OpenAPI, screenshots, "How this was built" page, README |

## Later
Template extraction for other projects; S3 and SES adapters when the AWS account exists; tracked recruiter links; CodeQL and SBOM in CI.
