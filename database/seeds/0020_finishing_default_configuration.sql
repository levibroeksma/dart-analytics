-- database/seeds/0020_finishing_default_configuration.sql
--
-- ============================================================
-- Seed: 0020_finishing_default_configuration.sql
--
-- Purpose:
-- Give the Finishing (TUOD) system template a default_configuration
-- so a player can pick it in the routine builder (D321). Until now
-- the template carried NULL and Balanced Training's step 4 supplied
-- the whole configuration; a user step carries no configuration, so
-- it would resolve to {} and fail TUOD validation at start.
--
-- Values are Balanced Training's own (seed 0017). duration_value is
-- overwritten per step by startTraining from the step's minutes, so
-- the 10 here is a default, not a rule.
--
-- UPDATE in place, the 0017/0019 shape: idempotent under re-run.
-- ============================================================
BEGIN;

UPDATE exercise_templates
SET default_configuration = '{
        "starting_target": 41,
        "finish_bonus": 10,
        "miss_penalty": 1,
        "duration_type": "MINUTES",
        "duration_value": 10,
        "max_darts_per_turn": 3
    }'::jsonb,
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000004';

COMMIT;
