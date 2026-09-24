---
name: new-slice
description: Start a new vertical slice from a GitHub issue. Reads the issue, explores the code, and produces an implementation plan for approval. Use at the beginning of every issue.
argument-hint: "<issue number or short description>"
disable-model-invocation: true
---
Start a vertical slice for: $ARGUMENTS

1. If a number was given, run `gh issue view <n>` and read acceptance criteria. Otherwise ask the owner for the goal and acceptance criteria.
2. Read the relevant CLAUDE.md files and explore only the code this slice touches.
3. Check for the `hand-write` label. If present, plan ONLY: spec, edge cases, and the failing tests; after approval, commit the failing tests on the issue branch and stop. The owner writes the implementation on that same branch.
4. Produce a plan and STOP for approval. The plan must contain:
   - Branch name (`type/<issue#>-short-desc`) and proposed PR title (Conventional Commits).
   - Files to create or change, grouped by layer.
   - Tests to write first (names in behaviour language), including security and failure cases.
   - Migration needed? Expand/contract safe? Config or env vars? New dependency (justify)?
   - Docs/ADR impact.
   - Proposed commit sequence (3 to 6 atomic commits).
   - Risks and what is explicitly out of scope.
5. After approval: create the branch, implement test-first, run the checks, and report real command output.
