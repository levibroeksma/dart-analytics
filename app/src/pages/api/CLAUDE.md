# Agent Rules — `app/src/pages/api/`

Scope: API route handlers in Astro server endpoints.

## Responsibilities

- Implement frozen REST contract from `architecture/docs/architecture/06-API/00-Overview.md`.
- Keep handlers thin: parse request, validate input, call service, map response envelope.
- Enforce separation: middleware handles identity verification, services handle domain authorization.

## Rules

- Route surface must stay under `/api/*`.
- Use standard success/error envelopes with `requestId`.
- Keep reads view-backed and writes transactional.
- Never parse JWT in handlers.
- Never implement business workflows directly in handlers.

## Validation

For API changes:

1. `npm run db:status`
2. `npm run db:migrate`
3. `drizzle-kit introspect`
4. `npx fallow`
5. `astro check`
