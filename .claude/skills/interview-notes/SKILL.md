---
name: interview-notes
description: Generate private interview notes for a module or slice from the real code and ADRs. Feeds the per-project PDF study guide later.
argument-hint: "<module or slice>"
disable-model-invocation: true
---
Write interview notes for: $ARGUMENTS

Create or update `notes/interview/<kebab-name>.md` (private, git-ignored). Base everything on the code, tests, and ADRs; cite file paths. Sections:
1. **30-second pitch** and **2-minute deep dive** in plain spoken language.
2. **What it does and how it flows** (request/event flow, key classes and files).
3. **Decisions and trade-offs** (link ADRs; state the alternative and why it lost).
4. **Engineering angles demonstrated** (security, testing, observability, resilience, data, performance) with the exact evidence in the repo.
5. **Likely interview questions** (at least 10, mixed difficulty) with model answers grounded in this code.
6. **Known limitations and what I would do next** (honesty is a strength).
7. **STAR story** candidate: a real problem hit while building it, what I did, the result.
Do not invent facts about the code. If something is unclear, ask.
