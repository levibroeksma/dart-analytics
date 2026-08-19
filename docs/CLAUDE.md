# Agent Rules — `docs/`

Scope: all documentation under `docs/` (foundation docs, database handbook, API/frontend docs; `docs/superpowers/` is historical, `docs/game-rules/` is non-canonical pre-spec source material — see `docs/game-rules/README.md`), plus the repo-root decision ledger `decisions/**` and its router `DECISIONS.md`. Global rules, authority order, and context packs live in `docs/architecture/00-Context-Map.md` — not repeated here. SQL migration/seed rules live in `database/CLAUDE.md`. (2026-07-14; decisions/** scope added 2026-08-02)

## Editing Workflow

1. Identify the canonical target doc for the change (use `docs/architecture/00-File-Inventory.md`).
2. Apply a minimal diff in the canonical doc first; align secondary docs to it.
3. Propagate only required consistency edits.

## Task Routing (edit the canonical doc first, then cascade)

- **Principles/System:** `01-Principles.md` / `02-System-Architecture.md`
- **Workflow/process:** `03-Engineering-Workflow.md`
- **Pattern-level:** `04-Architecture-patterns.md`, then impacted domain docs
- **Database model:** `05-Database/06-Database-Specification.md` (+ `06-Spec/` chapter), then `database/` migrations/seeds, then related `05-Database/*` guides
- **API contract:** `06-API/00-Overview.md` before or with implementation changes; implementation guidance in `06-API/01`–`02`
- **Frontend:** `07-Frontend/00-Overview.md` for integration; handbook `07-Frontend/01`–`05` + `10-Frontend-Agent-Guide.md`
- **Why a decision was made:** pick the domain file from `DECISIONS.md`'s routing table under `decisions/**`; append a new block, never edit or delete an existing one — a reversal is a new decision citing `Supersedes:`. `DECISIONS.md` itself is a router and must stay free of decision rows.

## Strict Rules

- Documentation-first: update design docs before implementation guidance.
- Preserve folder hierarchy and numbering conventions.
- Keep terminology stable across files (`activity`, `exercise_session`, `turn`, `dart`, …).
- Do not mark speculative ideas as decisions; use explicit "Open Decisions" sections.
- Historical records stay historical: `05-Database/07`–`09`, `docs/superpowers/**` — status notes only, never rewrites.
- Keep the Worker/Neon/PostgreSQL responsibility split explicit in API docs.
- Keep naming conventions stable (`v_*`, `idx_*`, `fk_*`, `uq_*`, `chk_*`).

## Consistency Checks Before Finish

- No contradiction between architecture docs and the migration/seed chain (`0001`–`0021`).
- ID ownership consistent: Worker/API generates UUIDv7 for runtime entities.
- CQRS-lite intact: writes to runtime tables, reads from `v_*` views.
- Context Maintenance protocol (root `CLAUDE.md`) completed — ISO dates, map registration, checker pass.
