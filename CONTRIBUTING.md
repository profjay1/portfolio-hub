# Contributing / working agreement

This is a personal portfolio project, but it is run like a professional one. The same rules apply to every change, whoever (or whatever) wrote it.

## Flow
1. Start from an issue with acceptance criteria.
2. Branch from `main`: `type/<issue#>-short-desc` (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `perf`).
3. Commit in small, atomic steps using [Conventional Commits](https://www.conventionalcommits.org/) (`feat(projects): add publish state`).
4. Open a pull request whose title is also a Conventional Commit (it becomes the squash commit). Fill in the template.
5. CI must be green and conversations resolved. PRs are squash-merged; `main` history stays linear and signed.

## Definition of done
Tests green and meaningful, lint clean, input validated, errors handled, no secrets or personal data in code or logs, docs updated, ADR added if a decision changed.

## Local setup
See `README.md` (filled in during M1).
