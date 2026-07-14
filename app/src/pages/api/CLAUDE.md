# Agent Rules — `app/src/pages/api/`

Scope: API route handlers in Astro server endpoints. Global app rules and the validation procedure live in `app/CLAUDE.md`; the frozen REST contract is `docs/architecture/06-API/00-Overview.md`. (2026-07-11)

## Rules

- Route surface stays under `/api/*`.
- Keep handlers thin: parse request, validate input, call service, map response envelope.
- Use standard success/error envelopes with `requestId`.
- Middleware handles identity verification; services handle domain authorization; never parse JWT or implement business workflows in handlers.
- Keep reads view-backed and writes transactional.
