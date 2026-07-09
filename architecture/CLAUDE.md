# Agent Rules - `architecture/`

Scope: everything under `architecture/` (docs, database migrations/seeds, and architecture context files).

## Primary Objective

Keep architecture docs and database artifacts consistent with the architecture-first model:

`Principles -> System Architecture -> Patterns -> Database/API docs -> SQL implementation`

Implementation that conflicts with architecture docs is incorrect unless a newer approved architectural decision explicitly replaces it.

## Canonical Sources

Use this authority order when conflicts exist:

1. User request in current chat
2. `architecture/docs/architecture/01-Principles.md`
3. `architecture/docs/architecture/02-System-Architecture.md`
4. `architecture/docs/architecture/04-Architecture-patterns.md`
5. `architecture/docs/architecture/05-Database/06-Database-Specification.md`
6. `architecture/docs/architecture/06-API/00-Overview.md`
7. `architecture/docs/architecture/03-Engineering-Workflow.md`
8. `architecture/docs/architecture/099-engineering-workflow-and-decision-framework.md`
9. SQL files in `architecture/docs/database/migrations/` and `architecture/docs/database/seeds/`

If lower-priority files conflict with higher-priority files, update lower-priority files.

## Required Reading Order (When Doing Architecture Work)

1. `architecture/docs/architecture/README.md`
2. `01-Principles.md`
3. `02-System-Architecture.md`
4. `03-Engineering-Workflow.md`
5. `04-Architecture-patterns.md`
6. `05-Database/10-Database-Agent-Guide.md`
7. `05-Database/06-Database-Specification.md`
8. `06-API/00-Overview.md`
9. `06-API/01-Implementation-Strategy.md` (2026-07-09)
10. `06-API/02-Middleware-And-Layering.md` (2026-07-09)
11. `07-Frontend/00-Overview.md` (2026-07-09)
12. `05-Database/11-Neon-Integration.md` (2026-07-09)

Use `architecture/000_master_context.md` as historical context and decision lineage, not as the final source of truth.

## Database and API Baselines (Must Stay Stable Unless Explicitly Changed)

- Database is source of truth for persistent facts.
- Completed runtime gameplay is immutable.
- Statistics are derived (views/queries), not persisted as truth.
- Runtime chain: `Activity -> Exercise Session -> Exercise Stage -> Turn -> Dart`.
- Configuration chain: `configuration_templates -> exercise_configurations -> exercise_sessions`.
- IDs: UUIDv7 for domain entities (application-generated), SMALLINT for controlled lookup tables.
- API runtime: Astro endpoints on Cloudflare Workers in `app/`.
- Auth transport: Bearer JWT, verified in Worker/API boundary.
- Runtime write endpoint: `POST /api/sessions/:sessionId/events:batch`.
- Read model contract: API reads from `v_*` views.

## Task Routing Rules

For requests in `architecture/`, identify impacted layer first:

- **Principles/System:** update `01`/`02` docs first, then cascade.
- **Workflow/process:** update `03` and `099`.
- **Pattern-level changes:** update `04`, then impacted domain docs.
- **Database model changes:** update `05-Database/06-Database-Specification.md`, then migrations/seeds, then related `05-Database/*` guides.
- **API contract changes:** update `06-API/00-Overview.md` before or with implementation changes.
- **API implementation guidance:** update `06-API/01-Implementation-Strategy.md` and `06-API/02-Middleware-And-Layering.md` (2026-07-09).
- **Frontend integration guidance:** update `07-Frontend/00-Overview.md` (2026-07-09).
- **Any docs file update:** add an ISO date (`YYYY-MM-DD`) to each newly added and/or changed row entry.

Always apply minimal diffs and propagate only necessary consistency edits.

## Historical Documents Policy

Treat these as historical records unless user explicitly requests edits:

- `05-Database/07-Data-Model-Review.md`
- `05-Database/08-Physical-Schema-Mapping.md`
- `05-Database/09-Pre-Implementation-Review.md`

Do not rewrite their historical review content. If needed, add concise status notes only.

## SQL Safety Rules

- Never modify applied migrations. Add a new numbered migration.
- Keep one responsibility per migration file.
- Keep schema changes in migrations and reference/static data in seeds.
- Use explicit deterministic IDs in seeds where required.
- Avoid adding indexes without a concrete query/access-path reason.
- Avoid introducing derivable-stat storage tables.

## Forbidden Actions

- Do not invent architectural decisions not grounded in canonical docs.
- Do not let runtime entities reference mutable templates directly.
- Do not expose raw runtime tables as API contracts when a view contract exists.
- Do not treat `000_master_context.md` as higher authority than canonical docs.
- Do not silently change naming conventions (`v_*`, `idx_*`, `fk_*`, `uq_*`, `chk_*`).

## Definition of Done for Architecture Changes

Before finishing, verify:

1. Changed files align with authority order.
2. No ownership boundary regressions were introduced.
3. Related docs remain internally consistent.
4. If schema or API behavior changed, canonical docs were updated accordingly.
5. Historical records were preserved unless explicitly requested otherwise.
6. If `app/` validation commands are documented/changed, they include `npx fallow` for stale-type detection.
