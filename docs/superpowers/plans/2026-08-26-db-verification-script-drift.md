# DB Verification Script Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close findings F7, F11, F13 — fix drift in three `database/verification/*.sql` scripts and add the one that's missing, per `docs/superpowers/specs/2026-08-26-db-verification-script-drift-design.md`.

**Architecture:** Pure SQL edits under `database/verification/`. No migration, seed, or `app/` change. Each script is edited/created in isolation and is independently readable — there is no shared code between them beyond copy-pasted structural conventions (temp results table, `ROLLBACK`, `implementation_key` lookups).

**Tech Stack:** PostgreSQL (Neon), plain `.sql` files run via `npm run db:verify` (`app/scripts/verify-db.ts`) or `psql`.

## Global Constraints

- No `DATABASE_URL` in this sandbox — these scripts cannot be executed here (established gap, D193 precedent). Every task's "verify" step is read/grep-based self-consistency, never a live `psql`/`db:verify` run. The PR description must say so and ask the branch owner to run `npm run db:verify` against the real Neon database before merge.
- Every script ends in `ROLLBACK` — a script that inserts fixture rows never `COMMIT`s.
- Lookup rows are resolved by `implementation_key` inside the script, never by a hardcoded numeric id (the one exception: `participant_types` CHECK constraints on the `participants` table itself hardcode `participant_type_id = 1`/`<> 3` — that is schema, not a fixture choice, and is not touched by this plan).
- `database/CLAUDE.md` Hard Constraint: never modify applied migrations. This plan touches only `database/verification/`, never `database/migrations/`.
- This is a doc/SQL-only change set — no `app/src/**/*.ts` or `app/scripts/**/*.ts` file is touched, so `scripts/check-test-coverage.sh` has nothing to flag and no Vitest task is needed.
- Final task is the mandatory context-maintenance close-out (`FINDINGS.md`, `docs/architecture/00-Context-Map-History.md`) — do not skip it.

---

### Task 1: F7 — narrow 0008/0009/0010 to their own rows

**Files:**
- Modify: `database/verification/0008_shanghai_capability_checks.sql`
- Modify: `database/verification/0009_121_capability_checks.sql`
- Modify: `database/verification/0010_around_the_clock_capability_checks.sql`

**Interfaces:** None — these are standalone SQL scripts with no consumers besides `app/scripts/verify-db.ts`, which runs every `.sql` file in the directory unmodified (no per-file API).

- [ ] **Step 1: Rewrite `0008_shanghai_capability_checks.sql`**

Replace the entire file content with:

```sql
-- ============================================================
-- Verification: 0008_shanghai_capability_checks.sql
--
-- Mirrors 0007_capability_seed_checks.sql's shape, re-scoped for
-- the additive SHANGHAI_V1 row appended to 0007_ruleset_version_
-- capabilities.sql's own VALUES list. No PostgreSQL server exists
-- in the container that authored this file (D193), so it asserts
-- against a real Neon database before merge:
--
--   1. SHANGHAI_V1 + RECREATIONAL + DETAILED_DARTS resolved
--      through the implementation_key joins
--   2. no exercise_sessions row is left undeclared
--
-- Full-table exact-count parity (every declared triple present,
-- no unexpected row) lives in 0007_capability_seed_checks.sql
-- alone — 0007's own seed file is the single running ledger every
-- ruleset's capability rows are appended to, so it already
-- re-verifies the whole table on every run. This script owns only
-- SHANGHAI_V1's own addition, so a later game's own additive
-- script never requires editing this one (F7).
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0008_shanghai_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0008.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: SHANGHAI_V1 + RECREATIONAL + DETAILED_DARTS resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'SHANGHAI_V1 / RECREATIONAL / DETAILED_DARTS resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for SHANGHAI_V1'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'DETAILED_DARTS'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'SHANGHAI_V1';

-- ------------------------------------------------------------
-- Step 2: no live exercise_sessions row is left undeclared.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'no exercise_sessions row is undeclared',
    CASE
        WHEN undeclared = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of %s session(s) undeclared', undeclared, total)
FROM (
        SELECT count(*) AS total,
            count(*) FILTER (
                WHERE NOT EXISTS (
                        SELECT 1
                        FROM ruleset_version_capabilities c
                        WHERE c.ruleset_version_id = es.ruleset_version_id
                            AND c.capture_mode_id = es.capture_mode_id
                            AND c.input_mode_id = es.input_mode_id
                    )
            ) AS undeclared
        FROM exercise_sessions es
    ) counts;

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step,
    result,
    check_name,
    detail
FROM verification_results
ORDER BY step,
    check_name;

SELECT CASE
        WHEN count(*) FILTER (
            WHERE result = 'FAIL'
        ) = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format(
            '%s OF %s CHECKS FAILED',
            count(*) FILTER (
                WHERE result = 'FAIL'
            ),
            count(*)
        )
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 2: Rewrite `0009_121_capability_checks.sql`**

Replace the entire file content with:

```sql
-- ============================================================
-- Verification: 0009_121_capability_checks.sql
--
-- Mirrors 0008_shanghai_capability_checks.sql's shape, re-scoped
-- for the additive 121_V1 row appended to 0007_ruleset_version_
-- capabilities.sql's own VALUES list. No PostgreSQL server exists
-- in the container that authored this file (D193), so it asserts
-- against a real Neon database before merge:
--
--   1. 121_V1 + RECREATIONAL + QUICK_SCORE resolved through the
--      implementation_key joins
--   2. no exercise_sessions row is left undeclared
--
-- Full-table exact-count parity (every declared triple present,
-- no unexpected row) lives in 0007_capability_seed_checks.sql
-- alone — see that file's header for why. This script owns only
-- 121_V1's own addition (F7).
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0009_121_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0009.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: 121_V1 + RECREATIONAL + QUICK_SCORE resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    '121_V1 / RECREATIONAL / QUICK_SCORE resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for 121_V1'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'QUICK_SCORE'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = '121_V1';

-- ------------------------------------------------------------
-- Step 2: no live exercise_sessions row is left undeclared.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'no exercise_sessions row is undeclared',
    CASE
        WHEN undeclared = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of %s session(s) undeclared', undeclared, total)
FROM (
        SELECT count(*) AS total,
            count(*) FILTER (
                WHERE NOT EXISTS (
                        SELECT 1
                        FROM ruleset_version_capabilities c
                        WHERE c.ruleset_version_id = es.ruleset_version_id
                            AND c.capture_mode_id = es.capture_mode_id
                            AND c.input_mode_id = es.input_mode_id
                    )
            ) AS undeclared
        FROM exercise_sessions es
    ) counts;

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step,
    result,
    check_name,
    detail
FROM verification_results
ORDER BY step,
    check_name;

SELECT CASE
        WHEN count(*) FILTER (
            WHERE result = 'FAIL'
        ) = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format(
            '%s OF %s CHECKS FAILED',
            count(*) FILTER (
                WHERE result = 'FAIL'
            ),
            count(*)
        )
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 3: Rewrite `0010_around_the_clock_capability_checks.sql`**

Replace the entire file content with:

```sql
-- ============================================================
-- Verification: 0010_around_the_clock_capability_checks.sql
--
-- Mirrors 0008_shanghai_capability_checks.sql's and
-- 0009_121_capability_checks.sql's shape, re-scoped for the
-- additive AROUND_THE_CLOCK_V1 row appended to 0007_ruleset_
-- version_capabilities.sql's own VALUES list. No PostgreSQL
-- server exists in the container that authored this file (D193),
-- so it asserts against a real Neon database before merge:
--
--   1. AROUND_THE_CLOCK_V1 + RECREATIONAL + DETAILED_DARTS
--      resolved through the implementation_key joins
--   2. no exercise_sessions row is left undeclared
--
-- Full-table exact-count parity (every declared triple present,
-- no unexpected row) lives in 0007_capability_seed_checks.sql
-- alone — see that file's header for why. This script owns only
-- AROUND_THE_CLOCK_V1's own addition (F7).
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0010_around_the_clock_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0010.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: AROUND_THE_CLOCK_V1 + RECREATIONAL + DETAILED_DARTS resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'AROUND_THE_CLOCK_V1 / RECREATIONAL / DETAILED_DARTS resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for AROUND_THE_CLOCK_V1'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'DETAILED_DARTS'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'AROUND_THE_CLOCK_V1';

-- ------------------------------------------------------------
-- Step 2: no live exercise_sessions row is left undeclared.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'no exercise_sessions row is undeclared',
    CASE
        WHEN undeclared = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of %s session(s) undeclared', undeclared, total)
FROM (
        SELECT count(*) AS total,
            count(*) FILTER (
                WHERE NOT EXISTS (
                        SELECT 1
                        FROM ruleset_version_capabilities c
                        WHERE c.ruleset_version_id = es.ruleset_version_id
                            AND c.capture_mode_id = es.capture_mode_id
                            AND c.input_mode_id = es.input_mode_id
                    )
            ) AS undeclared
        FROM exercise_sessions es
    ) counts;

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step,
    result,
    check_name,
    detail
FROM verification_results
ORDER BY step,
    check_name;

SELECT CASE
        WHEN count(*) FILTER (
            WHERE result = 'FAIL'
        ) = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format(
            '%s OF %s CHECKS FAILED',
            count(*) FILTER (
                WHERE result = 'FAIL'
            ),
            count(*)
        )
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 4: Verify no full-table count assertion remains**

Run: `grep -n "count(\*) = 1[012]\|holds exactly" database/verification/0008_shanghai_capability_checks.sql database/verification/0009_121_capability_checks.sql database/verification/0010_around_the_clock_capability_checks.sql`
Expected: no output (no matches in any of the three files).

- [ ] **Step 5: Verify step numbering is exactly 1 and 2 in each file**

Run: `grep -n "^-- Step" database/verification/0008_shanghai_capability_checks.sql database/verification/0009_121_capability_checks.sql database/verification/0010_around_the_clock_capability_checks.sql`
Expected: each file shows exactly two lines — `-- Step 1: ...` and `-- Step 2: ...` (no `Step 3`).

- [ ] **Step 6: Commit**

```bash
git add database/verification/0008_shanghai_capability_checks.sql database/verification/0009_121_capability_checks.sql database/verification/0010_around_the_clock_capability_checks.sql
git commit -m "$(cat <<'EOF'
fix: narrow per-game capability verification scripts to their own rows (F7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XQS8nWbZiNQq9viCd4i1ro
EOF
)"
```

---

### Task 2: F11 — reword the stale "9-row" comment

**Files:**
- Modify: `database/verification/0007_capability_seed_checks.sql:117-118`

**Interfaces:** None.

- [ ] **Step 1: Replace the stale comment**

Old text (lines 117-118):

```sql
-- Driven by a fixed 9-row VALUES list, so this can only be short if the
-- VALUES list above was edited down — guard it anyway per house style.
```

New text:

```sql
-- Guards against a future edit shortening the VALUES list above without
-- updating the counts this script asserts — the check-count would then
-- silently read as fewer triples checked, not FAIL.
```

- [ ] **Step 2: Verify the stale number is gone**

Run: `grep -n "9-row\|fixed 9" database/verification/0007_capability_seed_checks.sql`
Expected: no output.

- [ ] **Step 3: Verify the file still ends in ROLLBACK and Step 2's SELECT is untouched**

Run: `grep -n "^ROLLBACK;\|all 18 declared triples were actually checked" database/verification/0007_capability_seed_checks.sql`
Expected: two lines — the `ROLLBACK;` line and the untouched check-name line from Step 2's count assertion (this task only edits the comment, not the surrounding SQL).

- [ ] **Step 4: Commit**

```bash
git add database/verification/0007_capability_seed_checks.sql
git commit -m "$(cat <<'EOF'
docs: reword stale VALUES-list row-count comment (F11)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XQS8nWbZiNQq9viCd4i1ro
EOF
)"
```

---

### Task 3: F13 — add the missing owner-scoped dart view verification script

**Files:**
- Create: `database/verification/0023_owner_scoped_dart_view_checks.sql`

**Interfaces:**
- Consumes: `v_dart_analytics`, `v_dart_locations`, `v_game_replay` (migration `0023_owner_scoped_dart_views.sql`); `players`, `activities`, `exercise_sessions`, `exercise_stages`, `participants`, `turns`, `darts` runtime tables; `ruleset_versions`, `capture_modes`, `input_modes`, `game_statuses`, `stage_types`, `participant_types`, `dart_zones` lookup tables, all resolved by `implementation_key`.
- Produces: nothing consumed by later tasks — this is a standalone leaf script, same as every other file in `database/verification/`.

- [ ] **Step 1: Create the new verification script**

Create `database/verification/0023_owner_scoped_dart_view_checks.sql`:

```sql
-- ============================================================
-- Verification: 0023_owner_scoped_dart_view_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0023_owner_scoped_dart_views.sql (D193 — SQL that
-- cannot be applied locally ships with a verification script the
-- owner runs against the real Neon database before merge):
--
--   1. v_dart_analytics returns only the session owner's own
--      dart, not a GUEST participant's, for a session with one
--      of each
--   2. v_dart_locations does the same
--   3. v_game_replay returns BOTH participants' turns for the
--      same session — proving the lack of owner-scoping there
--      (migration 0023's own comment) is deliberate, not a gap
--      this script is failing to also catch
--
-- Everything runs inside one transaction that ends in ROLLBACK,
-- so no fixture row survives. Lookup rows are resolved by
-- implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0023_owner_scoped_dart_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0023.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: one session, one PLAYER participant (the session
-- owner) and one GUEST participant, each with one turn and one
-- dart. Each dart sets both the intended-target pair (required
-- by v_dart_analytics) and the location pair (required by
-- v_dart_locations), so a single fixture dart per participant
-- proves both views at once. The two darts use distinct
-- hit_target_number and location_x values so a check can tell
-- whose row it is looking at.
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000002301',
        'verification-0023-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002302',
        '01990000-0000-7000-8000-000000002301',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

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
SELECT '01990000-0000-7000-8000-000000002303',
    '01990000-0000-7000-8000-000000002302',
    '01990000-0000-7000-8000-000000002301',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'RECREATIONAL'),
    (SELECT id FROM input_modes WHERE implementation_key = 'QUICK_SCORE'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = 'TUOD_V1';

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002304',
        '01990000-0000-7000-8000-000000002303',
        (SELECT id FROM stage_types WHERE implementation_key = 'MATCH'),
        1,
        now()
    );

INSERT INTO participants (
        id,
        exercise_session_id,
        participant_type_id,
        player_id,
        display_name,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002305',
        '01990000-0000-7000-8000-000000002303',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002301',
        'Verification Owner',
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002306',
        '01990000-0000-7000-8000-000000002303',
        (SELECT id FROM participant_types WHERE implementation_key = 'GUEST'),
        NULL,
        'Verification Guest',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002307',
        '01990000-0000-7000-8000-000000002304',
        '01990000-0000-7000-8000-000000002305',
        1,
        20,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002308',
        '01990000-0000-7000-8000-000000002304',
        '01990000-0000-7000-8000-000000002306',
        1,
        19,
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        intended_target_number,
        intended_zone_id,
        hit_target_number,
        hit_zone_id,
        score,
        location_x,
        location_y,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002309',
        '01990000-0000-7000-8000-000000002307',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        20,
        5.00,
        5.00,
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000230a',
        '01990000-0000-7000-8000-000000002308',
        1,
        19,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        19,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        19,
        -5.00,
        -5.00,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: v_dart_analytics returns only the owner's dart.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_dart_analytics returns exactly 1 row for the fixture session',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 1, found %s', count(*))
FROM v_dart_analytics
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '1',
    'v_dart_analytics row belongs to the PLAYER, not the GUEST',
    CASE
        WHEN hit_target_number = 20 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('hit_target_number=%s (expected 20, the owner''s dart -- 19 would be the guest''s)', hit_target_number)
FROM v_dart_analytics
WHERE session_id = '01990000-0000-7000-8000-000000002303';

-- ------------------------------------------------------------
-- Step 2: v_dart_locations returns only the owner's dart.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'v_dart_locations returns exactly 1 row for the fixture session',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 1, found %s', count(*))
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '2',
    'v_dart_locations row belongs to the PLAYER, not the GUEST',
    CASE
        WHEN location_x = 5.00 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('location_x=%s (expected 5.00, the owner''s dart -- -5.00 would be the guest''s)', location_x)
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-000000002303';

-- ------------------------------------------------------------
-- Step 3: v_game_replay is deliberately NOT owner-scoped -- it
-- must return BOTH participants' turns for the same session.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'v_game_replay returns 2 turn rows (one per participant) for the fixture session',
    CASE
        WHEN count(*) = 2 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 2, found %s', count(*))
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '3',
    'v_game_replay rows are Verification Owner and Verification Guest',
    CASE
        WHEN names.agg = ARRAY['Verification Guest', 'Verification Owner'] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('found participant_name(s): %s', names.agg)
FROM (
        SELECT array_agg(
                DISTINCT participant_name
                ORDER BY participant_name
            ) AS agg
        FROM v_game_replay
        WHERE session_id = '01990000-0000-7000-8000-000000002303'
    ) names;

-- ------------------------------------------------------------
-- Anti-vacuity guard: several checks above are driven by a
-- SELECT against a view, so a broken column could make one
-- vanish silently instead of failing. Assert the count of
-- checks that actually ran separately (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'all 6 view-driven checks actually ran',
    CASE
        WHEN count(*) = 6 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 6 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3');

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step,
    result,
    check_name,
    detail
FROM verification_results
ORDER BY step,
    check_name;

SELECT CASE
        WHEN count(*) FILTER (
            WHERE result = 'FAIL'
        ) = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format(
            '%s OF %s CHECKS FAILED',
            count(*) FILTER (
                WHERE result = 'FAIL'
            ),
            count(*)
        )
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 2: Verify the script ends in ROLLBACK and never COMMITs**

Run: `grep -n "^COMMIT;\|^ROLLBACK;" database/verification/0023_owner_scoped_dart_view_checks.sql`
Expected: exactly one line, `ROLLBACK;` at the end of the file — no `COMMIT;` anywhere.

- [ ] **Step 3: Verify every fixture lookup resolves by implementation_key**

Run: `grep -n "implementation_key = '" database/verification/0023_owner_scoped_dart_view_checks.sql`
Expected: 12 matches — `ACTIVE` (x2, activity + session status), `RECREATIONAL`, `QUICK_SCORE`, `TUOD_V1`, `MATCH`, `PLAYER`, `GUEST`, `SINGLE` (x4, two darts x intended/hit zone). No numeric lookup id is hardcoded anywhere in the file.

- [ ] **Step 4: Verify the fixture UUIDs are internally consistent**

Run: `grep -o "01990000-0000-7000-8000-0000000023[0-9a-f][0-9a-f]" database/verification/0023_owner_scoped_dart_view_checks.sql | sort -u`
Expected: 10 distinct UUIDs (`...2301` through `...2309`, plus `...230a`), each referenced by at least 2 lines (one INSERT, one or more reads/FK references) — confirms no fixture id is orphaned or misspelled.

- [ ] **Step 5: Commit**

```bash
git add database/verification/0023_owner_scoped_dart_view_checks.sql
git commit -m "$(cat <<'EOF'
test: add owner-scoped dart view verification script (F13)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XQS8nWbZiNQq9viCd4i1ro
EOF
)"
```

---

### Task 4: Context maintenance close-out

**Files:**
- Modify: `FINDINGS.md`
- Modify: `docs/architecture/00-Context-Map-History.md`

**Interfaces:** None.

- [ ] **Step 1: Delete the F7 block from `FINDINGS.md`**

Remove this entire block (including the blank line after it):

```markdown
### F7 — Per-game capability verification scripts each assert the complete capability set
Status: Open · Found: 2026-08-19 · Task: claude/consistency-spec3
Claim: `database/verification/0010_around_the_clock_capability_checks.sql` is scoped to the one additive `AROUND_THE_CLOCK_V1` row, but its check 2 asserts "the table now holds exactly the 12 triples", i.e. every earlier game's rows too
Evidence: `database/verification/0010_around_the_clock_capability_checks.sql` header check 2, and the same shape in `database/verification/0009_121_capability_checks.sql`
Impact: game ten's seed makes both scripts fail on their exact-count assertion, so adding a game means either editing every earlier per-game verification script or knowingly leaving them stale — neither is what a per-game, additive script implies
Proposed: keep the exact-count parity assertion in the one shared `0007_capability_seed_checks.sql` and narrow the per-game scripts to their own rows
```

- [ ] **Step 2: Delete the F11 block from `FINDINGS.md`**

Remove this entire block (including the blank line after it):

```markdown
### F11 — A capability-seed verification script's row-count assertions had already drifted stale
Status: Open · Found: 2026-08-20 · Task: claude/tuod-analytics-plan-os3v5f
Claim: `database/verification/0007_capability_seed_checks.sql` asserted `ruleset_version_capabilities` held exactly 14 rows, with a VALUES list of 14 declared triples to match
Evidence: `database/verification/0007_capability_seed_checks.sql` (before this task's fix) vs `database/seeds/0007_ruleset_version_capabilities.sql`, which already held 17 rows at the start of this task — three other rulesets' own `ANALYTICS + VISUAL_BOARD` additions had updated the seed without a matching update to this verification script. This task corrected the count to the real 17 → 18 (after adding TUOD's own row) rather than the originally-planned 14 → 15, but left one descriptive comment ("Driven by a fixed 9-row VALUES list, so this can only be short if the VALUES list above was edited down") unchanged — it was already inaccurate before this task (the list has always had far more than 9 rows) and remains so
Impact: an agent trusting the row-count text (or the "9-row" comment) as ground truth for how many capability pairs exist would undercount before this fix, and the leftover comment can still mislead about the VALUES list's actual size after it
Proposed: reword or remove the "9-row" comment near `database/verification/0007_capability_seed_checks.sql`'s Step 2 count-check to state what it actually guards (that the checked-triple count matches the declared VALUES list, whatever its current length), rather than naming a specific row count
```

- [ ] **Step 3: Delete the F13 block from `FINDINGS.md`**

Remove this entire block:

```markdown
### F13 — `scripts/verify-db.ts` does not cover the two dart analytics views
Status: Open · Found: 2026-08-21 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: migration `0023` changes `v_dart_analytics` and `v_dart_locations`, but neither view has a `database/verification/*.sql` script, so no automated check proves the new participant filter behaves as intended against a real database
Evidence: `database/verification/` holds scripts for `0007` capabilities, `0021` player settings and `0022` player profile among others, with no `0014`/`0018`/`0023` dart-view equivalent; `app/package.json:23` `db:verify` runs `app/scripts/verify-db.ts`
Impact: the filter's correctness rests on reading the SQL. The specific case worth proving — a session with one PLAYER and one GUEST returns only the PLAYER's dart rows, while `v_game_replay` returns both — is exactly the one no existing test covers, and this task could not run any database check at all (no `DATABASE_URL` in the execution container)
Proposed: add `database/verification/0023_owner_scoped_dart_view_checks.sql` asserting the two views' owner scoping and `v_game_replay`'s deliberate lack of it, following `0022_player_profile_checks.sql`'s shape
```

- [ ] **Step 4: Bump the front-matter `updated` date**

In `FINDINGS.md`'s front matter, change:

```
updated: 2026-08-23
```

to:

```
updated: 2026-08-26
```

Leave `highest-issued: F28` unchanged — this task closes findings, it does not open any.

- [ ] **Step 5: Verify FINDINGS.md no longer mentions F7/F11/F13**

Run: `grep -n "^### F7 \|^### F11 \|^### F13 " FINDINGS.md`
Expected: no output.

- [ ] **Step 6: Register the task in `docs/architecture/00-Context-Map-History.md`**

Insert this new entry immediately below the `# Version History` heading (i.e. directly above the existing `> **Version:** 1.24.0 ...` line, so it becomes the new topmost/most-recent entry):

```markdown
> **Version:** 1.25.0 (2026-08-26 — DB verification script drift closed: F7 (narrowed `database/verification/0008_shanghai_capability_checks.sql`, `0009_121_capability_checks.sql`, `0010_around_the_clock_capability_checks.sql` to their own game's row plus the shared "no undeclared session" check, dropping each script's stale full-table exact-count assertion — full bidirectional parity against `capabilities.ts` already lives in `0007_capability_seed_checks.sql` alone, which re-verifies the whole table on every run since its seed file is the single running ledger; 0008 included even though F7's evidence named only 0009/0010, since it carried the identical stale-count defect), F11 (reworded `0007_capability_seed_checks.sql`'s stale "fixed 9-row VALUES list" comment to describe what the guard checks without naming a specific count), F13 (added `database/verification/0023_owner_scoped_dart_view_checks.sql` — a PLAYER + GUEST fixture proving `v_dart_analytics`/`v_dart_locations` return only the owning player's dart while `v_game_replay` deliberately returns both, per migration `0023`'s own comment). Verification-script-only change set, no `app/` or migration/seed files touched. Validation: `scripts/check-context-map.sh`, `scripts/check-findings-log.sh`, `scripts/check-doc-links.sh` pass; the four edited/new `.sql` files could not be executed against a live database in this sandbox (no `DATABASE_URL`, established D193 precedent) — `npm run db:verify` still needs to run against the real Neon database before merge)
```

- [ ] **Step 7: Run the context/findings gate scripts directly**

Run: `bash scripts/check-context-map.sh && bash scripts/check-findings-log.sh && bash scripts/check-doc-links.sh`
Expected: all three print `OK`-style success output and exit 0.

- [ ] **Step 8: Commit**

```bash
git add FINDINGS.md docs/architecture/00-Context-Map-History.md
git commit -m "$(cat <<'EOF'
docs: close F7, F11, F13 and register db-verification-script-drift task

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XQS8nWbZiNQq9viCd4i1ro
EOF
)"
```
