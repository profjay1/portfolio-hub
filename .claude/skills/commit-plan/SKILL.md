---
name: commit-plan
description: Propose how to split the current working tree into clean, atomic Conventional Commits. Use before committing a slice, so history reads like a professional project.
disable-model-invocation: true
---
1. Run `git status` and `git diff` to see all pending changes.
2. Propose an ordered list of atomic commits: each builds and passes tests on its own, tests ship with the code they cover, refactors are separate from behaviour changes, docs/config changes are separate when they stand alone.
3. For each commit give: the exact Conventional Commit message (`type(scope): imperative summary`, body explaining WHY when not obvious) and the list of files (or hunks) it contains.
4. Flag anything that should NOT be committed (secrets, generated files, local config, notes/).
5. Wait for approval, then execute the commits one by one using `git add -p` or path lists. Show `git log --oneline` at the end.
