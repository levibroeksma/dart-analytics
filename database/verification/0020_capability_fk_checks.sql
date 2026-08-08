-- ============================================================
-- Verification: 0020_capability_fk_checks.sql
--
-- Runs task-4-brief.md's Steps 1 and 4 as assertions against a
-- live database, since no PostgreSQL server exists in the
-- container that authored migrations/0020_session_capability_fk.sql
-- (D193 — SQL that cannot be applied locally ships with a
-- verification script the owner runs against the real Neon
-- database before merge):
--
--   1. fk_sessions_capability exists on exercise_sessions as a
--      FOREIGN KEY over exactly (ruleset_version_id,
--      capture_mode_id, input_mode_id) in that order
--   2. the constraint refuses a session claiming a capture/input
--      mode combination its ruleset version does not declare
--   3. the constraint permits a session claiming a combination
--      its ruleset version does declare (so a check confirming
--      only that "everything is rejected" cannot pass)
--
-- Everything runs inside one transaction that ends in
-- ROLLBACK, so no fixture row survives. Lookup rows are
-- resolved by implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0020_capability_fk_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0020 (which itself
-- requires seed 0007 to have already run).
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: fk_sessions_capability exists as a FOREIGN KEY.
--
-- Checked by name and type separately from the column check
-- below, so a constraint that exists under the right name but
-- was built as e.g. a UNIQUE constraint (or dropped entirely)
-- fails here rather than silently passing the column check.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'fk_sessions_capability exists on exercise_sessions as a FOREIGN KEY',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s matching pg_constraint row(s) found', count(*))
FROM pg_constraint
WHERE conrelid = 'exercise_sessions'::regclass
    AND conname = 'fk_sessions_capability'
    AND contype = 'f';

-- ------------------------------------------------------------
-- Step 1 (continued): the constraint covers exactly the three
-- expected columns, in the expected order.
--
-- A constraint named fk_sessions_capability that exists but
-- was built over the wrong columns (or the right columns in
-- the wrong order) must FAIL here even though the check above
-- passed.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'fk_sessions_capability covers (ruleset_version_id, capture_mode_id, input_mode_id) in order',
    CASE
        WHEN cols.names = ARRAY['ruleset_version_id', 'capture_mode_id', 'input_mode_id'] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('found column order: %s', cols.names)
FROM (
        SELECT array_agg(
                a.attname
                ORDER BY k.ord
            ) AS names
        FROM pg_constraint c
            CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = c.conrelid
            AND a.attnum = k.attnum
        WHERE c.conrelid = 'exercise_sessions'::regclass
            AND c.conname = 'fk_sessions_capability'
            AND c.contype = 'f'
    ) cols;

-- ------------------------------------------------------------
-- Fixture: two players + activities, one pair per candidate
-- session. Neither session is committed — both live inside the
-- savepoints below and the whole script ends in ROLLBACK.
--
-- TUOD_V1 declares exactly one capability row: RECREATIONAL +
-- QUICK_SCORE (seed 0007). ANALYTICS + VISUAL_BOARD is not
-- declared for TUOD_V1, which is what makes it the undeclared
-- case. Both candidate inserts share every other column so a
-- failure can only come from fk_sessions_capability, not from
-- an unrelated NOT NULL/FK on exercise_sessions.
--
-- The two candidates use distinct player_id/activity_id pairs
-- (not just distinct session ids) so uq_sessions_single_active
-- (player_id, game_type_id) WHERE completed_at IS NULL — 0011)
-- can never fire between them. Without that, an undeclared
-- combination that is wrongly accepted by a broken/missing FK
-- (Step 2's failure mode) would leave a row behind that the
-- Step 3 insert then collides with on the unique index instead
-- of on fk_sessions_capability, replacing a clean FAIL with an
-- unrelated unique_violation that escapes this DO block.
-- ------------------------------------------------------------
DO $$
DECLARE
    fixture_player_id CONSTANT UUID := '01990000-0000-7000-8000-00000000c001';
    fixture_activity_id CONSTANT UUID := '01990000-0000-7000-8000-00000000c002';
    fixture_player_id_2 CONSTANT UUID := '01990000-0000-7000-8000-00000000c005';
    fixture_activity_id_2 CONSTANT UUID := '01990000-0000-7000-8000-00000000c006';
    tuod_ruleset_id UUID;
    tuod_game_type_id UUID;
    active_status_id SMALLINT;
    analytics_capture_id SMALLINT;
    visual_board_input_id SMALLINT;
    recreational_capture_id SMALLINT;
    quick_score_input_id SMALLINT;
BEGIN
    SELECT rv.id, rv.game_type_id
    INTO tuod_ruleset_id, tuod_game_type_id
    FROM ruleset_versions rv
    WHERE rv.implementation_key = 'TUOD_V1';

    SELECT id
    INTO active_status_id
    FROM game_statuses
    WHERE implementation_key = 'ACTIVE';

    SELECT id
    INTO analytics_capture_id
    FROM capture_modes
    WHERE implementation_key = 'ANALYTICS';

    SELECT id
    INTO visual_board_input_id
    FROM input_modes
    WHERE implementation_key = 'VISUAL_BOARD';

    SELECT id
    INTO recreational_capture_id
    FROM capture_modes
    WHERE implementation_key = 'RECREATIONAL';

    SELECT id
    INTO quick_score_input_id
    FROM input_modes
    WHERE implementation_key = 'QUICK_SCORE';

    INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
    VALUES (
            fixture_player_id,
            'verification-0020',
            'Verification Fixture',
            now(),
            now()
        );

    INSERT INTO activities (id, player_id, status_id, started_at, created_at)
    VALUES (
            fixture_activity_id,
            fixture_player_id,
            active_status_id,
            now(),
            now()
        );

    INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
    VALUES (
            fixture_player_id_2,
            'verification-0020-b',
            'Verification Fixture 2',
            now(),
            now()
        );

    INSERT INTO activities (id, player_id, status_id, started_at, created_at)
    VALUES (
            fixture_activity_id_2,
            fixture_player_id_2,
            active_status_id,
            now(),
            now()
        );

    -- ------------------------------------------------------------
    -- Step 2: TUOD_V1 + ANALYTICS + VISUAL_BOARD is undeclared.
    -- The insert must be refused by fk_sessions_capability.
    -- ------------------------------------------------------------
    BEGIN
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
        VALUES (
                '01990000-0000-7000-8000-00000000c003',
                fixture_activity_id,
                fixture_player_id,
                tuod_game_type_id,
                analytics_capture_id,
                visual_board_input_id,
                active_status_id,
                tuod_ruleset_id,
                now(),
                now()
            );
        INSERT INTO verification_results
        VALUES (
                '2',
                'TUOD_V1 + ANALYTICS + VISUAL_BOARD (undeclared) is refused',
                'FAIL',
                'insert was accepted'
            );
    EXCEPTION
        WHEN foreign_key_violation THEN
        INSERT INTO verification_results
        VALUES (
                '2',
                'TUOD_V1 + ANALYTICS + VISUAL_BOARD (undeclared) is refused',
                'PASS',
                SQLERRM
            );
    END;

    -- ------------------------------------------------------------
    -- Step 3: TUOD_V1 + RECREATIONAL + QUICK_SCORE is declared
    -- (seed 0007). The insert must be permitted — without this
    -- check, a constraint rejecting every combination would also
    -- pass Step 2.
    --
    -- Uses fixture_player_id_2 / fixture_activity_id_2, not the
    -- Step 2 pair — see the fixture comment above.
    -- ------------------------------------------------------------
    BEGIN
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
        VALUES (
                '01990000-0000-7000-8000-00000000c004',
                fixture_activity_id_2,
                fixture_player_id_2,
                tuod_game_type_id,
                recreational_capture_id,
                quick_score_input_id,
                active_status_id,
                tuod_ruleset_id,
                now(),
                now()
            );
        INSERT INTO verification_results
        VALUES (
                '3',
                'TUOD_V1 + RECREATIONAL + QUICK_SCORE (declared) is permitted',
                'PASS',
                NULL
            );
    EXCEPTION
        WHEN foreign_key_violation THEN
        INSERT INTO verification_results
        VALUES (
                '3',
                'TUOD_V1 + RECREATIONAL + QUICK_SCORE (declared) is permitted',
                'FAIL',
                SQLERRM
            );
    END;
END $$;

-- ------------------------------------------------------------
-- Anti-vacuity guard: the checks above always emit exactly one
-- result row each regardless of outcome, but this guard exists
-- per house style (D192) so a future edit that removes a check
-- without removing this comment is caught by a count mismatch
-- rather than a silently smaller passing report.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'all 4 constraint checks actually ran',
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
