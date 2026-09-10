-- ============================================================
-- Migration: 0028_template_exercise_types.sql
--
-- Purpose:
-- Let the template layer describe non-game exercises, and let a
-- routine step carry its own configuration.
--
-- exercise_templates gains the exercise_type_id discriminator
-- and relaxes game_type_id to nullable. The foreign key and its
-- RESTRICT are kept: deleting a game type is still blocked while
-- a template references it.
--
-- routine_steps gains the Routine Exercise Configuration of
-- 09-training-routines.md 3.5 — targets, sequences, patterns,
-- game selection. Duration stays in its own columns because it
-- is structural and queried (section 6).
--
-- Both tables were confirmed empty in production before this
-- migration was written (SELECT count(*) FROM exercise_templates,
-- routine_steps), so exercise_type_id is added NOT NULL directly
-- with no backfill. Re-confirm emptiness before applying, since
-- there is no live database in the authoring container to check
-- against at commit time.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_templates
ADD COLUMN exercise_type_id UUID NOT NULL,
ADD COLUMN default_configuration JSONB,
ALTER COLUMN game_type_id DROP NOT NULL,
ADD CONSTRAINT fk_exercise_templates_exercise_type FOREIGN KEY (exercise_type_id) REFERENCES exercise_types(id) ON DELETE RESTRICT;

COMMENT ON COLUMN exercise_templates.exercise_type_id IS 'Which kind of exercise this template defines.';
COMMENT ON COLUMN exercise_templates.game_type_id IS 'Set only when the exercise type is GAME.';
COMMENT ON COLUMN exercise_templates.default_configuration IS 'Exercise-type defaults and constraints; overridden by routine_steps.configuration.';

ALTER TABLE routine_steps
ADD COLUMN configuration JSONB;

COMMENT ON COLUMN routine_steps.configuration IS 'Routine Exercise Configuration (09-training-routines.md 3.5).';

-- migrate:down
ALTER TABLE routine_steps DROP COLUMN IF EXISTS configuration;

ALTER TABLE exercise_templates DROP CONSTRAINT IF EXISTS fk_exercise_templates_exercise_type;

ALTER TABLE exercise_templates
DROP COLUMN IF EXISTS default_configuration,
DROP COLUMN IF EXISTS exercise_type_id;

ALTER TABLE exercise_templates ALTER COLUMN game_type_id SET NOT NULL;
