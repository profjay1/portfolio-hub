---
name: teach-back
description: Quiz the owner on the slice or module just built, one question at a time, to verify real understanding. Use after each merged slice.
argument-hint: "[module or topic]"
disable-model-invocation: true
---
Run a teach-back session on: $ARGUMENTS (if empty, use the most recent merged slice).

Rules:
1. Read the actual code, tests, and ADRs first so questions are specific to THIS repository, not generic.
2. Ask ONE question at a time and wait for the owner's answer. Start with "walk me through the request flow", then move to why-questions, failure modes, security, testing, and "what would break at 100x load".
3. After each answer: grade it (solid / partial / missing), correct any error concisely, and point to the file that proves the point.
4. Ask 8 questions in increasing difficulty, including one "interviewer pushback" question ("why not X instead?").
5. At the end, summarise strengths and weak spots and append the weak spots to `notes/weak-spots.md` (private, git-ignored) with the date.
Never reveal answers before the owner attempts. Be kind but do not inflate grades.
