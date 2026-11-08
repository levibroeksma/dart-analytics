-- ============================================================
-- Migration: 0054_active_sessions_resume_fields.sql
--
-- Purpose:
-- Widen v_active_sessions with is_routine_step and configuration,
-- so findActiveSessions reads the resume deck from the view alone.
-- Until now the repository joined exercise_sessions and
-- exercise_configurations at runtime to add those two fields (D442,
-- #893), which split the read model between a view and an ad-hoc
-- join that every new consumer had to repeat.
--
-- is_routine_step is routine_step_sequence_number IS NOT NULL on
-- exercise_sessions (0029); standalone sessions leave it NULL, so
-- the flag is false for them. configuration is the session's
-- exercise_configurations snapshot, NULL when none was written.
--
-- exercise_configurations is UNIQUE on exercise_session_id
-- (uq_exercise_configuration_session), so the LEFT JOIN adds no
-- fan-out: row count is unchanged and the view stays filtered to
-- ACTIVE sessions. The 0033 LEFT JOINs are untouched.
--
-- The up direction uses CREATE OR REPLACE: both columns land after
-- the existing eight, so none is dropped or reordered. CREATE OR
-- REPLACE cannot drop a column back off, so the down direction
-- DROPs the view and recreates 0033's definition verbatim.
-- ============================================================

-- migrate:up
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    gt.name               AS game_type_name,
    cm.implementation_key AS capture_mode_key,
    im.implementation_key AS input_mode_key,
    rv.implementation_key AS ruleset_version_key,
    es.started_at,
    (es.routine_step_sequence_number IS NOT NULL) AS is_routine_step,
    ec.configuration
FROM exercise_sessions es
    LEFT JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN capture_modes cm    ON cm.id = es.capture_mode_id
    LEFT JOIN input_modes im      ON im.id = es.input_mode_id
    LEFT JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    JOIN game_statuses gs         ON gs.id = es.status_id
WHERE gs.implementation_key = 'ACTIVE';
COMMENT ON VIEW v_active_sessions IS 'Active sessions available for resume, game and non-game alike; game_type_key/game_type_name and the capture/input/ruleset keys are NULL for a training exercise session. is_routine_step marks a routine step; configuration is the session configuration snapshot, NULL if absent.';

-- migrate:down
DROP VIEW IF EXISTS v_active_sessions;
CREATE VIEW v_active_sessions AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    gt.name               AS game_type_name,
    cm.implementation_key AS capture_mode_key,
    im.implementation_key AS input_mode_key,
    rv.implementation_key AS ruleset_version_key,
    es.started_at
FROM exercise_sessions es
    LEFT JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN capture_modes cm    ON cm.id = es.capture_mode_id
    LEFT JOIN input_modes im      ON im.id = es.input_mode_id
    LEFT JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN game_statuses gs         ON gs.id = es.status_id
WHERE gs.implementation_key = 'ACTIVE';
COMMENT ON VIEW v_active_sessions IS 'Active sessions available for resume, game and non-game alike; game_type_key/game_type_name and the capture/input/ruleset keys are NULL for a training exercise session.';
