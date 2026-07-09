# Validation Blockers Fix — Design

> **Status:** Draft (brainstorming session 2026-07-09)
>
> **Scope:** Unblock `npm run validate:app` after Neon DB integration by converting SQL migrations to dbmate format and clearing fallow violations.
>
> **Prerequisite:** Neon DB integration implementation (`2026-07-09-neon-db-integration-design.md`) Tasks 1–8 complete in worktree `neon-db-integration`.
>
> **Authority:** Architecture SQL in `architecture/docs/database/migrations/` remains the sole schema source of truth.

---

## Goal

Make the full validation chain pass end-to-end:

```
npm run db:status
npm run db:migrate
npm run db:introspect
npx fallow
astro check
```

Two blockers remain after the Neon integration pass:

1. **dbmate format mismatch** — migration files are plain transactional SQL; dbmate requires `-- migrate:up` / `-- migrate:down` sections.
2. **fallow violations** — unused files/props, dependency miscategorization, and duplicate clones in generated `schema.ts`.

## Non-goals

- CI pipeline wiring (documented for future; not implemented here)
- fallow pre-commit hook installation
- Replacing dbmate with a custom migration runner
- Full data-migration reversal in `migrate:down` blocks
- Fixing fallow health/MI scores (informational only)
- Changes to `package.json` db scripts (already correct)

---

## Approved Decisions

| Decision | Choice |
| --- | --- |
| Migration runner | Keep **dbmate** (convert files to its format) |
| Conversion method | **Manual file-by-file** (12 files) |
| Down migration scope | **Structural DDL only** (DROP TABLE/VIEW/INDEX/CONSTRAINT; no data reversal) |
| Dev branch state | **Empty / never migrated** — safe to edit all 12 files in place |
| Fallow strategy | **Fix code + targeted ignores** (not config-only) |
| Transaction wrapping | Remove explicit `BEGIN`/`COMMIT` — dbmate wraps each section |

---

## Section 1 — Migration Conversion

### Problem

`npm run db:migrate` fails with:

```
dbmate requires each migration to define an up block with '-- migrate:up'
```

Current files (`0001`–`0012`) use plain SQL with explicit `BEGIN`/`COMMIT` per `03-Migrations.md` atomicity guidance. Neon integration docs (`11-Neon-Integration.md`) assume dbmate but never specified the marker format.

### Target format

Each migration file becomes:

```sql
-- ============================================================
-- Migration: 0001_extensions.sql
-- (header comments unchanged)
-- ============================================================

-- migrate:up
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- migrate:down
DROP EXTENSION IF EXISTS pg_stat_statements;
```

Rules:

- Add `-- migrate:up` immediately before the DDL block (after header comments).
- Add `-- migrate:down` with structural reverse DDL.
- **Remove** explicit `BEGIN`/`COMMIT` — dbmate runs each section inside a transaction.
- Preserve all header comments and inline documentation.
- Do not rename files or renumber the chain.

### Per-file down blocks

Structural reverse only. No data `UPDATE`/`INSERT` reversal.

| File | Down action |
| --- | --- |
| `0001_extensions.sql` | `DROP EXTENSION IF EXISTS pg_stat_statements` |
| `0002_reference_tables.sql` | `DROP TABLE` all 11 reference tables in reverse FK dependency order |
| `0003_players.sql` | `DROP TABLE player_settings, players` |
| `0004_templates.sql` | `DROP TABLE routine_steps, routine_templates, exercise_templates` |
| `0005_runtime_core.sql` | `DROP TABLE` 5 runtime tables (children before parents) |
| `0006_runtime_events.sql` | `DROP TABLE darts, turns` |
| `0007_constraints.sql` | `ALTER TABLE … DROP CONSTRAINT` for each constraint added in up |
| `0008_indexes.sql` | `DROP INDEX IF EXISTS` for each index created in up |
| `0009_views.sql` | `DROP VIEW IF EXISTS` for all 5 views |
| `0010_configuration_templates.sql` | `DROP TABLE configuration_templates` |
| `0011_ordering_and_uniqueness.sql` | Reverse: re-create dropped indexes (`idx_routine_steps_template_sequence`, `idx_darts_turn_number`), drop new unique indexes, drop added constraints |
| `0012_session_write_idempotency.sql` | `DROP TABLE session_write_idempotency` |

### High-risk files

**`0007_constraints.sql`** — grep every `ADD CONSTRAINT` / `ALTER TABLE … ADD` in up; mirror each named constraint in down. Missing one leaves orphan constraints on rollback.

**`0011_ordering_and_uniqueness.sql`** — down must:
1. Re-create indexes dropped in up (`DROP INDEX IF EXISTS idx_routine_steps_template_sequence`, `idx_darts_turn_number`)
2. Drop unique indexes created in up (`uq_stages_sibling_sequence`, `uq_stages_root_sequence`, `uq_sessions_single_active`)
3. Drop constraints added in up

### Validation (migrations)

```sh
cd app
npm run db:status     # 12 pending on empty dev branch
npm run db:migrate    # all 12 applied, exit 0
npm run db:rollback   # smoke-test: rolls back 0012
npm run db:migrate    # re-apply 0012
npm run db:seed       # idempotent, exit 0
npm run db:introspect # schema.ts unchanged (or commit only cosmetic drift)
```

### Documentation updates

**`architecture/docs/architecture/05-Database/03-Migrations.md`**

- Add **dbmate Format** section:
  - Required `-- migrate:up` / `-- migrate:down` markers
  - Example migration file
  - Rule: new migrations must include structural down blocks
- Revise **Migration Atomicity** section:
  - Replace `BEGIN`/`COMMIT` preference with: dbmate wraps each section in a transaction; authors omit explicit transaction boundaries
  - Note: PostgreSQL DDL is transactional, so dbmate's wrapper is sufficient

**`architecture/docs/architecture/05-Database/11-Neon-Integration.md`**

- Cross-reference dbmate format requirement in Migration Workflow section

**`architecture/docs/database/README.md`**

- Note that migration files must use dbmate markers

---

## Section 2 — Fallow Cleanup

### Problem

`npx fallow` reports failures:

| Category | Count | Items |
| --- | --- | --- |
| Unused files | 3 | `neon.ts`, `src/lib/env.ts`, `src/components/ui/Btn.astro` |
| Test-only prod deps | 3 | `@astrojs/alpinejs`, `@astrojs/cloudflare`, `@tailwindcss/vite` |
| Dev dep in prod | 1 | `postgres` (via `scripts/seed.ts`) |
| Unused component props | 4 | `AppLayout` (title, description, backHref), `NavBtn` (class) |
| Duplicate clones | 7 groups | All in generated `src/db/schema.ts` |

### Code fixes

| Finding | Fix |
| --- | --- |
| `src/components/ui/Btn.astro` | **Delete** — empty file, zero imports |
| `AppLayout.astro` unused `title` | Pass `title` prop to `BaseLayout` |
| `BaseLayout.astro` | Add optional `title?: string` prop; use when provided, else keep URL-derived default |
| `AppLayout.astro` unused `description`, `backHref` | **Remove** from `Props` interface (no consumers) |
| `NavBtn.astro` unused `class` | Destructure `class` from props; merge into `className` on `<a>` |

Pages already pass `title` to `AppLayout` (`index.astro`, `games/index.astro`, `profile/index.astro`, `statistics/index.astro`) — wiring completes the existing contract.

### Config: `app/.fallowrc.jsonc` (new)

```jsonc
{
  "$schema": "https://fallow.tools/schema/config.json",
  "entry": [
    "neon.ts",
    "astro.config.mjs",
    "scripts/seed.ts"
  ],
  "ignoreDependencies": [
    "@astrojs/alpinejs",
    "@astrojs/cloudflare",
    "@tailwindcss/vite"
  ],
  "duplicates": {
    "ignore": ["src/db/schema.ts"]
  }
}
```

| Setting | Purpose |
| --- | --- |
| `entry` | `neon.ts` → resolves `src/lib/env.ts` as reachable; `astro.config.mjs` → Astro integrations traced; `scripts/seed.ts` → tooling entry for `postgres` |
| `ignoreDependencies` | Astro integrations consumed via config file, not static app imports |
| `duplicates.ignore` | `src/db/schema.ts` is generated by `drizzle-kit introspect` — clone groups are expected |

`postgres` remains in `devDependencies` (correct semantics for a seed-only driver). If fallow still flags it after entry config, add an explicit boundary rule during implementation.

### Validation (fallow)

```sh
cd app
npx fallow    # 0 dead-code failures, 0 dupe failures
astro check   # 0 errors
```

---

## Section 3 — Execution Order and Success Criteria

### Execution order

```
1. Convert 12 migration files (manual, one at a time, 0001 → 0012)
2. Update migration docs (03-Migrations.md, 11-Neon-Integration.md, database/README.md)
3. Fallow code fixes (AppLayout, BaseLayout, NavBtn; delete Btn.astro)
4. Add app/.fallowrc.jsonc
5. Run full validation chain
```

Migrations first — `db:introspect` requires a migrated database. Fallow is independent but runs last in `validate:app`.

### Full success criteria

| Check | Expected |
| --- | --- |
| `npm run db:status` | 12 pending (empty dev) or all applied |
| `npm run db:migrate` | Exit 0; all 12 applied |
| `npm run db:rollback` | Smoke-test: 0012 down succeeds |
| `npm run db:migrate` | Re-apply 0012 |
| `npm run db:seed` | Exit 0; idempotent |
| `npm run db:introspect` | No meaningful `schema.ts` drift |
| `npx fallow` | Exit 0; no dead-code or dupe failures |
| `astro check` | 0 errors |
| `npm run validate:app` | Full chain green |

### Risk mitigations

| Risk | Mitigation |
| --- | --- |
| `0007` down blocks miss a constraint | Grep all `ADD CONSTRAINT` in up; verify 1:1 in down |
| `0011` index swap order wrong | Down re-creates dropped indexes before dropping new ones |
| `postgres` still flagged by fallow | Add boundary rule in `.fallowrc.jsonc` during implementation |
| Introspect produces schema drift | Diff `schema.ts` before/after migrate; commit only if unchanged |
| dbmate + extension DDL | `CREATE EXTENSION` is transactional in PG; no special handling needed |

### Scope boundaries

**In scope:**

- 12 migration file conversions
- 3 documentation file updates
- 4 component file edits + 1 file deletion
- 1 new `.fallowrc.jsonc`
- Full `validate:app` verification

**Out of scope:**

- `package.json` script changes
- CI pipeline implementation
- fallow pre-commit hooks
- `src/db/relations.ts` (not flagged as failure)
- fallow health/MI informational scores

---

## Files Changed (summary)

| Action | Path |
| --- | --- |
| Modify | `architecture/docs/database/migrations/0001_extensions.sql` |
| Modify | `architecture/docs/database/migrations/0002_reference_tables.sql` |
| Modify | `architecture/docs/database/migrations/0003_players.sql` |
| Modify | `architecture/docs/database/migrations/0004_templates.sql` |
| Modify | `architecture/docs/database/migrations/0005_runtime_core.sql` |
| Modify | `architecture/docs/database/migrations/0006_runtime_events.sql` |
| Modify | `architecture/docs/database/migrations/0007_constraints.sql` |
| Modify | `architecture/docs/database/migrations/0008_indexes.sql` |
| Modify | `architecture/docs/database/migrations/0009_views.sql` |
| Modify | `architecture/docs/database/migrations/0010_configuration_templates.sql` |
| Modify | `architecture/docs/database/migrations/0011_ordering_and_uniqueness.sql` |
| Modify | `architecture/docs/database/migrations/0012_session_write_idempotency.sql` |
| Modify | `architecture/docs/architecture/05-Database/03-Migrations.md` |
| Modify | `architecture/docs/architecture/05-Database/11-Neon-Integration.md` |
| Modify | `architecture/docs/database/README.md` |
| Modify | `app/src/layouts/AppLayout.astro` |
| Modify | `app/src/layouts/BaseLayout.astro` |
| Modify | `app/src/components/layout/NavBtn.astro` |
| Delete | `app/src/components/ui/Btn.astro` |
| Create | `app/.fallowrc.jsonc` |

---

## Relationship to Prior Work

This spec unblocks the validation gate left open by `2026-07-09-neon-db-integration-implementation.md` Task 8. Implementation should run in the `neon-db-integration` worktree branch (`neon-db-integration-sdd`) and merge after `validate:app` is green.

No changes to the Neon integration architecture decisions (schema authority, Drizzle introspect-only, dbmate runner, Neon Auth) — this is a format/tooling alignment pass.
