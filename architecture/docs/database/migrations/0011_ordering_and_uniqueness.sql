-- ============================================================
-- Migration: 0011_ordering_and_uniqueness.sql
--
-- Purpose:
-- Enforce ordering uniqueness and the single-active-session
-- rule that were previously application-enforced only.
--
-- These constraints protect event ordering integrity:
-- replay depends on unambiguous sequence numbers.
--
-- ============================================================

-- migrate:up
ALTER TABLE routine_steps
ADD CONSTRAINT uq_routine_steps_sequence UNIQUE (routine_template_id, sequence_number);

CREATE UNIQUE INDEX uq_stages_sibling_sequence ON exercise_stages (
    exercise_session_id,
    parent_stage_id,
    sequence_number
)
WHERE parent_stage_id IS NOT NULL;

CREATE UNIQUE INDEX uq_stages_root_sequence ON exercise_stages (exercise_session_id, sequence_number)
WHERE parent_stage_id IS NULL;

ALTER TABLE turns
ADD CONSTRAINT uq_turns_stage_participant_sequence UNIQUE (
        exercise_stage_id,
        participant_id,
        sequence_number
    );

ALTER TABLE darts
ADD CONSTRAINT uq_darts_turn_number UNIQUE (turn_id, dart_number);

CREATE UNIQUE INDEX uq_sessions_single_active ON exercise_sessions (player_id, game_type_id)
WHERE completed_at IS NULL;

DROP INDEX IF EXISTS idx_routine_steps_template_sequence;
DROP INDEX IF EXISTS idx_darts_turn_number;

-- migrate:down
CREATE INDEX idx_routine_steps_template_sequence ON routine_steps (routine_template_id, sequence_number);
CREATE INDEX idx_darts_turn_number ON darts (turn_id, dart_number);

DROP INDEX IF EXISTS uq_sessions_single_active;
ALTER TABLE darts DROP CONSTRAINT IF EXISTS uq_darts_turn_number;
ALTER TABLE turns DROP CONSTRAINT IF EXISTS uq_turns_stage_participant_sequence;
DROP INDEX IF EXISTS uq_stages_root_sequence;
DROP INDEX IF EXISTS uq_stages_sibling_sequence;
ALTER TABLE routine_steps DROP CONSTRAINT IF EXISTS uq_routine_steps_sequence;
