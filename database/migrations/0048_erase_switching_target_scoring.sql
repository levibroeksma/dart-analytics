-- ============================================================
-- Migration: 0048_erase_switching_target_scoring.sql
--
-- Purpose:
-- SWITCHING_TARGET_SCORING was merged into SWITCHING. The code
-- and the rules file are gone; this erases the type and every
-- row descending from it from the database. Seed 0024, which
-- created those rows, is deleted in the same commit, so nothing
-- reinstates them on the next `db:seed`.
--
-- Everything is selected by `implementation_key`: dev and prod
-- hold the same seeded ids today, but a delete keyed on a
-- hard-coded session or routine id would be a different
-- migration on every database.
--
-- Deletion order (each delete is a no-op when nothing matches,
-- so the migration replays cleanly on an empty database):
-- 1. darts, then turns of the type's sessions. Explicit even
--    though sessions cascade: turns -> participants is
--    ON DELETE RESTRICT, so a cascade that reached participants
--    before turns would abort.
-- 2. the sessions themselves; exercise_configurations,
--    exercise_stages, participants and session_write_idempotency
--    follow by ON DELETE CASCADE.
-- 3. routine_steps naming the type's template, in seeded and
--    player-built routines alike (fk_routine_steps_exercise is
--    ON DELETE RESTRICT: the template cannot go first).
-- 4. the minutes a player's routine just lost are given back to
--    its first surviving MINUTES step. trg_routine_steps_duration_bounds
--    (D305) holds a user routine to 30-60 minutes and is checked
--    at COMMIT, so simply dropping a step would abort this
--    migration against any routine sitting on the lower bound.
--    A routine of the player's chosen length is the conservative
--    outcome; system routines are exempt from the bound and are
--    left exactly as seeded.
-- 5. a player's routine left with no step at all cannot satisfy
--    that same bound, so it is deleted outright (with the
--    training_schedule_days rows that would RESTRICT the delete).
--    Such a routine held nothing but this one exercise.
-- 6. surviving steps are renumbered to close the gap in
--    uq_routine_steps_sequence. That constraint is NOT
--    DEFERRABLE, and a non-deferrable unique constraint is
--    checked after each row, not at end of statement: a single
--    ranking UPDATE can still collide with a row it has not
--    reached yet (4 -> 3 while 3 is still live). The numbers are
--    therefore parked above every live value first, then ranked
--    down into 1..n; neither statement can collide.
-- 7. exercise_type_tags, then the exercise_templates,
--    exercise_ruleset_versions and exercise_types rows.
--
-- History is not rewritten: activity_configurations is an
-- immutable snapshot of what a training ran, and
-- v_stats_routine_step_facts resolves a step through that
-- snapshot by sequence number, never through routine_steps, so
-- renumbering a live routine leaves past runs intact.
-- ============================================================

-- migrate:up
DO $$
DECLARE
    v_type_id UUID;
    v_count BIGINT;
BEGIN
    SELECT id INTO v_type_id
    FROM exercise_types
    WHERE implementation_key = 'SWITCHING_TARGET_SCORING';

    IF v_type_id IS NULL THEN
        RAISE NOTICE '0048: no SWITCHING_TARGET_SCORING exercise type; nothing to erase';
        RETURN;
    END IF;

    DELETE FROM darts d
    USING turns t, exercise_stages st, exercise_sessions s
    WHERE d.turn_id = t.id
        AND t.exercise_stage_id = st.id
        AND st.exercise_session_id = s.id
        AND s.exercise_type_id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % darts', v_count;

    DELETE FROM turns t
    USING exercise_stages st, exercise_sessions s
    WHERE t.exercise_stage_id = st.id
        AND st.exercise_session_id = s.id
        AND s.exercise_type_id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % turns', v_count;

    DELETE FROM exercise_sessions s
    WHERE s.exercise_type_id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % exercise sessions (stages, participants, configurations and idempotency rows cascaded)', v_count;

    CREATE TEMP TABLE tmp_0048_erased_steps ON COMMIT DROP AS
    SELECT rs.routine_template_id,
        rs.duration_type_id,
        rs.duration_value
    FROM routine_steps rs
        JOIN exercise_templates et ON et.id = rs.exercise_template_id
    WHERE et.exercise_type_id = v_type_id;

    DELETE FROM routine_steps rs
    USING exercise_templates et
    WHERE et.id = rs.exercise_template_id
        AND et.exercise_type_id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % routine steps', v_count;

    UPDATE routine_steps rs
    SET duration_value = rs.duration_value + comp.removed_minutes
    FROM (
        SELECT e.routine_template_id,
            SUM(e.duration_value) AS removed_minutes,
            (
                SELECT survivor.id
                FROM routine_steps survivor
                    JOIN duration_types sdt ON sdt.id = survivor.duration_type_id
                WHERE survivor.routine_template_id = e.routine_template_id
                    AND sdt.implementation_key = 'MINUTES'
                ORDER BY survivor.sequence_number
                LIMIT 1
            ) AS survivor_id
        FROM tmp_0048_erased_steps e
            JOIN duration_types dt ON dt.id = e.duration_type_id
            JOIN routine_templates rt ON rt.id = e.routine_template_id
        WHERE dt.implementation_key = 'MINUTES'
            AND NOT rt.is_system_template
        GROUP BY e.routine_template_id
    ) comp
    WHERE rs.id = comp.survivor_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: gave the deleted minutes back to % routine steps', v_count;

    DELETE FROM training_schedule_days d
    USING routine_templates rt
    WHERE d.routine_template_id = rt.id
        AND NOT rt.is_system_template
        AND EXISTS (
            SELECT 1 FROM tmp_0048_erased_steps e
            WHERE e.routine_template_id = rt.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM routine_steps rs
            WHERE rs.routine_template_id = rt.id
        );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % training schedule days of emptied routines', v_count;

    DELETE FROM routine_templates rt
    WHERE NOT rt.is_system_template
        AND EXISTS (
            SELECT 1 FROM tmp_0048_erased_steps e
            WHERE e.routine_template_id = rt.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM routine_steps rs
            WHERE rs.routine_template_id = rt.id
        );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % player routines left with no step', v_count;

    UPDATE routine_steps rs
    SET sequence_number = rs.sequence_number + 1000000
    WHERE EXISTS (
        SELECT 1 FROM tmp_0048_erased_steps e
        WHERE e.routine_template_id = rs.routine_template_id
    );

    UPDATE routine_steps rs
    SET sequence_number = ranked.rn
    FROM (
        SELECT rs2.id,
            row_number() OVER (
                PARTITION BY rs2.routine_template_id
                ORDER BY rs2.sequence_number
            ) AS rn
        FROM routine_steps rs2
        WHERE EXISTS (
            SELECT 1 FROM tmp_0048_erased_steps e
            WHERE e.routine_template_id = rs2.routine_template_id
        )
    ) ranked
    WHERE rs.id = ranked.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: renumbered % surviving routine steps', v_count;

    DELETE FROM exercise_type_tags tt
    WHERE tt.exercise_type_id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % exercise type tags', v_count;

    DELETE FROM exercise_templates et
    WHERE et.exercise_type_id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % exercise templates', v_count;

    DELETE FROM exercise_ruleset_versions erv
    WHERE erv.exercise_type_id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % exercise ruleset versions', v_count;

    DELETE FROM exercise_types ty
    WHERE ty.id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % exercise types', v_count;
END
$$;

-- migrate:down
-- Deliberately irreversible. The rows this would restore have no
-- source left to restore them from: seed 0024 is deleted in the
-- same commit, the type's rules file and engine are gone, and the
-- sessions, turns and darts it took with it were destroyed on
-- purpose (one active player, no history worth migrating to
-- another type). Rolling the schema back past 0048 means
-- restoring a database backup, not running SQL here.
