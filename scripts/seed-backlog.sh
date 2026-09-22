#!/usr/bin/env bash
# Creates the M1 (walking skeleton) backlog as GitHub issues. Run after scripts/setup-github.sh.
set -euo pipefail
command -v gh >/dev/null || { echo "Install the GitHub CLI first."; exit 1; }

issue() { # title | milestone | labels | body
  gh issue create --title "$1" --milestone "$2" --label "$3" --body "$4" >/dev/null && echo "created: $1"
}

M1="M1 Walking skeleton"

issue "Scaffold backend: Spring Boot 4.1, Java 21, Modulith, Maven wrapper" "$M1" "type:chore,area:backend" \
"## Goal
Runnable backend skeleton with the module layout from backend/CLAUDE.md.

## Acceptance criteria
- Maven wrapper committed; Java 21 toolchain; Spring Boot 4.1.x and Spring Modulith 2.1.x versions verified against official docs
- Empty modules created with public/internal packages
- A Modulith verification test runs and passes
- \`backend/mvnw -f backend/pom.xml verify\` is green"

issue "Add PostgreSQL, Flyway baseline, and a Testcontainers smoke test" "$M1" "type:chore,area:backend" \
"## Acceptance criteria
- Flyway baseline migration V1 applied at startup
- Integration test boots the app against a Testcontainers PostgreSQL
- Datasource configured only through HUB_* environment variables
- ADR written for persistence approach (Spring Data JDBC vs JPA)"

issue "Expose health, info, and version endpoints" "$M1" "type:feature,area:backend" \
"## Acceptance criteria
- Actuator liveness and readiness probes enabled; only health and info exposed publicly
- /actuator/info reports version and commit SHA
- Test asserts that no other actuator endpoints are exposed anonymously"

issue "Global error handling (Problem Details) and structured JSON logging" "$M1" "type:feature,area:backend" \
"## Acceptance criteria
- One @RestControllerAdvice returns RFC 9457 ProblemDetail with a stable \`code\`
- Validation errors list offending fields; no stack traces leak
- Prod profile logs JSON with a correlation id; tests cover error format"

issue "Scaffold Angular 22 app with lint, Vitest, Prettier, and build" "$M1" "type:chore,area:frontend" \
"## Acceptance criteria
- Node 22+, TypeScript 6; scripts start, build, lint, test:ci, e2e, generate:api exist
- One component test passes in CI mode
- Folder structure from frontend/CLAUDE.md"

issue "Home page shows backend version via /api/v1/ping" "$M1" "type:feature,area:frontend" \
"## Acceptance criteria
- Backend exposes a public ping endpoint (id + version)
- Angular home page fetches and displays it with loading and error states
- CORS configured from an allow-list in configuration"

issue "Dockerfiles and local Docker Compose stack" "$M1" "type:chore,area:infra" \
"## Acceptance criteria
- Multi-stage, non-root images for backend and frontend, with healthchecks
- \`docker compose -f infra/compose/compose.local.yml up -d\` starts database, backend, frontend
- Images pinned by version; .dockerignore present"

issue "Enable Dependabot for Maven, npm, and Docker; add Spotless and ESLint" "$M1" "type:chore,area:infra" \
"## Acceptance criteria
- Dependabot blocks in .github/dependabot.yml enabled for the now-existing manifests
- Spotless (backend) and ESLint + Prettier (frontend) enforced in CI"

issue "Provision the VPS with Ansible (hardening, Docker, firewall)" "$M1" "type:chore,area:infra" \
"## Acceptance criteria
- Idempotent playbook: non-root sudo user, SSH keys only, root login disabled, ufw, fail2ban, unattended upgrades, Docker
- Run twice: second run reports no changes
- Runbook: how to rebuild the server from scratch"

issue "Deploy pipeline: build images to GHCR, deploy over SSH with health gate and rollback" "$M1" "type:feature,area:infra" \
"## Acceptance criteria
- Workflow triggered on tag or manual dispatch; uses a protected 'production' environment
- Pulls tagged images, waits for readiness, rolls back automatically if unhealthy
- Restricted deploy key; no long-lived secrets in the repo"

issue "Caddy reverse proxy with automatic HTTPS and domain DNS" "$M1" "type:chore,area:infra" \
"## Acceptance criteria
- Domain points at the VPS; HTTPS certificate issued automatically; HTTP redirects to HTTPS
- Security headers set at the proxy; verified with an external scanner"

issue "External uptime check, README 'Running locally', tag v0.1.0" "$M1" "type:chore,area:infra" \
"## Acceptance criteria
- Uptime monitor (outside the VPS) checks /actuator/health/readiness via the public URL
- README explains local run, tests, and deployment overview
- Tag v0.1.0 and a GitHub Release created"
echo "Done. See issues in the M1 milestone."
