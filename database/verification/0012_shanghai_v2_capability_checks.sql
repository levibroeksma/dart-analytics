-- ============================================================
-- Verification: 0012_shanghai_v2_capability_checks.sql
--
-- Mirrors 0011_one_twenty_one_v2_capability_checks.sql's shape,
-- re-scoped for the additive SHANGHAI_V2 rows appended to 0007_
-- ruleset_version_capabilities.sql's own VALUES list. No
-- PostgreSQL server exists in the container that authored this
-- file (D193), so it asserts against a real Neon database
-- before merge:
--
--   1. SHANGHAI_V2 + RECREATIONAL + DETAILED_DARTS resolved
--   2. SHANGHAI_V2 + ANALYTICS + VISUAL_BOARD resolved
--   3. no exercise_sessions row is left undeclared
--
-- Full-table exact-count parity lives in
-- 0007_capability_seed_checks.sql alone. This script owns only
-- SHANGHAI_V2's own additions.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0012_shanghai_v2_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0012.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: SHANGHAI_V2 + RECREATIONAL + DETAILED_DARTS resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'SHANGHAI_V2 / RECREATIONAL / DETAILED_DARTS resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for SHANGHAI_V2'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'DETAILED_DARTS'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'SHANGHAI_V2';

-- ------------------------------------------------------------
-- Step 2: SHANGHAI_V2 + ANALYTICS + VISUAL_BOARD resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'SHANGHAI_V2 / ANALYTICS / VISUAL_BOARD resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for SHANGHAI_V2'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'ANALYTICS'
    LEFT JOIN input_modes im ON im.implementation_key = 'VISUAL_BOARD'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'SHANGHAI_V2';

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
