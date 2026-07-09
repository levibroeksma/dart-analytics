# Agent Rules — `architecture/docs/`

Scope: all files under `architecture/docs/`.

## Mission

Keep architecture and database documentation internally consistent and aligned with implemented SQL artifacts.

## Read Order

1. `architecture/docs/architecture/README.md`
2. `architecture/docs/architecture/01-Principles.md`
3. `architecture/docs/architecture/02-System-Architecture.md`
4. `architecture/docs/architecture/04-Architecture-patterns.md`
5. relevant domain handbook/doc (API, DB)

## Non-Negotiable Rules

- Documentation-first: update design docs before implementation guidance.
- Prefer targeted edits; do not regenerate entire document sets.
- Preserve folder hierarchy and numbering conventions.
- Keep terminology stable across files (`activity`, `exercise_session`, `turn`, `dart`, etc.).
- If a canonical document exists for a topic, update it first and align secondary docs to it.
- For any docs update, include an ISO date (`YYYY-MM-DD`) in every newly added and/or changed row entry.

## Canonical Sources

- Architecture map: `architecture/docs/architecture/README.md`
- Canonical DB spec: `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- Canonical API baseline: `architecture/docs/architecture/06-API/00-Overview.md`
- API implementation guidance: `architecture/docs/architecture/06-API/01-Implementation-Strategy.md`, `02-Middleware-And-Layering.md` (2026-07-09)
- Frontend integration: `architecture/docs/architecture/07-Frontend/00-Overview.md` (2026-07-09)
- Neon platform integration: `architecture/docs/architecture/05-Database/11-Neon-Integration.md` (2026-07-09)

## Consistency Checks Before Finish

- No contradiction between architecture docs and migration/seed chain.
- IDs ownership is consistent (Worker/API generates UUIDv7 for runtime entities).
- API read/write responsibilities remain CQRS-lite (writes to tables, reads from views).
- Any changed claim is reflected in relevant summary context files when requested by user.
- If validation command lists are updated, include `npx fallow` as standard stale-type check for `app/`.
