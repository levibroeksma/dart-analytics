# General Statistics Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the database architecture from `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md`: split `05-Views.md` into a directory, and add the two new Analytics views the design calls for (`v_player_visit_facts`, `v_player_leg_facts`).

**Architecture:** Two new Postgres views expose per-turn and per-leg facts, owning-participant scoped, alongside the existing `v_session_overview`/`v_double_out_checkout_darts`. Views only — no application code, no stat-card modules, no API endpoint, no UI. Consuming these views to compute actual stat numbers is separate work the user is designing themselves.

**Tech Stack:** PostgreSQL (dbmate migrations).

## Global Constraints

- **Scope is database architecture only.** No TypeScript modules, no repository/service wiring, no API endpoint, no UI. The design spec's app-module catalog (career-summary, visit-stats, leg-stats, highest-checkout, scoring-average) is not built here.
- Win rate is out of scope — see the design spec's 2026-09-06 status note (needs session-replay-from-persisted-facts, which doesn't exist for any engine yet).
- Do not touch `v_double_out_checkout_darts` or `double-attempt.module.ts` — that scope belongs to `claude/x01-doubles-accuracy-ljbk6c`.
- Views: Analytics category, owning-participant scoped (`p.player_id = es.player_id`, mirroring `v_dart_analytics`/`v_double_out_checkout_darts`). Joins/filtering/aggregation/arithmetic only — no workflow decisions, no win detection, no game-specific scoring.
- Never modify applied migrations `0001`–`0024`. New schema changes are new migrations `0025`, `0026`.
- Migration behavior is proven with a `database/verification/00NN_*_checks.sql` script (psql, ends in `ROLLBACK`, includes the anti-vacuity "N of N checks ran" row per D192/D193) — not a Vitest test. No live Postgres exists in this container, so these scripts are written and reviewed, but only actually run where `DATABASE_URL` is available.

---

### Task 1: Split `05-Views.md` into a directory

Mechanical relocation only — no content changes beyond path references and the `updated:` date. `01-General-Views.md` is **not** created here; it's created in Task 4 once the two new views actually exist, matching the precedent in `docs/superpowers/plans/2026-09-05-double-out-checkout-accuracy.md` (doc registration happens after the thing being documented is built).

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

One row per completed turn, every game type and capture mode, owning-participant scoped. Exposes the real dart count (0 when no dart rows exist) alongside the configured `max_darts_per_turn`, as raw facts for whatever consumer is built later.

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
-- type and capture mode, for career-wide turn-level statistics.
--
-- dart_count is the REAL count of dart rows for the turn -- 0 for
-- QUICK_SCORE turns, where no dart rows are ever written.
-- configured_max_darts_per_turn is the ruleset's configured value
-- for the session (from exercise_configurations' JSONB snapshot),
-- exposed as a raw fact so the application read layer can decide
-- its own approximation strategy rather than the view guessing.
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
COMMENT ON VIEW v_player_visit_facts IS 'One row per completed turn, every game type and capture mode (owning player only): real dart count plus the configured max-darts-per-turn, for career-wide turn-level statistics.';

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
owning-participant scoped. Real dart count plus configured max,
exposed as raw facts for a future read layer to consume.
EOF
)"
```

---

### Task 3: Migration + verification — `v_player_leg_facts`

One row per `LEG`-stage, only where every one of the owning participant's turns in that leg has real dart rows.

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
-- participant only (X01 games -- 501/121/TUOD -- are the only
-- game types that ever create a LEG stage).
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

### Task 4: Docs, decisions, and final validation

Registers both new views in `01-General-Views.md` (created here) and the Read-Model-Layer chapter, updates the Context-Map pack row and File-Inventory budgets, appends the decision and context-map history entries, and runs full validation.

**Files:**
- Create: `docs/architecture/05-Database/05-Views/01-General-Views.md`
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md`
- Modify: `docs/architecture/05-Database/05-Views/00-Overview.md`
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
>
> These views expose row-level facts only. No application code consumes
> them yet — the stat-card computations (approximation rules, exclusions,
> aggregation) are separate work, designed elsewhere.

---

# v_player_visit_facts

## Category

Analytics View

## Purpose

One row per completed turn, every game type and capture mode, for
career-wide turn-level statistics.

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
not combined in SQL, so any future application read layer decides its own
approximation strategy (e.g. real count where present, else the configured
max) — the view never fabricates a dart count it doesn't actually have.

---

# v_player_leg_facts

## Category

Analytics View

## Purpose

One row per `LEG`-type stage, for best-leg/darts-per-leg style statistics.
Only X01 games (501/121/TUOD) ever create a `LEG` stage.

## Sources

- turns → participants, exercise_stages → exercise_sessions → game_types, stage_types (filtered to `LEG`)
- darts (LEFT JOIN, for the real dart count per turn)

## Exposes

`session_id`, `player_id`, `game_type_key`, `stage_id`, and
`total_darts_in_leg` (the owning player's real dart count summed across the
leg's turns). Scoped to the session's OWNING player. A leg is included only
when every one of that player's turns in it has at least one real dart row.

## Design Rationale

A statistic built on this view needs an exact count — approximating a
`QUICK_SCORE` leg's dart total the way `v_player_visit_facts` does would
fabricate a number that looks exact but isn't (a checkout or bust can
resolve on any dart). The view narrows its own population instead, the
same precedent as `v_dart_analytics`'s "both intended target and zone
present" filter.
```

- [ ] **Step 2: Register both new views in the Read-Model-Layer chapter's migration list**

In `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md:42`, change:

```
Migration `0023` scopes `v_dart_analytics` and `v_dart_locations` to the session's owning participant; `v_game_replay` is deliberately left unfiltered, because it exists to replay a session as it was played, every participant included. <!-- 2026-08-21 --> Migration `0024` adds `v_double_out_checkout_darts`, scoped to 501 `VISUAL_BOARD` sessions only. <!-- 2026-09-05 --> Future analytics views are described under Future Expansion. <!-- 2026-07-12 -->
```

to:

```
Migration `0023` scopes `v_dart_analytics` and `v_dart_locations` to the session's owning participant; `v_game_replay` is deliberately left unfiltered, because it exists to replay a session as it was played, every participant included. <!-- 2026-08-21 --> Migration `0024` adds `v_double_out_checkout_darts`, scoped to 501 `VISUAL_BOARD` sessions only. <!-- 2026-09-05 --> Migrations `0025`/`0026` add `v_player_visit_facts` and `v_player_leg_facts` for career-wide statistics — full detail in `05-Views/01-General-Views.md`, not repeated here. <!-- 2026-09-06 --> Future analytics views are described under Future Expansion. <!-- 2026-07-12 -->
```

- [ ] **Step 3: Add both new views to `00-Overview.md`'s Implemented Views table**

In `docs/architecture/05-Database/05-Views/00-Overview.md`, change:

```
| `v_double_out_checkout_darts` | Analytics | Raw per-dart facts + running leg score for 501 VISUAL_BOARD checkout accuracy, owning player only (2026-09-05) |
```

to:

```
| `v_double_out_checkout_darts` | Analytics | Raw per-dart facts + running leg score for 501 VISUAL_BOARD checkout accuracy, owning player only (2026-09-05) |
| `v_player_visit_facts` | Analytics | One row per completed turn, every game type/capture mode, for career-wide turn-level statistics (2026-09-06) |
| `v_player_leg_facts` | Analytics | One row per complete-capture LEG stage, for best-leg/darts-per-leg style statistics (2026-09-06) |
```

- [ ] **Step 4: Update the Context-Map pack row**

In `docs/architecture/00-Context-Map.md`, change:

```
| New view / analytics query | `05-Database/05-Views/00-Overview.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5.1k |
```

to:

```
| New view / analytics query | `05-Database/05-Views/00-Overview.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5.1k |
| New general (career-wide) stat view | `05-Database/05-Views/01-General-Views.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~2.0k |
```

Recompute both `~Nk` figures with `wc -c <file> | awk '{print $1/4/1000}'`, rounded to one decimal, before committing — the values above are estimates.

- [ ] **Step 5: Add `01-General-Views.md` to `00-File-Inventory.md`**

In `docs/architecture/00-File-Inventory.md`, immediately after the `05-Views/00-Overview.md` row, add:

```
| `05-Views/01-General-Views.md` | `v_player_visit_facts`/`v_player_leg_facts` view contracts for career-wide statistics (2026-09-06) | canonical | ~2.0k |
```

Recompute `~2.0k` the same way as Step 4.

- [ ] **Step 6: Append the decision**

Append to `decisions/database.md` (append-only — never edit an existing block). `D257` is the next id: the highest existing id across `decisions/*.md` is `D256` (verified via `grep -rhoE '^### D[0-9]+' decisions/*.md | sed 's/### D//' | sort -n | tail -1` — re-run this immediately before committing in case another decision landed first):

```markdown
### D257 — Split `05-Views.md` into a directory; general stat views expose raw facts only

`05-Views.md` became `05-Views/` (`00-Overview.md` + `01-General-Views.md`,
future `02-X01-Views.md` etc.) so per-domain view catalogs don't all pile
into one growing file (2026-09-06).

`v_player_visit_facts`/`v_player_leg_facts` expose row-level facts only
(real dart counts, configured maxes) — no stat-card computation, no
application module. That layer is deliberately out of scope for this work
and is being designed separately. Win-rate was scoped out entirely — it
needs session-replay-from-persisted-facts, which doesn't exist for any
engine yet; see
`docs/superpowers/specs/2026-09-06-general-statistics-views-design.md`.

Supersedes: none.
```

- [ ] **Step 7: Append the Context-Map-History entries**

In `docs/architecture/00-Context-Map-History.md`, immediately after the `# Version History` heading, prepend a new entry. The current highest is `1.50.0` (verify with `grep -m1 '\*\*Version:\*\*' docs/architecture/00-Context-Map-History.md` immediately before committing, in case another task landed a version first), so the new entry is `1.51.0`:

```
> **Version:** 1.51.0 (2026-09-06 — general-statistics-views: split `05-Views.md` into a directory (`00-Overview.md` + `01-General-Views.md`); added `v_player_visit_facts`/`v_player_leg_facts` (migrations `0025`/`0026`) exposing career-wide turn/leg facts. Database architecture only — no stat-card computation, no application module; that layer is being designed separately. Win-rate scoped out entirely (no session-replay-from-persisted-facts exists for any engine yet).
```

And in the `# Task Records` table, add two rows:

```
| `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md` | General statistics views design: career-wide stat card catalog (17 cards), the `05-Views.md` → directory restructure, capture-mode best-effort scoping, and the view/app-module split for cross-game stats; win-rate scoped out during plan-writing (session-replay-from-persisted-facts doesn't exist for any engine); the implementation plan was further narrowed to database architecture only, at the user's request (2026-09-06) | historical |
| `docs/superpowers/plans/2026-09-06-general-statistics-views.md` | The 4-task plan implementing the database half of that design: doc restructure and `v_player_visit_facts`/`v_player_leg_facts` migrations. Stat-card computation (the design's app-module catalog) is out of scope — the user is designing that layer separately (2026-09-06) | historical |
```

- [ ] **Step 8: Run the context-maintenance skill**

Invoke the `context-maintenance` skill and follow its procedure (CLAUDE.md sync, gate scripts, findings check).

- [ ] **Step 9: Run the run-all-gates skill**

Invoke the `run-all-gates` skill for the touched areas (`database/`, `docs/`).

- [ ] **Step 10: Final full validation**

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

Expected: every command exits 0.

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

Tasks 1–4 in the order written: doc restructure first (independent, unblocks nothing), then the two migrations (Tasks 2–3, either order relative to each other), then docs/decisions/validation (Task 4) last, once both views exist to document.
