# core

App-wide singletons, provided once in `app.config.ts`. Nothing here renders UI.

Planned contents (each arrives with the slice that needs it):

- HTTP interceptors: Problem Details (RFC 9457) error mapping, correlation id
- Global error handling
- Runtime configuration
- Auth state (session lives in an HttpOnly cookie; see ADR 0006)
