# Statistics Phase 6a — Routine Statistics Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the SQL half of rollout phase 6: one migration adding `v_stats_routine_run_facts` and `v_stats_routine_step_facts`, its verification script, the regenerated `schema.ts`, and the database docs. The plan ends at a PR. Merging it lets the `deploy` workflow apply the migration to production. Phase 6b (`2026-09-26-statistics-phase-6b-routine-statistics.md`) then starts from the new `main`.

**Architecture:** Two owner-scoped views derive routine and step identity from the `activity_configurations` snapshot and never reference a template. The identity rules are phase 6b's decisions 1–3 (recorded as D372 there); this plan's migration header states them:
1. `routine_key = configuration ->> 'routineTemplateId'`; a snapshot without it keys as `'name-' || md5(routineName)`.
2. `step_key = <sequenceNumber>-<md5((step - 'sequenceNumber')::text)>`; the element is found by `sequenceNumber`, not array position.
3. Two views; `v_stats_session_facts` stays game-only. Both views keep phase 1's rule-free, integer-cast `LATERAL` counts over the owning participant.

**Tech Stack:** PostgreSQL (Neon; local PostgreSQL 16 for introspection), dbmate, Drizzle Kit, Vitest.

**Spec:** `docs/architecture/10-Statistics/00-Overview.md` §8, §10 (canonical); `09-Training/01-Routines.md` §11, §18 and `05-Database/06-Spec/04-Runtime-Layer.md` §`activity_configurations` for the snapshot. The split follows phase 1a (`2026-09-26-statistics-phase-1a-database.md`, §Why the split).

**Prerequisite:** Phases 1–5 are merged.

## Global Constraints

- Migration number: the next free one after phase 5's (`0045` unless taken). Written here as `NNNN`. Never edit an applied migration. The D344 carve-out applies only with `db:status` and `db:status:prod` both reporting it pending; while this PR is open and undeployed, `NNNN` is ordinary new work on this branch.
- `app/src/db/schema.ts` is generated. Never hand-edit it.
- No exercise rule in SQL. Statistics are never persisted.
- The snapshot is read, never trusted blindly: a step element with a missing or non-integer `sequenceNumber` yields no row, and the verification script proves it.
- `npm run format` before every commit.
- Branch: `feat/statistics-routines-db` from `main` after phase 5 has merged.
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.
- No decision id is taken here; D372 is recorded in 6b.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Create | `database/migrations/NNNN_stats_routine_views.sql` | the two views |
| Create | `database/verification/NNNN_stats_routine_views_checks.sql` | live-DB assertions (D193) |
| Regenerate | `app/src/db/schema.ts` | `vStatsRoutineRunFacts`, `vStatsRoutineStepFacts` |
| Docs | Task 4 list | |

---

### Task 1: Verification script

**Files:**
- Create: `database/verification/NNNN_stats_routine_views_checks.sql`

- [ ] **Step 1: Write it first** (fixture pattern: `0023_owner_scoped_dart_view_checks.sql` and phase 1a's `0043` checks, ending in `ROLLBACK`). It asserts:
  1. A completed training with a snapshot carrying `routineTemplateId` and three steps (Warm-Up, Switching, a `SCORE_TRAINING_V1` game) → one run row, `step_count = 3`, `steps_completed = 3`, `routine_key` equal to the template id.
  2. A snapshot without `routineTemplateId` → `routine_key = 'name-' || md5(routineName)`.
  3. Step rows: three, with the Warm-Up's `input_mode_key` null and the game step's `game_type_key` set. `step_key` is `sequenceNumber || '-' || md5(...)`.
  4. Two runs whose step 2 differs only in configuration → two `step_key` values at `sequence_number = 2`. Two identical runs → one.
  5. An activity abandoned with zero step sessions → one run row, `steps_started = 0`.
  6. An `ACTIVE` activity and an `ACTIVE` step session → absent.
  7. A standalone game (no snapshot) → absent from both views and still present in `v_stats_session_facts`.
  8. `dart_count` counts the owner participant only.
  9. A step whose `sequenceNumber` has no matching snapshot element → absent.
- [ ] **Step 2: Commit.** `test(db): routine statistics view verification`

---

### Task 2: Migration — routine fact views

**Files:**
- Create: `database/migrations/NNNN_stats_routine_views.sql`

**Interfaces:**
- `v_stats_routine_run_facts`, one row per `COMPLETED` or `ABANDONED` activity that has an `activity_configurations` row. Columns:
  - `activity_id`, `player_id`
  - `routine_key`, `routine_template_id` (nullable), `routine_name`
  - `status_key`, `started_at`, `completed_at`, `duration_seconds`
  - `step_count` (`jsonb_array_length(configuration -> 'steps')`), `steps_started`, `steps_completed`, `dart_count`
- `v_stats_routine_step_facts`, one row per `COMPLETED` or `ABANDONED` exercise session whose activity has a snapshot and whose `routine_step_sequence_number` is not null. Columns:
  - `session_id`, `activity_id`, `player_id`
  - `routine_key`, `routine_name`
  - `sequence_number`, `step_fingerprint`, `step_key`, `step` (the snapshot element)
  - `exercise_type_key`, `exercise_ruleset_version_key`, `game_type_key`, `ruleset_version_key`, `input_mode_key` (the last four nullable)
  - `status_key`, `configuration` (the session's `exercise_configurations`)
  - `started_at`, `completed_at`, `duration_seconds`, `turn_count`, `counted_score`, `dart_count`
- The step element is found with a `LEFT JOIN LATERAL (SELECT e FROM jsonb_array_elements(ac.configuration -> 'steps') e WHERE e ->> 'sequenceNumber' = es.routine_step_sequence_number::text LIMIT 1)`. A session with no matching element is dropped by requiring the element to be non-null.
- Lookups `LEFT JOIN` wherever `0033` made the key nullable.
- Every count and sum is `::integer` (`migration-numeric-typing`); `duration_seconds` follows `0043`'s `FLOOR(EXTRACT(...))::integer`.
- The header comment states the identity rules above.
- `migrate:down` drops both views.

- [ ] **Step 1: Write the migration.**
- [ ] **Step 2: Commit.** `feat(db): routine statistics fact views (NNNN)`

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
mv ../database/migrations/NNNN_stats_routine_views.sql "$SCRATCH/"
npm run db:migrate:ci && npm run db:introspect
git diff --exit-code src/db/schema.ts
mv "$SCRATCH/NNNN_stats_routine_views.sql" ../database/migrations/
git status --short
```

**If the diff is not empty,** local introspection does not reproduce Neon's output. Restore with `git checkout -- src/db/schema.ts`, skip to Step 5, and ask the owner to run `npm run db:migrate && npm run db:introspect` on this branch against the dev database, then commit `schema.ts` before merging.

- [ ] **Step 3: Apply, seed, verify.**

```bash
npm run db:migrate:ci && npm run db:seed:ci
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/verification/NNNN_stats_routine_views_checks.sql
```

Every row `PASS`. On a failure, fix on this branch, roll back with `npx dbmate --no-dump-schema --migrations-dir ../database/migrations rollback`, then run Step 3 again.

- [ ] **Step 4: Introspect.** `npm run db:introspect`. `git diff src/db/schema.ts` shows only the two new `pgView` declarations.
- [ ] **Step 5: Stop the database.** `"$PGBIN/pg_ctl" -D "$SCRATCH/pg" stop`, `unset DATABASE_URL`.
- [ ] **Step 6: Suite.** `cd app && npm test`. `schema-view-drift` and `migration-numeric-typing` must pass. A flagged column gets its missing cast in `NNNN`; redo Steps 3–4.
- [ ] **Step 7: Commit.** `chore(db): regenerate schema.ts for NNNN`

---

### Task 4: Database docs

- `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md` and `05-Views/00-Overview.md`: both views. `03-Migrations.md`: an entry for `NNNN`.
- `docs/architecture/10-Statistics/00-Overview.md` §10: the two views, marked **built**. §12 stays open; 6b marks phase 6 done.
- `docs/CLAUDE.md` and `database/CLAUDE.md`: the migration range becomes `0001`–`NNNN` wherever it states the chain's extent. Root `CLAUDE.md`'s never-modify range is **not** moved here; 6b moves it after the deploy.

- [ ] **Step 1:** Make the edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Commit `docs(db): routine statistics views`.

---

### Task 5: Context maintenance, gates, PR

- [ ] **Step 1:** Run the `context-maintenance` skill: context map, File Inventory rows for the migration and verification files, history entry.
- [ ] **Step 2:** Run the `run-all-gates` skill for `database/` + `docs/`: the Always-run set, `check-constraint-mirror.sh`, `check-doc-sync.sh`. Report each result. `validate:app` needs `DATABASE_URL`; Task 3 stands in for its `db:migrate` / `db:introspect` / `npm test` steps, and the gap is named in the PR body.
- [ ] **Step 3:** Run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR). `db-rehearsal.yml` must run green on the PR. The PR body states: merging applies `NNNN` to production via `deploy.yml`; phase 6b starts after that deploy is green.

---

## Handoff to phase 6b

Phase 6b starts only when this PR is merged and the `deploy` run for its merge commit is green (`rehearse`, `migrate`, `deploy`). A red deploy is fixed with a new migration, never by editing `NNNN` once it is applied.

## Out of scope

- The query-plan measurement of the step- and run-facts filters: it needs real data, so it runs in 6b. A missing index lands as its own migration.
- Everything in the app, decision D372 and the API/frontend/training docs (phase 6b).
