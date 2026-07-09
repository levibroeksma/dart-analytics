-- ============================================================
-- Migration: 0008_indexes.sql
--
-- Purpose:
-- Add performance indexes based on application
-- query patterns.
--
-- Index strategy:
-- - optimize reads
-- - avoid unnecessary write overhead
-- - support analytical queries
--
-- ============================================================

-- migrate:up
CREATE INDEX idx_game_types_published ON game_types (is_published)
WHERE is_published = TRUE;
CREATE INDEX idx_game_type_features_game_type ON game_type_features (game_type_id);
CREATE INDEX idx_routine_steps_template_sequence ON routine_steps (routine_template_id, sequence_number);
CREATE INDEX idx_exercise_templates_game_type ON exercise_templates (game_type_id);
CREATE INDEX idx_activities_player_status ON activities (player_id, status_id);
CREATE INDEX idx_sessions_player_created ON exercise_sessions (player_id, created_at DESC);
CREATE INDEX idx_sessions_player_completed ON exercise_sessions (player_id, completed_at DESC)
WHERE completed_at IS NOT NULL;
CREATE INDEX idx_sessions_active ON exercise_sessions (player_id, status_id)
WHERE completed_at IS NULL;
CREATE INDEX idx_sessions_activity ON exercise_sessions (activity_id);
CREATE INDEX idx_configuration_session ON exercise_configurations (exercise_session_id);
CREATE INDEX idx_participants_session ON participants (exercise_session_id);
CREATE INDEX idx_stages_session_sequence ON exercise_stages (exercise_session_id, sequence_number);
CREATE INDEX idx_stages_parent ON exercise_stages (parent_stage_id);
CREATE INDEX idx_turns_stage_sequence ON turns (exercise_stage_id, sequence_number);
CREATE INDEX idx_turns_participant ON turns (participant_id);
CREATE INDEX idx_darts_turn_number ON darts (turn_id, dart_number);
CREATE INDEX idx_darts_intended_target ON darts (
    intended_target_number,
    intended_zone_id
);
CREATE INDEX idx_darts_hit_target ON darts (hit_target_number, hit_zone_id);
CREATE INDEX idx_darts_zone_accuracy ON darts (intended_zone_id, hit_zone_id);

-- migrate:down
DROP INDEX IF EXISTS idx_darts_zone_accuracy;
DROP INDEX IF EXISTS idx_darts_hit_target;
DROP INDEX IF EXISTS idx_darts_intended_target;
DROP INDEX IF EXISTS idx_darts_turn_number;
DROP INDEX IF EXISTS idx_turns_participant;
DROP INDEX IF EXISTS idx_turns_stage_sequence;
DROP INDEX IF EXISTS idx_stages_parent;
DROP INDEX IF EXISTS idx_stages_session_sequence;
DROP INDEX IF EXISTS idx_participants_session;
DROP INDEX IF EXISTS idx_configuration_session;
DROP INDEX IF EXISTS idx_sessions_activity;
DROP INDEX IF EXISTS idx_sessions_active;
DROP INDEX IF EXISTS idx_sessions_player_completed;
DROP INDEX IF EXISTS idx_sessions_player_created;
DROP INDEX IF EXISTS idx_activities_player_status;
DROP INDEX IF EXISTS idx_exercise_templates_game_type;
DROP INDEX IF EXISTS idx_routine_steps_template_sequence;
DROP INDEX IF EXISTS idx_game_type_features_game_type;
DROP INDEX IF EXISTS idx_game_types_published;
