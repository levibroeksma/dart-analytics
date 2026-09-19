---
name: validate-app
description: Use before claiming any app/ change done — runs the Dart Analytics validate:app sequence (db:status, db:migrate, db:drift, db:introspect, fallow gate, tests, astro check, graph refresh) and states when to also run it mid-task.
---

# Validate App

The sole validation procedure for `app/` changes:

```bash
cd app && npm run validate:app
```

This executes, in order: `db:status` → `db:migrate` → `db:drift` → `db:introspect` → `bash ../scripts/fallow-gate.sh` → `npm test` → `npm run check` (`rm -rf .astro && astro check --minimumFailingSeverity hint`) → `bash ../scripts/refresh-graph.sh` (warns instead of failing when the graphify CLI is absent; nothing to record and nothing to stage either way — graph freshness is CI-owned per D185 and D287, and `.github/workflows/graph.yml` rebuilds it on merge to `main`). Seeding (`npm run db:seed`) is environment provisioning, not validation — see `docs/architecture/05-Database/11-Neon-Integration.md`.

**Definition of done for the type gate:** `npm run check` must report **0 errors, 0 warnings, 0 hints**. It is run with `--minimumFailingSeverity hint`, so an unused import, an unread parameter, or any other hint-level diagnostic exits non-zero and the job is not finished. Delete the dead declaration; do not silence it. CI runs the same script (`quality.yml`, Type gate). (2026-08-21)

**When the drift gate fails:** `npm run db:drift` compares `schema_migrations` to `database/migrations/` in both directions, and the live `v_*` views to the ones the chain's `migrate:up` regions leave behind. It stops the chain *before* `db:introspect`, which would otherwise rewrite `app/src/db/schema.ts` from the drifted database — the committed schema then loses views the code reads, and the suite stays green because it mocks the query builder. `dbmate status` cannot report this: it enumerates files, so an applied version with no file prints nothing and `Pending: 0` still shows. An applied version this checkout has no file for came from another branch — roll it back or land that branch; never add a migration to paper over it. (2026-09-19, D333, #503)

**When the fallow gate fails:** read the block the wrapper prints *after* fallow's own output. fallow's `Failed: … health (N above threshold): start with <file>` line does not name the violating file — "start with" names entry 1 of its ROI-ranked `Refactoring targets` list, which is computed independently of the gate and routinely names a file that breached nothing. `scripts/fallow-gate.sh` re-runs `npx fallow health --format json` on failure and prints the `findings` array's real file, function, line and breached threshold. Never chase the "start with" filename. (2026-09-19, D332, #292)

**Mid-task gate (multi-step / multi-commit work):** a focused vitest file going green is not enough to claim a task done when the change touches services, repositories, middleware, or shared client API code. Before that claim, also run `bash ../scripts/fallow-gate.sh` and `npm run check` and fix any new failures they surface — plan-faithful code can still leave type or maintainability gates red. The full sequence above remains the completion bar for the whole change set.
