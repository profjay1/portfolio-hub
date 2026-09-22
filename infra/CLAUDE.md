# Infra rules
- Everything reproducible from code: Ansible (VPS provisioning and hardening), Docker Compose (runtime), Caddy (HTTPS), Terraform (DNS and the small AWS footprint).
- **No secrets in the repo.** Encrypted with SOPS + age, or injected by GitHub environment secrets at deploy time. Never read or print secret material.
- Terraform: run `fmt` and `validate` freely; **never run `apply` or `destroy` yourself**, only propose the plan output for the owner to review.
- Pin container images by version (digest for production). Containers run as non-root with healthchecks and resource limits.
- Every operational procedure (deploy, rollback, restore from backup, rotate secret, rebuild the server) becomes a runbook in `docs/runbooks/` and is rehearsed at least once.
- Cost awareness: tag AWS resources `project=<name>`; prefer the cheapest design that still teaches the concept; document the trade-off in an ADR.
