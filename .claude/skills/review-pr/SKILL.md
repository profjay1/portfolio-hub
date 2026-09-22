---
name: review-pr
description: Review the current branch against main as a strict senior reviewer. Use before opening or merging a PR.
disable-model-invocation: true
---
Review the current branch as if you were a demanding senior engineer who did not write it.

1. Run `git diff main...HEAD --stat` and read the full diff plus the tests.
2. Check, in this order: correctness and edge cases; security (authn/authz, validation, injection, secrets, logging of sensitive data); tests (do they fail without the change? do they test behaviour?); module boundaries (Modulith verify) and layering; error handling; migrations (backwards compatible?); performance traps (N+1, unbounded queries, blocking calls); accessibility for UI changes; docs/ADR updates; commit and PR hygiene (Conventional Commits, atomic, no unrelated changes).
3. If the diff touches auth, config, dependencies, Docker, CI, or infra, delegate to the `security-reviewer` subagent and include its findings.
4. Output a report grouped by severity: BLOCKER, MAJOR, MINOR, NIT. Each item cites `file:line` and gives a concrete fix.
5. Finish with: "Would I approve?" and the three most valuable follow-ups. Do not modify files.
