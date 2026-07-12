# Agent Rules — `architecture/docs/`

Scope: all documentation under `architecture/docs/` (foundation docs, database handbook, API/frontend docs). Authority order and canonical-file inventory live in `architecture/docs/architecture/00-Context-Map.md`. (2026-07-11)

## Editing Workflow

1. Identify the canonical target doc for the change (use the context map inventory).
2. Apply a minimal diff in the canonical doc first; align secondary docs to it.
3. Propagate only required consistency edits.

## Strict Rules

- Documentation-first: update design docs before implementation guidance.
- Preserve folder hierarchy and numbering conventions.
- Keep terminology stable across files (`activity`, `exercise_session`, `turn`, `dart`, …).
- Do not mark speculative ideas as decisions; use explicit "Open Decisions" sections.
- Keep historical records historical (`05-Database/07`–`09`); do not rewrite history.
- Keep the Worker/Neon/PostgreSQL responsibility split explicit in API docs.
- Keep naming conventions stable (`v_*`, `idx_*`, `fk_*`, `uq_*`, `chk_*`).

## Consistency Checks Before Finish

- No contradiction between architecture docs and the migration/seed chain (`0001`–`0013`).
- ID ownership consistent: Worker/API generates UUIDv7 for runtime entities.
- CQRS-lite intact: writes to runtime tables, reads from `v_*` views.
- Context Maintenance protocol (root `CLAUDE.md`) completed — including the ISO-date rule and context-map registration.
