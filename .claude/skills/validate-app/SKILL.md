---
name: validate-app
description: Use before claiming any app/ change done — runs the Dart Analytics validate:app sequence (db:status, db:migrate, db:introspect, fallow, tests, astro check, graph refresh) and states when to also run it mid-task.
---

# Validate App

The sole validation procedure for `app/` changes:

```bash
cd app && npm run validate:app
```

This executes, in order: `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `npm test` → `npm run check` (`rm -rf .astro && astro check --minimumFailingSeverity hint`) → `bash ../scripts/refresh-graph.sh` (warns instead of failing when the graphify CLI is absent; nothing to record and nothing to stage either way — graph freshness is CI-owned per D185, and `.github/workflows/graph.yml` rebuilds it on merge to `main`). Seeding (`npm run db:seed`) is environment provisioning, not validation — see `docs/architecture/05-Database/11-Neon-Integration.md`.

**Definition of done for the type gate:** `npm run check` must report **0 errors, 0 warnings, 0 hints**. It is run with `--minimumFailingSeverity hint`, so an unused import, an unread parameter, or any other hint-level diagnostic exits non-zero and the job is not finished. Delete the dead declaration; do not silence it. CI runs the same script (`quality.yml`, Type gate). (2026-08-21)

**Mid-task gate (multi-step / multi-commit work):** a focused vitest file going green is not enough to claim a task done when the change touches services, repositories, middleware, or shared client API code. Before that claim, also run `npx fallow` and `npm run check` and fix any new failures they surface — plan-faithful code can still leave type or maintainability gates red. The full sequence above remains the completion bar for the whole change set.
