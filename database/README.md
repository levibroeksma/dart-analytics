<!--
status: canonical
scope: database/sql-artifacts
read-when: applying migrations and seeds
updated: 2026-08-05
-->

# Database SQL Artifacts

This directory contains SQL source-of-truth artifacts used by the application.

## Structure

```text
database/
├── migrations/     # ordered schema migrations (0001–0021)
├── seeds/          # controlled reference/system data
└── verification/   # rollback-safe checks run against a live database
```

## Execution Model

- Migrations are applied with `dbmate`.
- Migration files must include `-- migrate:up` and `-- migrate:down` markers (see `03-Migrations.md`).
- Seeds run after migrations in deterministic order.
- App schema ownership stays in SQL files here (not ORM-generated migrations).

## Standard Local Flow

From `app/`:

```sh
npm run db:status
npm run db:migrate     # expected to STOP at 0020 — see below
npm run db:seed        # 0007 fills the capability table
npm run db:migrate     # 0020 and 0021 now apply
npm run db:introspect
npx fallow
astro check
```

`0020` adds a composite foreign key from `exercise_sessions` to `ruleset_version_capabilities` and requires seed `0007` to have already run — applying `0020` before `0007` (or against a populated database whose sessions use a combination `0007` does not declare) fails on constraint validation.

**The first `db:migrate` failing at `0020` is expected, not a broken migration.** `db:migrate` is `dbmate up`, which takes no target version and applies every pending migration in one run. Against a populated database it will commit `0019`, then stop at `0020` because the capability table is still empty. Run `db:seed`, then `db:migrate` again to apply `0020` and `0021`. On an empty `exercise_sessions` the first run succeeds straight through — the stop is data-dependent, so do not treat its absence as a sign the order does not matter.

## Seed Order

1. `seeds/0001_reference_data.sql`
2. `seeds/0002_default_templates.sql`
3. `seeds/0003_game_engine_reference.sql`
4. `seeds/0004_score_training_minutes_preset.sql`
5. `seeds/0005_visual_board_input_mode.sql`
6. `seeds/0006_single_band_dart_zones.sql`
7. `seeds/0007_ruleset_version_capabilities.sql`

## Verification Scripts

`verification/` holds SQL that asserts behaviour only a real database can show — constraints firing, view expressions resolving, derived columns reading correctly. Each script builds its own fixture inside one transaction, resolves every lookup row by `implementation_key` rather than by hardcoded id, prints a PASS/FAIL row per check, and ends in `ROLLBACK`. Nothing survives the run, so they are safe against a seeded dev database.

From `app/`:

```sh
npm run db:verify              # every script
npm run db:verify 0018         # only scripts whose filename matches
```

Expect `ALL n CHECKS PASSED`; the command exits non-zero if any check fails. It runs through `postgres.js` rather than `psql`, which is not installed locally — this project uses a Neon `dev` branch instead of a local PostgreSQL server (D24), so the client binaries are not there either. `psql "$DATABASE_URL" -f <file>` works identically if you do have it.

These are not a substitute for the Vitest suite: they cover the SQL layer, which unit tests cannot reach. They are not part of `npm test` — they need a live `DATABASE_URL` and are run deliberately, per environment.

| Script | Covers |
| ------ | ------ |
| `verification/0007_capability_seed_checks.sql` | `seeds/0007` row count, per-triple resolution, zero undeclared `exercise_sessions`, parity with `capabilities.ts` (12 checks) |
| `verification/0018_visual_board_checks.sql` | `chk_dart_location_pair`, `v_dart_locations` angles and filtering, bust divergence (11 checks) |
| `verification/0020_capability_fk_checks.sql` | `fk_sessions_capability` exists over the exact composite columns, refuses an undeclared capture/input mode combination, permits a declared one (4 checks) |
| `verification/0021_player_settings_checks.sql` | `v_player_settings` exists with the exact expected columns, translates known mode ids to implementation keys, omits a row for a player with no settings, and preserves the `LEFT JOIN` (NULL mode ids still yield a row with NULL keys) (7 checks) |

## References

- [`../docs/architecture/05-Database/03-Migrations.md`](../docs/architecture/05-Database/03-Migrations.md)
- [`../docs/architecture/05-Database/10-Database-Agent-Guide.md`](../docs/architecture/05-Database/10-Database-Agent-Guide.md)
- [`../docs/architecture/05-Database/11-Neon-Integration.md`](../docs/architecture/05-Database/11-Neon-Integration.md)
- [`../app/CLAUDE.md`](../app/CLAUDE.md)
- [`./CLAUDE.md`](./CLAUDE.md)
