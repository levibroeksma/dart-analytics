-- ============================================================
-- Migration: 0051_active_sessions_routine_config.sql
--
-- Purpose:
-- Fold is_routine_step and configuration into v_active_sessions.
--
-- findActiveSessions joined exercise_sessions and
-- exercise_configurations at request time to add the routine-step
-- flag and the configuration snapshot, because the view exposed
-- neither (D442). The read model was split between a view and an
-- ad-hoc join in the repository, so each consumer had to repeat it.
--
-- The view gains two trailing columns:
--   * is_routine_step -- routine_step_sequence_number IS NOT NULL
--   * configuration   -- the session's exercise_configurations
--     snapshot, NULL when the session has none
--
-- uq_exercise_configuration_session (0005) makes the LEFT JOIN
-- one-to-one, so no row is multiplied.
--
-- Never edits 0009/0013/0033; this is a new migration.
-- ============================================================

-- migrate:up
DROP VIEW IF EXISTS v_active_sessions;
CREATE VIEW v_active_sessions AS
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
