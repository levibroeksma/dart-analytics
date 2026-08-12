-- ============================================================
-- Seed: 0007_ruleset_version_capabilities.sql
--
-- Declares which capture/input mode combination each ruleset
-- version supports. Mirrors app/src/lib/game/rulesets/
-- capabilities.ts; a parity test proves the two agree.
--
-- Migration 0020 adds the composite foreign key from
-- exercise_sessions to this table, so every combination any
-- existing session already uses MUST be present here before
-- that migration runs.
--
-- Correction over the original task-2 brief: SINGLES_V1,
-- BOBS27_V1 and DOUBLES_TRAINING_V1 are RECREATIONAL +
-- DETAILED_DARTS, not ANALYTICS + DETAILED_DARTS — their
-- validators (singles-training/bobs27/doubles-training
-- .validator.ts) declare RECREATIONAL, and
-- capabilities.ts's RULESET_CAPABILITIES agrees. See
-- database/verification/0007_capability_seed_checks.sql for
-- the parity assertion.
-- ============================================================
BEGIN;

INSERT INTO ruleset_version_capabilities (
        ruleset_version_id,
        capture_mode_id,
        input_mode_id,
        created_at
    )
SELECT rv.id,
    cm.id,
    im.id,
    now()
FROM (
        VALUES
            ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
    ) AS declared(ruleset_key, capture_key, input_key)
    JOIN ruleset_versions rv ON rv.implementation_key = declared.ruleset_key
    JOIN capture_modes cm ON cm.implementation_key = declared.capture_key
    JOIN input_modes im ON im.implementation_key = declared.input_key
ON CONFLICT DO NOTHING;

COMMIT;
