# Desktop Handoff — Read-Model Normalization + API Response Contracts

> **Date:** 2026-07-12
> **Branch:** `response-shape-decisions`
> **State at handoff:** both cycles implemented and reviewed in-branch; **not merged, no PR.** The steps below are the parts that require a **Neon-connected desktop** (DB apply, type generation, behaviour smoke) — they were deliberately deferred because this environment has no database or `node_modules`.

---

## What is already done on the branch

Two cycles, each brainstorm → spec → plan → subagent-driven execution → review, all committed and pushed:

**Cycle 1 — DB read-model normalization**
- `0013_normalize_read_model_views.sql` — all five views normalized to `*_key`/`*_name`, internal lookup ids dropped, `ruleset_version_key` added to `v_active_sessions`.
- DB handbook docs, naming standard, chain cascade to `0013`, `DECISIONS` D27.

**Cycle 2 — API response contracts & v1 freeze**
- `0014_dart_analytics_session_scope.sql` — adds `session_id` to `v_dart_analytics` so `GET /sessions/:id/darts` is view-filterable.
- `06-API/04` — camelCase response DTOs (`SessionActive`, `SessionOverview`, `ReplayEntry`, `DartAnalytics`, `RoutineSummary`, `RoutineStep`, `RoutineExecution`, `BatchWriteResponse`); read shapes corrected (`active`/`replay`/`darts` → arrays); frozen `1.0.0`.
- `06-API/03` — snake→camel response-DTO mapping convention; frozen `1.0.0`. `00` notes the freeze (`1.2.0`).
- Provision code (`app/src/repositories/player.repository.ts`, `services/player.service.ts`, `pages/api/players/provision.ts`) returns `{ playerId, authUserId, created }` via the Postgres `xmax` upsert trick.
- Chain cascade to `0014`, `DECISIONS` D65/D28, context map `1.0.4`.

`scripts/check-context-map.sh` passes. Final whole-branch review: **Ready to merge.**

---

## Desktop steps to complete (run these on the Neon-connected machine)

All from `app/` after pulling `response-shape-decisions`. Requires the Neon **dev-branch** `DATABASE_URL` (+ `DATABASE_URL_POOLED` for dbmate) in `app/.env`, and `npm install` done.

```bash
git checkout response-shape-decisions && git pull
cd app
npm install                     # if not already

# 1. Confirm 0013 and 0014 are pending
npm run db:status               # expect: 0013_… and 0014_… pending

# 2. Apply both migrations (normalize views, then session-scope v_dart_analytics)
npm run db:migrate

# 3. Regenerate the Drizzle types from the new views (DO commit the result)
drizzle-kit introspect
git add src/db/schema.ts && git commit -m "chore(db): re-introspect schema after 0013/0014"

# 4. Confirm no stale types + the app typechecks (this is the provision-code gate)
npx fallow
npx astro check

# 5. Behaviour smoke for the provision fix (needs the live DB)
#    Call POST /api/players/provision twice for a brand-new auth user:
#      first  → { playerId, authUserId, created: true }
#      second → { playerId, authUserId, created: false }
#    Body must be exactly those three fields (no displayName / timestamps).
```

### Sanity checks (optional but recommended)
```sql
-- normalized columns present, no internal lookup ids leaked
SELECT * FROM v_active_sessions   LIMIT 1;   -- has ruleset_version_key, no *_id lookups
SELECT * FROM v_session_overview  LIMIT 1;   -- game_type_key/name, status_key, duration_seconds
-- 0014: session-scoped darts
SELECT session_id FROM v_dart_analytics LIMIT 1;   -- column exists
```

### Rollback (if needed)
```bash
npm run db:rollback   # runs 0014 down (restores 0013 v_dart_analytics)
npm run db:rollback   # again → 0013 down (restores original 0009 views)
```

---

## Why these steps aren't done here

- **No database in the agent environment** → `db:migrate`, `drizzle-kit introspect`, and the provision behaviour smoke can't run. The migrations and all docs/code are authored and reviewed; only application + type-generation + live-DB verification remain.
- **No `node_modules`** → `astro check` couldn't run in-session. The provision TypeScript was type-reviewed by reading (imports resolve, `sql<string>\`xmax::text\`` makes `row.xmax === "0"` sound); `astro check` on desktop is the real confirmation, and it is only meaningful **after** step 3 regenerates `schema.ts` (so `v_dart_analytics.sessionId` and the provision `.returning` columns exist in the generated types).
- **`app/src/db/schema.ts` is generated** — never hand-edited in-branch; step 3 regenerates it. It is currently stale relative to `0013`/`0014` until you run introspect.

---

## Explicitly NOT in scope (future work)

- **Read endpoint implementation** — the response contracts are frozen, but no read repositories/handlers were built (only `provision`). That is a later backend cycle.
- **Frontend** — none. The frozen `03`/`04` contracts are the foundation the frontend architecture builds on next.
- **Statistics endpoints** — still deferred post-v1; `v_dart_analytics.player_id` is retained for that future player-global work.
- **Minor cosmetics** (non-blocking): the new `04` DTO sketches omit the `type X = z.infer<>` alias lines used elsewhere in the file (they become real types in `types.ts` during the backend cycle); a `provision.ts` comment names `ProvisionPlayerResponse` (a doc-only Zod sketch).

---

## When ready to open the PR

Base `main` ← `response-shape-decisions`. Suggest committing the desktop `schema.ts` re-introspect (step 3) into the same branch first, so the PR carries the regenerated types. Use the repo PR template.
