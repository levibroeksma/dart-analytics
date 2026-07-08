-- ============================================================
-- Seed: 0002_default_templates.sql
--
-- Purpose:
-- Insert system-owned default templates.
--
-- Contains:
-- - default exercise templates (one per game type)
-- - default configuration presets per game type
-- - one pre-configured training routine
--
-- All rows are system templates:
-- - is_system_template = TRUE
-- - player_id IS NULL where applicable
--
-- Seed data uses fixed identifiers to guarantee
-- consistency across environments.
--
-- UUID allocation:
-- - 0198f200-* exercise_templates
-- - 0198f300-* configuration_templates
-- - 0198f400-* routine_templates
-- - 0198f500-* routine_steps
--
-- Configuration JSONB structures follow the ruleset
-- configuration schema of each game type (V1 rulesets).
-- Validation is an application responsibility.
--
-- ============================================================
BEGIN;
-- ============================================================
-- Exercise templates
-- ============================================================
INSERT INTO exercise_templates (
        id,
        game_type_id,
        name,
        description,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f200-0000-7000-8000-000000000001',
        '0198f000-0000-7000-8000-000000000001',
        '501 Match',
        'Standard 501 match play.',
        TRUE,
        now(),
        now()
    ),
    (
        '0198f200-0000-7000-8000-000000000002',
        '0198f000-0000-7000-8000-000000000002',
        'Ten Up One Down',
        'Progressive target training starting at 41.',
        TRUE,
        now(),
        now()
    ),
    (
        '0198f200-0000-7000-8000-000000000003',
        '0198f000-0000-7000-8000-000000000003',
        'Singles Accuracy',
        'Singles accuracy training across all targets.',
        TRUE,
        now(),
        now()
    ),
    (
        '0198f200-0000-7000-8000-000000000004',
        '0198f000-0000-7000-8000-000000000004',
        'Score Training Block',
        'Repeated scoring practice on the 20 segment.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration presets: 501
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
        '0198f300-0000-7000-8000-000000000001',
        '0198f000-0000-7000-8000-000000000001',
        NULL,
        '501 — Quick Play',
        'Single leg, double out.',
        '{
            "starting_score": 501,
            "legs_to_win": 1,
            "sets_to_win": 1,
            "check_in": "STRAIGHT_IN",
            "check_out": "DOUBLE_OUT",
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000002',
        '0198f000-0000-7000-8000-000000000001',
        NULL,
        '501 — Best of 5 Legs',
        'First to three legs, double out.',
        '{
            "starting_score": 501,
            "legs_to_win": 3,
            "sets_to_win": 1,
            "check_in": "STRAIGHT_IN",
            "check_out": "DOUBLE_OUT",
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    -- ============================================================
    -- Configuration presets: TUOD
    -- ============================================================
    (
        '0198f300-0000-7000-8000-000000000003',
        '0198f000-0000-7000-8000-000000000002',
        NULL,
        'TUOD — 10 Rounds',
        'Ten rounds starting at target 41.',
        '{
            "starting_target": 41,
            "finish_bonus": 10,
            "miss_penalty": 1,
            "duration_type": "ROUNDS",
            "duration_value": 10,
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000004',
        '0198f000-0000-7000-8000-000000000002',
        NULL,
        'TUOD — 10 Minutes',
        'Timed session starting at target 41.',
        '{
            "starting_target": 41,
            "finish_bonus": 10,
            "miss_penalty": 1,
            "duration_type": "MINUTES",
            "duration_value": 10,
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    -- ============================================================
    -- Configuration presets: Singles Training
    -- ============================================================
    (
        '0198f300-0000-7000-8000-000000000005',
        '0198f000-0000-7000-8000-000000000003',
        NULL,
        'Singles — Normal, High to Low',
        'All targets from 20 down to 1, normal difficulty.',
        '{
            "order_mode": "HIGH_TO_LOW",
            "difficulty": "NORMAL",
            "duration_type": "ROUNDS",
            "duration_value": 20,
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000006',
        '0198f000-0000-7000-8000-000000000003',
        NULL,
        'Singles — Hard, Random Order',
        'Random target order, hard difficulty.',
        '{
            "order_mode": "RANDOM",
            "difficulty": "HARD",
            "duration_type": "ROUNDS",
            "duration_value": 20,
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    -- ============================================================
    -- Configuration presets: Score Training
    -- ============================================================
    (
        '0198f300-0000-7000-8000-000000000007',
        '0198f000-0000-7000-8000-000000000004',
        NULL,
        'Score Training — 10 Rounds',
        'Ten scoring rounds.',
        '{
            "duration_type": "ROUNDS",
            "duration_value": 10,
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000008',
        '0198f000-0000-7000-8000-000000000004',
        NULL,
        'Score Training — 15 Minutes',
        'Timed scoring practice.',
        '{
            "duration_type": "MINUTES",
            "duration_value": 15,
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Default training routine
--
-- Standard practice session:
-- 1. Singles accuracy   (15 minutes)
-- 2. Score training     (20 minutes)
-- 3. Ten Up One Down    (10 rounds)
-- ============================================================
INSERT INTO routine_templates (
        id,
        player_id,
        name,
        description,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f400-0000-7000-8000-000000000001',
        NULL,
        'Standard Practice',
        'Balanced warmup, scoring and target training session.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
INSERT INTO routine_steps (
        id,
        routine_template_id,
        exercise_template_id,
        sequence_number,
        duration_type_id,
        duration_value,
        created_at
    )
VALUES (
        '0198f500-0000-7000-8000-000000000001',
        '0198f400-0000-7000-8000-000000000001',
        '0198f200-0000-7000-8000-000000000003',
        1,
        2,
        15,
        now()
    ),
    (
        '0198f500-0000-7000-8000-000000000002',
        '0198f400-0000-7000-8000-000000000001',
        '0198f200-0000-7000-8000-000000000004',
        2,
        2,
        20,
        now()
    ),
    (
        '0198f500-0000-7000-8000-000000000003',
        '0198f400-0000-7000-8000-000000000001',
        '0198f200-0000-7000-8000-000000000002',
        3,
        1,
        10,
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
