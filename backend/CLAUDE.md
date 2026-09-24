# Backend rules (Spring Boot 4.1 / Modulith 2.1 / Java 21)

## Layout (base package: `com.sahtechlabs.hub`, changeable only via ADR)
```
com.sahtechlabs.hub
├── HubApplication.java
├── identity/        authentication, tokens, users, roles
├── projects/        project catalogue and case studies
├── resume/          resume versions, downloads
├── contact/         recruiter messages, spam defence
├── notifications/   outbound email (listens to events)
├── insights/        privacy-friendly analytics (listens to events)
└── shared/          cross-cutting: errors, logging, config, audit (keep tiny)
```
Inside each module:
- module root package = **public API** (service interfaces, DTOs, domain events). Other modules may only use this.
- `internal/` = controllers, persistence, entities, implementation. Never referenced from other modules.
- Cross-module interaction: call the public API, or publish a domain event handled with `@ApplicationModuleListener`.
- `ApplicationModules.of(HubApplication.class).verify()` must pass; it runs in the test suite. Never weaken it to make a build pass.

## Conventions
- **API:** `/api/v1/...`. Decide native Boot 4 API versioning vs path prefix in M1 and record it in an ADR.
- **Validation:** Bean Validation on request DTOs; domain invariants enforced in the domain, not only at the edge.
- **Errors:** one `@RestControllerAdvice` returning `ProblemDetail` with a stable `code` property; never leak stack traces or internals.
- **Persistence:** Spring Data JDBC or JPA is decided by ADR in M1. Flyway migrations `V<n>__<snake_case>.sql`. NEVER edit an applied migration; add a new one. Migrations must be backwards compatible with the previous release (expand/contract).
- **Config:** `@ConfigurationProperties` records with validation, bound from environment variables prefixed `HUB_`. Profiles: `local`, `test`, `prod`. No secrets in `application*.yml`.
- **Logging:** structured JSON in `prod` via Boot structured logging; correlation id in MDC; never log passwords, tokens, or message bodies; log ids not personal data.
- **Security:** Spring Security 7, deny by default, method security for admin operations, BCrypt (or delegating encoder), login throttling, security headers, CORS allow-list from config.
- **Time:** inject `Clock`; store UTC.
- **Money-like or id types:** use value objects; no primitive obsession at module boundaries.

## Testing
- Unit tests for domain logic (fast, no Spring).
- `@ApplicationModuleTest` for a module in isolation; Testcontainers PostgreSQL for anything touching the DB. Never mock the database.
- Security tests: every admin endpoint has an "anonymous is rejected" and "wrong role is rejected" test.
- Test names state behaviour. Arrange/Act/Assert. No sleeping; use Awaitility for async.
- Migrations tested by starting from an empty database.

## Commands
- `backend/mvnw -f backend/pom.xml verify` (unit + integration; Docker required for Testcontainers)
- `backend/mvnw -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=local`
