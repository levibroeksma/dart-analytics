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
BEGIN;
-- ============================================================
-- ROUTINE STEPS
--
-- A routine cannot contain two steps with the same position.
-- ============================================================
ALTER TABLE routine_steps
ADD CONSTRAINT uq_routine_steps_sequence UNIQUE (routine_template_id, sequence_number);
-- ============================================================
-- EXERCISE STAGES
--
-- Stage order must be unambiguous within a parent.
--
-- Top-level stages (parent_stage_id IS NULL) are covered
-- by a partial unique index because NULL values are not
-- comparable in a plain UNIQUE constraint.
-- ============================================================
CREATE UNIQUE INDEX uq_stages_sibling_sequence ON exercise_stages (
    exercise_session_id,
    parent_stage_id,
    sequence_number
)
WHERE parent_stage_id IS NOT NULL;
CREATE UNIQUE INDEX uq_stages_root_sequence ON exercise_stages (exercise_session_id, sequence_number)
WHERE parent_stage_id IS NULL;
-- ============================================================
-- TURNS
--
-- A participant cannot have two turns with the same
-- position inside one stage.
-- ============================================================
ALTER TABLE turns
ADD CONSTRAINT uq_turns_stage_participant_sequence UNIQUE (
        exercise_stage_id,
        participant_id,
        sequence_number
    );
-- ============================================================
-- DARTS
--
-- A turn cannot contain two darts with the same number.
-- ============================================================
ALTER TABLE darts
ADD CONSTRAINT uq_darts_turn_number UNIQUE (turn_id, dart_number);
-- ============================================================
-- SINGLE ACTIVE SESSION
--
-- Frozen rule:
-- One active exercise session per game type per player.
--
-- Previously application-enforced only.
-- ============================================================
CREATE UNIQUE INDEX uq_sessions_single_active ON exercise_sessions (player_id, game_type_id)
WHERE completed_at IS NULL;
-- ============================================================
-- REDUNDANT INDEX CLEANUP
--
-- The unique constraints above create indexes that make
-- the following 0008 indexes redundant.
--
-- 0008 itself is applied history and is never modified.
-- ============================================================
DROP INDEX IF EXISTS idx_routine_steps_template_sequence;
DROP INDEX IF EXISTS idx_darts_turn_number;
COMMIT;
