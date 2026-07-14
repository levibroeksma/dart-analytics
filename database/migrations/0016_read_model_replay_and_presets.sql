-- ============================================================
-- Migration: 0016_read_model_replay_and_presets.sql
--
-- Purpose:
-- Rebuild the replay and overview read models and add the
-- configuration preset read model.
--
--   * v_game_replay: LEFT JOIN darts (turn-total-only turns
--     appear with NULL dart columns), expose turns.total_score
--     as turn_total_score, and expose stage_id/parent_stage_id
--     so consumers can reconstruct and order nested stages
--     (stage sequence_number is only unique per parent).
--   * v_session_overview: floor duration_seconds to an integer
--     to match the SessionOverview DTO contract.
--   * v_configuration_presets: backs
--     GET /api/configuration-templates (system + own presets).
--
-- Never edits 0009/0013/0014; this is a new migration.
-- ============================================================

-- migrate:up
DROP VIEW IF EXISTS v_game_replay;
CREATE VIEW v_game_replay AS
SELECT es.id AS session_id,
    es.player_id,
    st.id                  AS stage_id,
    st.parent_stage_id,
    st.sequence_number     AS stage_sequence,
    stg.implementation_key AS stage_type_key,
    t.sequence_number      AS turn_sequence,
    p.display_name         AS participant_name,
    t.total_score          AS turn_total_score,
    d.dart_number,
    d.intended_target_number,
    dz1.implementation_key AS intended_zone_key,
    d.hit_target_number,
    dz2.implementation_key AS hit_zone_key,
    d.score
FROM exercise_sessions es
    JOIN exercise_stages st ON st.exercise_session_id = es.id
    JOIN stage_types stg    ON stg.id = st.stage_type_id
    JOIN turns t            ON t.exercise_stage_id = st.id
    JOIN participants p     ON p.id = t.participant_id
    LEFT JOIN darts d        ON d.turn_id = t.id
    LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id
    LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id;
COMMENT ON VIEW v_game_replay IS 'Reconstructs chronological gameplay events at turn resolution (dart columns NULL for turn-total-only turns).';

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

CREATE VIEW v_configuration_presets AS
SELECT ct.id AS configuration_template_id,
    ct.player_id,
    gt.implementation_key AS game_type_key,
    ct.name,
    ct.description,
    ct.configuration,
    ct.is_system_template
FROM configuration_templates ct
    JOIN game_types gt ON gt.id = ct.game_type_id;
COMMENT ON VIEW v_configuration_presets IS 'Configuration presets per game type for GET /api/configuration-templates (system + own).';

-- migrate:down
DROP VIEW IF EXISTS v_configuration_presets;

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
    EXTRACT(
        EPOCH
        FROM (
                COALESCE(
                    es.completed_at,
                    now()
                ) - es.started_at
            )
    ) AS duration_seconds
FROM exercise_sessions es
    JOIN game_types gt    ON gt.id = es.game_type_id
    JOIN game_statuses gs ON gs.id = es.status_id
    JOIN capture_modes cm ON cm.id = es.capture_mode_id;
COMMENT ON VIEW v_session_overview IS 'High level gameplay history overview.';

DROP VIEW IF EXISTS v_game_replay;
CREATE VIEW v_game_replay AS
SELECT es.id AS session_id,
    es.player_id,
    st.sequence_number     AS stage_sequence,
    stg.implementation_key AS stage_type_key,
    t.sequence_number      AS turn_sequence,
    p.display_name         AS participant_name,
    d.dart_number,
    d.intended_target_number,
    dz1.implementation_key AS intended_zone_key,
    d.hit_target_number,
    dz2.implementation_key AS hit_zone_key,
    d.score
FROM exercise_sessions es
    JOIN exercise_stages st ON st.exercise_session_id = es.id
    JOIN stage_types stg    ON stg.id = st.stage_type_id
    JOIN turns t            ON t.exercise_stage_id = st.id
    JOIN participants p     ON p.id = t.participant_id
    JOIN darts d            ON d.turn_id = t.id
    LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id
    LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id;
COMMENT ON VIEW v_game_replay IS 'Reconstructs chronological gameplay events.';
