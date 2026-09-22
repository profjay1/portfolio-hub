# Portfolio Hub: project memory for Claude Code

## What this is
A production-style portfolio platform: a public showcase of projects, a resume download, a recruiter contact form,
and a login-protected admin dashboard. The **repository itself** is the demonstration of senior engineering practice.
Optimise for correctness, clarity, testability, operability, and being explainable in an interview. Not for cleverness.

## Stack (verify versions against official docs before adding or upgrading; never guess)
- Backend: Java 21, Spring Boot 4.1.x (Spring Framework 7), Spring Modulith 2.1.x, Spring Security 7, PostgreSQL, Flyway, Maven wrapper.
- Frontend: Angular 22 (TypeScript 6, Node 22+), Signals, Signal Forms, Vitest, Playwright.
- Ops: Docker + Compose, Caddy (automatic HTTPS), Ansible (VPS provisioning), Terraform (DNS + small AWS footprint), GitHub Actions.
- Hosting: the Hub runs on a VPS (see docs/adr/0004). Other portfolio projects live in their own repositories.

## Repo map
- `backend/`   Spring Boot modular monolith (own CLAUDE.md, open in IntelliJ)
- `frontend/`  Angular app (own CLAUDE.md, open in VS Code)
- `infra/`     Ansible, Terraform, Compose, Caddy (own CLAUDE.md)
- `docs/`      ADRs (`docs/adr`), architecture (`docs/architecture`), runbooks (`docs/runbooks`)
- `notes/`     PRIVATE study notes and interview notes. Git-ignored. Never commit.
- `.claude/`   shared Claude Code settings, hooks, skills (slash commands), subagents

## Commands (some appear only after Phase 2; see backend/ and frontend/ CLAUDE.md)
- Backend build + tests: `backend/mvnw -f backend/pom.xml verify`
- Frontend: `npm --prefix frontend run lint | test:ci | build`
- Full local stack: `docker compose -f infra/compose/compose.local.yml up -d`

## How we work (non-negotiable)
1. **Plan before code.** For anything beyond a trivial edit, propose a short plan (files, tests, migrations, docs) and wait for approval.
2. **Small vertical slices.** One issue = one branch = one small PR (aim under ~400 changed lines). No unrelated refactors in a feature PR.
3. **Branches:** `type/<issue#>-short-desc` (feat, fix, docs, chore, refactor, test, ci, build, perf). Never commit to `main`. Never force-push. Never bypass hooks (`--no-verify`).
4. **Commits:** Conventional Commits (`feat(projects): add publish state`). Imperative, explain *why* in the body when not obvious. Atomic commits; tests travel with the code they test. PR titles follow the same format because PRs are squash-merged.
5. **Prove it.** Never claim something works without running the relevant command and reporting the real output. If you could not run it, say so.
6. **Definition of done:** tests written and green; lint/format clean; input validated; errors handled via the shared mechanism; no secrets or PII in code/logs; docs and ADRs updated if a decision changed; PR description filled in.
7. **Dependencies:** do not add one without saying why, what the alternative was, and its maintenance status. Significant ones need an ADR.
8. **Secrets:** never read, print, or write real secrets. Only `.env.example` with placeholders is committed. Hooks block edits to secret-bearing files; do not try to route around them.

## Learning mode (the owner must be able to defend every line in an interview)
- Issues labelled `hand-write` are implemented by the OWNER. For those, provide only: a spec, edge cases, failing tests, and review. Do not write the implementation unless the owner explicitly asks.
- After each merged slice, offer `/teach-back` (quiz) and `/interview-notes` (private notes). Prefer explaining trade-offs over listing features.
- When a design choice has a real alternative, say so and offer `/adr`.

## Code style essentials
- Backend: constructor injection, records for DTOs and value objects, no Lombok, packages by module (see backend/CLAUDE.md), Problem Details (RFC 9457) for errors.
- Frontend: standalone components, `inject()`, signals, OnPush, strict TypeScript, no `any`, no NgModules (see frontend/CLAUDE.md).
- Tests describe behaviour ("rejects login after five failed attempts"), not implementation.
- Comments explain *why*. Prefer clear names over comments.

## Where to look
Decisions: `docs/adr/`. Roadmap and milestones: `docs/roadmap.md`. AI usage policy: `docs/ai-assisted-development.md`.
