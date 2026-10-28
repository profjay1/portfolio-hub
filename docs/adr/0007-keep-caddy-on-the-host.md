# 0007. Keep Caddy on the host, managed by Ansible, in front of the Compose stack

- **Status:** Accepted
- **Date:** 2026-10-26
- **Deciders:** Repository owner

## Context
ADR 0004 puts the Hub on a single VPS, with Docker Compose for the runtime and Caddy for automatic HTTPS. It does not
say where Caddy runs. That matters now, because the production Compose file and the Caddy work (#12) are next.

A read-only inspection of the droplet on 2026-10-26 found that Caddy is already in production:

- **Caddy 2.11.4** is installed as the apt package `caddy` and runs as the systemd unit `caddy.service` (active,
  enabled, as user `caddy`), with `caddy run --environ --config /etc/caddy/Caddyfile`. It listens on `*:80` and
  `*:443`, and its admin API on `127.0.0.1:2019`, its default.
- It serves `saheetech.xyz` and `www.saheetech.xyz` over HTTPS. Each name has its own Let's Encrypt certificate, valid
  from 2026-09-30 to 2026-12-29, which Caddy renews automatically. HTTP answers `308 Permanent Redirect` to HTTPS.
- The live `/etc/caddy/Caddyfile` (83 bytes, root-owned, last changed 2026-09-30) is:

  ```
  saheetech.xyz, www.saheetech.xyz {
      root * /var/www/saheetech
      file_server
  }
  ```

  It serves one hand-placed file, `/var/www/saheetech/index.html` ("Portfolio Hub — coming soon"). `/api/v1/ping` and
  `/actuator/health` return 404: no application is behind it.
- The live site sends no security headers: no HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy` or `Permissions-Policy`.
- Caddy and the Caddyfile were set up by hand on 2026-09-30. The Ansible playbook (#10) hardens the host and installs
  Docker but deliberately leaves Caddy out, so `docs/runbooks/rebuild-server.md` would not recreate it. The live
  configuration is drift: it exists only on the server.
- Docker on the droplet is clean: no containers apart from an exited `hello-world`, no volumes and no Compose projects.
  Nothing from this repository is deployed yet.
- Checked on 2026-10-27, with `sudo` run by the owner: the package comes from Caddy's official apt repository
  (`/etc/apt/sources.list.d/caddy-stable.list`, signed by `/usr/share/keyrings/caddy-stable-archive-keyring.gpg`);
  Caddy's journal has no warnings or errors since setup; ufw allows only OpenSSH, 80/tcp and 443/tcp.

The repository already assumes something outside Compose terminates TLS. `infra/CLAUDE.md` says production containers
publish to `127.0.0.1` only and Caddy is the only public entry point, because ports Docker publishes bypass ufw. The
frontend's nginx (`frontend/nginx/default.conf`) leaves `X-Forwarded-*` to "an upstream proxy (Caddy in
production)".

## Decision
1. **Caddy stays on the host** as the Ubuntu package and systemd service it is today. It is not moved into the
   Compose stack.
2. **Ansible manages it from now on.** A new role installs the `caddy` package, keeps the service enabled and
   running, and owns `/etc/caddy/Caddyfile`, starting from the live file above. A Caddyfile change is validated
   (`caddy validate`) before it is copied into place, then applied with a reload rather than a restart, so open
   connections and certificates are kept. The role is written to match the server's verified state first, in the
   same way as #10, so its first run against the live server changes nothing.
3. **Caddy proxies to the application, which publishes only on `127.0.0.1`.** The production Compose file publishes
   only the frontend container (nginx, which already proxies `/api` to the backend), and only on a loopback port.
   PostgreSQL and the backend are not published at all. Caddy's site block switches from `file_server` to
   `reverse_proxy` to that loopback port when the first deploy happens, not before.
4. **Caddy is the only public entry point and the only TLS terminator.** It keeps issuing and renewing the
   certificates for `saheetech.xyz` and `www.saheetech.xyz`.

## Alternatives considered
1. **Run Caddy as a container in the production Compose file.** This keeps the whole runtime in one file and lets
   the Caddy image be pinned by digest like the others. It lost because:
   - it means migrating the live certificate storage into a volume, or reissuing certificates, and taking down a
     setup that works today;
   - it gains nothing functionally: Caddy does the same job either way.
2. **Leave Caddy as it is, outside configuration management.** This needs no work now. It lost because the server
   could not be rebuilt from the repository, the Caddyfile could change without review, and the deploy would depend
   on a file that only exists on one machine.

## Consequences
- **Positive:**
  - No migration and no downtime: the working HTTPS setup carries on, and certificates keep renewing.
  - The drift is closed. The Caddyfile is reviewed in pull requests, and a rebuilt server gets the same Caddy.
  - The network rules stay simple: ufw opens 80 and 443 to Caddy, and nothing published by Docker is reachable from
    outside.
- **Negative / costs / risks:**
  - Two update paths: the app images are upgraded through deploys, and the Caddy package through apt.
    unattended-upgrades does not upgrade Caddy: its allowed origins are Ubuntu's own release, security and ESM
    archives, and Caddy's repository identifies itself as `cloudsmith/caddy/stable`. Caddy is upgraded only when
    someone runs the playbook's `--tags upgrade` (or apt by hand), so it falls behind otherwise: on 2026-10-27 the
    server ran 2.11.4 while 2.11.7 was available. A Caddy upgrade is not tested in CI.
  - Caddy cannot use Docker service names, so the frontend's loopback port is a contract between the Compose file and
    the Caddyfile and must be kept in step.
- **Follow-ups this creates:**
  - **Security headers** in the Caddyfile (#12, #62). None are sent today.
  - **Forwarded-header trust on the backend.** Behind Caddy and the frontend's nginx, the backend must trust
    `X-Forwarded-*` only from the proxy (`server.forward-headers-strategy` and the trusted-proxy settings), so that
    the request scheme is `https` and per-IP rate limiting sees the real client (#61, and ADR 0006's follow-up).
  - **An Ansible role for Caddy** (package, service, Caddyfile, validate and reload), with `rebuild-server.md`
    updated so a rebuilt server gets Caddy too.
  - **The production Compose file**, publishing the frontend on `127.0.0.1` only, and the switch from `file_server`
    to `reverse_proxy` with the first deploy.

## Revisit when
- The Hub moves to more than one server or to a managed platform, where a load balancer or ingress would terminate
  TLS instead.
- Several applications share the VPS and need routing by container labels, which favours a containerised proxy.
- Running Caddy from the host package becomes a problem (for example a needed plugin or version the package lacks).
