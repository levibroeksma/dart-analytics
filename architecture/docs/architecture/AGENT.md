# Agent Rules — `architecture/docs/architecture/`

Scope: foundation architecture docs and subfolders.

## Mandatory Workflow

1. Read `README.md` in this folder.
2. Identify canonical target doc for the requested change.
3. Apply minimal diff in canonical doc.
4. Propagate only required consistency edits to related docs.

## Authority Order

1. User request in current chat
2. `01-Principles.md`
3. `02-System-Architecture.md`
4. `04-Architecture-patterns.md`
5. Domain docs (`05-Database/*`, `06-API/*`)

If two docs conflict, higher authority wins and lower doc must be corrected.

## Strict Rules

- Do not introduce implementation details that contradict documented ownership boundaries.
- Keep route, schema, and naming conventions stable once approved.
- Do not mark speculative ideas as decisions; use explicit "Open Decisions" sections.
- Keep historical records (`05-Database/07` to `09`) historical; do not rewrite history.
- For API docs, keep Worker/Neon/PostgreSQL responsibility split explicit.
- For every docs-file edit, add an ISO date (`YYYY-MM-DD`) to all newly added and/or changed row entries.

## Required Current Baselines

- API runtime: Astro endpoints on Cloudflare Workers in `app/`.
- Auth transport: Bearer JWT.
- UUID ownership: Worker/API generates UUIDv7 for runtime persistence entities.
- Batch write: `POST /api/sessions/:sessionId/events:batch` with idempotency key.
- Read model: API reads from `v_*` views.
