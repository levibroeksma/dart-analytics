-- ============================================================
-- Verification: 0007_capability_seed_checks.sql
--
-- Runs task-2-brief.md's Steps 1, 3 and 4 as assertions against
-- a live database, since no PostgreSQL server exists in the
-- container that authored seeds/0007_ruleset_version_capabilities.sql
-- (D193 — SQL that cannot be applied locally ships with a
-- verification script the owner runs against the real Neon
-- database before merge):
--
--   1. seeds/0007 inserted a non-zero, exact row count
--   2. every declared (ruleset, capture, input) triple resolved
--      through the implementation_key joins — no typo silently
--      dropped a row
--   3. no exercise_sessions row is left undeclared — the exact
--      precondition migration 0020's composite FK requires
--   4. the table holds exactly the triples declared in
--      app/src/lib/game/rulesets/capabilities.ts, no more and
--      no fewer (parity — a later test proves code and seed
--      agree; this proves seed and live data agree)
--
-- This script does not build its own fixture: unlike
-- 0018_visual_board_checks.sql it asserts against the
-- already-applied seed/session data rather than exercising a
-- constraint that needs synthetic rows. It still wraps in
-- BEGIN/ROLLBACK per the house style so it can never leave
-- anything behind, and so it composes safely with scripts that
-- do insert fixtures when run together via `npm run db:verify`.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0007_capability_seed_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: the seed inserted a non-zero, exact row count.
--
-- A count of 0 means every JOIN in the seed missed and the
-- table is silently empty — the single easiest way for this
-- seed to fail quietly.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'seed inserted exactly the 14 declared rows',
    CASE
        WHEN count(*) = 14 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 14, found %s', count(*))
FROM ruleset_version_capabilities;

-- ------------------------------------------------------------
-- Step 2: every declared triple resolved through the
-- implementation_key joins.
--
-- Driven by a VALUES list (not the table), left-joined out to
-- ruleset_version_capabilities, so a row an implementation_key
-- typo dropped shows up as an explicit FAIL rather than simply
-- being absent from the results.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    format(
        '%s / %s / %s resolves to a seeded row',
        declared.ruleset_key,
        declared.capture_key,
        declared.input_key
    ),
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for ' || declared.ruleset_key
        WHEN cm.id IS NULL THEN 'no capture_modes row for ' || declared.capture_key
        WHEN im.id IS NULL THEN 'no input_modes row for ' || declared.input_key
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM (
        VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('AROUND_THE_CLOCK_V1', 'ANALYTICS', 'VISUAL_BOARD')
    ) AS declared(ruleset_key, capture_key, input_key)
    LEFT JOIN ruleset_versions rv ON rv.implementation_key = declared.ruleset_key
    LEFT JOIN capture_modes cm ON cm.implementation_key = declared.capture_key
    LEFT JOIN input_modes im ON im.implementation_key = declared.input_key
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id;

-- Driven by a fixed 9-row VALUES list, so this can only be short if the
-- VALUES list above was edited down — guard it anyway per house style.
INSERT INTO verification_results
SELECT '2',
    'all 14 declared triples were actually checked',
    CASE
        WHEN count(*) = 14 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 14 triple checks ran', count(*))
FROM verification_results
WHERE step = '2';

-- ------------------------------------------------------------
-- Step 3: no live exercise_sessions row is left undeclared.
--
-- This is the exact query from task-2-brief.md Step 4 and the
-- precondition migration 0020's composite FK depends on. The
-- inner SELECT reports the total sessions considered alongside
-- the undeclared count, so a PASS on an empty exercise_sessions
-- table is visibly a PASS-by-vacuity rather than a real check.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
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
-- Step 4: parity with app/src/lib/game/rulesets/capabilities.ts
--
-- capabilities.ts's RULESET_CAPABILITIES (source of truth) is
-- transcribed literally in the VALUES list below — SQL cannot
-- import the TS module, so this is a manual mirror; a Vitest
-- parity test proves the seed file and capabilities.ts agree,
-- this proves the live table and capabilities.ts agree. Step 2
-- already proved every declared triple is present; this proves
-- the table holds nothing else (bidirectional parity).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'table holds no capability row outside capabilities.ts',
    CASE
        WHEN count(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s unexpected row(s)', count(*))
FROM ruleset_version_capabilities c
    JOIN ruleset_versions rv ON rv.id = c.ruleset_version_id
    JOIN capture_modes cm ON cm.id = c.capture_mode_id
    JOIN input_modes im ON im.id = c.input_mode_id
WHERE NOT EXISTS (
        SELECT 1
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('AROUND_THE_CLOCK_V1', 'ANALYTICS', 'VISUAL_BOARD')
            ) AS declared(ruleset_key, capture_key, input_key)
        WHERE declared.ruleset_key = rv.implementation_key
            AND declared.capture_key = cm.implementation_key
            AND declared.input_key = im.implementation_key
    );

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
