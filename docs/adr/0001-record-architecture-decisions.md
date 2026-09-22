# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Repository owner

## Context
This repository is meant to show how decisions are made, not only what was built. Reasoning that lives only in a chat window or in someone's head is lost, and reviewers cannot judge trade-offs they cannot see.

## Decision
Significant decisions (technology choices, patterns, hosting, security approach, data model) are recorded as short ADRs in `docs/adr/`, numbered sequentially, reviewed through pull requests like code.

## Alternatives considered
1. **Wiki or Notion pages:** easy to write, but drift away from the code and are invisible in pull requests.
2. **Commit messages only:** precise but hard to discover and unstructured.

## Consequences
- **Positive:** decisions are searchable, reviewable, versioned with the code, and usable in interviews.
- **Negative:** small writing overhead per decision; must resist writing ADRs for trivial choices.

## Revisit when
The ADR list becomes too large to navigate; then add categories or tags.
