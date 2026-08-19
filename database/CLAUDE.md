# Agent Rules — `database/`

Scope: SQL migrations, seeds and live-database verification scripts. Load the "New table / column / constraint" or "New seed data" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. ID strategy detail is owned by `05-Database/10-Database-Agent-Guide.md`. (2026-07-11)

## Hard Constraints

- Never modify applied migrations; a new schema change is a new numbered migration.
- Migrations are schema-only; seeds contain controlled data only.
- No database-generated UUIDs or SERIAL identifiers for domain entities.
- No statistics tables for derivable analytics; use views (`v_*`).
- One responsibility per migration file; schema in migrations, controlled data in seeds.
- Explicit deterministic IDs in seeds where required.
- No indexes without a concrete query/access-path reason.

## Validation Checklist

- Migration numbering contiguous (`0001`–`0022` applied) and single-responsibility.
- New constraints/indexes match documented access patterns (`04-Indexes.md`).
- Any schema change is reflected in `06-Database-Specification.md` and its `06-Spec/` chapters.
- Behaviour a migration can only prove against a real database (constraints firing, view expressions resolving) gets a `verification/` script, not checklist prose (D193). Scripts build their own fixture, resolve lookups by `implementation_key`, and end in `ROLLBACK`.
- Context Maintenance protocol (root `CLAUDE.md`) completed.
