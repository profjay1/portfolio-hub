# 0002. Monorepo and modular monolith for the Hub

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Repository owner

## Context
The Hub is a single-owner product with six well-understood capabilities (identity, projects, resume, contact, notifications, insights). It will run on one small server. Team size is one. We still want strong boundaries, event-driven collaboration between capabilities, and a credible path to extraction if a capability ever needs independent scaling.

## Decision
Build the backend as **one Spring Boot application structured with Spring Modulith modules**, verified by tests. Keep backend, frontend, infra, and docs in **one repository**. Microservices are deliberately reserved for a different portfolio project (OrderFlow), where independent deployment, scaling, and failure isolation are the point.

## Alternatives considered
1. **Microservices for the Hub:** more moving parts (discovery, tracing, distributed data, deployment) with no matching scaling or team-autonomy need; higher cost on a small VPS.
2. **Classic layered monolith without enforced boundaries:** simplest, but boundaries erode and nothing demonstrates design discipline.
3. **Separate repositories for frontend and backend:** clean ownership for large teams, but slows one-person iteration and splits history and CI.

## Consequences
- **Positive:** simple operations, one deployable, fast local development, enforced module boundaries, natural interview story about *when not to use microservices*.
- **Negative:** all modules scale and fail together; a discipline-only risk remains inside a module.
- **Follow-ups:** module verification test in CI; generated module documentation in `docs/architecture`.

## Revisit when
A module needs different scaling, release cadence, or isolation from the rest, or a second developer joins and needs autonomy.
