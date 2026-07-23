# Agent Rules — `database/`

Scope: SQL migrations and seeds. Load the "New table / column / constraint" or "New seed data" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. ID strategy detail is owned by `05-Database/10-Database-Agent-Guide.md`. (2026-07-11)

## Hard Constraints

- Never modify applied migrations; a new schema change is a new numbered migration.
- Migrations are schema-only; seeds contain controlled data only.
- No database-generated UUIDs or SERIAL identifiers for domain entities.
- No statistics tables for derivable analytics; use views (`v_*`).
- One responsibility per migration file; schema in migrations, controlled data in seeds.
- Explicit deterministic IDs in seeds where required.
- No indexes without a concrete query/access-path reason.

## Validation Checklist

- Migration numbering contiguous (`0001`–`0016` applied) and single-responsibility.
- New constraints/indexes match documented access patterns (`04-Indexes.md`).
- Any schema change is reflected in `06-Database-Specification.md` and its `06-Spec/` chapters.
- Context Maintenance protocol (root `CLAUDE.md`) completed.

## Tool Allowances & Restrictions (2026-07-23)

Database layer work is implementation-focused: migrations, schema, seeds. Work here is atomic and versioned.

### Allow

- **Read** — load schema files, existing migrations, database docs
- **Edit/Write** — modify or create SQL migrations and database scripts
- **Bash** — run database scripts, psql commands, migration runners
- **Grep** — verify naming conventions (`v_*`, `idx_*`, `fk_*`, `uq_*`, `chk_*`), cross-reference table/column usage
- **Glob** — find migration files and related SQL by pattern

### Restrict

Scoped to this layer's own work; skill-driven workflows use restricted tools as designed — see root `CLAUDE.md`.

- GitHub MCP tools (mcp__github__*) — DB changes don't require PR/issue interaction; that's handled at top level
- WebFetch, WebSearch — no external data needed
- Agent spawning — focused, concrete work on schema and migrations
