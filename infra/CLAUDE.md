# Infra rules
- Everything reproducible from code: Ansible (VPS provisioning and hardening), Docker Compose (runtime), Caddy (HTTPS), Terraform (DNS and the small AWS footprint).
- **No plaintext secrets in the repo.** Never read or print secret material. Every secret belongs to exactly one of two stores:
  - **SOPS + age (app runtime):** anything the running Hub reads, e.g. database password, admin bootstrap credentials, SMTP credentials, signing keys. Committed *encrypted* under `infra/`, decrypted on the VPS at deploy time.
  - **GitHub environment secrets (pipeline credentials):** anything only the workflow uses, e.g. SSH deploy key, VPS host, registry token, AWS/Terraform credentials. Never written to the repo or the app's config.
  - The age private key is never committed. Where it lives is decided with the deploy pipeline and recorded in an ADR.
- Terraform: run `fmt` and `validate` freely; **never run `apply` or `destroy` yourself**, only propose the plan output for the owner to review.
- Pin container images by version (digest for production). Containers run as non-root with healthchecks and resource limits.
- Every operational procedure (deploy, rollback, restore from backup, rotate secret, rebuild the server) becomes a runbook in `docs/runbooks/` and is rehearsed at least once.
- Cost awareness: tag AWS resources `project=<name>`; prefer the cheapest design that still teaches the concept; document the trade-off in an ADR.
