# 0006. Carry the session JWT in an HttpOnly cookie, with CSRF tokens

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Repository owner

## Context
The admin area needs authentication for one admin user. The backend is stateless (ADR 0002 keeps it a single
Spring Boot app; no server-side session store is wanted). The frontend is an Angular SPA served from the same origin
as the API behind Caddy (ADR 0004). `frontend/CLAUDE.md` already forbids keeping tokens in `localStorage`. The real
choice is where the token lives in the browser and how it travels:

- in JavaScript-readable storage, sent as `Authorization: Bearer …`; or
- in a cookie the browser attaches automatically.

That choice decides which attack each design is exposed to. A token that JavaScript can read can be stolen by any
XSS. A cookie the browser sends automatically is an ambient credential, so cross-site request forgery (CSRF) has to
be handled.

## Decision
1. **Token.** On login the backend issues a JWT signed with HS256 using `HUB_JWT_SECRET` (at least 256 bits, checked
   at startup). Claims: `iss=portfolio-hub`, `sub=<user id>`, `email`, `role`, `iat`, `exp`. It is valid for 1 hour
   (`hub.jwt.ttl`). It is issued and verified with Spring Security's Nimbus JOSE support; there is no third-party JWT
   library.
2. **Transport.** The token travels only in a cookie, `__Host-hub_session`, with `HttpOnly`, `Secure`,
   `SameSite=Strict`, `Path=/` and `Max-Age` equal to the token lifetime. The `__Host-` prefix makes browsers refuse
   the cookie unless it is Secure, host-only (no `Domain`) and scoped to `/`, so a sibling subdomain can neither set
   nor read it. Logout overwrites it with `Max-Age=0`.
3. **Verification.** A filter in the security chain reads the cookie and verifies signature, issuer and expiry
   against the injected `Clock`. If the token is valid, the filter authenticates the request with the token's role,
   so the existing role rules (`/api/v1/admin/**`) apply unchanged. A missing or invalid cookie leaves the request
   anonymous; the authorization rules then decide. A stale cookie therefore never breaks public endpoints or a
   fresh login.
4. **CSRF protection stays on**, using double-submit tokens (`csrf().spa()`):
   - the backend issues a readable `XSRF-TOKEN` cookie on every response;
   - unsafe requests (POST, PUT, PATCH, DELETE), including login and logout, must echo it in `X-XSRF-TOKEN`;
   - Angular's `HttpClient` does this natively for same-origin requests;
   - a missing or wrong token gets 403 Problem Details with `code: invalid-csrf-token`.

### Why SameSite=Strict alone is not treated as sufficient
SameSite works per *site* (scheme plus registrable domain), not per *origin*. A request from
`https://other.example.com` to `https://hub.example.com` is same-site, so a `SameSite=Strict` cookie is still
attached. If any other portfolio project, preview deployment or third-party tool ever lives on a subdomain of the
Hub's registrable domain, a flaw there would be enough to forge admin requests here. Older or embedded browsers that
ignore SameSite would also be exposed. SameSite stays on as defence in depth; CSRF tokens are the actual control. The
cost is small: Angular already sends the header, and the backend needs one extra filter. In #23, CSRF was disabled
only because no ambient credential existed yet. That reason no longer holds.

## Alternatives considered
1. **Bearer token in an `Authorization` header, held by the SPA in memory or `localStorage`.** This is the common
   tutorial approach, and CSRF disappears because nothing is sent automatically. It lost because any XSS can read
   the token and exfiltrate it, and a stolen token works from anywhere until it expires. `localStorage` is already
   ruled out by `frontend/CLAUDE.md`. Keeping the token only in memory loses it on every page reload, which pushes
   toward a refresh-token mechanism and back to a cookie anyway.
2. **Server-side sessions (`JSESSIONID` and a session store).** These are simple, revocable on logout, and built
   into Spring Security. They lost because they bring back server state (a store or sticky sessions) and still need
   CSRF protection. With one admin this would have been acceptable, so it is the main fallback if revocation becomes
   a requirement (see Revisit).
3. **Rely on SameSite=Strict instead of CSRF tokens.** This is less code. It lost for the same-site reasons above.

## Consequences
- **Positive:**
  - JavaScript, including injected scripts, cannot read the session token.
  - The API stays stateless: no session store, and any instance can verify a request.
  - CSRF is covered by a mechanism Angular supports out of the box.
  - 401 and 403 responses, including CSRF failures, are Problem Details from the one shared handler.
- **Negative / costs / risks:**
  - **No server-side revocation.** Logout deletes the cookie in that browser, but a copy of the token taken earlier
    keeps working until it expires (at most 1 hour). A test documents this on purpose. A role change or a deleted
    user also takes effect only when the current token expires.
  - The token payload is signed, not encrypted, so it reveals the admin's email to anyone holding the cookie. Only
    the admin's own browser holds it, and it is HttpOnly.
  - HS256 means the same secret signs and verifies. That is fine for a single backend, but it means no third party
    can verify tokens without being able to mint them.
  - The `Secure` and `__Host-` requirements mean the cookie works only over HTTPS, or on `localhost`, which browsers
    treat as a secure context. The SPA must reach the API same-origin (the Angular dev-server proxy locally, Caddy
    in production).
  - XSS is mitigated, not solved: injected script can still make same-origin requests while the page is open. A
    Content Security Policy (M6) remains necessary.
- **Follow-ups this creates:**
  - Behind Caddy, the app must trust forwarded headers (`server.forward-headers-strategy`), so request schemes and
    redirects reflect HTTPS (#12).
  - The frontend reads `GET /api/v1/auth/me` to learn who is signed in. On a 403 `invalid-csrf-token` it should
    retry once after any GET has refreshed the `XSRF-TOKEN` cookie.
  - Login throttling (#26).

## Revisit when
- Logout must be enforced server-side, for example after a credential leak or because more admins are added. Then
  add a short deny-list of token ids, or switch to server-side sessions.
- The API gains cross-origin or non-browser clients, which would need a bearer-token path.
- Tokens must be verified by another service, which would mean switching to an asymmetric algorithm (RS256 or
  ES256) with a published public key.
