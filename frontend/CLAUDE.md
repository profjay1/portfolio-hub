# Frontend rules (Angular 22, TypeScript 6, Node 22+)

## Structure
```
src/app
├── core/          singletons: auth, http interceptors, error handling, config
├── shared/        reusable UI (dumb components, pipes, directives)
├── features/
│   ├── public/    home, projects, project detail, resume, contact  (SSR/prerendered)
│   └── admin/     login, dashboard, projects CRUD, messages inbox   (lazy, client-only)
└── api/generated/ TypeScript client generated from the backend OpenAPI spec. NEVER hand-edit.
```

## Conventions
- Standalone components only (no NgModules). `inject()` over constructor params. Signals for state. OnPush is the default in Angular 22; do not opt out without a comment.
- Forms: Signal Forms. Server-side validation errors from Problem Details are mapped to fields.
- Data fetching: `httpResource` / `rxResource` where fitting; interceptors for error mapping and correlation id. No auth-header interceptor: the session travels in an HttpOnly cookie, and `HttpClient` echoes the `XSRF-TOKEN` cookie as `X-XSRF-TOKEN` on unsafe requests (keep requests same-origin so it does).
- Routing: lazy-load `features/admin`; functional route guards; typed route params.
- Strict TypeScript. No `any`. No non-null assertions without a comment.
- Accessibility is a requirement: semantic HTML, labels, focus management, keyboard support, colour contrast. Axe/Lighthouse checks run in CI later.
- Styling: design tokens as CSS custom properties, light and dark themes, mobile first.
- Never store tokens in localStorage. Auth relies on HttpOnly cookies set by the backend (see `docs/adr/0006-jwt-in-httponly-cookie-with-csrf-tokens.md`).

## Required npm scripts (CI depends on these exact names)
`start`, `build`, `lint`, `test:ci` (single run, no watch), `e2e`, `generate:api`.

## Testing
- Vitest for units (components tested through the DOM, services through public behaviour).
- Playwright for the critical journeys: recruiter downloads resume, recruiter sends message, admin logs in and publishes a project.
- No snapshot tests of large DOM trees.

## Commands
- `npm --prefix frontend ci` / `start` / `run lint` / `run test:ci` / `run build`
- `npm --prefix frontend run e2e` (first time: `npx --prefix frontend playwright install chromium`). Starts its own dev server and stubs the API.
- `npm --prefix frontend run format` rewrites files with Prettier; `lint` only checks.

## Running locally
Two terminals: the backend on :8080 (see backend/CLAUDE.md), then `npm --prefix frontend start` on :4200.
`proxy.conf.json` forwards `/api/**` to `http://localhost:8080`, so the app always calls relative URLs and stays
same-origin (no CORS, and the XSRF cookie flow works). Change the target there if the backend runs elsewhere.
