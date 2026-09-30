-- ============================================================
-- Verification: 0046_replay_stages_view_checks.sql
--
-- Runs assertions against a live database for
-- migrations/0046_replay_stages_view.sql (D193):
--
--   1. A parent stage with no turn of its own appears in
--      v_replay_stages next to its child.
--   2. The same parent has no row in v_game_replay (the gap
--      issue #639 closes).
--   3. The child row carries parent_stage_id, stage_sequence and
--      stage_type_key.
--   4. player_id scopes the view to its owner.
--
-- Everything runs inside one transaction that ends in ROLLBACK,
-- so no fixture row survives. Lookup rows are resolved by
-- implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0046_replay_stages_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0046.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: one session with a two-level tree: a LEG parent
-- stage holding NO turn, and a ROUND child stage holding one
-- turn. A second session (another owner) holds one stage, to
-- prove the owner scope.
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000004601',
        'verification-0046-owner',
        'Verification Owner',
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-000000004621',
        'verification-0046-other',
        'Verification Other',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004602',
        '01990000-0000-7000-8000-000000004601',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-000000004622',
        '01990000-0000-7000-8000-000000004621',
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
SELECT s.session_id::uuid,
    s.activity_id::uuid,
    s.player_id::uuid,
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
    CROSS JOIN (
        VALUES (
                '01990000-0000-7000-8000-000000004603',
                '01990000-0000-7000-8000-000000004602',
                '01990000-0000-7000-8000-000000004601'
            ),
            (
                '01990000-0000-7000-8000-000000004623',
                '01990000-0000-7000-8000-000000004622',
                '01990000-0000-7000-8000-000000004621'
            )
    ) AS s(session_id, activity_id, player_id)
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_stages (id, exercise_session_id, parent_stage_id, stage_type_id, sequence_number, created_at)
VALUES (
        -- Parent: no turn of its own.
        '01990000-0000-7000-8000-000000004604',
        '01990000-0000-7000-8000-000000004603',
        NULL,
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    ),
    (
        -- Child: holds the only turn.
        '01990000-0000-7000-8000-000000004605',
        '01990000-0000-7000-8000-000000004603',
        '01990000-0000-7000-8000-000000004604',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
        1,
        now()
    ),
    (
        -- Other owner's stage.
        '01990000-0000-7000-8000-000000004624',
        '01990000-0000-7000-8000-000000004623',
        NULL,
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004606',
        '01990000-0000-7000-8000-000000004603',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000004601',
        'Verification Owner',
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004607',
        '01990000-0000-7000-8000-000000004605',
        '01990000-0000-7000-8000-000000004606',
        1,
        26,
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Assertion 1: v_replay_stages returns the turnless parent and
-- its child for the owner's session (2 rows).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'turnless parent stage appears in v_replay_stages',
    CASE
        WHEN count(*) = 2
        AND count(*) FILTER (
            WHERE stage_id = '01990000-0000-7000-8000-000000004604'
        ) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s stage rows', count(*))
FROM v_replay_stages
WHERE session_id = '01990000-0000-7000-8000-000000004603'
    AND player_id = '01990000-0000-7000-8000-000000004601';

-- ------------------------------------------------------------
-- Assertion 2: the same parent has no row in v_game_replay, the
-- gap that the new view closes (#639).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'v_game_replay still omits the turnless parent',
    CASE
        WHEN count(*) FILTER (
            WHERE stage_id = '01990000-0000-7000-8000-000000004604'
        ) = 0
        AND count(*) FILTER (
            WHERE stage_id = '01990000-0000-7000-8000-000000004605'
        ) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s replay rows', count(*))
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000004603';

-- ------------------------------------------------------------
-- Assertion 3: the child names its parent, and sequence and
-- stage type come through.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'child row carries parent_stage_id, stage_sequence and stage_type_key',
    CASE
        WHEN parent_stage_id = '01990000-0000-7000-8000-000000004604'
        AND stage_sequence = 1
        AND stage_type_key = 'ROUND' THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s / %s / %s', parent_stage_id, stage_sequence, stage_type_key)
FROM v_replay_stages
WHERE stage_id = '01990000-0000-7000-8000-000000004605';

-- ------------------------------------------------------------
-- Assertion 4: owner scope -- filtering by another player_id
-- returns none of the first session's stages, and the other
-- owner's session returns only its own stage.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'player_id scopes v_replay_stages to its owner',
    CASE
        WHEN count(*) FILTER (
            WHERE session_id = '01990000-0000-7000-8000-000000004603'
        ) = 0
        AND count(*) FILTER (
            WHERE session_id = '01990000-0000-7000-8000-000000004623'
        ) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s rows for the other owner', count(*))
FROM v_replay_stages
WHERE player_id = '01990000-0000-7000-8000-000000004621';

-- ------------------------------------------------------------
-- Every assertion above is an INSERT ... SELECT, so a missing
-- fixture row would make a check vanish silently instead of
-- failing. Assert the count of checks that actually ran
-- separately (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5',
    'all 4 view-driven checks actually ran',
    CASE
        WHEN count(*) = 4 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 4 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3', '4');

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
