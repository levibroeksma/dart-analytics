-- ============================================================
-- Migration: 0007_constraints.sql
--
-- Purpose:
-- Add database integrity constraints.
--
-- This migration protects domain rules that cannot
-- be guaranteed by table structure alone.
--
-- ============================================================
BEGIN;
-- ============================================================
-- GAME DEFINITIONS
-- ============================================================
-- Game implementations must have stable keys
ALTER TABLE game_types
ADD CONSTRAINT chk_game_types_implementation_key_not_empty CHECK (length(trim(implementation_key)) > 0);
-- Names cannot be empty
ALTER TABLE game_types
ADD CONSTRAINT chk_game_types_name_not_empty CHECK (length(trim(name)) > 0);
-- ============================================================
-- FEATURES
-- ============================================================
ALTER TABLE game_features
ADD CONSTRAINT chk_game_features_key_not_empty CHECK (length(trim(implementation_key)) > 0);
ALTER TABLE game_type_features
ADD CONSTRAINT uq_game_type_feature UNIQUE (game_type_id, game_feature_id);
-- ============================================================
-- RULESETS
-- ============================================================
ALTER TABLE ruleset_versions
ADD CONSTRAINT chk_ruleset_version_positive CHECK (version_number > 0);
-- ============================================================
-- PLAYERS
-- ============================================================
ALTER TABLE players
ADD CONSTRAINT chk_players_display_name_not_empty CHECK (
        display_name IS NULL
        OR length(trim(display_name)) > 0
    );
-- ============================================================
-- ACTIVITIES
-- ============================================================
ALTER TABLE activities
ADD CONSTRAINT chk_activity_completed_after_start CHECK (
        completed_at IS NULL
        OR completed_at >= started_at
    );
-- ============================================================
-- EXERCISE SESSIONS
-- ============================================================
ALTER TABLE exercise_sessions
ADD CONSTRAINT chk_session_completed_after_start CHECK (
        completed_at IS NULL
        OR completed_at >= started_at
    );
-- ============================================================
-- EXERCISE CONFIGURATIONS
-- ============================================================
ALTER TABLE exercise_configurations
ADD CONSTRAINT chk_configuration_not_empty CHECK (jsonb_typeof(configuration) = 'object');
-- ============================================================
-- PARTICIPANTS
-- ============================================================
-- A participant must either reference
-- an existing player OR have a display name.
--
-- Example:
--
-- Player:
-- player_id = UUID
--
-- Guest:
-- player_id = NULL
-- display_name = "John"
--

ALTER TABLE participants
ADD CONSTRAINT chk_participant_identity CHECK (
        player_id IS NOT NULL
        OR display_name IS NOT NULL
    );
-- ============================================================
-- EXERCISE STAGES
-- ============================================================
ALTER TABLE exercise_stages
ADD CONSTRAINT chk_stage_sequence_positive CHECK (sequence_number > 0);
ALTER TABLE exercise_stages
ADD CONSTRAINT chk_stage_not_self_parent CHECK (
        parent_stage_id IS NULL
        OR parent_stage_id <> id
    );
-- ============================================================
-- ROUTINES
-- ============================================================
ALTER TABLE routine_steps
ADD CONSTRAINT chk_routine_step_sequence_positive CHECK (sequence_number > 0);
ALTER TABLE routine_steps
ADD CONSTRAINT chk_routine_duration_positive CHECK (duration_value > 0);
-- ============================================================
-- TURNS
-- ============================================================
ALTER TABLE turns
ADD CONSTRAINT chk_turn_sequence_positive CHECK (sequence_number > 0);
ALTER TABLE turns
ADD CONSTRAINT chk_turn_completed_after_created CHECK (
        completed_at IS NULL
        OR completed_at >= created_at
    );
-- ============================================================
-- DARTS
-- ============================================================
ALTER TABLE darts
ADD CONSTRAINT chk_dart_number_positive CHECK (dart_number > 0);
ALTER TABLE darts
ADD CONSTRAINT chk_dart_score_positive CHECK (score >= 0);
ALTER TABLE darts
ADD CONSTRAINT chk_dart_target_consistency CHECK (
        (
            intended_zone_id IS NULL
            AND intended_target_number IS NULL
        )
        OR (intended_zone_id IS NOT NULL)
    );
ALTER TABLE darts
ADD CONSTRAINT chk_hit_consistency CHECK (
        (
            hit_zone_id IS NULL
            AND hit_target_number IS NULL
        )
        OR (hit_zone_id IS NOT NULL)
    );
COMMIT;