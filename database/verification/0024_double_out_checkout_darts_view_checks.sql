-- ============================================================
-- Verification: 0024_double_out_checkout_darts_view_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0024_double_out_checkout_darts_view.sql (D193).
--
--   1. v_double_out_checkout_darts returns the owning player's
--      501 VISUAL_BOARD darts, in (stage, turn, dart) order
--   2. prior_scored_in_stage is NULL for the first dart of a
--      leg and the running sum for later darts
--   3. a 121 (non-501) session's darts never appear
--
-- Everything runs inside one transaction that ends in ROLLBACK.
-- Lookup rows are resolved by implementation_key, never by
-- hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0024_double_out_checkout_darts_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0024.
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
        '01990000-0000-7000-8000-000000002401',
        'verification-0024-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002402',
        '01990000-0000-7000-8000-000000002401',
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
SELECT '01990000-0000-7000-8000-000000002403',
    '01990000-0000-7000-8000-000000002402',
    '01990000-0000-7000-8000-000000002401',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002404',
        '01990000-0000-7000-8000-000000002403',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
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
        '01990000-0000-7000-8000-000000002405',
        '01990000-0000-7000-8000-000000002403',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002401',
        'Verification Owner',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002406',
        '01990000-0000-7000-8000-000000002404',
        '01990000-0000-7000-8000-000000002405',
        1,
        60,
        now(),
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002407',
        '01990000-0000-7000-8000-000000002406',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002408',
        '01990000-0000-7000-8000-000000002406',
        2,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'DOUBLE'),
        40,
        now()
    );

-- ------------------------------------------------------------
-- 121 session (should never appear in this view).
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
SELECT '01990000-0000-7000-8000-000000002409',
    '01990000-0000-7000-8000-000000002402',
    '01990000-0000-7000-8000-000000002401',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '121_V1';

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000240a',
        '01990000-0000-7000-8000-000000002409',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
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
        '01990000-0000-7000-8000-00000000240b',
        '01990000-0000-7000-8000-000000002409',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002401',
        'Verification Owner',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000240c',
        '01990000-0000-7000-8000-00000000240a',
        '01990000-0000-7000-8000-00000000240b',
        1,
        60,
        now(),
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000240d',
        '01990000-0000-7000-8000-00000000240c',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: returns exactly the 2 501 darts, in dart order.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_double_out_checkout_darts returns exactly 2 rows for the 501 session',
    CASE
        WHEN count(*) = 2 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 2, found %s', count(*))
FROM v_double_out_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000002403';

-- ------------------------------------------------------------
-- Step 2: prior_scored_in_stage is NULL for dart 1, 60 for dart 2.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'dart 1 has no prior score in the stage',
    CASE
        WHEN prior_scored_in_stage IS NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('prior_scored_in_stage=%s (expected NULL)', prior_scored_in_stage)
FROM v_double_out_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000002403'
    AND dart_number = 1;

INSERT INTO verification_results
SELECT '2',
    'dart 2 carries dart 1''s score as its prior score in the stage',
    CASE
        WHEN prior_scored_in_stage = 60 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('prior_scored_in_stage=%s (expected 60)', prior_scored_in_stage)
FROM v_double_out_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000002403'
    AND dart_number = 2;

-- ------------------------------------------------------------
-- Step 3: the 121 session's dart never appears.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'a 121 session''s darts do not appear in v_double_out_checkout_darts',
    CASE
        WHEN count(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 0, found %s', count(*))
FROM v_double_out_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000002409';

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192): assert the count of checks that
-- actually ran, separately from their pass/fail results.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'all 4 view-driven checks actually ran',
    CASE
        WHEN count(*) = 4 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 4 checks ran', count(*))
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
