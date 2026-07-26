# Agent Rules — `app/src/pages/api/`

Scope: API route handlers in Astro server endpoints. Global app rules and the validation procedure live in `app/CLAUDE.md`; the frozen REST contract is `docs/architecture/06-API/00-Overview.md`. (2026-07-11)

## Rules

- Route surface stays under `/api/*`.
- Keep handlers thin: parse request, validate input, call service, map response envelope.
- Use standard success/error envelopes with `requestId`.
- Middleware handles identity verification; services handle domain authorization; never parse JWT or implement business workflows in handlers.
- Keep reads view-backed and writes transactional.
- **Request schemas mirror the column CHECK constraints of the tables they write.** A bound the database enforces (`chk_*` in `database/migrations/`) belongs beside the field's type in the shared Zod schema, once — not restated per ruleset validator, which keeps only ruleset rules. A value the schema lets through and the database rejects aborts the write transaction and fails the whole batch with a 500 instead of a `VALIDATION_FAILED` naming the offending record. (2026-07-26)

## Tool Allowances & Restrictions (2026-07-23)

Thin handler layer: parse requests, validate, call services, respond. Part of app/ validation scope.

### Allow

- **Read** — load handlers, services, request/response definitions
- **Edit/Write** — modify handler logic, validation, response mapping
- **Bash** — run tests
- **Grep** — verify request/response patterns

### Restrict

Scoped to this layer's own work; skill-driven workflows use restricted tools as designed — see root `CLAUDE.md`.

- GitHub MCP tools (mcp__github__*) — handler changes don't require PR/issue interaction
- WebFetch, WebSearch — no external lookups needed
- Agent spawning — focused handler work with clear scope
- Glob — limited file scope, not needed
