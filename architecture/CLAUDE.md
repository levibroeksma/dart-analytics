# Agent Rules — `architecture/`

Scope: architecture docs, database migrations/seeds, and context files. Global rules, authority order, and context packs live in `architecture/docs/architecture/00-Context-Map.md` — not repeated here. (2026-07-11)

## Task Routing (architecture edits)

Identify the impacted layer first, then edit the canonical doc before cascading:

- **Principles/System:** `01-Principles.md` / `02-System-Architecture.md` first, then cascade.
- **Workflow/process:** `03-Engineering-Workflow.md` and `099-engineering-workflow-and-decision-framework.md`.
- **Pattern-level:** `04-Architecture-patterns.md`, then impacted domain docs.
- **Database model:** `05-Database/06-Database-Specification.md` (+ `06-Spec/` chapter), then migrations/seeds, then related `05-Database/*` guides.
- **API contract:** `06-API/00-Overview.md` before or with implementation changes.
- **API implementation guidance:** `06-API/01-Implementation-Strategy.md`, `06-API/02-Middleware-And-Layering.md`.
- **Frontend integration:** `07-Frontend/00-Overview.md`.
- **Frontend handbook:** `07-Frontend/01`–`05` + `10-Frontend-Agent-Guide.md`; amend `00-Overview.md` for integration changes.

Apply minimal diffs; propagate only necessary consistency edits.

## Historical Documents Policy

Treat as immutable records unless the user explicitly requests edits: `05-Database/07`–`09` (design gates), `architecture/000_master_context.md`. Add concise status notes only; never rewrite historical review content. `000_master_context.md` and `DECISIONS.md` are context, never authority.

## SQL Safety Rules

- Never modify applied migrations; add a new numbered migration.
- One responsibility per migration file; schema in migrations, controlled data in seeds.
- Explicit deterministic IDs in seeds where required.
- No indexes without a concrete query/access-path reason.
- No derivable-stat storage tables.

## Definition of Done

1. Changed files align with the authority order in `00-Context-Map.md`.
2. Related docs remain internally consistent; canonical docs updated if schema/API behavior changed.
3. Historical records preserved.
4. Context Maintenance protocol (root `CLAUDE.md`) completed.
