# 0008. Host additional static sites via /etc/caddy/sites/

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Repository owner

## Context
ADR 0007 keeps Caddy on the droplet's host, managed by the Ansible `caddy` role, with one site block for
`saheetech.xyz` in `/etc/caddy/Caddyfile`. ADR 0004 puts the Hub on this droplet and the other projects on AWS,
"deployable and destroyable on demand from GitHub Actions".

`zoradox.com` is a separate project. Its first phase is a static site: HTML, CSS, fonts and images, with no server-side
code. `zoradox.com` and `www.zoradox.com` already resolve to the droplet. A static site needs a web server and a
certificate, both of which Caddy already provides here. Hosting it on AWS instead would need an AWS account, Terraform
and a second deployment model before the first page is served.

Adding a second site's block to the Hub's Caddyfile would mix two projects' configuration in one file. Caddy can
`import` a glob of files, and a glob that matches no files is not an error: in `caddy:2.11.7`, `import` of
`/dir/*.caddy` over an empty or missing directory logs a warning and validates, while a missing non-glob file fails.

## Decision
1. **Static sites only.** This droplet may host additional *static* sites alongside the Hub. Anything that needs a
   runtime (an application server, a database, a queue) still follows ADR 0004, including zoradox's planned Spring
   Boot API, which will live on a subdomain of `zoradox.com`.
2. **One file per site, in `/etc/caddy/sites/`.** Each site's blocks live in `/etc/caddy/sites/<site>.caddy`. The main
   Caddyfile ends with `import /etc/caddy/sites/*.caddy`; the Hub's own block and snippet stay where they are.
3. **Installed only by Ansible, root-owned.** The directory (0755) and the site files (0644) belong to root and are
   installed only by the `caddy` role, so every change goes through review and the playbook. Each site's web root is
   owned by the deploy user, so its content can be published without `sudo`.
4. **Each site defines its own headers.** No site imports another site's snippet, so a change to one site's headers
   cannot change another's.
5. **Each site file is validated on its own when it is installed** (`caddy validate`, as the role does for the main
   Caddyfile), then Caddy is reloaded. This ADR extends ADR 0007, which is not edited.

## Alternatives considered
1. **Add each site's block to the main Caddyfile.** One file, nothing new to learn. It lost because unrelated
   projects would share a file, and a change for one site would show up as a change to the Hub's configuration.
2. **Host the static site on AWS (S3 and CloudFront), as ADR 0004 says for other projects.** It fits 0004 without an
   exception and has no single server to lose. It lost for a static site: it needs an AWS account, Terraform and a
   second deployment model before the first page is served, while this droplet already has Caddy and certificates.
3. **A Caddy container per site, or one shared container.** Isolation between sites. It lost for the reasons ADR
   0007 rejected a Caddy container: it would take over ports 80 and 443 from the working host Caddy.

## Consequences
- **Positive:**
  - A new static site is one file in `roles/caddy/files/sites/` and a web-root task, reviewed in a pull request.
  - The Hub's Caddyfile changes only by the one `import` line.
  - An empty `sites/` directory is safe: the main Caddyfile still validates.
- **Negative / costs / risks:**
  - **Validating a site file on its own only catches syntax errors in that file.** A clash with another site (two
    blocks claiming the same address) is caught only when the main Caddyfile is validated, which happens when it
    changes, or when Caddy reloads, which reports the error and keeps the previous configuration.
  - The droplet now serves two projects, so a fault or an outage affects both, and its single point of failure
    (ADR 0004) covers zoradox's static site too.
  - **The exception does not extend to runtimes.** Under ADR 0004, AWS projects are deployable and destroyable on
    demand, so a future zoradox API is not an always-on service unless ADR 0004 is revisited.
  - The web root is owned by the deploy user, which is also the Ansible login and, through the `docker` role, a member
    of the docker group, which is root-equivalent. While the owner deploys zoradox from the owner's own machine this
    adds no exposure. An automated deploy for zoradox, with a key stored in CI, would hand that key the same access,
    so it needs its own restricted account first.
- **Follow-ups this creates:**
  - zoradox's content and its rsync deploy into its web root, in the zoradox repository.
  - Raising zoradox's HSTS to one year after its first week (no `includeSubDomains`, no `preload`), as with the Hub.
  - Before any CI deploy for zoradox, create a dedicated restricted account and key (for example rsync-only with a
    forced command) that owns `/var/www/zoradox`. Track it as its own issue.

## Revisit when
- A site on this droplet needs a runtime: that belongs under ADR 0004, or needs a new ADR.
- Enough sites share the droplet that one's traffic, or its failure, affects the others.
- The zoradox API's availability needs (always-on versus on demand) lead to revisiting ADR 0004.
