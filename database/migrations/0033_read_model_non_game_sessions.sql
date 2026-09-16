-- ============================================================
-- Migration: 0033_read_model_non_game_sessions.sql
--
-- Purpose:
-- Let the read model see a session that has no game bound to it.
--
-- Migration 0029 relaxed exercise_sessions.game_type_id,
-- ruleset_version_id, capture_mode_id and input_mode_id to
-- NULLABLE, and 0028 did the same for
-- exercise_templates.game_type_id. No view was generalized with
-- them: every one still INNER JOINed those lookups, so a
-- training exercise session was deleted from the result set
-- rather than returned with NULL keys. The facts were written
-- (D277, D281) and nothing could read them.
--
-- Each affected view's game_types join becomes a LEFT JOIN, as
-- do the other now-nullable session lookups it reaches through
-- (v_active_sessions' ruleset_versions/capture_modes/input_modes,
-- v_session_overview's capture_modes, v_dart_locations'
-- input_modes) -- an INNER JOIN on any one of them drops the
-- same row for the same reason. The *_key/*_name columns those
-- joins feed are therefore nullable from here on; that contract
-- change is mirrored in the API/TypeScript read layer.
--
-- Two views are deliberately left inner-joined:
--   * v_configuration_presets reads
--     configuration_templates.game_type_id, which is still
--     NOT NULL.
--   * v_double_out_checkout_darts restricts itself to
--     game_type_key = '501' in its own WHERE clause, so a
--     non-game session can never reach it and a LEFT JOIN there
--     would change no row.
--
-- v_game_replay already has no game_types join at all.
--
-- Never edits 0013/0016/0023/0025/0026; this is a new migration.
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
    es.started_at
FROM exercise_sessions es
    LEFT JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN capture_modes cm    ON cm.id = es.capture_mode_id
    LEFT JOIN input_modes im      ON im.id = es.input_mode_id
    LEFT JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN game_statuses gs         ON gs.id = es.status_id
WHERE gs.implementation_key = 'ACTIVE';
COMMENT ON VIEW v_active_sessions IS 'Active sessions available for resume, game and non-game alike; game_type_key/game_type_name and the capture/input/ruleset keys are NULL for a training exercise session.';

DROP VIEW IF EXISTS v_session_overview;
CREATE VIEW v_session_overview AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    gt.name               AS game_type_name,
    gs.implementation_key AS status_key,
    cm.implementation_key AS capture_mode_key,
    es.started_at,
    es.completed_at,
    FLOOR(
        EXTRACT(
            EPOCH
            FROM (
                    COALESCE(
                        es.completed_at,
                        now()
                    ) - es.started_at
                )
        )
    )::integer AS duration_seconds
FROM exercise_sessions es
    LEFT JOIN game_types gt    ON gt.id = es.game_type_id
    LEFT JOIN capture_modes cm ON cm.id = es.capture_mode_id
    JOIN game_statuses gs      ON gs.id = es.status_id;
COMMENT ON VIEW v_session_overview IS 'High level session history, game and non-game alike; game_type_key/game_type_name and capture_mode_key are NULL for a training exercise session.';

DROP VIEW IF EXISTS v_dart_analytics;
CREATE VIEW v_dart_analytics AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE
        ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t              ON t.id = d.turn_id
    JOIN participants p       ON p.id = t.participant_id
    JOIN exercise_stages st   ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    LEFT JOIN game_types gt            ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics (session-scoped, owning player only); game_type_key is NULL for a training exercise session.';

DROP VIEW IF EXISTS v_dart_locations;
CREATE VIEW v_dart_locations AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    im.implementation_key AS input_mode_key,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    t.total_score AS turn_total_score,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.score,
    d.location_x,
    d.location_y,
    SQRT(
        POWER(d.location_x, 2) + POWER(d.location_y, 2)
    ) AS radius_mm,
    MOD(
        DEGREES(
            ATAN2(d.location_x, - d.location_y)
        )::NUMERIC + 360,
        360
    ) AS angle_degrees
FROM darts d
    JOIN turns t              ON t.id = d.turn_id
    JOIN participants p       ON p.id = t.participant_id
    JOIN exercise_stages st   ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    LEFT JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN input_modes im      ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
WHERE d.location_x IS NOT NULL
    AND d.location_y IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_dart_locations IS 'Dart landing coordinates in millimetres with derived polar form (owning player only); miss margin is computed in the application read layer. game_type_key/input_mode_key are NULL for a training exercise session.';

DROP VIEW IF EXISTS v_player_visit_facts;
CREATE VIEW v_player_visit_facts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    st.id AS stage_id,
    stype.implementation_key AS stage_type_key,
    t.sequence_number AS turn_sequence,
    t.total_score,
    t.completed_at,
    COUNT(d.id) AS dart_count,
    (ec.configuration ->> 'max_darts_per_turn')::int AS configured_max_darts_per_turn
FROM turns t
    JOIN participants p       ON p.id = t.participant_id
    JOIN exercise_stages st   ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN stage_types stype    ON stype.id = st.stage_type_id
    LEFT JOIN game_types gt   ON gt.id = es.game_type_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN darts d ON d.turn_id = t.id
WHERE p.player_id = es.player_id
    AND t.completed_at IS NOT NULL
GROUP BY es.id,
    es.player_id,
    gt.implementation_key,
    st.id,
    stype.implementation_key,
    t.sequence_number,
    t.total_score,
    t.completed_at,
    ec.configuration;
COMMENT ON VIEW v_player_visit_facts IS 'One row per completed turn, every game type and capture mode (owning player only): real dart count plus the configured max-darts-per-turn, for career-wide turn-level statistics. game_type_key is NULL for a training exercise session.';

DROP VIEW IF EXISTS v_player_leg_facts;
CREATE VIEW v_player_leg_facts AS
WITH leg_turns AS (
    SELECT t.id AS turn_id,
        t.exercise_stage_id,
        COUNT(d.id) AS dart_count
    FROM turns t
        JOIN participants p ON p.id = t.participant_id
        JOIN exercise_stages st ON st.id = t.exercise_stage_id
        JOIN exercise_sessions es ON es.id = st.exercise_session_id
        LEFT JOIN darts d ON d.turn_id = t.id
    WHERE p.player_id = es.player_id
        AND t.completed_at IS NOT NULL
    GROUP BY t.id, t.exercise_stage_id
)
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    st.id AS stage_id,
    SUM(lt.dart_count) AS total_darts_in_leg
FROM leg_turns lt
    JOIN exercise_stages st ON st.id = lt.exercise_stage_id
    JOIN stage_types stype ON stype.id = st.stage_type_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    LEFT JOIN game_types gt ON gt.id = es.game_type_id
WHERE stype.implementation_key = 'LEG'
GROUP BY es.id, es.player_id, gt.implementation_key, st.id
HAVING bool_and(lt.dart_count > 0);
COMMENT ON VIEW v_player_leg_facts IS 'One row per LEG stage (owning player only), total real darts thrown in that leg -- only legs where every turn has real dart rows; incomplete-capture legs are excluded, never approximated. game_type_key is NULL for a training exercise session.';

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    gt.implementation_key AS game_type_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition; game_type_key is NULL for a non-game exercise step.';

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
    JOIN game_types gt       ON gt.id = es.game_type_id
    JOIN capture_modes cm    ON cm.id = es.capture_mode_id
    JOIN input_modes im      ON im.id = es.input_mode_id
    JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN game_statuses gs    ON gs.id = es.status_id
WHERE gs.implementation_key = 'ACTIVE';
COMMENT ON VIEW v_active_sessions IS 'Active gameplay sessions available for resume.';

DROP VIEW IF EXISTS v_session_overview;
CREATE VIEW v_session_overview AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    gt.name               AS game_type_name,
    gs.implementation_key AS status_key,
    cm.implementation_key AS capture_mode_key,
    es.started_at,
    es.completed_at,
    FLOOR(
        EXTRACT(
            EPOCH
            FROM (
                    COALESCE(
                        es.completed_at,
                        now()
                    ) - es.started_at
                )
        )
    )::integer AS duration_seconds
FROM exercise_sessions es
    JOIN game_types gt    ON gt.id = es.game_type_id
    JOIN game_statuses gs ON gs.id = es.status_id
    JOIN capture_modes cm ON cm.id = es.capture_mode_id;
COMMENT ON VIEW v_session_overview IS 'High level gameplay history overview.';

DROP VIEW IF EXISTS v_dart_analytics;
CREATE VIEW v_dart_analytics AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE
        ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t             ON t.id = d.turn_id
    JOIN participants p      ON p.id = t.participant_id
    JOIN exercise_stages st  ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics (session-scoped, owning player only).';

DROP VIEW IF EXISTS v_dart_locations;
CREATE VIEW v_dart_locations AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    im.implementation_key AS input_mode_key,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    t.total_score AS turn_total_score,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.score,
    d.location_x,
    d.location_y,
    SQRT(
        POWER(d.location_x, 2) + POWER(d.location_y, 2)
    ) AS radius_mm,
    MOD(
        DEGREES(
            ATAN2(d.location_x, - d.location_y)
        )::NUMERIC + 360,
        360
    ) AS angle_degrees
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
WHERE d.location_x IS NOT NULL
    AND d.location_y IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_dart_locations IS 'Dart landing coordinates in millimetres with derived polar form (owning player only); miss margin is computed in the application read layer.';

DROP VIEW IF EXISTS v_player_visit_facts;
CREATE VIEW v_player_visit_facts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    st.id AS stage_id,
    stype.implementation_key AS stage_type_key,
    t.sequence_number AS turn_sequence,
    t.total_score,
    t.completed_at,
    COUNT(d.id) AS dart_count,
    (ec.configuration ->> 'max_darts_per_turn')::int AS configured_max_darts_per_turn
FROM turns t
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN stage_types stype ON stype.id = st.stage_type_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN darts d ON d.turn_id = t.id
WHERE p.player_id = es.player_id
    AND t.completed_at IS NOT NULL
GROUP BY es.id,
    es.player_id,
    gt.implementation_key,
    st.id,
    stype.implementation_key,
    t.sequence_number,
    t.total_score,
    t.completed_at,
    ec.configuration;
COMMENT ON VIEW v_player_visit_facts IS 'One row per completed turn, every game type and capture mode (owning player only): real dart count plus the configured max-darts-per-turn, for career-wide turn-level statistics.';

DROP VIEW IF EXISTS v_player_leg_facts;
CREATE VIEW v_player_leg_facts AS
WITH leg_turns AS (
    SELECT t.id AS turn_id,
        t.exercise_stage_id,
        COUNT(d.id) AS dart_count
    FROM turns t
        JOIN participants p ON p.id = t.participant_id
        JOIN exercise_stages st ON st.id = t.exercise_stage_id
        JOIN exercise_sessions es ON es.id = st.exercise_session_id
        LEFT JOIN darts d ON d.turn_id = t.id
    WHERE p.player_id = es.player_id
        AND t.completed_at IS NOT NULL
    GROUP BY t.id, t.exercise_stage_id
)
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    st.id AS stage_id,
    SUM(lt.dart_count) AS total_darts_in_leg
FROM leg_turns lt
    JOIN exercise_stages st ON st.id = lt.exercise_stage_id
    JOIN stage_types stype ON stype.id = st.stage_type_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
WHERE stype.implementation_key = 'LEG'
GROUP BY es.id, es.player_id, gt.implementation_key, st.id
HAVING bool_and(lt.dart_count > 0);
COMMENT ON VIEW v_player_leg_facts IS 'One row per LEG stage (owning player only), total real darts thrown in that leg -- only legs where every turn has real dart rows; incomplete-capture legs are excluded, never approximated.';

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    gt.implementation_key AS game_type_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN game_types gt         ON gt.id = et.game_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition.';
