# 0005. Use Spring Data JDBC for persistence

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Repository owner

## Context
The backend needs a persistence approach before the first module stores data. The Hub's data is small and flat:
users, projects, resume versions, contact messages. Each is a single table, or nearly, with few relationships and
no deep object graphs. The application is a Spring Modulith modular monolith (ADR 0002). Each module owns its data,
and modules must not reach into each other's internals. The owner must be able to explain every line of
behaviour in an interview, so implicit behaviour has a real cost here, beyond any performance cost.

## Decision
Use **Spring Data JDBC** (`spring-boot-starter-data-jdbc`) with PostgreSQL. Flyway owns the schema, with no
generated DDL. Each module defines its own aggregates and repositories in its `internal` package and references
other modules' aggregates by id only, never by object reference.

## Alternatives considered
1. **Spring Data JPA (Hibernate):** the most widely known option and familiar to most reviewers, with rich mapping,
   lazy loading, caching, and dirty checking. It lost because those features are implicit behaviour: a persistence
   context, flush timing, lazy-loading exceptions, N+1 queries, and proxies. Each has to be understood, tuned, and
   defended, and this domain gets nothing from any of them. JPA also makes it easy to map object references across
   aggregates, which works against Modulith's module boundaries.

## Consequences
- **Positive:**
  - Spring Data JDBC's model matches DDD aggregates: one repository per aggregate root, the whole aggregate loaded and
    saved together, and references to other aggregates by id. That is the same rule Modulith enforces between
    modules.
  - What you see is what runs: no session, no lazy loading, no dirty checking. SQL is predictable and easy to read
    in logs and tests.
  - Small flat entities map to Java records or simple classes with little configuration.
- **Negative / costs / risks:**
  - Saving an aggregate with collections deletes and re-inserts the children, which suits small aggregates only.
  - No lazy loading or second-level cache. Complex reads need explicit queries (`@Query` or `JdbcClient`).
  - Fewer tutorials and Stack Overflow answers than JPA.
- **Follow-ups this creates:**
  - Keep aggregates small. Model cross-module links as ids (value objects at module boundaries).
  - Add Spring Modulith's JDBC event publication registry when the first module publishes domain events.

## Revisit when
A module develops a genuinely deep object graph, or read patterns that would clearly benefit from lazy loading or a
second-level cache. Also if Spring Data JDBC stops covering a needed PostgreSQL feature without heavy hand-written SQL.
