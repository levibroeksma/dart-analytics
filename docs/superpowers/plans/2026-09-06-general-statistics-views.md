# General Statistics Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the career-wide "general stats" read layer from `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md`: split `05-Views.md` into a directory, add the two new Analytics views the design calls for, and add the pure TypeScript modules that turn their rows into the 16 in-scope stat-card numbers.

**Architecture:** Two new Postgres views (`v_player_visit_facts`, `v_player_leg_facts`) expose per-turn and per-leg facts, owning-participant scoped, alongside the existing `v_session_overview`/`v_double_out_checkout_darts`. Five new pure TypeScript modules turn arrays of those rows into stat numbers — no DB access inside the modules, no business logic inside the views. No API endpoint or UI is built in this plan (not designed yet — separate future work).

**Tech Stack:** PostgreSQL (dbmate migrations), TypeScript, Vitest.

**Stat coverage:** of the design's 17 cards, this plan builds 16. Double accuracy needs **no new code** — it already reuses `v_double_out_checkout_darts` + `classifyDoubleAttempts` + the existing `accuracyDisplay` formatter as-is, so no task below targets it directly. Win rate is deferred (see Global Constraints).

## Global Constraints

- **Win rate is explicitly out of scope for this plan.** It needs session-replay-from-persisted-facts for 9 engines, which doesn't exist yet — see the design spec's 2026-09-06 status note. A separate plan will cover it.
- Do not touch `v_double_out_checkout_darts`'s game-type filter or `double-attempt.module.ts`'s classification rules (steps 1–6 of `classifyDart`) — that scope belongs to `claude/x01-doubles-accuracy-ljbk6c`. The one permitted touch to that file is exporting its existing private `classifyDart`/`DartOutcome` (Task 8) — an additive export, zero behavior change.
- Views: Analytics category, owning-participant scoped (`p.player_id = es.player_id`, mirroring `v_dart_analytics`/`v_double_out_checkout_darts`). Joins/filtering/aggregation/arithmetic only — no workflow decisions, no win detection, no game-specific scoring.
- Never modify applied migrations `0001`–`0024`. New schema changes are new migrations `0025`, `0026`.
- Migration behavior is proven with a `database/verification/00NN_*_checks.sql` script (psql, ends in `ROLLBACK`, includes the anti-vacuity "N of N checks ran" row per D192/D193) — not a Vitest test. No live Postgres exists in this container, so these scripts are written and reviewed, but only actually run where `DATABASE_URL` is available.
- `export type`/`export interface` never appears in an implementation file (type-barrel rule 1, `scripts/check-type-barrels.sh`) — all new types live in the owning folder's `types.ts`, raised into `app/src/modules/types.ts`.
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- No `//`/`/* */` comments inside function bodies; a doc comment goes above the declaration only.
- `npm run validate:app` (0 errors/warnings/hints) must pass before any task is called done; `npm run format`/`format:check` clean before any commit.
- Every touched runtime `.ts` file needs a covering test (`scripts/check-test-coverage.sh`).

---

### Task 1: Split `05-Views.md` into a directory

Mechanical relocation only — no content changes beyond path references and the `updated:` date. `01-General-Views.md` is **not** created here; it's created in Task 9 once the two new views actually exist, matching the precedent in `docs/superpowers/plans/2026-09-05-double-out-checkout-accuracy.md` (doc registration happens after the thing being documented is built).

**Files:**
- Move: `docs/architecture/05-Database/05-Views.md` → `docs/architecture/05-Database/05-Views/00-Overview.md`
- Modify: `docs/architecture/00-Context-Map.md:28`
- Modify: `docs/architecture/00-File-Inventory.md:43`
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md:36`
- Modify: `docs/architecture/05-Database/10-Database-Agent-Guide.md:218`
- Modify: `docs/architecture/05-Database/00-OVERVIEW.md:113`
- Modify: `docs/architecture/README.md:108`

**Interfaces:**
- Produces: the canonical view-strategy doc now lives at `docs/architecture/05-Database/05-Views/00-Overview.md`. Every later task that needs to cite it uses that path.

- [ ] **Step 1: Move the file**

```bash
mkdir -p docs/architecture/05-Database/05-Views
git mv docs/architecture/05-Database/05-Views.md docs/architecture/05-Database/05-Views/00-Overview.md
```

- [ ] **Step 2: Bump the moved file's front matter date**

In `docs/architecture/05-Database/05-Views/00-Overview.md`, change:

```
updated: 2026-09-05
```

to:

```
updated: 2026-09-06
```

- [ ] **Step 3: Update `00-Context-Map.md`'s pack row**

In `docs/architecture/00-Context-Map.md:28`, change:

```
| New view / analytics query | `05-Database/05-Views.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5.1k |
```

to:

```
| New view / analytics query | `05-Database/05-Views/00-Overview.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5.1k |
```

- [ ] **Step 4: Update `00-File-Inventory.md`'s row**

In `docs/architecture/00-File-Inventory.md:43`, change:

```
| `05-Views.md` | View categories and replay rules; ten implemented views through `0024` (2026-09-05) | canonical | ~2.2k |
```

to:

```
| `05-Views/00-Overview.md` | View categories and replay rules; ten implemented views through `0024` (2026-09-05); split into a directory to host per-domain view catalogs (2026-09-06) | canonical | ~2.2k |
```

- [ ] **Step 5: Update the Read-Model-Layer chapter's cross-reference**

In `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md:36`, change:

```
Views are divided into three categories (defined in `05-Views.md`):
```

to:

```
Views are divided into three categories (defined in `05-Views/00-Overview.md`):
```

- [ ] **Step 6: Update the Database Agent Guide's cross-reference**

In `docs/architecture/05-Database/10-Database-Agent-Guide.md:218`, change:

```
2. Document in `05-Views.md` and `06-Database-Specification.md` Read Model Layer
```

to:

```
2. Document in `05-Views/00-Overview.md` and `06-Database-Specification.md` Read Model Layer
```

- [ ] **Step 7: Update the Database overview's cross-reference**

In `docs/architecture/05-Database/00-OVERVIEW.md:113`, change:

```
Analytics (averages, checkout %, progression) are derived views — never a separate source of truth. Future analytics views extend this layer; see `05-Views.md`.
```

to:

```
Analytics (averages, checkout %, progression) are derived views — never a separate source of truth. Future analytics views extend this layer; see `05-Views/00-Overview.md`.
```

- [ ] **Step 8: Update the architecture README's folder tree**

In `docs/architecture/README.md`, change:

```
05-Database/
  00-OVERVIEW.md
  01-Naming-Conventions.md
  02-Design-Rules.md
  03-Migrations.md
  04-Indexes.md
  05-Views.md
  06-Database-Specification.md   ← canonical spec: invariants + chapter index (2026-07-11)
```

to:

```
05-Database/
  00-OVERVIEW.md
  01-Naming-Conventions.md
  02-Design-Rules.md
  03-Migrations.md
  04-Indexes.md
  05-Views/
    00-Overview.md               ← view strategy, categories, naming, anti-patterns
    01-General-Views.md          ← career-wide stat views (2026-09-06)
  06-Database-Specification.md   ← canonical spec: invariants + chapter index (2026-07-11)
```

- [ ] **Step 9: Run the context-integrity gates**

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

Expected: all three exit 0. If `check-context-budget.sh` complains about the pack total, recompute `~5.1k` as `(size of 00-Overview.md + size of 05-Read-Model-Layer.md) / 4 / 1000` using `wc -c`, and update the pack row to match (rounded to one decimal).

- [ ] **Step 10: Commit**

```bash
git add docs/architecture/05-Database/05-Views docs/architecture/00-Context-Map.md \
  docs/architecture/00-File-Inventory.md docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md \
  docs/architecture/05-Database/10-Database-Agent-Guide.md docs/architecture/05-Database/00-OVERVIEW.md \
  docs/architecture/README.md
git commit -m "$(cat <<'EOF'
Split 05-Views.md into a directory to host per-domain view catalogs

Mechanical relocation to 05-Views/00-Overview.md; no content change.
Makes room for 01-General-Views.md (added once the new views exist).
EOF
)"
```

---

### Task 2: Migration + verification — `v_player_visit_facts`

One row per completed turn, every game type and capture mode, owning-participant scoped. Exposes the real dart count (0 when no dart rows exist) alongside the configured `max_darts_per_turn`, so consumers can apply the best-effort approximation themselves.

**Files:**
- Create: `database/migrations/0025_player_visit_facts_view.sql`
- Create: `database/verification/0025_player_visit_facts_view_checks.sql`

**Interfaces:**
- Produces: view `v_player_visit_facts(session_id, player_id, game_type_key, stage_id, stage_type_key, turn_sequence, total_score, completed_at, dart_count, configured_max_darts_per_turn)`.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0025_player_visit_facts_view.sql`:

```sql
-- ============================================================
-- v_player_visit_facts: one row per completed turn, every game
-- type and capture mode, for career-wide stat cards (total darts
-- thrown, score bands, median, highest game average, first-9
-- average, base scoring average).
--
-- dart_count is the REAL count of dart rows for the turn -- 0 for
-- QUICK_SCORE turns, where no dart rows are ever written.
-- configured_max_darts_per_turn is the ruleset's configured value
-- for the session (from exercise_configurations' JSONB snapshot),
-- exposed as a raw fact so the application read layer can apply
-- its own best-effort approximation (real count where present,
-- else the configured max) rather than the view guessing.
--
-- Scoped to the session's owning participant, mirroring
-- v_dart_analytics/v_dart_locations/v_double_out_checkout_darts.
-- Only completed turns are included -- an open visit carries a
-- running total, not a result (05-Views.md forbids exposing
-- workflow state as though it were a finished fact).
-- ============================================================

-- migrate:up
CREATE VIEW v_player_visit_facts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    st.id AS stage_id,
    stype.implementation_key AS stage_type_key,
    t.sequence_number AS turn_sequence,
    t.total_score,
    t.completed_at,
    COUNT(d.id) AS dart_count,
    (ec.configuration ->> 'max_darts_per_turn')::int AS configured_max_darts_per_turn
FROM turns t
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN stage_types stype ON stype.id = st.stage_type_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN darts d ON d.turn_id = t.id
WHERE p.player_id = es.player_id
    AND t.completed_at IS NOT NULL
GROUP BY es.id,
    es.player_id,
    gt.implementation_key,
    st.id,
    stype.implementation_key,
    t.sequence_number,
    t.total_score,
    t.completed_at,
    ec.configuration;
COMMENT ON VIEW v_player_visit_facts IS 'One row per completed turn, every game type and capture mode (owning player only): real dart count plus the configured max-darts-per-turn, for career-wide turn-level stat cards.';

-- migrate:down
DROP VIEW IF EXISTS v_player_visit_facts;
```

- [ ] **Step 2: Write the verification script**

Create `database/verification/0025_player_visit_facts_view_checks.sql`:

```sql
-- ============================================================
-- Verification: 0025_player_visit_facts_view_checks.sql
--
-- Runs assertions against a live database (D193).
--
--   1. a QUICK_SCORE turn (no dart rows) reports dart_count = 0
--   2. a VISUAL_BOARD turn with 2 dart rows reports dart_count = 2
--   3. configured_max_darts_per_turn reflects the JSONB snapshot
--   4. an open (uncompleted) turn never appears
--   5. a guest participant's turn never appears
--
-- Everything runs inside one transaction that ends in ROLLBACK.
-- Lookup rows are resolved by implementation_key, never by
-- hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0025_player_visit_facts_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0025.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000002501',
        'verification-0025-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002502',
        '01990000-0000-7000-8000-000000002501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Session A: TUOD, RECREATIONAL + QUICK_SCORE (no dart rows).
-- ------------------------------------------------------------
INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        game_type_id,
        capture_mode_id,
        input_mode_id,
        status_id,
        ruleset_version_id,
        started_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000002503',
    '01990000-0000-7000-8000-000000002502',
    '01990000-0000-7000-8000-000000002501',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'RECREATIONAL'),
    (SELECT id FROM input_modes WHERE implementation_key = 'QUICK_SCORE'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = 'TUOD_V1';

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002504',
        '01990000-0000-7000-8000-000000002503',
        '{"max_darts_per_turn": 3}'::jsonb,
        now()
    );

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002505',
        '01990000-0000-7000-8000-000000002503',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002506',
        '01990000-0000-7000-8000-000000002503',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002501',
        'Verification Owner',
        now()
    );

-- Turn 1: completed, no darts (QUICK_SCORE).
INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002507',
        '01990000-0000-7000-8000-000000002505',
        '01990000-0000-7000-8000-000000002506',
        1,
        45,
        now(),
        now()
    );

-- Turn 2: still open -- must never appear.
INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002508',
        '01990000-0000-7000-8000-000000002505',
        '01990000-0000-7000-8000-000000002506',
        2,
        0,
        NULL,
        now()
    );

-- ------------------------------------------------------------
-- Session B: 501, ANALYTICS + VISUAL_BOARD (2 dart rows), plus a
-- guest participant's turn in the same session (must not appear).
-- ------------------------------------------------------------
INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        game_type_id,
        capture_mode_id,
        input_mode_id,
        status_id,
        ruleset_version_id,
        started_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000002509',
    '01990000-0000-7000-8000-000000002502',
    '01990000-0000-7000-8000-000000002501',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250a',
        '01990000-0000-7000-8000-000000002509',
        '{"max_darts_per_turn": 3, "starting_score": 501}'::jsonb,
        now()
    );

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250b',
        '01990000-0000-7000-8000-000000002509',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250c',
        '01990000-0000-7000-8000-000000002509',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002501',
        'Verification Owner',
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000250d',
        '01990000-0000-7000-8000-000000002509',
        (SELECT id FROM participant_types WHERE implementation_key = 'GUEST'),
        NULL,
        'Guest Opponent',
        now()
    );

-- Owner's turn: completed, 2 darts.
INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250e',
        '01990000-0000-7000-8000-00000000250b',
        '01990000-0000-7000-8000-00000000250c',
        1,
        100,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250f',
        '01990000-0000-7000-8000-00000000250e',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002510',
        '01990000-0000-7000-8000-00000000250e',
        2,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        40,
        now()
    );

-- Guest's turn in the same session: must never appear.
INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002511',
        '01990000-0000-7000-8000-00000000250b',
        '01990000-0000-7000-8000-00000000250d',
        1,
        60,
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Step 1: QUICK_SCORE turn reports dart_count = 0.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'QUICK_SCORE turn reports dart_count = 0',
    CASE WHEN dart_count = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('dart_count=%s (expected 0)', dart_count)
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002503'
    AND turn_sequence = 1;

-- ------------------------------------------------------------
-- Step 2: VISUAL_BOARD turn reports dart_count = 2.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'VISUAL_BOARD turn reports dart_count = 2',
    CASE WHEN dart_count = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('dart_count=%s (expected 2)', dart_count)
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002509'
    AND turn_sequence = 1
    AND stage_id = '01990000-0000-7000-8000-00000000250b';

-- ------------------------------------------------------------
-- Step 3: configured_max_darts_per_turn reflects the JSONB.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'configured_max_darts_per_turn reads the JSONB snapshot',
    CASE WHEN configured_max_darts_per_turn = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('configured_max_darts_per_turn=%s (expected 3)', configured_max_darts_per_turn)
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002503'
    AND turn_sequence = 1;

-- ------------------------------------------------------------
-- Step 4: the open turn never appears.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'an open (uncompleted) turn does not appear',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002503'
    AND turn_sequence = 2;

-- ------------------------------------------------------------
-- Step 5: the guest's turn never appears.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5',
    'a guest participant''s turn does not appear',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002509'
    AND total_score = 60;

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6',
    'all 5 view-driven checks actually ran',
    CASE WHEN count(*) = 5 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 5 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3', '4', '5');

SELECT step, result, check_name, detail FROM verification_results ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 3: Apply the migration and introspect (only where `DATABASE_URL` is set)**

```bash
cd app
npm run db:status
npm run db:migrate
npm run db:introspect
```

Expected: migration `0025` applies cleanly; `db:introspect` regenerates `app/src/db/schema.ts` with the new view.

- [ ] **Step 4: Run the verification script (only where `DATABASE_URL` is set)**

```bash
psql "$DATABASE_URL" -f database/verification/0025_player_visit_facts_view_checks.sql
```

Expected: `ALL 6 CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/0025_player_visit_facts_view.sql \
  database/verification/0025_player_visit_facts_view_checks.sql
git add -A app/src/db  # only if db:introspect regenerated schema.ts/meta
git commit -m "$(cat <<'EOF'
Add v_player_visit_facts view for career-wide turn-level stats

One row per completed turn across every game type and capture mode,
owning-participant scoped. Real dart count plus configured max, so
the read layer applies its own best-effort darts-thrown approximation.
EOF
)"
```

---

### Task 3: Migration + verification — `v_player_leg_facts`

One row per `LEG`-stage, only where every one of the owning participant's turns in that leg has real dart rows. Backs best-leg and average-darts-per-leg — both need exact counts, so an incomplete leg is excluded rather than approximated.

**Files:**
- Create: `database/migrations/0026_player_leg_facts_view.sql`
- Create: `database/verification/0026_player_leg_facts_view_checks.sql`

**Interfaces:**
- Produces: view `v_player_leg_facts(session_id, player_id, game_type_key, stage_id, total_darts_in_leg)`.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0026_player_leg_facts_view.sql`:

```sql
-- ============================================================
-- v_player_leg_facts: one row per LEG-type stage, owning
-- participant only, for best-leg / average-darts-per-leg stat
-- cards (X01 games -- 501/121/TUOD -- are the only game types
-- that ever create a LEG stage).
--
-- A leg is included only when EVERY one of the owning
-- participant's turns in it has at least one real dart row. A
-- QUICK_SCORE leg's real per-turn dart count is unknown (a
-- checkout or bust can resolve on any dart), so this view
-- narrows the population rather than approximating a count that
-- would look exact but isn't -- same precedent as
-- v_dart_analytics's "both intended target and zone present"
-- filter (05-Views.md).
-- ============================================================

-- migrate:up
CREATE VIEW v_player_leg_facts AS
WITH leg_turns AS (
    SELECT t.id AS turn_id,
        t.exercise_stage_id,
        COUNT(d.id) AS dart_count
    FROM turns t
        JOIN participants p ON p.id = t.participant_id
        JOIN exercise_stages st ON st.id = t.exercise_stage_id
        JOIN exercise_sessions es ON es.id = st.exercise_session_id
        LEFT JOIN darts d ON d.turn_id = t.id
    WHERE p.player_id = es.player_id
        AND t.completed_at IS NOT NULL
    GROUP BY t.id, t.exercise_stage_id
)
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    st.id AS stage_id,
    SUM(lt.dart_count) AS total_darts_in_leg
FROM leg_turns lt
    JOIN exercise_stages st ON st.id = lt.exercise_stage_id
    JOIN stage_types stype ON stype.id = st.stage_type_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
WHERE stype.implementation_key = 'LEG'
GROUP BY es.id, es.player_id, gt.implementation_key, st.id
HAVING bool_and(lt.dart_count > 0);
COMMENT ON VIEW v_player_leg_facts IS 'One row per LEG stage (owning player only), total real darts thrown in that leg -- only legs where every turn has real dart rows; incomplete-capture legs are excluded, never approximated.';

-- migrate:down
DROP VIEW IF EXISTS v_player_leg_facts;
```

- [ ] **Step 2: Write the verification script**

Create `database/verification/0026_player_leg_facts_view_checks.sql`:

```sql
-- ============================================================
-- Verification: 0026_player_leg_facts_view_checks.sql
--
--   1. a leg where every turn has dart rows appears, with the
--      correct total_darts_in_leg
--   2. a leg with one QUICK_SCORE turn (0 darts) is excluded
--      entirely
--   3. a non-LEG stage (ROUND) never appears
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0026_player_leg_facts_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0026.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000002601',
        'verification-0026-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002602',
        '01990000-0000-7000-8000-000000002601',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

INSERT INTO exercise_sessions (
        id, activity_id, player_id, game_type_id, capture_mode_id,
        input_mode_id, status_id, ruleset_version_id, started_at, created_at
    )
SELECT '01990000-0000-7000-8000-000000002603',
    '01990000-0000-7000-8000-000000002602',
    '01990000-0000-7000-8000-000000002601',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002604',
        '01990000-0000-7000-8000-000000002603',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002601',
        'Verification Owner',
        now()
    );

-- ------------------------------------------------------------
-- Leg 1 (complete capture): 2 turns, both with dart rows -- 5 darts total.
-- ------------------------------------------------------------
INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002605',
        '01990000-0000-7000-8000-000000002603',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002606',
        '01990000-0000-7000-8000-000000002605',
        '01990000-0000-7000-8000-000000002604',
        1,
        140,
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002607',
        '01990000-0000-7000-8000-000000002605',
        '01990000-0000-7000-8000-000000002604',
        2,
        40,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
VALUES
    ('01990000-0000-7000-8000-000000002608', '01990000-0000-7000-8000-000000002606', 1, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'), 60, now()),
    ('01990000-0000-7000-8000-000000002609', '01990000-0000-7000-8000-000000002606', 2, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'), 60, now()),
    ('01990000-0000-7000-8000-00000000260a', '01990000-0000-7000-8000-000000002606', 3, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 20, now()),
    ('01990000-0000-7000-8000-00000000260b', '01990000-0000-7000-8000-000000002607', 1, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'DOUBLE'), 40, now()),
    ('01990000-0000-7000-8000-00000000260c', '01990000-0000-7000-8000-000000002607', 2, NULL, NULL, 0, now());

-- ------------------------------------------------------------
-- Leg 2 (incomplete capture): 1 turn with darts, 1 QUICK_SCORE
-- turn with none -- must be excluded entirely.
-- ------------------------------------------------------------
INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000260d',
        '01990000-0000-7000-8000-000000002603',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        2,
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000260e',
        '01990000-0000-7000-8000-00000000260d',
        '01990000-0000-7000-8000-000000002604',
        1,
        60,
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000260f',
        '01990000-0000-7000-8000-00000000260d',
        '01990000-0000-7000-8000-000000002604',
        2,
        41,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
VALUES ('01990000-0000-7000-8000-000000002610', '01990000-0000-7000-8000-00000000260e', 1, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'), 60, now());
-- turn '...260f' has NO dart rows (QUICK_SCORE-style turn mixed into an
-- otherwise ANALYTICS session for this fixture, on purpose).

-- ------------------------------------------------------------
-- A ROUND stage (TUOD-shaped) -- must never appear.
-- ------------------------------------------------------------
INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002611',
        '01990000-0000-7000-8000-000000002603',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
        3,
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002612',
        '01990000-0000-7000-8000-000000002611',
        '01990000-0000-7000-8000-000000002604',
        1,
        60,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
VALUES ('01990000-0000-7000-8000-000000002613', '01990000-0000-7000-8000-000000002612', 1, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'), 60, now());

-- ------------------------------------------------------------
-- Step 1: leg 1 appears with total_darts_in_leg = 5.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'complete-capture leg reports total_darts_in_leg = 5',
    CASE WHEN total_darts_in_leg = 5 THEN 'PASS' ELSE 'FAIL' END,
    format('total_darts_in_leg=%s (expected 5)', total_darts_in_leg)
FROM v_player_leg_facts
WHERE stage_id = '01990000-0000-7000-8000-000000002605';

-- ------------------------------------------------------------
-- Step 2: leg 2 (incomplete capture) is excluded entirely.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'incomplete-capture leg is excluded',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_player_leg_facts
WHERE stage_id = '01990000-0000-7000-8000-00000000260d';

-- ------------------------------------------------------------
-- Step 3: the ROUND stage never appears.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'a ROUND stage does not appear',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_player_leg_facts
WHERE stage_id = '01990000-0000-7000-8000-000000002611';

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'all 3 view-driven checks actually ran',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 3 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3');

SELECT step, result, check_name, detail FROM verification_results ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 3: Apply the migration and introspect (only where `DATABASE_URL` is set)**

```bash
cd app
npm run db:status
npm run db:migrate
npm run db:introspect
```

- [ ] **Step 4: Run the verification script (only where `DATABASE_URL` is set)**

```bash
psql "$DATABASE_URL" -f database/verification/0026_player_leg_facts_view_checks.sql
```

Expected: `ALL 4 CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/0026_player_leg_facts_view.sql \
  database/verification/0026_player_leg_facts_view_checks.sql
git add -A app/src/db  # only if db:introspect regenerated schema.ts/meta
git commit -m "$(cat <<'EOF'
Add v_player_leg_facts view for best-leg/avg-darts-per-leg stats

One row per LEG stage, owning player only, included only when every
turn in it has real dart rows -- incomplete-capture legs are excluded,
never approximated.
EOF
)"
```

---

### Task 4: `modules/stats/types.ts` + `career-summary.module.ts`

Pure functions over `v_session_overview`-shaped rows: total games played, total play time, favorite game type, longest/current play streak.

**Files:**
- Create: `app/src/modules/stats/types.ts`
- Modify: `app/src/modules/types.ts`
- Create: `app/src/modules/stats/career-summary.module.ts`
- Test: `app/tests/modules/stats/career-summary.module.test.ts`

**Interfaces:**
- Produces: type `PlayerSessionSummaryRow` (`app/src/modules/stats/types.ts`, raised into `@modules/types`); functions `totalGamesPlayed`, `totalPlayTimeSeconds`, `favoriteGameTypeKey`, `longestPlayStreakDays`, `currentPlayStreakDays` (`@modules/stats/career-summary.module`).

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/stats/career-summary.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  currentPlayStreakDays,
  favoriteGameTypeKey,
  longestPlayStreakDays,
  totalGamesPlayed,
  totalPlayTimeSeconds,
} from "@modules/stats/career-summary.module";
import type { PlayerSessionSummaryRow } from "@modules/types";

function session(
  overrides: Partial<PlayerSessionSummaryRow> = {},
): PlayerSessionSummaryRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    statusKey: "COMPLETED",
    startedAt: "2026-09-01T10:00:00.000Z",
    durationSeconds: 600,
    ...overrides,
  };
}

describe("totalGamesPlayed", () => {
  it("returns 0 for no sessions", () => {
    expect(totalGamesPlayed([])).toBe(0);
  });

  it("counts only COMPLETED sessions", () => {
    const rows = [
      session({ statusKey: "COMPLETED" }),
      session({ statusKey: "ABANDONED" }),
      session({ statusKey: "ACTIVE" }),
    ];
    expect(totalGamesPlayed(rows)).toBe(1);
  });
});

describe("totalPlayTimeSeconds", () => {
  it("sums duration across COMPLETED sessions only", () => {
    const rows = [
      session({ durationSeconds: 300 }),
      session({ durationSeconds: 700, statusKey: "ABANDONED" }),
      session({ durationSeconds: 200 }),
    ];
    expect(totalPlayTimeSeconds(rows)).toBe(500);
  });
});

describe("favoriteGameTypeKey", () => {
  it("returns null for no sessions", () => {
    expect(favoriteGameTypeKey([])).toBeNull();
  });

  it("returns the most-played COMPLETED game type", () => {
    const rows = [
      session({ gameTypeKey: "501" }),
      session({ gameTypeKey: "TUOD" }),
      session({ gameTypeKey: "501" }),
      session({ gameTypeKey: "501", statusKey: "ABANDONED" }),
    ];
    expect(favoriteGameTypeKey(rows)).toBe("501");
  });

  it("breaks ties by first-seen order", () => {
    const rows = [session({ gameTypeKey: "TUOD" }), session({ gameTypeKey: "501" })];
    expect(favoriteGameTypeKey(rows)).toBe("TUOD");
  });
});

describe("longestPlayStreakDays", () => {
  it("returns 0 for no sessions", () => {
    expect(longestPlayStreakDays([])).toBe(0);
  });

  it("counts a run of consecutive calendar days once per day", () => {
    const rows = [
      session({ startedAt: "2026-09-01T09:00:00.000Z" }),
      session({ startedAt: "2026-09-01T21:00:00.000Z" }),
      session({ startedAt: "2026-09-02T09:00:00.000Z" }),
      session({ startedAt: "2026-09-03T09:00:00.000Z" }),
    ];
    expect(longestPlayStreakDays(rows)).toBe(3);
  });

  it("finds the longest of several runs separated by gaps", () => {
    const rows = [
      session({ startedAt: "2026-09-01T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
      session({ startedAt: "2026-09-06T09:00:00.000Z" }),
      session({ startedAt: "2026-09-07T09:00:00.000Z" }),
    ];
    expect(longestPlayStreakDays(rows)).toBe(3);
  });
});

describe("currentPlayStreakDays", () => {
  it("returns 0 for no sessions", () => {
    expect(currentPlayStreakDays([], new Date("2026-09-06T12:00:00.000Z"))).toBe(0);
  });

  it("counts the run ending today", () => {
    const rows = [
      session({ startedAt: "2026-09-04T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
      session({ startedAt: "2026-09-06T09:00:00.000Z" }),
    ];
    expect(currentPlayStreakDays(rows, new Date("2026-09-06T18:00:00.000Z"))).toBe(3);
  });

  it("still counts the run when the reference date is the day after last play", () => {
    const rows = [
      session({ startedAt: "2026-09-04T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
    ];
    expect(currentPlayStreakDays(rows, new Date("2026-09-06T08:00:00.000Z"))).toBe(2);
  });

  it("returns 0 when the last play is more than a day before the reference date", () => {
    const rows = [session({ startedAt: "2026-09-01T09:00:00.000Z" })];
    expect(currentPlayStreakDays(rows, new Date("2026-09-06T08:00:00.000Z"))).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/stats/career-summary.module.test.ts
```

Expected: FAIL — `Cannot find module '@modules/stats/career-summary.module'` (and `PlayerSessionSummaryRow` not exported from `@modules/types`).

- [ ] **Step 3: Create the types file**

Create `app/src/modules/stats/types.ts`:

```ts
/** One row of `v_player_visit_facts`. See `05-Views/01-General-Views.md`. */
export type PlayerSessionSummaryRow = {
  sessionId: string;
  gameTypeKey: string;
  statusKey: "ACTIVE" | "COMPLETED" | "ABANDONED";
  startedAt: string;
  durationSeconds: number;
};
```

- [ ] **Step 4: Raise the new barrel into `app/src/modules/types.ts`**

In `app/src/modules/types.ts`, change:

```ts
export * from "./dartbot/types";
export * from "./game/types";
export * from "./ui/types";
```

to:

```ts
export * from "./dartbot/types";
export * from "./game/types";
export * from "./stats/types";
export * from "./ui/types";
```

- [ ] **Step 5: Write the implementation**

Create `app/src/modules/stats/career-summary.module.ts`:

```ts
import type { PlayerSessionSummaryRow } from "./types";

function completedRows(
  rows: readonly PlayerSessionSummaryRow[],
): PlayerSessionSummaryRow[] {
  return rows.filter((row) => row.statusKey === "COMPLETED");
}

export function totalGamesPlayed(rows: readonly PlayerSessionSummaryRow[]): number {
  return completedRows(rows).length;
}

export function totalPlayTimeSeconds(rows: readonly PlayerSessionSummaryRow[]): number {
  return completedRows(rows).reduce((sum, row) => sum + row.durationSeconds, 0);
}

export function favoriteGameTypeKey(
  rows: readonly PlayerSessionSummaryRow[],
): string | null {
  const counts = new Map<string, number>();
  for (const row of completedRows(rows)) {
    counts.set(row.gameTypeKey, (counts.get(row.gameTypeKey) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [gameTypeKey, count] of counts) {
    if (count > bestCount) {
      best = gameTypeKey;
      bestCount = count;
    }
  }
  return best;
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(earlier: string, later: string): number {
  const msPerDay = 86_400_000;
  return Math.round((Date.parse(later) - Date.parse(earlier)) / msPerDay);
}

function distinctSortedPlayDates(rows: readonly PlayerSessionSummaryRow[]): string[] {
  const dates = new Set(completedRows(rows).map((row) => toDateOnly(row.startedAt)));
  return Array.from(dates).sort();
}

export function longestPlayStreakDays(rows: readonly PlayerSessionSummaryRow[]): number {
  const dates = distinctSortedPlayDates(rows);
  if (dates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i += 1) {
    current = daysBetween(dates[i - 1], dates[i]) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** `referenceDate` defaults to now; pass an explicit date for deterministic tests. */
export function currentPlayStreakDays(
  rows: readonly PlayerSessionSummaryRow[],
  referenceDate: Date = new Date(),
): number {
  const dates = distinctSortedPlayDates(rows);
  if (dates.length === 0) return 0;
  const today = referenceDate.toISOString().slice(0, 10);
  const lastPlayed = dates[dates.length - 1];
  if (daysBetween(lastPlayed, today) > 1) return 0;
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i -= 1) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) streak += 1;
    else break;
  }
  return streak;
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/stats/career-summary.module.test.ts
```

Expected: PASS, all cases green.

- [ ] **Step 7: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add app/src/modules/stats/types.ts app/src/modules/types.ts \
  app/src/modules/stats/career-summary.module.ts \
  app/tests/modules/stats/career-summary.module.test.ts
git commit -m "$(cat <<'EOF'
Add career-summary.module.ts: games played, play time, streaks

Pure functions over v_session_overview-shaped rows. Streak functions
use gap-and-islands over distinct play dates, not a SQL aggregate,
since finding consecutive-day runs is iterative logic.
EOF
)"
```

---

### Task 5: `visit-stats.module.ts`

Pure functions over `v_player_visit_facts`-shaped rows: total darts thrown, score-band counts (100/120/140+/180s), median visit score, highest game average, first-9 career average.

**Files:**
- Modify: `app/src/modules/stats/types.ts`
- Create: `app/src/modules/stats/visit-stats.module.ts`
- Test: `app/tests/modules/stats/visit-stats.module.test.ts`

**Interfaces:**
- Consumes: none from earlier tasks.
- Produces: type `PlayerVisitFactRow`, `ScoreBandCounts` (`@modules/types`); functions `effectiveDartsForVisit`, `totalDartsThrown`, `scoreBandCounts`, `medianVisitScore`, `highestGameAverage`, `firstNineCareerAverage` (`@modules/stats/visit-stats.module`). Task 8 imports `effectiveDartsForVisit` and the `PlayerVisitFactRow` type from this module.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/stats/visit-stats.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  effectiveDartsForVisit,
  firstNineCareerAverage,
  highestGameAverage,
  medianVisitScore,
  scoreBandCounts,
  totalDartsThrown,
} from "@modules/stats/visit-stats.module";
import type { PlayerVisitFactRow } from "@modules/types";

function visit(overrides: Partial<PlayerVisitFactRow> = {}): PlayerVisitFactRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    stageId: "stage-1",
    stageTypeKey: "LEG",
    turnSequence: 1,
    totalScore: 60,
    dartCount: 3,
    configuredMaxDartsPerTurn: 3,
    ...overrides,
  };
}

describe("effectiveDartsForVisit", () => {
  it("uses the real dart count when it is present", () => {
    expect(effectiveDartsForVisit(visit({ dartCount: 1 }))).toBe(1);
  });

  it("falls back to the configured max when dartCount is 0", () => {
    expect(
      effectiveDartsForVisit(visit({ dartCount: 0, configuredMaxDartsPerTurn: 3 })),
    ).toBe(3);
  });

  it("falls back to 3 when neither the real count nor the configured max is known", () => {
    expect(
      effectiveDartsForVisit(visit({ dartCount: 0, configuredMaxDartsPerTurn: null })),
    ).toBe(3);
  });
});

describe("totalDartsThrown", () => {
  it("returns 0 for no visits", () => {
    expect(totalDartsThrown([])).toBe(0);
  });

  it("sums effective darts across visits", () => {
    const rows = [visit({ dartCount: 3 }), visit({ dartCount: 0 })];
    expect(totalDartsThrown(rows)).toBe(6);
  });
});

describe("scoreBandCounts", () => {
  it("counts each visit in exactly its highest band", () => {
    const rows = [
      visit({ totalScore: 180 }),
      visit({ totalScore: 140 }),
      visit({ totalScore: 120 }),
      visit({ totalScore: 100 }),
      visit({ totalScore: 59 }),
    ];
    expect(scoreBandCounts(rows)).toEqual({
      hundredPlus: 1,
      oneTwentyPlus: 1,
      oneFortyPlus: 1,
      oneEighties: 1,
    });
  });

  it("returns all zeros for no visits", () => {
    expect(scoreBandCounts([])).toEqual({
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });
});

describe("medianVisitScore", () => {
  it("returns 0 for no visits", () => {
    expect(medianVisitScore([])).toBe(0);
  });

  it("returns the middle value for an odd count", () => {
    const rows = [visit({ totalScore: 10 }), visit({ totalScore: 60 }), visit({ totalScore: 30 })];
    expect(medianVisitScore(rows)).toBe(30);
  });

  it("averages the two middle values for an even count", () => {
    const rows = [
      visit({ totalScore: 10 }),
      visit({ totalScore: 20 }),
      visit({ totalScore: 30 }),
      visit({ totalScore: 40 }),
    ];
    expect(medianVisitScore(rows)).toBe(25);
  });
});

describe("highestGameAverage", () => {
  it("returns 0 for no visits", () => {
    expect(highestGameAverage([])).toBe(0);
  });

  it("picks the session with the highest 3-dart average", () => {
    const rows = [
      visit({ sessionId: "a", totalScore: 60, dartCount: 3 }),
      visit({ sessionId: "a", totalScore: 60, dartCount: 3 }),
      visit({ sessionId: "b", totalScore: 20, dartCount: 3 }),
    ];
    expect(highestGameAverage(rows)).toBe(60);
  });
});

describe("firstNineCareerAverage", () => {
  it("returns 0 for no visits", () => {
    expect(firstNineCareerAverage([])).toBe(0);
  });

  it("pools only the first 3 turns of each session", () => {
    const rows = [
      visit({ sessionId: "a", turnSequence: 1, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 2, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 3, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 4, totalScore: 0 }),
      visit({ sessionId: "b", turnSequence: 1, totalScore: 30 }),
    ];
    expect(firstNineCareerAverage(rows)).toBe(52.5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/stats/visit-stats.module.test.ts
```

Expected: FAIL — module and types not found.

- [ ] **Step 3: Add the row/result types**

In `app/src/modules/stats/types.ts`, append:

```ts

/** One row of `v_player_visit_facts`. */
export type PlayerVisitFactRow = {
  sessionId: string;
  gameTypeKey: string;
  stageId: string;
  stageTypeKey: string;
  turnSequence: number;
  totalScore: number;
  dartCount: number;
  configuredMaxDartsPerTurn: number | null;
};

/**
 * Exclusive score-band tally (Pattern 21) over `v_player_visit_facts` rows —
 * kept independent of `play-visit-stats.ts`'s `visitScoreBandCounts` (the
 * live in-session helper): score-band thresholds are fixed darts convention,
 * not a heuristic subject to drift, so the duplication risk is negligible
 * and this avoids pulling every historical turn into the live-session module.
 */
export type ScoreBandCounts = {
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};
```

- [ ] **Step 4: Write the implementation**

Create `app/src/modules/stats/visit-stats.module.ts`:

```ts
import type { PlayerVisitFactRow, ScoreBandCounts } from "./types";

/** The real dart count where it's known, else the visit's configured max, else 3. */
export function effectiveDartsForVisit(row: PlayerVisitFactRow): number {
  if (row.dartCount > 0) return row.dartCount;
  return row.configuredMaxDartsPerTurn ?? 3;
}

export function totalDartsThrown(rows: readonly PlayerVisitFactRow[]): number {
  return rows.reduce((sum, row) => sum + effectiveDartsForVisit(row), 0);
}

export function scoreBandCounts(rows: readonly PlayerVisitFactRow[]): ScoreBandCounts {
  const counts: ScoreBandCounts = {
    hundredPlus: 0,
    oneTwentyPlus: 0,
    oneFortyPlus: 0,
    oneEighties: 0,
  };
  for (const row of rows) {
    const score = row.totalScore;
    if (score >= 180) counts.oneEighties += 1;
    else if (score >= 140) counts.oneFortyPlus += 1;
    else if (score >= 120) counts.oneTwentyPlus += 1;
    else if (score >= 100) counts.hundredPlus += 1;
  }
  return counts;
}

export function medianVisitScore(rows: readonly PlayerVisitFactRow[]): number {
  if (rows.length === 0) return 0;
  const sorted = rows.map((row) => row.totalScore).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function groupBySession(
  rows: readonly PlayerVisitFactRow[],
): Map<string, PlayerVisitFactRow[]> {
  const bySession = new Map<string, PlayerVisitFactRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }
  return bySession;
}

export function highestGameAverage(rows: readonly PlayerVisitFactRow[]): number {
  let highest = 0;
  for (const sessionRows of groupBySession(rows).values()) {
    const totalScore = sessionRows.reduce((sum, row) => sum + row.totalScore, 0);
    const totalDarts = sessionRows.reduce(
      (sum, row) => sum + effectiveDartsForVisit(row),
      0,
    );
    if (totalDarts === 0) continue;
    highest = Math.max(highest, (totalScore / totalDarts) * 3);
  }
  return highest;
}

export function firstNineCareerAverage(rows: readonly PlayerVisitFactRow[]): number {
  const pooled: number[] = [];
  for (const sessionRows of groupBySession(rows).values()) {
    const firstThree = [...sessionRows]
      .sort((a, b) => a.turnSequence - b.turnSequence)
      .slice(0, 3);
    pooled.push(...firstThree.map((row) => row.totalScore));
  }
  if (pooled.length === 0) return 0;
  return pooled.reduce((sum, score) => sum + score, 0) / pooled.length;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/stats/visit-stats.module.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/stats/types.ts app/src/modules/stats/visit-stats.module.ts \
  app/tests/modules/stats/visit-stats.module.test.ts
git commit -m "$(cat <<'EOF'
Add visit-stats.module.ts: darts thrown, score bands, median, averages

Pure functions over v_player_visit_facts-shaped rows: total darts
thrown (best-effort), 100/120/140+/180 counts, median visit score,
highest single-game average, career first-9 average.
EOF
)"
```

---

### Task 6: `leg-stats.module.ts`

Pure functions over `v_player_leg_facts`-shaped rows: best leg (least darts), average darts per leg.

**Files:**
- Modify: `app/src/modules/stats/types.ts`
- Create: `app/src/modules/stats/leg-stats.module.ts`
- Test: `app/tests/modules/stats/leg-stats.module.test.ts`

**Interfaces:**
- Produces: type `PlayerLegFactRow` (`@modules/types`); functions `bestLegDarts`, `averageDartsPerLeg` (`@modules/stats/leg-stats.module`).

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/stats/leg-stats.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { averageDartsPerLeg, bestLegDarts } from "@modules/stats/leg-stats.module";
import type { PlayerLegFactRow } from "@modules/types";

function leg(overrides: Partial<PlayerLegFactRow> = {}): PlayerLegFactRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    stageId: "stage-1",
    totalDartsInLeg: 15,
    ...overrides,
  };
}

describe("bestLegDarts", () => {
  it("returns null for no legs", () => {
    expect(bestLegDarts([])).toBeNull();
  });

  it("returns the fewest darts across legs", () => {
    const rows = [leg({ totalDartsInLeg: 15 }), leg({ totalDartsInLeg: 9 }), leg({ totalDartsInLeg: 12 })];
    expect(bestLegDarts(rows)).toBe(9);
  });
});

describe("averageDartsPerLeg", () => {
  it("returns null for no legs", () => {
    expect(averageDartsPerLeg([])).toBeNull();
  });

  it("averages darts across legs", () => {
    const rows = [leg({ totalDartsInLeg: 12 }), leg({ totalDartsInLeg: 18 })];
    expect(averageDartsPerLeg(rows)).toBe(15);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/stats/leg-stats.module.test.ts
```

Expected: FAIL — module and type not found.

- [ ] **Step 3: Add the row type**

In `app/src/modules/stats/types.ts`, append:

```ts

/** One row of `v_player_leg_facts`. */
export type PlayerLegFactRow = {
  sessionId: string;
  gameTypeKey: string;
  stageId: string;
  totalDartsInLeg: number;
};
```

- [ ] **Step 4: Write the implementation**

Create `app/src/modules/stats/leg-stats.module.ts`:

```ts
import type { PlayerLegFactRow } from "./types";

export function bestLegDarts(rows: readonly PlayerLegFactRow[]): number | null {
  if (rows.length === 0) return null;
  return Math.min(...rows.map((row) => row.totalDartsInLeg));
}

export function averageDartsPerLeg(rows: readonly PlayerLegFactRow[]): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.totalDartsInLeg, 0);
  return total / rows.length;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/stats/leg-stats.module.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/stats/types.ts app/src/modules/stats/leg-stats.module.ts \
  app/tests/modules/stats/leg-stats.module.test.ts
git commit -m "$(cat <<'EOF'
Add leg-stats.module.ts: best leg and average darts per leg

Pure functions over v_player_leg_facts-shaped rows, which already
excludes incomplete-capture legs -- null result when no leg qualifies.
EOF
)"
```

---

### Task 7: `highest-checkout.module.ts`

Highest successful checkout finish, with a repeat count (e.g. "170 ×3"). Reuses `CheckoutVisitDarts`/`DartFact` — the same shape `double-attempt.module.ts` already consumes — without touching that file.

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Create: `app/src/modules/game/highest-checkout.module.ts`
- Test: `app/tests/modules/game/highest-checkout.module.test.ts`

**Interfaces:**
- Consumes: `CheckoutVisitDarts`, `DartFact` (already exported from `@modules/types` via `app/src/modules/types.ts`'s existing `export * from "./game/types"` — no barrel change needed here, `game/types` was already raised).
- Produces: type `HighestCheckout` (`@modules/types`); function `highestCheckout` (`@modules/game/highest-checkout.module`).

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/highest-checkout.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { highestCheckout } from "@modules/game/highest-checkout.module";
import type { CheckoutVisitDarts, DartFact } from "@modules/types";

function dart(hitZoneKey: DartFact["hitZoneKey"], score: number): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: null,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

describe("highestCheckout", () => {
  it("returns null when no visit finishes", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("SINGLE", 20)] },
    ];
    expect(highestCheckout(visits)).toBeNull();
  });

  it("returns the finishing value and a repeat count of 1 for a single finish", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 40, timesHit: 1 });
  });

  it("returns the highest finish across visits, ignoring lower ones", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 50, darts: [dart("INNER_BULL", 50)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 50, timesHit: 1 });
  });

  it("counts repeats of the same highest finish value", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 32, darts: [dart("DOUBLE", 32)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 40, timesHit: 2 });
  });

  it("only counts a dart that lands exactly on the remaining score's double or inner bull", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("OUTER_BULL", 25)] },
      { startingRemaining: 36, darts: [dart("DOUBLE", 32)] },
    ];
    expect(highestCheckout(visits)).toBeNull();
  });

  it("finds a finish that isn't the visit's last dart", () => {
    const visits: CheckoutVisitDarts[] = [
      {
        startingRemaining: 100,
        darts: [dart("TREBLE", 60), dart("DOUBLE", 40), dart("SINGLE", 5)],
      },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 40, timesHit: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/game/highest-checkout.module.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Add the result type**

In `app/src/modules/game/types.ts`, immediately after the existing `CheckoutVisitDarts` type (around line 404), add:

```ts

/** The largest successful checkout finish, and how many times it was hit. */
export type HighestCheckout = {
  value: number;
  timesHit: number;
};
```

- [ ] **Step 4: Write the implementation**

Create `app/src/modules/game/highest-checkout.module.ts`:

```ts
import type { CheckoutVisitDarts, DartFact, HighestCheckout } from "./types";

const FINISHING_ZONES: ReadonlySet<DartFact["hitZoneKey"]> = new Set([
  "DOUBLE",
  "INNER_BULL",
]);

function isFinishingDart(remaining: number, dart: DartFact): boolean {
  return FINISHING_ZONES.has(dart.hitZoneKey) && dart.score === remaining;
}

/**
 * The largest remaining score any visit successfully finished, and how many
 * times that exact value was hit. Walks the same `CheckoutVisitDarts` shape
 * `double-attempt.module.ts` classifies, independently -- this measures the
 * finish value itself, not a hit/miss tally, so it does not share that
 * module's classifier.
 */
export function highestCheckout(
  visits: readonly CheckoutVisitDarts[],
): HighestCheckout | null {
  const finishes: number[] = [];
  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      if (isFinishingDart(remaining, dart)) finishes.push(remaining);
      remaining -= dart.score;
    }
  }
  if (finishes.length === 0) return null;
  const value = Math.max(...finishes);
  const timesHit = finishes.filter((finish) => finish === value).length;
  return { value, timesHit };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/game/highest-checkout.module.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/highest-checkout.module.ts \
  app/tests/modules/game/highest-checkout.module.test.ts
git commit -m "$(cat <<'EOF'
Add highest-checkout.module.ts: largest finish + repeat count

Walks the same CheckoutVisitDarts shape double-attempt.module.ts
classifies, independently -- reports the finish value and repeat
count (e.g. "170 x3"), not a hit/miss tally, so it needs no shared
classifier with that module.
EOF
)"
```

---

### Task 8: `scoring-average.module.ts`

Career scoring average, refined to exclude double-attempt darts where classifiable (X01 sessions with dart-level data). Requires exporting the existing private `classifyDart`/`DartOutcome` from `double-attempt.module.ts` — an additive export, no logic change, reused rather than duplicated per that module's own "one classifier, two callers" precedent.

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Modify: `app/src/modules/game/double-attempt.module.ts`
- Modify: `app/tests/modules/game/double-attempt.module.test.ts`
- Create: `app/src/modules/stats/scoring-average.module.ts`
- Test: `app/tests/modules/stats/scoring-average.module.test.ts`

**Interfaces:**
- Consumes: `effectiveDartsForVisit`, `PlayerVisitFactRow` (Task 5); `CheckoutVisitDarts` (`@modules/types`); newly-exported `classifyDart`, `DartOutcome` (`@modules/types`, defined in `app/src/modules/game/types.ts`, function still lives in `double-attempt.module.ts`).
- Produces: function `scoringAverageExcludingDoubles` (`@modules/stats/scoring-average.module`).

- [ ] **Step 1: Write the failing test for the new export**

In `app/tests/modules/game/double-attempt.module.test.ts`, change the existing import:

```ts
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
```

to:

```ts
import { classifyDart, classifyDoubleAttempts } from "@modules/game/double-attempt.module";
```

and add a new `describe` block at the end of the file:

```ts
describe("classifyDart", () => {
  it("is exported directly so other modules can reuse the classification rule", () => {
    expect(classifyDart(40, dart(20, "DOUBLE", 40))).toBe("HIT");
    expect(classifyDart(40, dart(20, "SINGLE", 20))).toBe("MISS");
    expect(classifyDart(121, dart(20, "TREBLE", 60))).toBe("NOT_ATTEMPT");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/game/double-attempt.module.test.ts
```

Expected: FAIL — `classifyDart` is not exported from `@modules/game/double-attempt.module`.

- [ ] **Step 3: Move `DartOutcome` into `types.ts` and export `classifyDart`**

In `app/src/modules/game/types.ts`, immediately after the `HighestCheckout` type added in Task 7, add:

```ts

/** One dart's classification against the remaining score it was thrown at. */
export type DartOutcome = "HIT" | "MISS" | "NOT_ATTEMPT";
```

In `app/src/modules/game/double-attempt.module.ts`, change:

```ts
import type { CheckoutVisitDarts, DartFact, DartZoneKey } from "./types";

export type { CheckoutVisitDarts };
```

to:

```ts
import type { CheckoutVisitDarts, DartFact, DartOutcome, DartZoneKey } from "./types";

export type { CheckoutVisitDarts };
```

and change:

```ts
type DartOutcome = "HIT" | "MISS" | "NOT_ATTEMPT";

/**
 * One dart's classification against the remaining score it was thrown at.
 * `remaining === 50` treats the inner bull as "the required double" and the
 * outer bull as its own near-miss zone; every other eligible remaining
 * treats `remaining / 2` as the required double's segment number.
 */
function classifyDart(remaining: number, dart: DartFact): DartOutcome {
```

to:

```ts
/**
 * One dart's classification against the remaining score it was thrown at.
 * `remaining === 50` treats the inner bull as "the required double" and the
 * outer bull as its own near-miss zone; every other eligible remaining
 * treats `remaining / 2` as the required double's segment number.
 */
export function classifyDart(remaining: number, dart: DartFact): DartOutcome {
```

(This drops the file's own private `DartOutcome` declaration in favor of the one now in `types.ts`, and adds `export` to the function — the classification logic itself is untouched.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/game/double-attempt.module.test.ts
```

Expected: PASS, including the new `classifyDart` block.

- [ ] **Step 5: Write the failing test for the new module**

Create `app/tests/modules/stats/scoring-average.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoringAverageExcludingDoubles } from "@modules/stats/scoring-average.module";
import type { CheckoutVisitDarts, DartFact, PlayerVisitFactRow } from "@modules/types";

function visit(overrides: Partial<PlayerVisitFactRow> = {}): PlayerVisitFactRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    stageId: "stage-1",
    stageTypeKey: "LEG",
    turnSequence: 1,
    totalScore: 60,
    dartCount: 3,
    configuredMaxDartsPerTurn: 3,
    ...overrides,
  };
}

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartFact["hitZoneKey"],
  score: number,
): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

describe("scoringAverageExcludingDoubles", () => {
  it("returns 0 for no visits", () => {
    expect(scoringAverageExcludingDoubles([], [])).toBe(0);
  });

  it("returns the plain 3-dart average when there is no dart-level double-out data", () => {
    const rows = [visit({ totalScore: 60, dartCount: 3 }), visit({ totalScore: 60, dartCount: 3 })];
    expect(scoringAverageExcludingDoubles(rows, [])).toBe(60);
  });

  it("excludes a successful double-attempt dart's score and count", () => {
    const rows = [visit({ totalScore: 140, dartCount: 3 })];
    const doubleOutVisits: CheckoutVisitDarts[] = [
      {
        // 140 -> 80 -> 20 remaining; the third dart opens at 20, an even
        // directly-finishable remaining, so it's a real double attempt.
        startingRemaining: 140,
        darts: [dart(20, "TREBLE", 60), dart(20, "TREBLE", 60), dart(20, "DOUBLE", 20)],
      },
    ];
    // 140 total over 3 darts, minus the 20-point double-attempt dart:
    // (140 - 20) / (3 - 1) * 3 = 180.
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(180);
  });

  it("excludes a missed double-attempt dart too, not just successful ones", () => {
    const rows = [visit({ totalScore: 60, dartCount: 3 })];
    const doubleOutVisits: CheckoutVisitDarts[] = [
      // 40 remaining, needs D20; single 20 is the same segment as the
      // required double -- a plausible errant shot at it (MISS), not a
      // lay-up (NOT_ATTEMPT).
      { startingRemaining: 40, darts: [dart(20, "SINGLE", 20)] },
    ];
    // 60 total over 3 darts, minus the 20-point miss: (60 - 20) / (3 - 1) * 3 = 60.
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(60);
  });

  it("returns 0 rather than dividing by zero when every dart is excluded", () => {
    const rows = [visit({ totalScore: 40, dartCount: 1 })];
    const doubleOutVisits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart(20, "DOUBLE", 40)] },
    ];
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(0);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/stats/scoring-average.module.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Write the implementation**

Create `app/src/modules/stats/scoring-average.module.ts`:

```ts
import { classifyDart } from "@modules/game/double-attempt.module";
import type { CheckoutVisitDarts } from "@modules/types";
import { effectiveDartsForVisit } from "./visit-stats.module";
import type { PlayerVisitFactRow } from "./types";

function attemptDartsTotals(visits: readonly CheckoutVisitDarts[]): {
  score: number;
  count: number;
} {
  let score = 0;
  let count = 0;
  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      if (classifyDart(remaining, dart) !== "NOT_ATTEMPT") {
        score += dart.score;
        count += 1;
      }
      remaining -= dart.score;
    }
  }
  return { score, count };
}

/**
 * Career 3-dart average, excluding darts classified as double-out attempts
 * wherever that classification is available (X01 sessions with dart-level
 * capture). Sessions or darts without that data pass through unrefined --
 * every dart counts as scoring, since there's no basis to say otherwise.
 */
export function scoringAverageExcludingDoubles(
  visitRows: readonly PlayerVisitFactRow[],
  doubleOutVisits: readonly CheckoutVisitDarts[] = [],
): number {
  const totalScore = visitRows.reduce((sum, row) => sum + row.totalScore, 0);
  const totalDarts = visitRows.reduce(
    (sum, row) => sum + effectiveDartsForVisit(row),
    0,
  );
  const attempts = attemptDartsTotals(doubleOutVisits);
  const scoringScore = totalScore - attempts.score;
  const scoringDarts = totalDarts - attempts.count;
  return scoringDarts <= 0 ? 0 : (scoringScore / scoringDarts) * 3;
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/stats/scoring-average.module.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 10: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/double-attempt.module.ts \
  app/tests/modules/game/double-attempt.module.test.ts \
  app/src/modules/stats/scoring-average.module.ts \
  app/tests/modules/stats/scoring-average.module.test.ts
git commit -m "$(cat <<'EOF'
Add scoring-average.module.ts: career avg excluding double attempts

Exports double-attempt.module.ts's existing classifyDart/DartOutcome
(additive, no logic change) so the new module reuses the one
classification rule instead of forking it. Sessions without
dart-level double-out data pass through as the plain 3-dart average.
EOF
)"
```

---

### Task 9: Docs, decisions, and final validation

Registers both new views in `01-General-Views.md` (created here) and the Read-Model-Layer chapter, updates the Context-Map pack row and File-Inventory budgets, appends the decision and context-map history entries, and runs full validation.

**Files:**
- Create: `docs/architecture/05-Database/05-Views/01-General-Views.md`
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `docs/architecture/00-File-Inventory.md`
- Modify: `decisions/database.md`
- Modify: `docs/architecture/00-Context-Map-History.md`

- [ ] **Step 1: Create `01-General-Views.md`**

Create `docs/architecture/05-Database/05-Views/01-General-Views.md`:

```markdown
<!--
status: canonical
scope: database/views/general
read-when: adding or changing a career-wide (cross-game) statistic view
updated: 2026-09-06
-->

# General Views

> Career-wide, cross-game views. See `00-Overview.md` for view philosophy,
> categories, naming, and anti-patterns — this file only documents the views
> themselves. Design: `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md`.

---

# v_player_visit_facts

## Category

Analytics View

## Purpose

One row per completed turn, every game type and capture mode, for
career-wide turn-level stat cards.

## Sources

- turns → participants, exercise_stages → exercise_sessions → game_types, stage_types
- exercise_configurations (LEFT JOIN, for the configured `max_darts_per_turn`)
- darts (LEFT JOIN, for the real dart count)

## Exposes

`session_id`, `player_id`, `game_type_key`, `stage_id`, `stage_type_key`, turn
`sequence_number` (as `turn_sequence`), `total_score`, `completed_at`,
`dart_count` (real count of dart rows, 0 when none exist), and
`configured_max_darts_per_turn` (the ruleset's configured value for the
session, from the JSONB configuration snapshot). Scoped to the session's
OWNING player (`p.player_id = es.player_id`, mirroring `v_dart_analytics`).
Only completed turns are included.

## Design Rationale

`dart_count` and `configured_max_darts_per_turn` are exposed as raw facts,
not combined in SQL, so the application read layer decides its own
best-effort approximation (real count where present, else the configured
max) — the view never fabricates a dart count it doesn't actually have.
Backs total darts thrown, 100/120/140+/180 counts, median visit score,
highest single-game average, career first-9 average, and the base half of
scoring average (`app/src/modules/stats/visit-stats.module.ts`,
`scoring-average.module.ts`).

---

# v_player_leg_facts

## Category

Analytics View

## Purpose

One row per `LEG`-type stage, for best-leg and average-darts-per-leg stat
cards. Only X01 games (501/121/TUOD) ever create a `LEG` stage.

## Sources

- turns → participants, exercise_stages → exercise_sessions → game_types, stage_types (filtered to `LEG`)
- darts (LEFT JOIN, for the real dart count per turn)

## Exposes

`session_id`, `player_id`, `game_type_key`, `stage_id`, and
`total_darts_in_leg` (the owning player's real dart count summed across the
leg's turns). Scoped to the session's OWNING player. A leg is included only
when every one of that player's turns in it has at least one real dart row.

## Design Rationale

Best-leg and average-darts-per-leg need an exact count — approximating a
`QUICK_SCORE` leg's dart total the way `v_player_visit_facts` does for
darts-thrown would fabricate a number that looks exact but isn't (a
checkout or bust can resolve on any dart). The view narrows its own
population instead, the same precedent as `v_dart_analytics`'s "both
intended target and zone present" filter. Backs
`app/src/modules/stats/leg-stats.module.ts`.
```

- [ ] **Step 2: Register both views in the Read-Model-Layer chapter**

In `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md:42`, change:

```
Migration `0023` scopes `v_dart_analytics` and `v_dart_locations` to the session's owning participant; `v_game_replay` is deliberately left unfiltered, because it exists to replay a session as it was played, every participant included. <!-- 2026-08-21 --> Migration `0024` adds `v_double_out_checkout_darts`, scoped to 501 `VISUAL_BOARD` sessions only. <!-- 2026-09-05 --> Future analytics views are described under Future Expansion. <!-- 2026-07-12 -->
```

to:

```
Migration `0023` scopes `v_dart_analytics` and `v_dart_locations` to the session's owning participant; `v_game_replay` is deliberately left unfiltered, because it exists to replay a session as it was played, every participant included. <!-- 2026-08-21 --> Migration `0024` adds `v_double_out_checkout_darts`, scoped to 501 `VISUAL_BOARD` sessions only. <!-- 2026-09-05 --> Migrations `0025`/`0026` add `v_player_visit_facts` and `v_player_leg_facts` for career-wide general stat cards — full detail in `05-Views/01-General-Views.md`, not repeated here. <!-- 2026-09-06 --> Future analytics views are described under Future Expansion. <!-- 2026-07-12 -->
```

- [ ] **Step 3: Add both new views to `00-Overview.md`'s Implemented Views table**

In `docs/architecture/05-Database/05-Views/00-Overview.md`, change:

```
| `v_double_out_checkout_darts` | Analytics | Raw per-dart facts + running leg score for 501 VISUAL_BOARD checkout accuracy, owning player only (2026-09-05) |
```

to:

```
| `v_double_out_checkout_darts` | Analytics | Raw per-dart facts + running leg score for 501 VISUAL_BOARD checkout accuracy, owning player only (2026-09-05) |
| `v_player_visit_facts` | Analytics | One row per completed turn, every game type/capture mode, for career-wide turn-level stats (2026-09-06) |
| `v_player_leg_facts` | Analytics | One row per complete-capture LEG stage, for best-leg/avg-darts-per-leg stats (2026-09-06) |
```

- [ ] **Step 4: Update the Context-Map pack row**

In `docs/architecture/00-Context-Map.md`, change:

```
| New view / analytics query | `05-Database/05-Views/00-Overview.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5.1k |
```

to:

```
| New view / analytics query | `05-Database/05-Views/00-Overview.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5.1k |
| New general (career-wide) stat view | `05-Database/05-Views/01-General-Views.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~3.0k |
```

Recompute both `~Nk` figures with `wc -c <file> | awk '{print $1/4/1000}'`, rounded to one decimal, before committing — the placeholder values above are estimates.

- [ ] **Step 5: Add `01-General-Views.md` to `00-File-Inventory.md`**

In `docs/architecture/00-File-Inventory.md`, immediately after the `05-Views/00-Overview.md` row, add:

```
| `05-Views/01-General-Views.md` | `v_player_visit_facts`/`v_player_leg_facts` view contracts for career-wide stat cards (2026-09-06) | canonical | ~3.0k |
```

Recompute `~3.0k` the same way as Step 4.

- [ ] **Step 6: Append the decision**

Append to `decisions/database.md` (append-only — never edit an existing block). `D257` is the next id: the highest existing id across `decisions/*.md` is `D256` (verified via `grep -rhoE '^### D[0-9]+' decisions/*.md | sed 's/### D//' | sort -n | tail -1` — re-run this immediately before committing in case another decision landed first):

```markdown
### D257 — Split `05-Views.md` into a directory; general stat views expose raw facts, not aggregates

`05-Views.md` became `05-Views/` (`00-Overview.md` + `01-General-Views.md`,
future `02-X01-Views.md` etc.) so per-domain view catalogs don't all pile
into one growing file (2026-09-06).

`v_player_visit_facts`/`v_player_leg_facts` expose row-level facts (real
dart counts, configured maxes), never pre-aggregated stat numbers — the
approximation/exclusion logic (best-effort darts-thrown, doubles-excluded
scoring average) lives in `app/src/modules/stats/*.module.ts`, reusing
`double-attempt.module.ts`'s classifier via an additive export
(`classifyDart`) rather than duplicating its rule. Win-rate was scoped out
of this work entirely — it needs session-replay-from-persisted-facts,
which doesn't exist for any engine yet; see
`docs/superpowers/specs/2026-09-06-general-statistics-views-design.md`.

Supersedes: none.
```

Replace `D-<next>` with the actual next available id per `DECISIONS.md`'s numbering rule.

- [ ] **Step 7: Append the Context-Map-History entries**

In `docs/architecture/00-Context-Map-History.md`, immediately after the `# Version History` heading, prepend a new entry. The current highest is `1.50.0` (verify with `grep -m1 '\*\*Version:\*\*' docs/architecture/00-Context-Map-History.md` immediately before committing, in case another task landed a version first), so the new entry is `1.51.0`:

```
> **Version:** 1.51.0 (2026-09-06 — general-statistics-views: split `05-Views.md` into a directory (`00-Overview.md` + `01-General-Views.md`); added `v_player_visit_facts`/`v_player_leg_facts` (migrations `0025`/`0026`) and five pure stat modules (`career-summary`, `visit-stats`, `leg-stats`, `highest-checkout`, `scoring-average`) covering 16 of the design's 17 stat cards (double accuracy needed no new module — it already reuses `classifyDoubleAttempts`/`accuracyDisplay`). Win-rate deferred to its own plan — no session-replay-from-persisted-facts exists for any engine yet.
```

And in the `# Task Records` table, add two rows:

```
| `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md` | General statistics views design: career-wide stat card catalog (17 cards), the `05-Views.md` → directory restructure, capture-mode best-effort scoping, and the view/app-module split for cross-game stats; win-rate scoped out during plan-writing (session-replay-from-persisted-facts doesn't exist for any engine) (2026-09-06) | historical |
| `docs/superpowers/plans/2026-09-06-general-statistics-views.md` | The 9-task plan implementing that design (minus win-rate): doc restructure, `v_player_visit_facts`/`v_player_leg_facts` migrations, and five pure stat modules (2026-09-06) | historical |
```

- [ ] **Step 8: Run the context-maintenance skill**

Invoke the `context-maintenance` skill and follow its procedure (CLAUDE.md sync, gate scripts, findings check).

- [ ] **Step 9: Run the run-all-gates skill**

Invoke the `run-all-gates` skill for the touched areas (`app/`, `database/`, `docs/`).

- [ ] **Step 10: Final full validation**

```bash
cd app
npm run validate:app
npm run format:check
cd ..
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

Expected: every command exits 0; `validate:app`'s type gate reports 0 errors/0 warnings/0 hints.

- [ ] **Step 11: Commit**

```bash
git add docs/architecture/05-Database/05-Views/01-General-Views.md \
  docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md \
  docs/architecture/05-Database/05-Views/00-Overview.md \
  docs/architecture/00-Context-Map.md docs/architecture/00-File-Inventory.md \
  decisions/database.md docs/architecture/00-Context-Map-History.md
git commit -m "$(cat <<'EOF'
Register general statistics views in docs; append decision + history

01-General-Views.md documents v_player_visit_facts/v_player_leg_facts;
Context-Map/File-Inventory updated with the new pack row and budgets;
decision appended to decisions/database.md.
EOF
)"
```

---

## Rollout order

Tasks 1–9 in the order written: doc restructure first (unblocks nothing but is independent and small), then the two migrations (Tasks 2–3, either order relative to each other but before the modules that consume their row shapes), then the five stat modules (Tasks 4–8, each independent of the others except Task 8 depending on Task 5's `effectiveDartsForVisit`/`PlayerVisitFactRow` and Task 7/8's shared touch on `modules/game/types.ts`), then docs/decisions/validation (Task 9) last.
