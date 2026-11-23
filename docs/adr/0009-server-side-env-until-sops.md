# 0009. Keep production secrets in a server-side .env until SOPS is in place

- **Status:** Accepted
- **Date:** 2026-11-22
- **Deciders:** Repository owner

## Context
`infra/CLAUDE.md` puts the Hub's runtime secrets in SOPS + age: committed encrypted under `infra/`, decrypted on the
server at deploy time. None of that exists yet. There is no `.sops.yaml`, no age key, no decryption step, and no
decision on where the age private key lives, which the same file defers to the deploy pipeline (#11).

The first production deploy (the launch plan in #11) needs the secrets on the server now. There is one server and one
operator, and the first deploys are run by hand from the owner's machine, not from CI.

The production Compose file reads its values from a `.env` file in its project directory and passes each service only
the variables that service lists. Of the variables in `.env.example`:

- **Secret, or personal, and set per server:** `HUB_DB_USER`, `HUB_DB_PASSWORD`, `HUB_JWT_SECRET` (at least 32 bytes;
  the backend refuses to start otherwise), `HUB_ADMIN_EMAIL` and `HUB_ADMIN_PASSWORD`.
- **Not secret, fixed by the Compose file itself:** `HUB_DB_URL` (the internal database service) and
  `HUB_RESUME_STORAGE_PATH` (the path inside the backend container, on a named volume).
- **Read by nothing:** `HUB_ALLOWED_ORIGINS`. The backend has no CORS configuration by design (#65).

## Decision
1. **A `.env` on the server, written once by the owner.** Production secrets live in `~/hub/.env` in the deploy user's
   home, next to the production Compose file. The owner creates it over SSH with `umask 077`, so the directory is
   `0700` and the file `0600`, both owned by the deploy user.
2. **It holds only the per-server variables:** `HUB_DB_USER`, `HUB_DB_PASSWORD`, `HUB_JWT_SECRET`, `HUB_ADMIN_EMAIL`
   and `HUB_ADMIN_PASSWORD`. `HUB_DB_URL` and `HUB_RESUME_STORAGE_PATH` are set in the Compose file.
   `HUB_ALLOWED_ORIGINS` is left out because nothing reads it.
3. **Never in git, never copied off the server, never printed.** Values are generated on the owner's machine and kept
   in the owner's password manager. The file is edited in place with an editor; it is not shown with `cat`, and
   commands that print resolved values (`docker compose config`, `docker inspect`) are not run where output is shared.
   The repository holds variable names and placeholders only.
4. **A stopgap, not the design.** This is a deliberate exception to the SOPS rule in `infra/CLAUDE.md`, which still
   stands. The procedure is in `docs/runbooks/production-secrets.md`.

## Alternatives considered
1. **Set up SOPS + age now.** It is the agreed design and gives encrypted, reviewed history of every change. It lost
   for launch: it needs the age key's home decided (tied to the CI deploy in #11), a decryption step on the server,
   and a rehearsal, all before the first page is served, for a single operator who already holds every value.
2. **GitHub environment secrets, written to the server by a workflow.** No file to create by hand. It lost because
   there is no deploy workflow yet (#11), and `infra/CLAUDE.md` reserves GitHub secrets for pipeline credentials, not
   the app's runtime secrets.
3. **Docker secrets (files mounted into containers).** Values would not appear in the containers' environment. It
   lost for now: the backend reads its settings from environment variables, and Compose's file-based secrets still
   need the same files on the server, so the gain is small until the app reads secrets from files.

## Consequences
- **Positive:**
  - The launch is not blocked on SOPS, and nothing secret enters the repository.
  - A `0600` file in the deploy user's home adds no new reader: the deploy user is already root-equivalent through
    the docker group (ADR 0008 notes the same).
- **Negative / costs / risks:**
  - **No history and no review.** A change to a value leaves no record, and a typo shows up only when the backend
    fails to start.
  - **Only two copies:** the server and the owner's password manager. Losing the server loses the file.
  - **Values are visible to anyone with Docker access** on the server, in the containers' environment. Today that is
    only the deploy user.
  - **Two values only take effect once.** The admin bootstrap creates the admin account only against an empty
    database, and the `postgres` image applies its password only when it initialises an empty data volume. Changing
    either in `.env` later does not change the live account or role. The runbook covers both.
- **Follow-ups this creates:**
  - Replace this with SOPS + age, as `infra/CLAUDE.md` describes, and mark this ADR superseded.

## Revisit when
- The CI deploy in #11 is built: that is when the age key's home is decided, and SOPS should land with it.
- A second person or a second server needs the secrets.
- A value is lost or changed without a record, which is the failure this stopgap accepts.
