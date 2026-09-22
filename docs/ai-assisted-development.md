# AI-assisted development

This project is built with Claude Code as a pair programmer. Transparency matters, so here is the policy.

**How AI is used:** scaffolding, test generation, code review, documentation drafts, and explanation. Commits keep the default co-author trailer where an AI wrote substantial parts.

**How quality is protected:**
- Every change starts from an issue with acceptance criteria and a reviewed plan.
- Tests come first or alongside; CI must be green; the same rules apply to AI-written and hand-written code.
- Security-sensitive areas (authentication, authorization, secrets, infrastructure) receive an extra independent review.
- Guardrails are enforced by tooling, not goodwill: protected-file hooks, permission rules, branch rulesets, secret scanning.
- Issues labelled `hand-write` are implemented by the owner without AI-written implementation; AI provides the spec, tests, and review.
- After each slice the owner is quizzed on the design (teach-back), and can explain every decision recorded in `docs/adr/`.

**What AI does not do:** access production, real secrets, or cloud accounts; merge to `main`; run `terraform apply`.
