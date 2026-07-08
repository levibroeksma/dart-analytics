-- ============================================================
-- Migration: 0005_runtime_core.sql
--
-- Purpose:
-- Create runtime gameplay entities.
--
-- Runtime data represents actual executed sessions.
--
-- ============================================================
BEGIN;
-- ============================================================
-- activities
--
-- Represents a user interaction lifecycle.
--
-- Example:
--
-- User opens app
-- Starts TUOD
-- Closes browser
-- Activity remains recoverable
--
-- ============================================================
CREATE TABLE activities (
    id UUID PRIMARY KEY,
    player_id UUID NOT NULL,
    status_id SMALLINT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_activities_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_activities_status FOREIGN KEY (status_id) REFERENCES game_statuses(id) ON DELETE RESTRICT
);
COMMENT ON TABLE activities IS 'Represents application usage sessions.';
-- ============================================================
-- exercise_sessions
--
-- Represents an actual played game/exercise.
--
-- ============================================================
CREATE TABLE exercise_sessions (
    id UUID PRIMARY KEY,
    activity_id UUID NOT NULL,
    player_id UUID NOT NULL,
    game_type_id UUID NOT NULL,
    capture_mode_id SMALLINT NOT NULL,
    input_mode_id SMALLINT NOT NULL,
    status_id SMALLINT NOT NULL,
    ruleset_version_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_sessions_activity FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_player FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_game_type FOREIGN KEY(game_type_id) REFERENCES game_types(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sessions_capture_mode FOREIGN KEY(capture_mode_id) REFERENCES capture_modes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sessions_input_mode FOREIGN KEY(input_mode_id) REFERENCES input_modes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sessions_status FOREIGN KEY(status_id) REFERENCES game_statuses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sessions_ruleset FOREIGN KEY(ruleset_version_id) REFERENCES ruleset_versions(id) ON DELETE RESTRICT
);
COMMENT ON TABLE exercise_sessions IS 'Immutable gameplay execution records.';
-- ============================================================
-- exercise_configurations
--
-- Stores exact configuration snapshot used.
--
-- ============================================================
CREATE TABLE exercise_configurations (
    id UUID PRIMARY KEY,
    exercise_session_id UUID NOT NULL,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_exercise_configuration_session UNIQUE(exercise_session_id),
    CONSTRAINT fk_exercise_configuration_session FOREIGN KEY(exercise_session_id) REFERENCES exercise_sessions(id) ON DELETE CASCADE
);
COMMENT ON TABLE exercise_configurations IS 'Immutable configuration snapshot for replay.';
-- ============================================================
-- participants
--
-- Represents people/entities involved in a session.
--
-- Examples:
-- player
-- guest
-- dartbot
--
-- ============================================================
CREATE TABLE participants (
    id UUID PRIMARY KEY,
    exercise_session_id UUID NOT NULL,
    participant_type_id SMALLINT NOT NULL,
    player_id UUID,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_participants_session FOREIGN KEY(exercise_session_id) REFERENCES exercise_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_participants_player FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE RESTRICT,
    CONSTRAINT fk_participants_type FOREIGN KEY (participant_type_id) REFERENCES participant_types(id) ON DELETE RESTRICT,
    -- Participant label determinism (enforced at write time; DB constraints cover the stable DartBot label + PLAYER player_id presence).
    CONSTRAINT chk_participants_dartbot_display_name CHECK (
        participant_type_id <> 3
        OR display_name = 'DartBot'
    ),
    CONSTRAINT chk_participants_player_type_has_player_id CHECK (
        participant_type_id <> 1
        OR player_id IS NOT NULL
    ),
    CONSTRAINT chk_participants_non_player_type_has_null_player_id CHECK (
        participant_type_id = 1
        OR player_id IS NULL
    )
);
COMMENT ON TABLE participants IS 'Participants involved in a gameplay session.';
-- ============================================================
-- exercise_stages
--
-- Represents hierarchical subdivisions.
--
-- Examples:
--
-- 501:
-- Match
--   Set
--      Leg
--
-- Routine:
--   Exercise block
--
-- ============================================================
CREATE TABLE exercise_stages (
    id UUID PRIMARY KEY,
    exercise_session_id UUID NOT NULL,
    parent_stage_id UUID,
    stage_type_id SMALLINT NOT NULL,
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_stage_session FOREIGN KEY(exercise_session_id) REFERENCES exercise_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_stage_parent FOREIGN KEY(parent_stage_id) REFERENCES exercise_stages(id) ON DELETE CASCADE,
    CONSTRAINT fk_stage_type FOREIGN KEY(stage_type_id) REFERENCES stage_types(id) ON DELETE RESTRICT
);
COMMENT ON TABLE exercise_stages IS 'Hierarchical structure of an executed exercise.';
COMMIT;