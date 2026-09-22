---
name: adr
description: Draft a new Architecture Decision Record in docs/adr from the template. Use when a design choice has real alternatives (framework, pattern, hosting, data model, security approach).
argument-hint: "<decision title>"
disable-model-invocation: true
---
Create a new ADR for: $ARGUMENTS

1. Read `docs/adr/README.md` and `docs/adr/0000-template.md`, and skim existing ADRs so the new one is consistent and does not contradict an accepted decision (if it does, propose superseding it explicitly).
2. Find the next number (highest existing + 1, zero-padded to 4 digits) and create `docs/adr/NNNN-kebab-case-title.md`.
3. Fill every section honestly: Context (forces and constraints, not marketing), Decision, at least two real Alternatives with why they lost, Consequences (positive AND negative), Revisit triggers (what would make us change our mind).
4. Set Status to `Proposed`. Only the owner changes it to `Accepted`.
5. Add a row to the index table in `docs/adr/README.md`.
6. If key inputs are missing (constraints, cost limits, preferences), ask the owner up to three short questions before writing.
7. Do not commit. Show the file and suggest the commit message: `docs(adr): NNNN <title>`.
