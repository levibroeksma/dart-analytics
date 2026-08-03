<!--
status: canonical
scope: decisions/database
read-when: why a schema/migration/view/index/seed choice was made
load-when: schema, migration, table, column, constraint, index, view, Neon, seed, replay, ID strategy, denormalisation
depends-on: decisions/architecture.md
related: decisions/api.md, decisions/game-engine.md
updated: 2026-08-03
-->

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D20 | P21–30 | CQRS-lite: writes to runtime tables in transactions, reads via `v_*` views only; API never exposes raw tables | Stable read contracts, schema freedom underneath |
| D21 | P48–53 | Migrations are schema-only, seeds hold controlled data; applied migrations are never modified; chain `0001`–`0016` | Auditable, reproducible schema history |
| D22 | P51–53 | Index philosophy: real query paths only, partial index for active sessions, no blind FK indexing | Write cost control |
| D23 | 2026-07-09 | dbmate owns migrations (SQL-first); `drizzle-kit introspect` provides typed query layer only — Drizzle never generates schema | Keeps SQL chain canonical while getting types |
| D24 | 2026-07-09 | Neon project in `aws-eu-central-1`, branches `main`/`preview`/`dev`; scale-to-zero on all branches for v1; shared `dev` branch for local work (no Docker Postgres) | Cost + low ops for solo operator |
| D25 | 2026-07-09 | `npx fallow` added to the standard `app/` validation sequence | Catch stale types before completion |
| D26 | 2026-07-08 | Session write idempotency table (migration `0012`) backing the batch endpoint's idempotency key | Safe client retries of batch uploads |
| D27 | 2026-07-12 | Read-model views normalized (migration `0013`): implementation keys as `*_key`, labels as `*_name`, no internal lookup ids exposed; `ruleset_version_key` added to `v_active_sessions` | Consistent, key-based read contract; fixes inconsistency the freeze missed |
| D28 | 2026-07-12 | `session_id` added to `v_dart_analytics` (migration `0014`) so `GET /sessions/:id/darts` filters by session through the view | Endpoint is per-session but the view was player-global |
| D74 | 2026-07-13 | Migration `0016` rebuilds `v_game_replay` (LEFT JOIN darts, `turn_total_score`, `stage_id`/`parent_stage_id`) and floors `v_session_overview.duration_seconds` | Recreational + nested-stage replay; integer DTO contract |
| D95 | 2026-07-15 | Reversed connection-string contract per user-verified `neonctl link` output: `DATABASE_URL` = pooled (tooling: dbmate, drizzle-kit), `DATABASE_URL_UNPOOLED` = direct (Worker runtime `getDb()`); `DATABASE_URL_POOLED` eliminated entirely, no manually-maintained alias | Matches Neon's real 5-variable output exactly; supersedes commit `a2be0eb`'s unverified reverse assumption |
| D137 | 2026-07-24 | Local Neon env: `npm run env:dev` / `env:prod` pull branch vars into `.env` / `.env.production` and mirror `PUBLIC_NEON_AUTH_BASE_URL`; `npm run dev` runs `env:dev` first; never pull `main` into `.env` | Neon CLI omits Astro `PUBLIC_` keys; deploy must not leave local `astro dev` on production |
