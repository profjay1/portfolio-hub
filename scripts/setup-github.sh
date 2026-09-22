#!/usr/bin/env bash
# Configure the GitHub repository the way a professional team would.
# Run AFTER: git init, first commit on main, and `gh auth login`.
# Usage: scripts/setup-github.sh [repo-name]      (env: VISIBILITY=public|private, default public)
# Note: repository rulesets are available on public repos with a free account; private repos need a paid plan.
set -euo pipefail

REPO_NAME="${1:-portfolio-hub}"
VISIBILITY="${VISIBILITY:-public}"

warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }
info() { printf '\033[32m[info]\033[0m %s\n' "$*"; }

command -v gh >/dev/null || { echo "Install the GitHub CLI first: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run: gh auth login"; exit 1; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo "Run git init and make the first commit first."; exit 1; }
git rev-parse HEAD >/dev/null 2>&1 || { echo "Make the first commit before running this script."; exit 1; }

# 1. Create the repository and push (skipped if origin already exists)
if ! git remote get-url origin >/dev/null 2>&1; then
  info "Creating $VISIBILITY repository $REPO_NAME and pushing"
  gh repo create "$REPO_NAME" "--$VISIBILITY" --source=. --remote=origin --push \
    --description "Production-style portfolio platform: Spring Boot 4 + Modulith + Angular 22, built in the open."
fi
SLUG="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
info "Configuring $SLUG"

# 2. Merge policy: squash only, tidy branches, auto-merge allowed
gh api -X PATCH "repos/$SLUG" --input - >/dev/null <<'JSON' || warn "Could not update merge settings"
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "allow_auto_merge": true,
  "allow_update_branch": true,
  "delete_branch_on_merge": true,
  "squash_merge_commit_title": "PR_TITLE",
  "squash_merge_commit_message": "PR_BODY",
  "has_wiki": false,
  "has_projects": true
}
JSON

# 3. Security features
gh api -X PATCH "repos/$SLUG" --input - >/dev/null <<'JSON' || warn "Could not enable secret scanning / push protection (plan or visibility limits?)"
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON
gh api -X PUT "repos/$SLUG/vulnerability-alerts" >/dev/null || warn "Could not enable Dependabot alerts"
gh api -X PUT "repos/$SLUG/automated-security-fixes" >/dev/null || warn "Could not enable Dependabot security updates"
gh api -X PUT "repos/$SLUG/private-vulnerability-reporting" >/dev/null || warn "Could not enable private vulnerability reporting"

# 4. Labels
label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null || warn "label $1 failed"; }
label "type:feature"        "0e8a16" "New capability (vertical slice)"
label "type:bug"            "d73a4a" "Something is broken"
label "type:chore"          "cfd3d7" "Tooling, infra, refactor, spike"
label "type:docs"           "0075ca" "Documentation or ADR"
label "hand-write"          "fbca04" "Owner implements; Claude provides spec, tests, review"
label "security"            "b60205" "Security-relevant change"
label "module:identity"     "5319e7" "identity module"
label "module:projects"     "5319e7" "projects module"
label "module:resume"       "5319e7" "resume module"
label "module:contact"      "5319e7" "contact module"
label "module:notifications" "5319e7" "notifications module"
label "module:insights"     "5319e7" "insights module"
label "area:backend"        "1d76db" "Backend"
label "area:frontend"       "1d76db" "Frontend"
label "area:infra"          "1d76db" "Infrastructure and delivery"

# 5. Milestones
milestone() { gh api "repos/$SLUG/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1 || warn "milestone '$1' exists or failed"; }
milestone "M0 Foundations"          "Repo, rules, CI skeleton, ADRs, Claude Code setup"
milestone "M1 Walking skeleton"     "v0.1.0: Angular + Spring + Postgres deployed over HTTPS on the VPS"
milestone "M2 Identity"             "v0.2.0: admin login, roles, throttling, security tests"
milestone "M3 Projects"             "v0.3.0: admin CRUD, publish state, public catalogue"
milestone "M4 Resume"               "v0.4.0: versioned resume, public download, download events"
milestone "M5 Contact and events"   "v0.5.0: contact form, inbox, email via events"
milestone "M6 Hardening"            "v0.6.0: rate limits, headers, scanning, threat model"
milestone "M7 Observability"        "v0.7.0: logs, metrics, dashboards, alerts"
milestone "M8 Backup and recovery"  "v0.8.0: encrypted backups, timed restore drill, DR runbook"
milestone "M9 Polish"               "v1.0.0: docs, OpenAPI, screenshots, README"

# 6. Rulesets (branch protection). Apply last so the initial push above is not blocked.
apply_ruleset() {
  gh api -X POST "repos/$SLUG/rulesets" --input "$1" >/dev/null \
    && info "Applied ruleset $1" || warn "Ruleset $1 not applied (already exists, or plan does not support rulesets)"
}
apply_ruleset .github/rulesets/main-protection.json
apply_ruleset .github/rulesets/protect-release-tags.json

info "Done. Next: enable Actions if prompted, run scripts/seed-backlog.sh, then open PRs (direct pushes to main are now blocked)."
