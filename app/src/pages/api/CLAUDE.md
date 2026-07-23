# Agent Rules — `app/src/pages/api/`

Scope: API route handlers in Astro server endpoints. Global app rules and the validation procedure live in `app/CLAUDE.md`; the frozen REST contract is `docs/architecture/06-API/00-Overview.md`. (2026-07-11)

## Rules

- Route surface stays under `/api/*`.
- Keep handlers thin: parse request, validate input, call service, map response envelope.
- Use standard success/error envelopes with `requestId`.
- Middleware handles identity verification; services handle domain authorization; never parse JWT or implement business workflows in handlers.
- Keep reads view-backed and writes transactional.

## Tool Allowances & Restrictions (2026-07-23)

Thin handler layer: parse requests, validate, call services, respond. Part of app/ validation scope.

### Allow

- **Read** — load handlers, services, request/response definitions
- **Edit/Write** — modify handler logic, validation, response mapping
- **Bash** — run tests
- **Grep** — verify request/response patterns

### Restrict

- GitHub MCP tools (mcp__github__*) — handler changes don't require PR/issue interaction
- WebFetch, WebSearch — no external lookups needed
- Agent spawning — focused handler work with clear scope
- Glob — limited file scope, not needed
