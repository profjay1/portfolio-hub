# 0004. Hub on a VPS, other projects on AWS

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Repository owner

## Context
The Hub is the first thing recruiters open, so it must be always on, fast, and cheap. Other portfolio projects (notably a microservices system) are expensive to keep running 24/7 on AWS. New AWS accounts receive time-limited credits, and the free account plan ends after six months or when credits are exhausted.

## Decision
- Host the **Hub on a single VPS** using Docker Compose, Caddy (automatic HTTPS), Ansible provisioning and hardening, images from GHCR, secrets via SOPS + age, nightly encrypted off-box backups, and a rehearsed restore procedure.
- Host the **other projects on AWS**, defined in Terraform, deployable and destroyable on demand from GitHub Actions, with budget alarms and per-project cost tags.
- Keep cloud-specific code behind ports and adapters (storage, email) so hosting can change later.
- Create the AWS account when the first AWS-hosted project is ready to deploy, to make the best use of the credit window.

## Alternatives considered
1. **Everything on AWS from day one:** best AWS résumé signal, but highest and least predictable cost for always-on demos.
2. **Everything on the VPS:** cheapest, but loses the cloud-native and IaC demonstration where it matters (microservices on ECS).

## Consequences
- **Positive:** predictable Hub cost, reliable recruiter-facing uptime, real ops story (hardening, backups, DR), cost-aware cloud story.
- **Negative:** the Hub is a single point of failure (documented RPO/RTO instead of claiming high availability); two deployment models to maintain.
- **Follow-ups:** runbooks for deploy, rollback, restore, and rebuild; uptime monitoring outside the VPS.

## Revisit when
Hub traffic or availability needs outgrow one server, credits or budget change, or a hosting provider changes pricing.
