# Agent Rules — `app/src/db/`

Scope: DB client integration inside the application.

## Responsibilities

- Keep DB access compatible with Cloudflare Workers + Neon serverless.
- Provide typed query access via Drizzle against introspected schema.
- Preserve architecture ownership: SQL migrations live in `architecture/docs/database/`.

## Rules

- Use `DATABASE_URL` (direct, non-pooler) for runtime DB client.
- Use `DATABASE_URL_POOLED` only for migrations/seeds/introspection tools.
- Keep DB client as a small factory (`getDb()`), no global TCP pool logic.
- `app/src/db/schema.ts` is generated from `drizzle-kit introspect`.
- Do not hand-edit generated schema output.

## Validation

Before completion of DB-layer changes:

1. `npm run db:status`
2. `npm run db:migrate`
3. `drizzle-kit introspect`
4. `npx fallow`
5. `astro check`
