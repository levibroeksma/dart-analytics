-- ============================================================
-- Migration: 0045_stats_routine_views.sql
--
-- Purpose:
-- Routine fact views for the detailed statistics pages
-- (docs/architecture/10-Statistics/00-Overview.md §8, §10).
--
-- Both views derive routine and step identity from the
-- activity_configurations snapshot (09-Training/01-Routines.md
-- §18) and never reference a routine template -- editing or
-- deleting a template can never alter historical statistics.
-- Three identity rules (recorded with phase 6b's routine-statistics
-- decision):
--
--   1. routine_key = configuration ->> 'routineTemplateId'; a
--      snapshot without it keys as
--      'name-' || md5(routineName), and a snapshot with neither
--      field keys as 'name-' || md5('') -- the fallback is total,
--      never NULL, because a NULL identity key would collapse or
--      drop those runs under a GROUP BY.
--   2. step_key = <sequenceNumber>-<md5((step - 'sequenceNumber')::text)>.
--      The step element is found by its sequenceNumber field, not
--      array position: LEFT JOIN LATERAL
--      jsonb_array_elements(configuration -> 'steps'), matched
--      where e ->> 'sequenceNumber' = routine_step_sequence_number::text
--      AND jsonb_typeof(e -> 'sequenceNumber') = 'number' -- the
--      typeof guard is required because a JSON string "2" would
--      otherwise text-match an integer sequence number 2. A
--      missing or non-integer sequenceNumber therefore yields no
--      row (verified live: 0045_stats_routine_views_checks.sql
--      check 10). The array itself is guarded the same way: the
--      argument to jsonb_array_elements (and to jsonb_array_length
--      for step_count, below) is wrapped in
--      CASE WHEN jsonb_typeof(configuration -> 'steps') = 'array'
--      THEN configuration -> 'steps' END, so a snapshot whose
--      steps value is present but not an array (an object or a
--      string) yields no step rows instead of erroring every query
--      against both views for every player; a missing steps key
--      was already safe (-> 'steps' is SQL NULL and both functions
--      return NULL on NULL input) and stays that way.
--      step_fingerprint is that md5 alone, so two runs of the same
--      routine whose step configuration differs (but whose
--      sequenceNumber is the same) get distinct step_key values,
--      and two identical runs collapse to one.
--   3. Two views; v_stats_session_facts (0043) stays game-only
--      and untouched here.
--
-- v_stats_routine_run_facts: one row per COMPLETED or ABANDONED
-- activity that has an activity_configurations row. step_count
-- reads the snapshot's own step array length, guarded per rule 2
-- above so a non-array or missing steps value reads NULL instead
-- of erroring; steps_started and steps_completed count the
-- activity's actual step sessions (any status vs. COMPLETED), so a
-- training abandoned before any step session was created reads
-- steps_started = 0. dart_count is a rule-free LATERAL sum over
-- the owning participant's darts across every session of the
-- activity -- unlike steps_started/steps_completed above, it is
-- NOT filtered to sessions with routine_step_sequence_number set,
-- so it reads as "every dart thrown during the run", not "every
-- dart thrown during a step"; that asymmetry is deliberate.
-- integer-cast so node-postgres does not deliver a NUMERIC/bigint
-- string.
--
-- v_stats_routine_step_facts: one row per COMPLETED or ABANDONED
-- exercise session whose activity has a snapshot, whose
-- routine_step_sequence_number is not null, and whose sequence
-- number resolves a snapshot element (a session with no matching
-- element -- including because the snapshot's steps value is not
-- an array -- is dropped by requiring the LATERAL match non-null).
-- Lookups are LEFT JOINed wherever migration 0033 made the
-- session's own key nullable (game_type_id, ruleset_version_id,
-- input_mode_id, exercise_ruleset_version_id); exercise_type_id
-- is NOT NULL on every session, so exercise_types stays an INNER
-- JOIN. turn_count/counted_score/dart_count repeat 0043's
-- owner-scoped, rule-free LATERAL pattern per session.
-- ============================================================

-- migrate:up
CREATE VIEW v_stats_routine_run_facts AS
SELECT a.id AS activity_id,
    a.player_id,
    COALESCE(
        ac.configuration ->> 'routineTemplateId',
        'name-' || md5(COALESCE(ac.configuration ->> 'routineName', ''))
    ) AS routine_key,
    ac.configuration ->> 'routineTemplateId' AS routine_template_id,
    ac.configuration ->> 'routineName' AS routine_name,
    gs.implementation_key AS status_key,
    a.started_at,
    a.completed_at,
    FLOOR(EXTRACT(EPOCH FROM (a.completed_at - a.started_at)))::integer AS duration_seconds,
    jsonb_array_length(
        CASE WHEN jsonb_typeof(ac.configuration -> 'steps') = 'array'
            THEN ac.configuration -> 'steps'
        END
    ) AS step_count,
    COALESCE(sf.steps_started, 0) AS steps_started,
    COALESCE(sf.steps_completed, 0) AS steps_completed,
    COALESCE(df.dart_count, 0) AS dart_count
FROM activities a
    JOIN activity_configurations ac ON ac.activity_id = a.id
    JOIN game_statuses gs           ON gs.id = a.status_id
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS steps_started,
            COUNT(*) FILTER (WHERE step_gs.implementation_key = 'COMPLETED')::integer AS steps_completed
        FROM exercise_sessions step_es
            JOIN game_statuses step_gs ON step_gs.id = step_es.status_id
        WHERE step_es.activity_id = a.id
            AND step_es.routine_step_sequence_number IS NOT NULL
    ) sf ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS dart_count
        FROM exercise_sessions step_es
            JOIN exercise_stages st ON st.exercise_session_id = step_es.id
            JOIN turns t            ON t.exercise_stage_id = st.id
            JOIN participants p     ON p.id = t.participant_id
            JOIN darts d            ON d.turn_id = t.id
        WHERE step_es.activity_id = a.id
            AND p.player_id = a.player_id
    ) df ON TRUE
WHERE gs.implementation_key IN ('COMPLETED', 'ABANDONED');
COMMENT ON VIEW v_stats_routine_run_facts IS 'One row per terminal training activity (owning player only) with a resolved routine identity, step counts read from the activity_configurations snapshot, and a rule-free owner-scoped dart count across every session of the activity. Statistics phase 6a; identity rules recorded with phase 6b''s routine-statistics decision.';

CREATE VIEW v_stats_routine_step_facts AS
SELECT es.id AS session_id,
    es.activity_id,
    es.player_id,
    COALESCE(
        ac.configuration ->> 'routineTemplateId',
        'name-' || md5(COALESCE(ac.configuration ->> 'routineName', ''))
    ) AS routine_key,
    ac.configuration ->> 'routineName' AS routine_name,
    es.routine_step_sequence_number AS sequence_number,
    md5((se.element - 'sequenceNumber')::text) AS step_fingerprint,
    es.routine_step_sequence_number::text || '-' || md5((se.element - 'sequenceNumber')::text) AS step_key,
    se.element AS step,
    et.implementation_key  AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key  AS game_type_key,
    rv.implementation_key  AS ruleset_version_key,
    im.implementation_key  AS input_mode_key,
    gs.implementation_key  AS status_key,
    ec.configuration AS configuration,
    es.started_at,
    es.completed_at,
    FLOOR(EXTRACT(EPOCH FROM (es.completed_at - es.started_at)))::integer AS duration_seconds,
    COALESCE(tf.turn_count, 0) AS turn_count,
    COALESCE(tf.counted_score, 0) AS counted_score,
    COALESCE(df.dart_count, 0) AS dart_count
FROM exercise_sessions es
    JOIN activity_configurations ac ON ac.activity_id = es.activity_id
    JOIN game_statuses gs           ON gs.id = es.status_id
    JOIN exercise_types et          ON et.id = es.exercise_type_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = es.exercise_ruleset_version_id
    LEFT JOIN game_types gt                 ON gt.id = es.game_type_id
    LEFT JOIN ruleset_versions rv           ON rv.id = es.ruleset_version_id
    LEFT JOIN input_modes im                ON im.id = es.input_mode_id
    LEFT JOIN exercise_configurations ec    ON ec.exercise_session_id = es.id
    LEFT JOIN LATERAL (
        SELECT e AS element
        FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(ac.configuration -> 'steps') = 'array'
                THEN ac.configuration -> 'steps'
            END
        ) e
        WHERE jsonb_typeof(e -> 'sequenceNumber') = 'number'
            AND e ->> 'sequenceNumber' = es.routine_step_sequence_number::text
        LIMIT 1
    ) se ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS turn_count,
            SUM(t.total_score)::integer AS counted_score
        FROM turns t
            JOIN participants p     ON p.id = t.participant_id
            JOIN exercise_stages st ON st.id = t.exercise_stage_id
        WHERE st.exercise_session_id = es.id
            AND p.player_id = es.player_id
    ) tf ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS dart_count
        FROM darts d
            JOIN turns t             ON t.id = d.turn_id
            JOIN participants p      ON p.id = t.participant_id
            JOIN exercise_stages st  ON st.id = t.exercise_stage_id
        WHERE st.exercise_session_id = es.id
            AND p.player_id = es.player_id
    ) df ON TRUE
WHERE gs.implementation_key IN ('COMPLETED', 'ABANDONED')
    AND es.routine_step_sequence_number IS NOT NULL
    AND se.element IS NOT NULL;
COMMENT ON VIEW v_stats_routine_step_facts IS 'One row per terminal routine step session (owning player only), its identity and snapshot element resolved by sequenceNumber (never array position), with rule-free owner-scoped turn/dart/score counts. Statistics phase 6a; identity rules recorded with phase 6b''s routine-statistics decision.';

-- migrate:down
DROP VIEW IF EXISTS v_stats_routine_step_facts;
DROP VIEW IF EXISTS v_stats_routine_run_facts;
