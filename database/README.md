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
├── migrations/     # ordered schema migrations (0001–0018)
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
npm run db:migrate
npm run db:seed
drizzle-kit introspect
npx fallow
astro check
```

## Seed Order

1. `seeds/0001_reference_data.sql`
2. `seeds/0002_default_templates.sql`
3. `seeds/0003_game_engine_reference.sql`
4. `seeds/0004_score_training_minutes_preset.sql`
5. `seeds/0005_visual_board_input_mode.sql`
6. `seeds/0006_single_band_dart_zones.sql`

## Verification Scripts

`verification/` holds SQL that asserts behaviour only a real database can show — constraints firing, view expressions resolving, derived columns reading correctly. Each script builds its own fixture inside one transaction, resolves every lookup row by `implementation_key` rather than by hardcoded id, prints a PASS/FAIL row per check, and ends in `ROLLBACK`. Nothing survives the run, so they are safe against a seeded dev database.

```sh
psql "$DATABASE_URL" -f database/verification/0018_visual_board_checks.sql
```

Expect `ALL n CHECKS PASSED`. These are not a substitute for the Vitest suite: they cover the SQL layer, which unit tests cannot reach.

## References

- [`../docs/architecture/05-Database/03-Migrations.md`](../docs/architecture/05-Database/03-Migrations.md)
- [`../docs/architecture/05-Database/10-Database-Agent-Guide.md`](../docs/architecture/05-Database/10-Database-Agent-Guide.md)
- [`../docs/architecture/05-Database/11-Neon-Integration.md`](../docs/architecture/05-Database/11-Neon-Integration.md)
- [`../app/CLAUDE.md`](../app/CLAUDE.md)
- [`./CLAUDE.md`](./CLAUDE.md)
