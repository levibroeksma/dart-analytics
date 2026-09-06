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
