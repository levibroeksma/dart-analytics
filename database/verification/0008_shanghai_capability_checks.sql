-- ============================================================
-- Verification: 0008_shanghai_capability_checks.sql
--
-- Mirrors 0007_capability_seed_checks.sql's shape, re-scoped for
-- the additive SHANGHAI_V1 row this seed adds on top of 0007's
-- original 9. No PostgreSQL server exists in the container that
-- authored seeds/0008_shanghai_game_engine_reference.sql (D193),
-- so this script asserts against a real Neon database before
-- merge:
--
--   1. SHANGHAI_V1 + RECREATIONAL + DETAILED_DARTS resolved
--      through the implementation_key joins
--   2. the table now holds exactly the 10 triples declared
--      across 0007 and this file, no more and no fewer (full
--      bidirectional parity with capabilities.ts as of this seed)
--   3. no exercise_sessions row is left undeclared
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
-- Step 2: full-table parity — 0007's 9 triples plus this file's
-- 1 new one, no more and no fewer.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'table holds exactly the 10 declared triples, no more and no fewer',
    CASE
        WHEN count(*) = 10 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 10, found %s', count(*))
FROM ruleset_version_capabilities c
    JOIN ruleset_versions rv ON rv.id = c.ruleset_version_id
    JOIN capture_modes cm ON cm.id = c.capture_mode_id
    JOIN input_modes im ON im.id = c.input_mode_id
WHERE EXISTS (
        SELECT 1
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS')
            ) AS declared(ruleset_key, capture_key, input_key)
        WHERE declared.ruleset_key = rv.implementation_key
            AND declared.capture_key = cm.implementation_key
            AND declared.input_key = im.implementation_key
    );

-- ------------------------------------------------------------
-- Step 3: no live exercise_sessions row is left undeclared.
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
