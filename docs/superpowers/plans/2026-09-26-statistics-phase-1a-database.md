# Statistics Phase 1a — Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the SQL half of rollout phase 1: migration `0043` (two base views + date-range index), its verification script, the regenerated `schema.ts`, and the database docs. The plan ends at a PR. Merging it lets the `deploy` workflow apply `0043` to production (`migrate` job, after `db-rehearsal`). Phase 1b (`2026-09-26-statistics-phase-1b-foundation.md`) then starts from the new `main`.

**Architecture:** Migration `0043` adds `v_stats_session_facts` (one row per terminal game session, owner-scoped, with rule-free turn/dart/score counts and a derived `context_key`), `v_stats_dart_facts` (one row per `VISUAL_BOARD` dart; no consumer until phase 2), and the date-range index. No app code reads them in this plan.

**Tech Stack:** PostgreSQL (Neon; local PostgreSQL 16 for introspection), dbmate, Drizzle Kit, Vitest.

**Spec:** `docs/architecture/10-Statistics/00-Overview.md` §10 (canonical); brainstorm record `docs/superpowers/specs/2026-09-26-statistics-pages-architecture-design.md`.

## Why the split

Phase 1 used to stop at the migration step and wait for the owner to run `db:migrate && db:introspect`. Production migration is the `deploy` workflow's job on merge, so the SQL lands on its own PR and the app work (1b) starts after it is deployed.

One thing still has to ship with the migration: `app/tests/db/schema-view-drift.test.ts` fails unless `schema.ts` declares a `pgView` for every view the chain creates, and `quality.yml` (which `deploy.yml` runs first) runs `npm test`. So `schema.ts` is regenerated in this plan, from a throwaway local PostgreSQL that the chain is applied to (Task 3). That is still generated output, never a hand edit. The method proves itself first: introspecting the unchanged chain must reproduce the committed `schema.ts` byte for byte.

## Global Constraints

- Never modify an applied migration (`0001`–`0042`). `0043` may be corrected in place only under D344 (both `db:status` and `db:status:prod` report it pending). A session with no `DATABASE_URL` cannot run that proof, but while the PR is open `0043` is unmerged and the deploy has not run, so fixing it on this branch before merge is the ordinary edit of new work.
- `app/src/db/schema.ts` is generated. Never hand-edit it.
- Statistics are never persisted. The views compute, nothing stores.
- No game rules in SQL (`05-Database/05-Views/00-Overview.md` §Business Logic).
- `npm run format` before every commit; `npm run format:check` clean.
- Branch: `feat/statistics-foundation-db`, cut from `main` once the architecture branch (`claude/stats-pages-architecture-4vapgh`) has merged. If it has not, cut it from that branch (the stack cap allows one level).
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.
- No decision id is taken here. The views implement D364; phase 1's plan-level decisions are recorded as D367 in 1b.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Create | `database/migrations/0043_stats_base_views.sql` | the two base views + index |
| Create | `database/verification/0043_stats_base_views_checks.sql` | live-DB assertions (D193) |
| Regenerate | `app/src/db/schema.ts` | `vStatsSessionFacts`, `vStatsDartFacts` |
| Docs | Task 5 list | |

---

### Task 1: Migration `0043` — base views and index

**Files:**
- Create: `database/migrations/0043_stats_base_views.sql`

- [ ] **Step 1: Read the rules.** `database/CLAUDE.md` (numbering, header, index rationale, `migrate:down`) and `docs/architecture/05-Database/05-Views/00-Overview.md` (§Business Logic: no game rules in SQL).

- [ ] **Step 2: Write the migration.**

```sql
-- ============================================================
-- Migration: 0043_stats_base_views.sql
--
-- Purpose:
-- Base fact views for the detailed statistics pages
-- (docs/architecture/10-Statistics/00-Overview.md §10, D364).
--
-- v_stats_session_facts: one row per COMPLETED or ABANDONED
-- game session, owner-scoped. Counts are rule-free reductions
-- over the owning participant's turns and darts. context_key is
-- derived, never stored: ROUTINE when the session's activity
-- has an activity_configurations snapshot, else STANDALONE.
-- Turn and dart aggregates are separate LATERAL subqueries so
-- neither fans the other out. COUNT/SUM are cast to integer so
-- node-postgres does not deliver NUMERIC strings.
--
-- v_stats_dart_facts: one row per VISUAL_BOARD dart with
-- coordinates, owner-scoped, carrying the session columns every
-- board/intent section filters on. Consumed from phase 2.
--
-- idx_exercise_sessions_player_game_completed: the date-range
-- entry point every statistics query takes.
-- ============================================================

-- migrate:up
CREATE VIEW v_stats_session_facts AS
SELECT es.id AS session_id,
    es.player_id,
    es.activity_id,
    gt.implementation_key AS game_type_key,
    rv.implementation_key AS ruleset_version_key,
    im.implementation_key AS input_mode_key,
    gs.implementation_key AS status_key,
    CASE WHEN ac.activity_id IS NULL THEN 'STANDALONE' ELSE 'ROUTINE' END AS context_key,
    es.routine_step_sequence_number,
    ec.configuration,
    es.started_at,
    es.completed_at,
    FLOOR(EXTRACT(EPOCH FROM (es.completed_at - es.started_at)))::integer AS duration_seconds,
    COALESCE(tf.turn_count, 0) AS turn_count,
    COALESCE(tf.counted_score, 0) AS counted_score,
    COALESCE(df.dart_count, 0) AS dart_count
FROM exercise_sessions es
    JOIN game_types gt       ON gt.id = es.game_type_id
    JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN input_modes im      ON im.id = es.input_mode_id
    JOIN game_statuses gs    ON gs.id = es.status_id
    LEFT JOIN activity_configurations ac ON ac.activity_id = es.activity_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS turn_count,
            SUM(t.total_score)::integer AS counted_score
        FROM turns t
            JOIN participants p     ON p.id = t.participant_id
            JOIN exercise_stages st ON st.id = t.exercise_stage_id
        WHERE st.exercise_session_id = es.id
            AND p.player_id = es.player_id
    ) tf ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS dart_count
        FROM darts d
            JOIN turns t            ON t.id = d.turn_id
            JOIN participants p     ON p.id = t.participant_id
            JOIN exercise_stages st ON st.id = t.exercise_stage_id
        WHERE st.exercise_session_id = es.id
            AND p.player_id = es.player_id
    ) df ON TRUE
WHERE gs.implementation_key IN ('COMPLETED', 'ABANDONED');
COMMENT ON VIEW v_stats_session_facts IS 'One row per terminal game session (owning player only) with rule-free turn/dart/score counts and derived context_key (ROUTINE when the activity has an activity_configurations snapshot). Statistics phase 1, D364.';

CREATE VIEW v_stats_dart_facts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    rv.implementation_key AS ruleset_version_key,
    gs.implementation_key AS status_key,
    CASE WHEN ac.activity_id IS NULL THEN 'STANDALONE' ELSE 'ROUTINE' END AS context_key,
    es.completed_at,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.score,
    d.location_x,
    d.location_y
FROM darts d
    JOIN turns t              ON t.id = d.turn_id
    JOIN participants p       ON p.id = t.participant_id
    JOIN exercise_stages st   ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt        ON gt.id = es.game_type_id
    JOIN ruleset_versions rv  ON rv.id = es.ruleset_version_id
    JOIN input_modes im       ON im.id = es.input_mode_id
    JOIN game_statuses gs     ON gs.id = es.status_id
    LEFT JOIN activity_configurations ac ON ac.activity_id = es.activity_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
WHERE im.implementation_key = 'VISUAL_BOARD'
    AND gs.implementation_key IN ('COMPLETED', 'ABANDONED')
    AND d.location_x IS NOT NULL
    AND d.location_y IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_stats_dart_facts IS 'One row per VISUAL_BOARD dart with coordinates in a terminal game session (owning player only), with the session columns statistics sections filter on. Statistics phase 1, D364.';

CREATE INDEX idx_exercise_sessions_player_game_completed
    ON exercise_sessions (player_id, game_type_id, completed_at DESC);

-- migrate:down
DROP INDEX IF EXISTS idx_exercise_sessions_player_game_completed;
DROP VIEW IF EXISTS v_stats_dart_facts;
DROP VIEW IF EXISTS v_stats_session_facts;
```

Confirm three facts against the spec before committing: the column name `routine_step_sequence_number`, the unique `activity_configurations.activity_id` (no fan-out), and the unique `exercise_configurations.exercise_session_id` (`0037`). All three are in `05-Database/06-Spec/04-Runtime-Layer.md`. If a fact differs, fix the SQL rather than the doc.

- [ ] **Step 3: Commit.** `feat(db): statistics base views and date-range index (0043)`

---

### Task 2: Verification script

**Files:**
- Create: `database/verification/0043_stats_base_views_checks.sql`

- [ ] **Step 1: Write it.** Mirror `database/verification/0023_owner_scoped_dart_view_checks.sql`: one transaction ending in `ROLLBACK`, lookups by `implementation_key`, a `verification_results` temp table, every row `PASS`. Fixtures and checks:
  1. A completed standalone 501 `VISUAL_BOARD` session with 2 player turns (3 darts each, totals 60 and 45) and 1 DartBot turn. Assert `turn_count = 2`, `dart_count = 6`, `counted_score = 105`, `context_key = 'STANDALONE'`.
  2. The same session shape under an activity with an `activity_configurations` row → `context_key = 'ROUTINE'`, and still exactly one row (no fan-out).
  3. An abandoned session with zero turns → one row, `turn_count = 0`, `dart_count = 0`, `counted_score = 0`.
  4. An `ACTIVE` session → absent from both views.
  5. A training exercise session (NULL `game_type_id`) → absent.
  6. `v_stats_dart_facts` returns 6 rows for fixture 1 (not the DartBot's), and none for a `QUICK_SCORE` session.
  7. `pg_indexes` contains `idx_exercise_sessions_player_game_completed`.

  It runs for real in Task 3 against the local database (chain + seeds applied).

- [ ] **Step 2: Commit.** `test(db): 0043 statistics base view verification`

---

### Task 3: Apply locally, verify, introspect

**Files:**
- Regenerate: `app/src/db/schema.ts`

The local database is scratch: it lives in the session's scratchpad, is never committed, and is stopped at the end of the task. `$SCRATCH` below is the session's scratchpad directory.

- [ ] **Step 1: Start a throwaway PostgreSQL 16.**

```bash
PGBIN=/usr/lib/postgresql/16/bin
"$PGBIN/initdb" -D "$SCRATCH/pg" -U postgres --auth=trust
"$PGBIN/pg_ctl" -D "$SCRATCH/pg" -o "-p 54329 -k $SCRATCH" -l "$SCRATCH/pg.log" start
export DATABASE_URL="postgres://postgres@localhost:54329/dart_local?sslmode=disable"
cd app && npm ci
```

`DATABASE_URL` is exported in the shell only. Never write it to `app/.env`.

- [ ] **Step 2: Prove the method on the unchanged chain.** Move `0043` aside, apply `0001`–`0042`, introspect, and require an empty diff:

```bash
mv ../database/migrations/0043_stats_base_views.sql "$SCRATCH/"
npm run db:migrate:ci && npm run db:introspect
git diff --exit-code src/db/schema.ts
mv "$SCRATCH/0043_stats_base_views.sql" ../database/migrations/
git status --short
```

Only `schema.ts` is tracked among Drizzle Kit's outputs (D290); `git status` must show nothing new outside the migration and verification files.

**If the diff is not empty,** local introspection does not reproduce Neon's output. Do not commit the local output. Restore with `git checkout -- src/db/schema.ts`, skip to Step 5, and ask the owner to run `npm run db:migrate && npm run db:introspect` on this branch against the dev database, then commit `schema.ts` before merging. That is the only stop left, and it is before merge, not after deploy.

- [ ] **Step 3: Apply `0043`, seed, verify.**

```bash
npm run db:migrate:ci && npm run db:seed:ci
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/verification/0043_stats_base_views_checks.sql
```

Every verification row is `PASS`. A failure is a bug in `0043` or the script: fix it on this branch (Global Constraints), roll back with `npx dbmate --no-dump-schema --migrations-dir ../database/migrations rollback`, then run Step 3 again.

- [ ] **Step 4: Introspect.** `npm run db:introspect`. `git diff src/db/schema.ts` shows only the two new `pgView` declarations (`vStatsSessionFacts`, `vStatsDartFacts`); nothing else moves.

- [ ] **Step 5: Stop the database.** `"$PGBIN/pg_ctl" -D "$SCRATCH/pg" stop`, `unset DATABASE_URL`.

- [ ] **Step 6: Run the suite.** `cd app && npm test`. `schema-view-drift` and `migration-numeric-typing` must pass. If `migration-numeric-typing` flags a column, add the missing `::integer` cast in `0043` and redo Steps 3–4.

- [ ] **Step 7: Commit.** `chore(db): regenerate schema.ts for 0043`

---

### Task 4: Rehearsal

`db-rehearsal.yml` runs on the PR (paths `database/migrations/**`, `database/verification/**`) against a Neon branch cut from production. It is the proof that `0043` applies to production's real state. Nothing to do here but make sure it runs green on the PR (Task 6); a red rehearsal is fixed on this branch, never merged past.

---

### Task 5: Database docs

- `docs/architecture/05-Database/05-Views/00-Overview.md` and the views catalog chapter that lists each view: entries for `v_stats_session_facts` and `v_stats_dart_facts`.
- The spec chapter holding indexes (`05-Database/06-Spec/`): the new index with its rationale.
- `docs/architecture/10-Statistics/00-Overview.md` §10: mark the base views **built** (migration `0043`). Leave §12's phase 1 open; 1b marks it done.
- `docs/CLAUDE.md` (§Consistency Checks) and `database/CLAUDE.md`: the migration range becomes `0001`–`0043` wherever it states the chain's extent.
- Root `CLAUDE.md`'s "never modify applied migrations (`0001`–`0042`)" range is **not** moved here: `0043` is not applied until the deploy runs. 1b moves it.

- [ ] **Step 1:** Make the edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Commit `docs(db): statistics base views and index`.

---

### Task 6: Context maintenance, gates, PR

- [ ] **Step 1:** Run the `context-maintenance` skill: context map, File Inventory rows for the migration and verification files, history entry.
- [ ] **Step 2:** Run the `run-all-gates` skill for `database/` + `docs/`: the Always-run set, `check-constraint-mirror.sh`, `check-doc-sync.sh`. Report each result. `validate:app` needs `DATABASE_URL`; Task 3 stands in for its `db:migrate` / `db:introspect` / `npm test` steps, and the gap is named in the PR body.
- [ ] **Step 3:** Run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR). PR body states: merging applies `0043` to production via `deploy.yml`; phase 1b starts after that deploy is green.

---

## Handoff to phase 1b

Phase 1b starts only when both hold:
1. This PR is merged to `main`.
2. The `deploy` workflow run for that merge commit is green: `rehearse`, `migrate` (its "Confirm nothing is left pending" step) and `deploy`.

A red deploy is fixed with a new migration (`0044`), never by editing `0043` once it is applied.

## Out of scope

- Everything in the app: capability tags, registry, contracts, repository, sections, service, routes, cache, page (phase 1b).
- Decision D367 and the API/frontend doc changes (phase 1b).
