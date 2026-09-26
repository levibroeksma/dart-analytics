# Statistics Phase 5a — Replay Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the SQL half of rollout phase 5: one migration that widens `v_game_replay` with `participant_id`, `participant_type_key`, `location_x` and `location_y`, its verification script, the regenerated `schema.ts`, and the database docs. The plan ends at a PR. Merging it lets the `deploy` workflow apply the migration to production. Phase 5b (`2026-09-26-statistics-phase-5b-replay.md`) then starts from the new `main`.

**Architecture:** `CREATE OR REPLACE VIEW` appends four columns to `v_game_replay`. Nothing in `app/` reads the view yet, and appending columns keeps its documented `ReplayEntry` contract valid. The view stays unfiltered by participant (`0023`'s rule). Why the view is widened rather than a sibling added, and why it gets no per-row `context_key`, is phase 5b's decision 1 (recorded as D371 there); this plan's migration header states it.

**Tech Stack:** PostgreSQL (Neon; local PostgreSQL 16 for introspection), dbmate, Drizzle Kit, Vitest.

**Spec:** `docs/architecture/10-Statistics/02-Replay.md` §3 and `00-Overview.md` §10 (canonical). The split follows phase 1a (`2026-09-26-statistics-phase-1a-database.md`, §Why the split): `schema.ts` ships with the migration because `schema-view-drift` fails `quality.yml`, which `deploy.yml` runs first.

**Prerequisite:** Phases 1–4 are merged.

## Global Constraints

- Migration number: the next free one, which is `0044` unless an earlier phase's measurement step took it. Written here as `NNNN`. Never edit an applied migration. The D344 carve-out applies only with `db:status` and `db:status:prod` both reporting it pending; while this PR is open and undeployed, `NNNN` is ordinary new work on this branch.
- `app/src/db/schema.ts` is generated. Never hand-edit it.
- No game rules in SQL.
- `npm run format` before every commit.
- Branch: `feat/statistics-replay-db` from `main` after phase 4 has merged.
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.
- No decision id is taken here; D371 is recorded in 5b.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Create | `database/migrations/NNNN_replay_view_coordinates.sql` | widen `v_game_replay` |
| Create | `database/verification/NNNN_replay_view_coordinates_checks.sql` | live-DB assertions (D193) |
| Regenerate | `app/src/db/schema.ts` | `vGameReplay` gains four columns |
| Docs | Task 4 list | |

---

### Task 1: Verification script

**Files:**
- Create: `database/verification/NNNN_replay_view_coordinates_checks.sql`

- [ ] **Step 1: Write it first** (fixture pattern: `0023_owner_scoped_dart_view_checks.sql`, lookups by `implementation_key`, ending in `ROLLBACK`). It asserts:
  1. A VISUAL_BOARD dart returns its `location_x`/`location_y` unchanged.
  2. A bounce-out dart (NULL location) returns NULL for both.
  3. A turn-total-only turn returns one row with NULL dart columns and a non-null `participant_id`.
  4. PLAYER, GUEST and DARTBOT participants each appear with their `participant_type_key`.
  5. Row count per session equals that of the `0016` definition, computed inline as a CTE. The widening adds columns, never rows.
- [ ] **Step 2: Commit.** `test(db): replay view coordinates verification`

---

### Task 2: Migration — widen `v_game_replay`

**Files:**
- Create: `database/migrations/NNNN_replay_view_coordinates.sql`

**Interfaces:**
- `migrate:up`: `CREATE OR REPLACE VIEW v_game_replay AS` the exact `0016` select list, followed by `p.id AS participant_id, pt.implementation_key AS participant_type_key, d.location_x, d.location_y`, with `JOIN participant_types pt ON pt.id = p.participant_type_id` added. A `COMMENT ON VIEW` names the new columns.
- `migrate:down`: `DROP VIEW v_game_replay` and recreate the `0016` definition verbatim, because `CREATE OR REPLACE` cannot drop columns.
- The header comment states why the view is widened rather than a sibling added (no `app/` reader; `0023`'s check counts rows, which the widening keeps), and why there is no `context_key` (a session fact, derived once in `v_stats_session_facts`).

- [ ] **Step 1: Write the migration.** Diff its select list against `0016` line by line: the first 15 columns are identical.
- [ ] **Step 2: Commit.** `feat(db): replay view carries participant and coordinates (NNNN)`

---

### Task 3: Apply locally, verify, introspect

**Files:**
- Regenerate: `app/src/db/schema.ts`

Same procedure as phase 1a Task 3. `$SCRATCH` is the session's scratchpad; the database is never committed.

- [ ] **Step 1: Start a throwaway PostgreSQL 16.**

```bash
PGBIN=/usr/lib/postgresql/16/bin
"$PGBIN/initdb" -D "$SCRATCH/pg" -U postgres --auth=trust
"$PGBIN/pg_ctl" -D "$SCRATCH/pg" -o "-p 54329 -k $SCRATCH" -l "$SCRATCH/pg.log" start
export DATABASE_URL="postgres://postgres@localhost:54329/dart_local?sslmode=disable"
cd app && npm ci
```

`DATABASE_URL` is exported in the shell only. Never write it to `app/.env`.

- [ ] **Step 2: Prove the method on the unchanged chain.**

```bash
mv ../database/migrations/NNNN_replay_view_coordinates.sql "$SCRATCH/"
npm run db:migrate:ci && npm run db:introspect
git diff --exit-code src/db/schema.ts
mv "$SCRATCH/NNNN_replay_view_coordinates.sql" ../database/migrations/
git status --short
```

**If the diff is not empty,** local introspection does not reproduce Neon's output. Restore with `git checkout -- src/db/schema.ts`, skip to Step 5, and ask the owner to run `npm run db:migrate && npm run db:introspect` on this branch against the dev database, then commit `schema.ts` before merging.

- [ ] **Step 3: Apply, seed, verify.**

```bash
npm run db:migrate:ci && npm run db:seed:ci
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/verification/NNNN_replay_view_coordinates_checks.sql
```

Every row `PASS`. On a failure, fix on this branch, roll back with `npx dbmate --no-dump-schema --migrations-dir ../database/migrations rollback`, then run Step 3 again.

- [ ] **Step 4: Introspect.** `npm run db:introspect`. `git diff src/db/schema.ts` shows only the four new `vGameReplay` columns.
- [ ] **Step 5: Stop the database.** `"$PGBIN/pg_ctl" -D "$SCRATCH/pg" stop`, `unset DATABASE_URL`.
- [ ] **Step 6: Suite.** `cd app && npm test`. `schema-view-drift` and `migration-numeric-typing` must pass. The coordinates stay NUMERIC; 5b parses them in the repository.
- [ ] **Step 7: Commit.** `chore(db): regenerate schema.ts for NNNN`

---

### Task 4: Database docs

- `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md` §`v_game_replay`: the four new columns and the `participant_types` source. Also `05-Views/00-Overview.md` if it lists columns, and `03-Migrations.md` with an entry for `NNNN`.
- `docs/architecture/10-Statistics/00-Overview.md` §10: the replay bullet resolved (widened, no per-row `context_key`). §12 stays open; 5b marks phase 5 done.
- `docs/CLAUDE.md` and `database/CLAUDE.md`: the migration range becomes `0001`–`NNNN` wherever it states the chain's extent. Root `CLAUDE.md`'s never-modify range is **not** moved here; 5b moves it after the deploy.

- [ ] **Step 1:** Make the edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Commit `docs(db): replay view columns`.

---

### Task 5: Context maintenance, gates, PR

- [ ] **Step 1:** Run the `context-maintenance` skill: context map, File Inventory rows for the migration and verification files, history entry.
- [ ] **Step 2:** Run the `run-all-gates` skill for `database/` + `docs/`: the Always-run set, `check-constraint-mirror.sh`, `check-doc-sync.sh`. Report each result. `validate:app` needs `DATABASE_URL`; Task 3 stands in for its `db:migrate` / `db:introspect` / `npm test` steps, and the gap is named in the PR body.
- [ ] **Step 3:** Run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR). `db-rehearsal.yml` must run green on the PR. The PR body states: merging applies `NNNN` to production via `deploy.yml`; phase 5b starts after that deploy is green.

---

## Handoff to phase 5b

Phase 5b starts only when this PR is merged and the `deploy` run for its merge commit is green (`rehearse`, `migrate`, `deploy`). A red deploy is fixed with a new migration, never by editing `NNNN` once it is applied.

## Out of scope

- The query-plan measurement of the replay page query: it measures 5b's repository query against real data, so it runs in 5b.
- Everything in the app, decision D371 and the API/frontend docs (phase 5b).
