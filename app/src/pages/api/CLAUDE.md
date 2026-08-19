# Agent Rules — `app/src/pages/api/`

Scope: API route handlers in Astro server endpoints. Global app rules and the validation procedure live in `app/CLAUDE.md`; the frozen REST contract is `docs/architecture/06-API/00-Overview.md`. (2026-07-11)

## Rules

- Route surface stays under `/api/*`.
- Keep handlers thin: parse request, validate input, call service, map response envelope.
- Use standard success/error envelopes with `requestId`.
- Middleware handles identity verification; services handle domain authorization; never parse JWT or implement business workflows in handlers.
- Keep reads view-backed and writes transactional.
- **Request schemas mirror the column CHECK constraints of the tables they write.** A bound the database enforces (`chk_*` in `database/migrations/`) belongs beside the field's type in the shared Zod schema, once — not restated per ruleset validator, which keeps only ruleset rules. A value the schema lets through and the database rejects aborts the write transaction and fails the whole batch with a 500 instead of a `VALIDATION_FAILED` naming the offending record. (2026-07-26)
