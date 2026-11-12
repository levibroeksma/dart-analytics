-- ============================================================
-- Verification: 0055_x01_checkout_darts_coordinates_checks.sql
--
-- Runs assertions against a live database for
-- migrations/0055_x01_checkout_darts_coordinates.sql (D193):
--
--   1. v_x01_checkout_darts exposes location_x and location_y.
--   2. A dart stored with coordinates returns them; a dart
--      stored without returns NULL for both.
--   3. The widening adds columns, never rows: the fixture
--      session returns exactly one row per dart.
--
-- Everything runs inside one transaction that ends in ROLLBACK,
-- so no fixture row survives. Lookup rows are resolved by
-- implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0055_x01_checkout_darts_coordinates_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0055.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: one 501 VISUAL_BOARD session, one stage, one
-- participant. Turn 1 carries two darts; only dart 1 has
-- landing coordinates.
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000005501',
        'verification-0055-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005502',
        '01990000-0000-7000-8000-000000005501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    );

INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        exercise_type_id,
        game_type_id,
        capture_mode_id,
        input_mode_id,
        status_id,
        ruleset_version_id,
        started_at,
        completed_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000005503',
    '01990000-0000-7000-8000-000000005502',
    '01990000-0000-7000-8000-000000005501',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now() - interval '1 hour',
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005504',
        '01990000-0000-7000-8000-000000005503',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005505',
        '01990000-0000-7000-8000-000000005503',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000005501',
        'Verification Owner',
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, kept, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005510',
        '01990000-0000-7000-8000-000000005504',
        '01990000-0000-7000-8000-000000005505',
        1,
        78,
        false,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, location_x, location_y, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005520',
        '01990000-0000-7000-8000-000000005510',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        1.50,
        -103.00,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000005521',
        '01990000-0000-7000-8000-000000005510',
        2,
        18,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        18,
        NULL,
        NULL,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: both columns exist on the view.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_x01_checkout_darts exposes location_x and location_y',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 2 columns found', count(*))
FROM information_schema.columns
WHERE table_name = 'v_x01_checkout_darts'
    AND column_name IN ('location_x', 'location_y');

-- ------------------------------------------------------------
-- Step 2: stored coordinates come back; absent ones stay NULL.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'Located dart returns its coordinates; unlocated dart returns NULL',
    CASE
        WHEN max(location_x) FILTER (WHERE dart_number = 1) = 1.50
            AND max(location_y) FILTER (WHERE dart_number = 1) = -103.00
            AND bool_and(location_x IS NULL AND location_y IS NULL) FILTER (WHERE dart_number = 2)
        THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('dart 1 = (%s, %s)', max(location_x) FILTER (WHERE dart_number = 1), max(location_y) FILTER (WHERE dart_number = 1))
FROM v_x01_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000005503';

-- ------------------------------------------------------------
-- Step 3: one row per dart -- no fan-out.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'Fixture session returns 2 rows (one per dart)',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s)', count(*))
FROM v_x01_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000005503';

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'all 3 checks actually ran',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 3 checks ran', count(*))
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
