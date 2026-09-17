-- ============================================================
-- Migration: 0036_read_model_view_consumers.sql
--
-- Purpose:
-- Make two read-model views able to serve the reads that
-- actually run, so the application stops going around them.
--
-- v_double_out_checkout_darts (issue #342):
-- the statistics read needs the session's starting_score to
-- turn prior_scored_in_stage into remaining-before-dart, and no
-- view exposed it -- so findStartingScores selected
-- exercise_configurations.configuration directly, against the
-- view-backed read contract (06-API/00-Overview.md) and
-- CLAUDE.md's "Reads via views". 0024 justified leaving it out
-- on the grounds that the view should stay "a plain arithmetic
-- projection, never a JSONB-parsing one"; 0025 overtook that
-- one migration later by projecting
-- (configuration ->> 'max_darts_per_turn') on
-- v_player_visit_facts. This follows 0025.
--
-- The join is LEFT and cannot fan out:
-- uq_exercise_configuration_session makes
-- exercise_configurations at most one row per session. A
-- session with no configuration row yields NULL, which the read
-- layer already treats as 0.
--
-- v_routine_execution (issue #344):
-- the documented read model for routines had zero consumers.
-- training-session.repository.ts re-implemented the same read
-- against routine_templates/routine_steps/exercise_templates/
-- duration_types, because the view exposed none of
-- is_system_template, exercise_type_key,
-- exercise_ruleset_version_key, default_configuration or
-- step_configuration -- everything findRoutineTemplateSteps
-- resolves a step from. Two divergent definitions of "a
-- routine's steps" with nothing keeping them in sync; 0033
-- fixed the view's game_types join (issue #343) but nothing
-- consumed the result.
--
-- exercise_types is INNER JOINed: exercise_templates
-- .exercise_type_id is NOT NULL since 0032.
-- exercise_ruleset_versions is LEFT JOINed on the pin 0035
-- added, matching the repository join it replaces -- a GAME
-- template pins no exercise ruleset.
--
-- Neither view changes an existing column, so no consumer of
-- either breaks; both are recreated rather than CREATE OR
-- REPLACEd because column order changes.
--
-- Never edits 0024/0033; this is a new migration.
-- ============================================================

-- migrate:up
DROP VIEW IF EXISTS v_double_out_checkout_darts;
CREATE VIEW v_double_out_checkout_darts AS
SELECT es.id AS session_id,
    es.player_id,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    SUM(d.score) OVER (
        PARTITION BY st.id, t.participant_id
        ORDER BY t.sequence_number, d.dart_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prior_scored_in_stage,
    (ec.configuration ->> 'starting_score')::int AS starting_score
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key = '501'
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_double_out_checkout_darts IS 'Raw per-dart facts for 501 VISUAL_BOARD sessions, plus prior score within the leg and the session''s configured starting_score, for dart-level double-attempt accuracy (owning player only). starting_score - prior_scored_in_stage gives remaining-before-dart; starting_score is NULL when the session stored no configuration snapshot.';

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rt.is_system_template,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    ext.implementation_key AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key AS game_type_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    et.default_configuration,
    rs.configuration AS step_configuration
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext    ON ext.id = et.exercise_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = et.exercise_ruleset_version_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition, carrying everything a step resolves from: its exercise type, the exercise ruleset version its template pins (0035), the template default configuration and the step override. game_type_key and exercise_ruleset_version_key are NULL for a non-game and a game step respectively.';

-- migrate:down
DROP VIEW IF EXISTS v_double_out_checkout_darts;
CREATE VIEW v_double_out_checkout_darts AS
SELECT es.id AS session_id,
    es.player_id,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    SUM(d.score) OVER (
        PARTITION BY st.id, t.participant_id
        ORDER BY t.sequence_number, d.dart_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prior_scored_in_stage
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key = '501'
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_double_out_checkout_darts IS 'Raw per-dart facts for 501 VISUAL_BOARD sessions, plus prior score within the leg, for dart-level double-attempt accuracy (owning player only). prior_scored_in_stage + the session''s own starting_score gives remaining-before-dart in the application read layer.';

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
