-- ============================================================
-- Migration: 0029_session_exercise_generalization.sql
--
-- Purpose:
-- Let an exercise session record a non-game exercise.
--
-- exercise_type_id is added NULLABLE here and promoted to
-- NOT NULL by migration 0031, because existing rows are
-- backfilled by database/seeds/0014_exercise_types.sql and
-- seeds run after migrations. The apply order is:
--
--   db:migrate (through 0030) -> db:seed -> db:migrate (0031)
--
-- Two independent CHECK constraints govern the relaxed columns.
-- A game binding is all-or-nothing; dart capture is
-- all-or-nothing and independent of it, because SWITCHING
-- (09-training-routines.md 17) takes dart observations with no
-- game engine. Neither constraint names a specific exercise
-- type: a literal id in DDL would need revisiting for every new
-- type, so type-to-column consistency is a service-layer rule.
--
-- fk_sessions_capability (migration 0020) is deliberately left
-- in place. It is MATCH SIMPLE, so a row with NULL in any of its
-- three columns satisfies it trivially.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_sessions
ADD COLUMN exercise_type_id UUID,
ADD COLUMN exercise_ruleset_version_id UUID,
ADD COLUMN routine_step_sequence_number INTEGER,
ALTER COLUMN game_type_id DROP NOT NULL,
ALTER COLUMN ruleset_version_id DROP NOT NULL,
ALTER COLUMN capture_mode_id DROP NOT NULL,
ALTER COLUMN input_mode_id DROP NOT NULL,
ADD CONSTRAINT fk_exercise_sessions_exercise_type FOREIGN KEY (exercise_type_id) REFERENCES exercise_types(id) ON DELETE RESTRICT,
ADD CONSTRAINT fk_exercise_sessions_exercise_ruleset_version FOREIGN KEY (exercise_ruleset_version_id) REFERENCES exercise_ruleset_versions(id) ON DELETE RESTRICT,
ADD CONSTRAINT chk_exercise_sessions_game_pair CHECK ((game_type_id IS NULL) = (ruleset_version_id IS NULL)),
ADD CONSTRAINT chk_exercise_sessions_capture_pair CHECK ((capture_mode_id IS NULL) = (input_mode_id IS NULL));

COMMENT ON COLUMN exercise_sessions.exercise_type_id IS 'Which kind of exercise this session ran.';
COMMENT ON COLUMN exercise_sessions.exercise_ruleset_version_id IS 'Exercise ruleset; set for an exercise run inside a training.';
COMMENT ON COLUMN exercise_sessions.routine_step_sequence_number IS 'Which step of the training this was; indexes into activity_configurations, no foreign key.';

-- migrate:down
ALTER TABLE exercise_sessions
DROP CONSTRAINT IF EXISTS chk_exercise_sessions_capture_pair,
DROP CONSTRAINT IF EXISTS chk_exercise_sessions_game_pair,
DROP CONSTRAINT IF EXISTS fk_exercise_sessions_exercise_ruleset_version,
DROP CONSTRAINT IF EXISTS fk_exercise_sessions_exercise_type,
DROP COLUMN IF EXISTS routine_step_sequence_number,
DROP COLUMN IF EXISTS exercise_ruleset_version_id,
DROP COLUMN IF EXISTS exercise_type_id;

ALTER TABLE exercise_sessions
ALTER COLUMN input_mode_id SET NOT NULL,
ALTER COLUMN capture_mode_id SET NOT NULL,
ALTER COLUMN ruleset_version_id SET NOT NULL,
ALTER COLUMN game_type_id SET NOT NULL;
