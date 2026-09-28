-- ============================================================
-- Verification: 0045_stats_routine_views_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0045_stats_routine_views.sql (D193):
--
--   1. A completed 3-step training (Warm-Up, Switching, a
--      SCORE_TRAINING_V1 game) with a snapshot carrying
--      routineTemplateId -> one v_stats_routine_run_facts row,
--      step_count = 3, steps_started = 3, steps_completed = 3,
--      routine_key equal to the template id.
--   2. A snapshot without routineTemplateId -> routine_key =
--      'name-' || md5(routineName).
--   3. v_stats_routine_step_facts: three step rows for fixture 1,
--      the Warm-Up's input_mode_key null, the game step's
--      game_type_key set, step_key formatted
--      <sequence_number>-<32 hex chars> and consistent with
--      step_fingerprint, and each row's step element matches its
--      own exercise_type_key.
--   4. Two runs whose step 2 differs only in configuration -> two
--      distinct step_key values at sequence_number = 2. Two runs
--      whose step 2 is identical -> one.
--   5. An activity abandoned with zero step sessions -> one run
--      row, steps_started = 0, steps_completed = 0.
--   6. An ACTIVE activity and an ACTIVE step session -> absent
--      from both views.
--   7. A standalone game (no activity_configurations snapshot) ->
--      absent from both new views, still present in
--      v_stats_session_facts.
--   8. dart_count counts the owner participant only, in both
--      views.
--   9. A step session whose sequenceNumber has no matching
--      snapshot element -> absent.
--  10. Snapshot elements with a missing, string (`"2"`) or
--      non-integer (`2.5`) sequenceNumber never match a step
--      session, even one whose routine_step_sequence_number and
--      array position would otherwise line up (R1: the plan's
--      Global Constraints require this, and a lateral match on
--      `e ->> 'sequenceNumber' = seq::text` alone lets the string
--      case through).
--
-- Everything runs inside one transaction that ends in ROLLBACK.
-- Lookup rows are resolved by implementation_key, never by
-- hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0045_stats_routine_views_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0045.
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
        '01990000-0000-7000-8000-000000004501',
        'verification-0045-owner',
        'Verification Owner',
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Fixture 1: completed 3-step training (Warm-Up, Switching, a
-- SCORE_TRAINING_V1 game step). The game step has an owner turn
-- (2 darts) and a DartBot turn (1 dart), so both views'
-- owner-scoped dart_count can be proven here (checks 1, 3, 8).
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004510',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    );

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004511',
        '01990000-0000-7000-8000-000000004510',
        '{
            "routineTemplateId": "01990000-0000-7000-8000-0000000045f1",
            "routineName": "Full Training",
            "steps": [
                {"sequenceNumber": 1, "exerciseTypeKey": "WARM_UP", "exerciseRulesetVersionKey": "WARM_UP_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 300, "configuration": {"stepDurationSeconds": 300}},
                {"sequenceNumber": 2, "exerciseTypeKey": "SWITCHING", "exerciseRulesetVersionKey": "SWITCHING_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 300, "configuration": {"targetSequence": ["T20", "T19"]}},
                {"sequenceNumber": 3, "exerciseTypeKey": "GAME", "exerciseRulesetVersionKey": null, "gameTypeKey": "SCORE_TRAINING", "gameRulesetVersionKey": "SCORE_TRAINING_V1", "durationSeconds": 900, "configuration": {"targetScore": 301}}
            ]
        }'::jsonb,
        now()
    );

-- Step 1: Warm-Up. No game pair, no capture pair.
INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
        status_id, routine_step_sequence_number, started_at, completed_at, created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000004512',
        '01990000-0000-7000-8000-000000004510',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        1,
        now() - interval '1 hour',
        now() - interval '50 minutes',
        now()
    );

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004513',
        '01990000-0000-7000-8000-000000004512',
        '{"stepDurationSeconds": 300}'::jsonb,
        now()
    );

-- Step 2: Switching. No game pair, capture pair set (VISUAL_BOARD).
INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
        capture_mode_id, input_mode_id,
        status_id, routine_step_sequence_number, started_at, completed_at, created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000004514',
        '01990000-0000-7000-8000-000000004510',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'SWITCHING_V1'),
        (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
        (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        2,
        now() - interval '50 minutes',
        now() - interval '45 minutes',
        now()
    );

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004515',
        '01990000-0000-7000-8000-000000004514',
        '{"targetSequence": ["T20", "T19"]}'::jsonb,
        now()
    );

-- Step 3: SCORE_TRAINING_V1 game. Game pair and capture pair both set.
INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id,
        game_type_id, ruleset_version_id, capture_mode_id, input_mode_id,
        status_id, routine_step_sequence_number, started_at, completed_at, created_at
    )
SELECT '01990000-0000-7000-8000-000000004516',
    '01990000-0000-7000-8000-000000004510',
    '01990000-0000-7000-8000-000000004501',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    rv.id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    3,
    now() - interval '45 minutes',
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = 'SCORE_TRAINING_V1';

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004517',
        '01990000-0000-7000-8000-000000004516',
        '{"targetScore": 301}'::jsonb,
        now()
    );

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004518',
        '01990000-0000-7000-8000-000000004516',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004519',
        '01990000-0000-7000-8000-000000004516',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000004501',
        'Verification Owner',
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000451a',
        '01990000-0000-7000-8000-000000004516',
        (SELECT id FROM participant_types WHERE implementation_key = 'DARTBOT'),
        NULL,
        'DartBot',
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000451b',
        '01990000-0000-7000-8000-000000004518',
        '01990000-0000-7000-8000-000000004519',
        1,
        40,
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000451c',
        '01990000-0000-7000-8000-000000004518',
        '01990000-0000-7000-8000-00000000451a',
        1,
        26,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
VALUES
    -- owner turn: 2 darts, total 40
    ('01990000-0000-7000-8000-00000000451d', '01990000-0000-7000-8000-00000000451b', 1, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 20, now()),
    ('01990000-0000-7000-8000-00000000451e', '01990000-0000-7000-8000-00000000451b', 2, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 20, now()),
    -- DartBot turn: 1 dart -- must never be counted
    ('01990000-0000-7000-8000-00000000451f', '01990000-0000-7000-8000-00000000451c', 1, 13, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 13, now());

-- ------------------------------------------------------------
-- Fixture 2: a snapshot without routineTemplateId -- routine_key
-- falls back to 'name-' || md5(routineName).
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004520',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    );

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004521',
        '01990000-0000-7000-8000-000000004520',
        '{
            "routineName": "Nameless Routine",
            "steps": [
                {"sequenceNumber": 1, "exerciseTypeKey": "WARM_UP", "exerciseRulesetVersionKey": "WARM_UP_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 120, "configuration": {}}
            ]
        }'::jsonb,
        now()
    );

INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
        status_id, routine_step_sequence_number, started_at, completed_at, created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000004522',
        '01990000-0000-7000-8000-000000004520',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        1,
        now() - interval '1 hour',
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Fixture 3: two pairs of runs, each pair's step 2 a Switching
-- step. A3/A4 differ only in the step's configuration; A5/A6 are
-- identical.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES
    ('01990000-0000-7000-8000-000000004530', '01990000-0000-7000-8000-000000004501', (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'), now() - interval '1 hour', now(), now()),
    ('01990000-0000-7000-8000-000000004533', '01990000-0000-7000-8000-000000004501', (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'), now() - interval '1 hour', now(), now()),
    ('01990000-0000-7000-8000-000000004536', '01990000-0000-7000-8000-000000004501', (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'), now() - interval '1 hour', now(), now()),
    ('01990000-0000-7000-8000-000000004539', '01990000-0000-7000-8000-000000004501', (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'), now() - interval '1 hour', now(), now());

-- A3: step 2 targets T20.
INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004531',
        '01990000-0000-7000-8000-000000004530',
        '{"routineTemplateId": "01990000-0000-7000-8000-0000000045f2", "routineName": "Dedup A", "steps": [
            {"sequenceNumber": 2, "exerciseTypeKey": "SWITCHING", "exerciseRulesetVersionKey": "SWITCHING_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 300, "configuration": {"targetSequence": ["T20"]}}
        ]}'::jsonb,
        now()
    );

-- A4: step 2 targets T19 -- differs from A3 only in configuration.
INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004534',
        '01990000-0000-7000-8000-000000004533',
        '{"routineTemplateId": "01990000-0000-7000-8000-0000000045f2", "routineName": "Dedup A", "steps": [
            {"sequenceNumber": 2, "exerciseTypeKey": "SWITCHING", "exerciseRulesetVersionKey": "SWITCHING_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 300, "configuration": {"targetSequence": ["T19"]}}
        ]}'::jsonb,
        now()
    );

-- A5 and A6: identical step 2.
INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES
    (
        '01990000-0000-7000-8000-000000004537',
        '01990000-0000-7000-8000-000000004536',
        '{"routineTemplateId": "01990000-0000-7000-8000-0000000045f3", "routineName": "Dedup B", "steps": [
            {"sequenceNumber": 2, "exerciseTypeKey": "SWITCHING", "exerciseRulesetVersionKey": "SWITCHING_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 300, "configuration": {"targetSequence": ["T20"]}}
        ]}'::jsonb,
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000453a',
        '01990000-0000-7000-8000-000000004539',
        '{"routineTemplateId": "01990000-0000-7000-8000-0000000045f3", "routineName": "Dedup B", "steps": [
            {"sequenceNumber": 2, "exerciseTypeKey": "SWITCHING", "exerciseRulesetVersionKey": "SWITCHING_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 300, "configuration": {"targetSequence": ["T20"]}}
        ]}'::jsonb,
        now()
    );

INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
        capture_mode_id, input_mode_id,
        status_id, routine_step_sequence_number, started_at, completed_at, created_at
    )
VALUES
    (
        '01990000-0000-7000-8000-000000004532', '01990000-0000-7000-8000-000000004530', '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'SWITCHING_V1'),
        (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
        (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        2, now() - interval '1 hour', now(), now()
    ),
    (
        '01990000-0000-7000-8000-000000004535', '01990000-0000-7000-8000-000000004533', '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'SWITCHING_V1'),
        (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
        (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        2, now() - interval '1 hour', now(), now()
    ),
    (
        '01990000-0000-7000-8000-000000004538', '01990000-0000-7000-8000-000000004536', '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'SWITCHING_V1'),
        (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
        (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        2, now() - interval '1 hour', now(), now()
    ),
    (
        '01990000-0000-7000-8000-00000000453b', '01990000-0000-7000-8000-000000004539', '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'SWITCHING_V1'),
        (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
        (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        2, now() - interval '1 hour', now(), now()
    );

-- ------------------------------------------------------------
-- Fixture 4: activity abandoned with zero step sessions.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004550',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ABANDONED'),
        now() - interval '1 hour',
        now(),
        now()
    );

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004551',
        '01990000-0000-7000-8000-000000004550',
        '{"routineTemplateId": "01990000-0000-7000-8000-0000000045f4", "routineName": "Abandoned Early", "steps": [
            {"sequenceNumber": 1, "exerciseTypeKey": "WARM_UP", "exerciseRulesetVersionKey": "WARM_UP_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 300, "configuration": {}}
        ]}'::jsonb,
        now()
    );

-- ------------------------------------------------------------
-- Fixture 5: an ACTIVE activity and an ACTIVE step session --
-- absent from both views.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004560',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004561',
        '01990000-0000-7000-8000-000000004560',
        '{"routineTemplateId": "01990000-0000-7000-8000-0000000045f5", "routineName": "In Progress", "steps": [
            {"sequenceNumber": 1, "exerciseTypeKey": "WARM_UP", "exerciseRulesetVersionKey": "WARM_UP_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 300, "configuration": {}}
        ]}'::jsonb,
        now()
    );

INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
        status_id, routine_step_sequence_number, started_at, created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000004562',
        '01990000-0000-7000-8000-000000004560',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        1,
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Fixture 6: a standalone completed game with NO
-- activity_configurations row -- absent from both new views,
-- still present in v_stats_session_facts.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004570',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    );

INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id,
        game_type_id, capture_mode_id, input_mode_id, status_id, ruleset_version_id,
        started_at, completed_at, created_at
    )
SELECT '01990000-0000-7000-8000-000000004571',
    '01990000-0000-7000-8000-000000004570',
    '01990000-0000-7000-8000-000000004501',
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

-- ------------------------------------------------------------
-- Fixture 7: three malformed sequenceNumber elements in one
-- snapshot -- (a) missing, (b) string "2", (c) non-integer 2.5 --
-- each at the array position AND paired with a step session whose
-- routine_step_sequence_number equals that position, so a
-- position-based or loosely-typed match (rather than the required
-- typed sequenceNumber match) would incorrectly produce a row.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004580',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    );

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004581',
        '01990000-0000-7000-8000-000000004580',
        '{
            "routineTemplateId": "01990000-0000-7000-8000-0000000045f6",
            "routineName": "Malformed Sequence",
            "steps": [
                {"exerciseTypeKey": "WARM_UP", "exerciseRulesetVersionKey": "WARM_UP_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 180, "configuration": {}},
                {"sequenceNumber": "2", "exerciseTypeKey": "WARM_UP", "exerciseRulesetVersionKey": "WARM_UP_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 180, "configuration": {}},
                {"sequenceNumber": 2.5, "exerciseTypeKey": "WARM_UP", "exerciseRulesetVersionKey": "WARM_UP_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 180, "configuration": {}}
            ]
        }'::jsonb,
        now()
    );

INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
        status_id, routine_step_sequence_number, started_at, completed_at, created_at
    )
VALUES
    (
        '01990000-0000-7000-8000-000000004582', '01990000-0000-7000-8000-000000004580', '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        1, now() - interval '1 hour', now(), now()
    ),
    (
        '01990000-0000-7000-8000-000000004583', '01990000-0000-7000-8000-000000004580', '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        2, now() - interval '1 hour', now(), now()
    ),
    (
        '01990000-0000-7000-8000-000000004584', '01990000-0000-7000-8000-000000004580', '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        3, now() - interval '1 hour', now(), now()
    );

-- ------------------------------------------------------------
-- Fixture 8: a step session whose sequenceNumber (99) has no
-- matching element in the snapshot's steps array (which only has
-- sequenceNumber 1) -- absent.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004590',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    );

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004591',
        '01990000-0000-7000-8000-000000004590',
        '{"routineTemplateId": "01990000-0000-7000-8000-0000000045f7", "routineName": "Missing Element", "steps": [
            {"sequenceNumber": 1, "exerciseTypeKey": "WARM_UP", "exerciseRulesetVersionKey": "WARM_UP_V1", "gameTypeKey": null, "gameRulesetVersionKey": null, "durationSeconds": 180, "configuration": {}}
        ]}'::jsonb,
        now()
    );

INSERT INTO exercise_sessions (
        id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
        status_id, routine_step_sequence_number, started_at, completed_at, created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000004592',
        '01990000-0000-7000-8000-000000004590',
        '01990000-0000-7000-8000-000000004501',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        99,
        now() - interval '1 hour',
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Check 1: fixture 1 -- one run row, step_count/steps_started/
-- steps_completed = 3, routine_key equal to the template id.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1', 'v_stats_routine_run_facts: fixture 1 has one row with step_count/steps_started/steps_completed = 3 and routine_key = routineTemplateId',
    CASE WHEN count(*) = 1
          AND bool_and(step_count = 3)
          AND bool_and(steps_started = 3)
          AND bool_and(steps_completed = 3)
          AND bool_and(routine_key = '01990000-0000-7000-8000-0000000045f1')
          AND bool_and(status_key = 'COMPLETED')
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s); step_count=%s steps_started=%s steps_completed=%s routine_key=%s',
        count(*), max(step_count), max(steps_started), max(steps_completed), max(routine_key))
FROM v_stats_routine_run_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004510';

-- ------------------------------------------------------------
-- Check 2: fixture 2 -- routine_key falls back to
-- 'name-' || md5(routineName) when routineTemplateId is absent.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2', 'v_stats_routine_run_facts: fixture 2 routine_key falls back to name-md5(routineName)',
    CASE WHEN count(*) = 1
          AND bool_and(routine_key = 'name-' || md5('Nameless Routine'))
          AND bool_and(routine_template_id IS NULL)
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s); routine_key=%s routine_template_id=%s', count(*), max(routine_key), max(routine_template_id))
FROM v_stats_routine_run_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004520';

-- ------------------------------------------------------------
-- Check 3: fixture 1 -- three step rows, Warm-Up's input_mode_key
-- null, the game step's game_type_key set, step_key formatted and
-- consistent with step_fingerprint, and the step element matches
-- its own session's exercise_type_key.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3', 'v_stats_routine_step_facts: fixture 1 has exactly three step rows',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 3, found %s', count(*))
FROM v_stats_routine_step_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004510';

INSERT INTO verification_results
SELECT '3', 'v_stats_routine_step_facts: Warm-Up step has input_mode_key and game_type_key null',
    CASE WHEN input_mode_key IS NULL AND game_type_key IS NULL AND ruleset_version_key IS NULL
         THEN 'PASS' ELSE 'FAIL' END,
    format('input_mode_key=%s game_type_key=%s ruleset_version_key=%s', input_mode_key, game_type_key, ruleset_version_key)
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004512';

INSERT INTO verification_results
SELECT '3', 'v_stats_routine_step_facts: Switching step has input_mode_key set, game_type_key null',
    CASE WHEN input_mode_key = 'VISUAL_BOARD' AND game_type_key IS NULL
         THEN 'PASS' ELSE 'FAIL' END,
    format('input_mode_key=%s game_type_key=%s', input_mode_key, game_type_key)
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004514';

INSERT INTO verification_results
SELECT '3', 'v_stats_routine_step_facts: game step has game_type_key set, exercise_ruleset_version_key null',
    CASE WHEN game_type_key = 'SCORE_TRAINING' AND ruleset_version_key = 'SCORE_TRAINING_V1' AND exercise_ruleset_version_key IS NULL
         THEN 'PASS' ELSE 'FAIL' END,
    format('game_type_key=%s ruleset_version_key=%s exercise_ruleset_version_key=%s', game_type_key, ruleset_version_key, exercise_ruleset_version_key)
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004516';

INSERT INTO verification_results
SELECT '3', 'v_stats_routine_step_facts: step_key is formatted <sequence_number>-<step_fingerprint> for all three rows',
    CASE WHEN count(*) = 3
          AND bool_and(step_key = sequence_number::text || '-' || step_fingerprint)
          AND bool_and(step_fingerprint ~ '^[0-9a-f]{32}$')
          AND bool_and(step ->> 'exerciseTypeKey' = exercise_type_key)
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s) checked', count(*))
FROM v_stats_routine_step_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004510';

-- ------------------------------------------------------------
-- Check 4: two runs whose step 2 differs only in configuration
-- produce two distinct step_key values; two identical runs
-- produce one.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4', 'v_stats_routine_step_facts: step 2 differing only in configuration yields two distinct step_key values',
    CASE WHEN count(DISTINCT step_key) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s distinct step_key value(s): %s', count(DISTINCT step_key), array_agg(DISTINCT step_key))
FROM v_stats_routine_step_facts
WHERE session_id IN ('01990000-0000-7000-8000-000000004532', '01990000-0000-7000-8000-000000004535');

INSERT INTO verification_results
SELECT '4', 'v_stats_routine_step_facts: two identical step-2 runs yield one step_key value',
    CASE WHEN count(DISTINCT step_key) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s distinct step_key value(s): %s', count(DISTINCT step_key), array_agg(DISTINCT step_key))
FROM v_stats_routine_step_facts
WHERE session_id IN ('01990000-0000-7000-8000-000000004538', '01990000-0000-7000-8000-00000000453b');

-- ------------------------------------------------------------
-- Check 5: an abandoned activity with zero step sessions -- one
-- run row, steps_started = 0, steps_completed = 0.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5', 'v_stats_routine_run_facts: abandoned activity with zero step sessions has steps_started/steps_completed = 0',
    CASE WHEN count(*) = 1
          AND bool_and(steps_started = 0)
          AND bool_and(steps_completed = 0)
          AND bool_and(status_key = 'ABANDONED')
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s); steps_started=%s steps_completed=%s', count(*), max(steps_started), max(steps_completed))
FROM v_stats_routine_run_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004550';

-- ------------------------------------------------------------
-- Check 6: an ACTIVE activity and its ACTIVE step session are
-- absent from both views.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6', 'v_stats_routine_run_facts: ACTIVE activity is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_routine_run_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004560';

INSERT INTO verification_results
SELECT '6', 'v_stats_routine_step_facts: ACTIVE step session is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004562';

-- ------------------------------------------------------------
-- Check 7: a standalone completed game with no
-- activity_configurations row is absent from both new views, but
-- still present in v_stats_session_facts.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '7', 'v_stats_routine_run_facts: standalone game (no snapshot) is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_routine_run_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004570';

INSERT INTO verification_results
SELECT '7', 'v_stats_routine_step_facts: standalone game (no snapshot) is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_routine_step_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004570';

INSERT INTO verification_results
SELECT '7', 'v_stats_session_facts: the standalone game is still present',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 1, found %s', count(*))
FROM v_stats_session_facts
WHERE session_id = '01990000-0000-7000-8000-000000004571';

-- ------------------------------------------------------------
-- Check 8: dart_count counts the owner participant only, in both
-- views (fixture 1's game step: 2 owner darts, 1 DartBot dart).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '8', 'v_stats_routine_run_facts: dart_count counts the owner participant only',
    CASE WHEN count(*) = 1 AND bool_and(dart_count = 2) THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s); dart_count=%s', count(*), max(dart_count))
FROM v_stats_routine_run_facts
WHERE activity_id = '01990000-0000-7000-8000-000000004510';

INSERT INTO verification_results
SELECT '8', 'v_stats_routine_step_facts: dart_count counts the owner participant only',
    CASE WHEN count(*) = 1 AND bool_and(dart_count = 2) AND bool_and(turn_count = 1) AND bool_and(counted_score = 40)
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s); dart_count=%s turn_count=%s counted_score=%s', count(*), max(dart_count), max(turn_count), max(counted_score))
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004516';

-- ------------------------------------------------------------
-- Check 9: a step session whose sequenceNumber has no matching
-- snapshot element is absent.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '9', 'v_stats_routine_step_facts: sequenceNumber with no matching snapshot element is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004592';

-- ------------------------------------------------------------
-- Check 10 (R1): a missing, string ("2") or non-integer (2.5)
-- sequenceNumber never matches, even when positioned and valued
-- to otherwise line up with the paired session.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '10', 'v_stats_routine_step_facts: element with no sequenceNumber (array position 1) does not match session at sequence 1',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004582';

INSERT INTO verification_results
SELECT '10', 'v_stats_routine_step_facts: element with sequenceNumber "2" (string) does not match session at sequence 2',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004583';

INSERT INTO verification_results
SELECT '10', 'v_stats_routine_step_facts: element with sequenceNumber 2.5 (non-integer) does not match session at sequence 3',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_routine_step_facts
WHERE session_id = '01990000-0000-7000-8000-000000004584';

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192): assert the count of checks that
-- actually ran, separately from their pass/fail results.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '11', 'all 21 view-driven checks actually ran',
    CASE WHEN count(*) = 21 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 21 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10');

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step::int, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
