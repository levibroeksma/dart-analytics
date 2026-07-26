-- ============================================================
-- Seed: 0003_game_engine_reference.sql
--
-- Purpose:
-- Seed the two game types that already have a shipped client
-- engine and a registered server-side ruleset validator but no
-- reference data at all: Bob's 27 and Doubles Training (I4).
--
-- Without this seed neither game has a game type, a ruleset
-- version, or a preset to start a session from — `POST
-- /api/sessions` has nothing to look up for `BOBS27_V1` or
-- `DOUBLES_TRAINING_V1`, regardless of the registered validator.
--
-- UUID allocation (continues the 0001/0002 ranges):
-- - 0198f000-* game_types              (...0005 BOBS27, ...0006 DOUBLES_TRAINING)
-- - 0198f100-* ruleset_versions        (...0005 BOBS27_V1, ...0006 DOUBLES_TRAINING_V1)
-- - 0198f300-* configuration_templates (...0009 BOBS27, ...0010 DOUBLES_TRAINING)
--
-- Configuration JSONB structures follow the ruleset configuration
-- schema of each game type (app/src/lib/game/rulesets/types.ts),
-- V1 rulesets, key for key. Validation is an application
-- responsibility (schemas are `.strict()`).
--
-- No game_type_features mapping for either game type: V1 is
-- single-player only for both (multiplayer/DartBot are V2+ per
-- docs/game-rules/rulesets/bobs-27.md and
-- docs/game-rules/rulesets/doubles-training.md, so OPPONENT_SUPPORT
-- /DARTBOT_SUPPORT do not apply); both walk a fixed 21-target path
-- with no timer or round count to configure (Bobs27Config and
-- DoublesTrainingConfig model no duration field, so TIMED_MODE/
-- ROUNDS_MODE do not apply); neither is an X01 checkout game (no
-- DOUBLE_OUT).
--
-- No exercise_templates rows: nothing outside this file's own
-- configuration_templates presets currently reads exercise_templates
-- at runtime (routine_steps only, an unrelated feature) and the
-- Task 11 interface list does not call for one.
--
-- Each game type gets exactly one configuration_templates preset:
-- V1 locks every setting to a single value (see each ruleset doc's
-- "Config & presets (V1)" table), so a second preset could only be
-- a byte-for-byte duplicate of the first.
-- ============================================================
BEGIN;
-- ============================================================
-- Game types
-- ============================================================
INSERT INTO game_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0198f000-0000-7000-8000-000000000005',
        'BOBS27',
        'Bob''s 27',
        'Running-score doubles training: three darts at each double, D1 through D20, then the bull.',
        TRUE,
        now(),
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000006',
        'DOUBLES_TRAINING',
        'Doubles Training',
        'Doubles accuracy training across the full path, low to high, ending on the bull.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Ruleset versions
-- ============================================================
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000005',
        '0198f000-0000-7000-8000-000000000005',
        'BOBS27_V1',
        1,
        'Initial Bob''s 27 ruleset.',
        now()
    ),
    (
        '0198f100-0000-7000-8000-000000000006',
        '0198f000-0000-7000-8000-000000000006',
        'DOUBLES_TRAINING_V1',
        1,
        'Initial Doubles Training ruleset.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration presets
-- ============================================================
INSERT INTO configuration_templates (
        id,
        game_type_id,
        player_id,
        name,
        description,
        configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f300-0000-7000-8000-000000000009',
        '0198f000-0000-7000-8000-000000000005',
        NULL,
        'Bob''s 27 — Standard',
        'Traditional Bob''s 27: start at 27, standard bull scoring.',
        '{
            "start_score": 27,
            "bull_hit_value": 50,
            "miss_penalty_multiplier": 1
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000010',
        '0198f000-0000-7000-8000-000000000006',
        NULL,
        'Doubles Training — Easy, Low to High',
        'Easy mode, doubles low to high ending on the bull.',
        '{
            "mode": "EASY",
            "order_mode": "LOW_TO_HIGH"
        }'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
