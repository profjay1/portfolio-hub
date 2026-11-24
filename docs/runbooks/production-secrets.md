# Production secrets (the server-side .env)

**When:** before the first deploy, when rebuilding the server, and when rotating a value.
**Result:** `~/hub/.env` on the server holds the Hub's runtime secrets, readable only by the deploy user. ADR 0009
explains why this file exists and what replaces it.
**Last rehearsed:** not yet. Record the date here when it is.

Never paste the file's contents, or the output of `docker compose config` or `docker inspect`, anywhere: all of them
show the values.

## The variables
| Name | What it is | Where the value comes from |
|---|---|---|
| `HUB_DB_USER` | PostgreSQL role the backend connects as | Chosen once, for example `hub` |
| `HUB_DB_PASSWORD` | That role's password | Generated on your machine (below) |
| `HUB_JWT_SECRET` | Signs session tokens; at least 32 bytes | Generated on your machine (below) |
| `HUB_ADMIN_EMAIL` | The admin account's login email | Your choice |
| `HUB_ADMIN_PASSWORD` | The admin account's initial password | Your password manager's generator |

`HUB_DB_URL` and `HUB_RESUME_STORAGE_PATH` are set by the production Compose file, not here. `HUB_ALLOWED_ORIGINS` is
read by nothing and does not belong in this file.

Store every value in your password manager before it goes on the server. The server and the password manager are the
only two copies.

## 1. Generate the values (on your machine)
In your own terminal, not in a shared session:

```bash
openssl rand -hex 32    # once for HUB_DB_PASSWORD, once more for HUB_JWT_SECRET
```

Hex output is 64 characters, so it clears the JWT secret's 32-byte minimum, and it contains nothing that `.env`
parsing treats specially. For the admin password, avoid `$` (Compose would try to expand it) or wrap the whole value
in single quotes.

## 2. Create the file (on the server)
```bash
ssh deploy@"$HUB_VPS_HOST"
umask 077               # new files 0600, new directories 0700, for this shell
mkdir -p ~/hub
nano ~/hub/.env         # any editor; not echo or a heredoc, which leave values in shell history
```

Type or paste, with your values in place of the placeholders:

```
HUB_DB_USER=<db-user>
HUB_DB_PASSWORD=<generated-locally>
HUB_JWT_SECRET=<generated-locally>
HUB_ADMIN_EMAIL=<admin-login-email>
HUB_ADMIN_PASSWORD=<from-password-manager>
```

## 3. Check it without printing it
```bash
stat -c '%U %a %n' ~/hub ~/hub/.env    # expect: deploy 700 .../hub and deploy 600 .../hub/.env
cut -d= -f1 ~/hub/.env                 # names only: the five above, each once
awk -F= '$1 == "HUB_JWT_SECRET" { print length(substr($0, index($0, "=") + 1)) }' ~/hub/.env   # 32 or more
```

## 4. Rotate a value
Containers read the environment when they are created. `docker compose restart` keeps the old values; recreate the
service with the same `docker compose up -d` the deploy uses.

- **`HUB_JWT_SECRET`:** edit the file, then recreate the backend. Every existing session becomes invalid, so the admin
  signs in again.
- **`HUB_DB_PASSWORD`:** the `postgres` image applies the password **only when it initialises an empty data volume**.
  Changing only `.env` leaves the role's old password in place, and the backend can no longer connect. In this order:
  1. Change the role's password inside PostgreSQL. `\password` prompts for it, so it stays out of shell history and
     the process list:
     `docker compose exec db psql -U <db-user> -d hub -c '\password <db-user>'`
  2. Put the same value in `~/hub/.env`.
  3. Recreate the backend and the database containers. The data volume is kept, and the new value is ignored by the
     image, which is fine: step 1 already set it.
- **`HUB_ADMIN_PASSWORD` and `HUB_ADMIN_EMAIL`:** the admin bootstrap creates the admin account **only on the first
  start against an empty database**; once any user exists it does nothing. Changing these in `.env` does not change
  the existing account. They matter again only for a fresh database. Keep them equal to the account's current
  credentials so a rebuild without a restore ends up with the same login.

## 5. If the server is lost
The file goes with it. On a new server, recreate it from the password manager with steps 2 and 3. If the database
starts empty, both one-time values above take effect again from the file. If it is restored from a backup instead,
the admin account comes back with the data; whether the role's password does depends on how the backup is taken,
which the backup work (#63) decides and its restore runbook must state.
