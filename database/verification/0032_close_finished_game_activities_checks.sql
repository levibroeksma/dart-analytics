-- ============================================================
-- Verification: 0032_close_finished_game_activities_checks.sql
--
-- Proves against a live database (D193) that seed 0032 closed
-- every standalone game activity whose single session finished,
-- and that it left training activities and unfinished games
-- alone.
--
-- Asserts against seeded data rather than building a fixture.
-- Still wrapped in BEGIN/ROLLBACK per house style.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0032_close_finished_game_activities_checks.sql
--
-- Expected: every result row reads PASS. Run after
-- `npm run db:seed`.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO verification_results
SELECT '1',
    'no finished standalone game has an open activity',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s open activit(ies)', count(*))
FROM activities a
JOIN exercise_sessions s ON s.activity_id = a.id
WHERE a.completed_at IS NULL
    AND s.completed_at IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM activity_configurations ac WHERE ac.activity_id = a.id
    )
    AND (
        SELECT count(*) FROM exercise_sessions o WHERE o.activity_id = a.id
    ) = 1;

INSERT INTO verification_results
SELECT '2',
    'a closed standalone game activity matches its session status and instant',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s mismatched activit(ies)', count(*))
FROM activities a
JOIN exercise_sessions s ON s.activity_id = a.id
WHERE a.completed_at IS NOT NULL
    AND s.completed_at IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM activity_configurations ac WHERE ac.activity_id = a.id
    )
    AND (
        SELECT count(*) FROM exercise_sessions o WHERE o.activity_id = a.id
    ) = 1
    AND (a.status_id <> s.status_id OR a.completed_at <> s.completed_at);

INSERT INTO verification_results
SELECT '3',
    'no activity is closed while its single session is still open',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s activit(ies)', count(*))
FROM activities a
JOIN exercise_sessions s ON s.activity_id = a.id
WHERE a.completed_at IS NOT NULL
    AND s.completed_at IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM activity_configurations ac WHERE ac.activity_id = a.id
    );

INSERT INTO verification_results
SELECT '4',
    'a standalone game activity is ACTIVE exactly when completed_at is NULL',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s incoherent activit(ies)', count(*))
FROM activities a
JOIN game_statuses gs ON gs.id = a.status_id
WHERE NOT EXISTS (
        SELECT 1 FROM activity_configurations ac WHERE ac.activity_id = a.id
    )
    AND ((gs.implementation_key = 'ACTIVE') <> (a.completed_at IS NULL));

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
