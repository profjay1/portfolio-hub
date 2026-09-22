# Architecture Decision Records

We record significant decisions using lightweight ADRs (Michael Nygard format). An ADR is immutable once **Accepted**:
if a decision changes, add a new ADR that supersedes it and mark the old one `Superseded by NNNN`.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-monorepo-and-modular-monolith.md) | Monorepo and modular monolith for the Hub | Accepted |
| [0003](0003-trunk-based-flow-conventional-commits.md) | Trunk-based flow, Conventional Commits, squash merges | Accepted |
| [0004](0004-hosting-hub-on-vps-others-on-aws.md) | Hub on a VPS, other projects on AWS | Accepted |

Create new ones with the `/adr` Claude Code skill or by copying [0000-template.md](0000-template.md).
