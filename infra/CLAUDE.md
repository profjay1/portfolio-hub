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

## Ansible: provisioning the VPS (`infra/ansible/`)
- `site.yml` provisions and hardens the server: unattended upgrades, the `deploy` sudo user and its key, SSH (keys only,
  no root), ufw (OpenSSH, 80/tcp, 443/tcp), fail2ban (the package's sshd jail), Docker Engine with the Compose plugin.
  It does **not** configure Caddy (#12) or the application stack (#11).
- One-time setup: `ansible-galaxy collection install -r infra/ansible/requirements.yml`.
- Inputs come from the environment, never the repo: `HUB_VPS_HOST` (the server address) and `HUB_SSH_PUBLIC_KEY_FILE`
  (path to the deploy user's public key). The sudo password is prompted for by `-K` and never stored.
- Run from `infra/ansible/` so `ansible.cfg` is picked up:
  1. Dry run: `ansible-playbook site.yml --check --diff -K`. Review every `changed` line.
  2. Apply only after the owner has approved that dry run: `ansible-playbook site.yml --diff -K`, with a second SSH
     session open to the server until it finishes (the ssh and firewall roles can lock you out if they are wrong).
  3. Run again: the recap must show `changed=0`. Anything else is an idempotency bug to fix before merging.
- Package upgrades are opt-in: `ansible-playbook site.yml --tags upgrade -K`.
- **Claude never runs the playbook against the real server, not even `--check`, without the owner's approval for that
  specific run.** Locally, run `ansible-playbook site.yml --syntax-check` and `ansible-lint` freely.
- Docker writes its own iptables rules, so ports it publishes **bypass ufw**. Production containers publish to
  `127.0.0.1` only; Caddy is the only public entry point.
- Rebuilding the server from scratch: `docs/runbooks/rebuild-server.md`.
