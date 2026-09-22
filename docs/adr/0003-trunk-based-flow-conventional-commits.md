# 0003. Trunk-based flow, Conventional Commits, squash merges

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Repository owner

## Context
The Git history is part of the portfolio. It should show small, reviewable increments and make releases and changelogs mechanical.

## Decision
- `main` is always releasable and protected by a repository ruleset (pull request required, required checks, linear history, signed commits, no force-push or deletion).
- Work happens on short-lived branches named `type/<issue#>-short-desc`, one issue per branch, merged by **squash merge**.
- PR titles follow **Conventional Commits** (validated in CI), so each commit on `main` is a single, meaningful, changelog-ready entry. Squash-merge PR bodies preserve the narrative.
- Releases are semantic-version tags (`vMAJOR.MINOR.PATCH`), protected from deletion.
- Real history only: no fabricated or backdated commits.

## Alternatives considered
1. **Gitflow:** heavy for a continuously deployed single-service product.
2. **Merge commits or rebase merges:** preserve every intermediate commit, which is noisier and lets WIP commits leak into `main`.

## Consequences
- **Positive:** readable history, automatic changelog and version bumps, safe `main`.
- **Negative:** intermediate branch commits are discarded on merge (they stay visible in the PR).

## Revisit when
The team grows or releases need long-lived branches (e.g., supporting several versions).
