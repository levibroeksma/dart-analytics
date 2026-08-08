<!--
status: canonical
scope: decisions/database
read-when: why a schema/migration/view/index/seed choice was made
load-when: schema, migration, table, column, constraint, index, view, Neon, seed, replay, ID strategy, denormalisation
depends-on: decisions/architecture.md
related: decisions/api.md, decisions/game-engine.md
updated: 2026-08-08
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

### D188 — Dart coordinates ship as regulation millimetres with a pair-or-neither constraint
Status: Accepted · Date: 2026-08-05
Decision: `darts.location_x` / `darts.location_y` ship as `NUMERIC(6, 2)` millimetres, origin at the bull centre, y increasing downward to match `dartboard.svg` (migration `0017`). Both columns are nullable, but never independently: `chk_dart_location_pair` rejects one present without the other. `v_dart_locations` (migration `0018`) exposes them plus derived `radius_mm` / `angle_degrees`; miss margin needs a zone centroid, which stays out of SQL entirely and is computed in the application read layer (`app/src/lib/game/board/miss-margin.module.ts`) instead.
Reason: A landing point is one fact, not two independently-optional columns — the CHECK constraint makes "half a coordinate" unrepresentable rather than a client-side convention. This is the shipped shape that replaces the deferral recorded in `06-Spec/04-Runtime-Layer.md` ("`location_x`/`location_y` board coordinates are deferred"), now that the visual board UI can capture them.
Consequences: Migration `0017` also adds the two `player_settings` foreign keys (`fk_player_settings_capture_mode`, `fk_player_settings_input_mode`) that `06-Spec/03-Player-Layer.md` specified but `0003` never created — bundled because both were reviewed together and neither is separable from the other in that migration. No capability table ships alongside this pair; it is deferred to a later plan.

### D192 — SQL that a migration can only fail on gets a real-database run, not a review
Status: Accepted · Date: 2026-08-08
Decision: `v_dart_locations`' angle expression casts to `NUMERIC` before `MOD()` (`MOD(DEGREES(ATAN2(x, -y))::NUMERIC + 360, 360)`), and `app/tests/db/migration-numeric-typing.test.ts` fails any migration whose `MOD()` argument reaches a double-precision function without an intervening `::NUMERIC`. Both derived columns are therefore `NUMERIC`, which Drizzle/node-postgres surface as strings.
Reason: migration `0018` shipped with `MOD(DEGREES(...) + 360, 360)` and could never have applied — PostgreSQL has no `mod(double precision, integer)`, and the double→numeric cast is assignment-only so it is not considered during function resolution. Nothing caught it: `tsc` and the whole Vitest suite are blind to SQL, the structural gates lint file shape rather than semantics, and the plan's own verification was deferred to an operator checklist. The bug was found only by running the chain against a throwaway PostgreSQL 16 cluster.
Consequences: `0018` is corrected in place rather than superseded — it had never applied to any database, so no environment carries the broken definition and the "never modify applied migrations" invariant (`0001`–`0016`) is untouched. Operator checklist steps 1 and 3–5 are now verified against a real cluster and marked as such; only the Neon-specific re-run remains. The read layer must parse `location_x`, `location_y`, `radius_mm` and `angle_degrees` from strings before handing them to `missMargin`, which takes numbers. A migration that only a live database can reject should be run against one before the branch claims verification.

### D193 — Live-database verification is a committed script, not checklist prose
Status: Accepted · Date: 2026-08-08
Decision: behaviour only a real database can demonstrate — a CHECK constraint firing, a view expression resolving, a derived column reading correctly — is asserted by a script under `database/verification/`, named for the migration it covers (`0018_visual_board_checks.sql`). Each script builds its own fixture inside one transaction, resolves every seeded lookup row by `implementation_key` rather than by hardcoded id, emits one PASS/FAIL row per check with the observed value in a `detail` column, and ends in `ROLLBACK`. Operator handoffs invoke the script instead of restating the SQL.
Reason: the original checklist told the operator to find "a real `turn_id` from a test session" and hand-type inserts against it. That is the shape of a step that gets skipped, and D192's `0018` defect is what skipping it costs. A script removes both the setup burden and the transcription risk, and it is re-runnable — the same checks that passed on the local PostgreSQL 16 cluster can be pointed at Neon, or at any future environment, without rewriting anything. Ending in `ROLLBACK` is what makes it safe to run against a seeded dev database rather than a scratch one.
Consequences: a join-driven check reports a vacuous pass when its source view is empty, so each script must separately assert that the expected number of checks ran — `0018_visual_board_checks.sql` does. Scripts must be proved non-vacuous before they are trusted: this one was, by swapping the view's angle expression to `ATAN2(y, x)` and confirming 4 of 11 checks went red. These scripts are not part of `npm test` — they need a live `DATABASE_URL` and are run deliberately, per environment. `database/CLAUDE.md`'s validation checklist carries the rule.
