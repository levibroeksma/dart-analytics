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
--    follow by ON DELETE CASCADE. The owning activities row does
--    not follow and is not deleted here: see (d) below.
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
--    Such a routine held nothing but this one exercise. Both
--    deletes name every routine they destroy — id, name, and the
--    weekday of each schedule day — the way seed 0031 names the
--    system routines it keeps: a destructive delete reporting
--    only a count tells the prod run nothing about what it lost.
-- 6. surviving steps are renumbered to close the gap in
--    uq_routine_steps_sequence. That constraint is NOT
--    DEFERRABLE, and a non-deferrable unique constraint is
--    checked after each row, not at end of statement: a single
--    ranking UPDATE can still collide with a row it has not
--    reached yet (4 -> 3 while 3 is still live). The numbers are
--    therefore parked above every live value first, then ranked
--    down into 1..n; neither statement can collide. routine_steps
--    is locked IN SHARE ROW EXCLUSIVE MODE before the first step
--    is deleted (readers unaffected, writers wait), so no
--    concurrent insert can land in an affected routine between
--    the park and the rank-down and make the park's offset
--    collide with a live number. Renumbering has a statistics
--    cost, paid knowingly: see (b) below.
-- 7. exercise_type_tags, then the exercise_templates,
--    exercise_ruleset_versions and exercise_types rows.
--
-- What this leaves behind. Each of these is reported by a
-- NOTICE rather than repaired, because repairing it is a
-- product decision this migration is not entitled to take.
--
-- a. Past step-level history is intact. activity_configurations
--    is an immutable snapshot of what a training ran, and
--    v_stats_routine_step_facts resolves a step through that
--    snapshot by sequence number, never through routine_steps,
--    so renumbering a live routine does not move a past run's
--    step.
-- b. Forward continuity is NOT intact for a renumbered step.
--    v_stats_routine_step_facts keys a step by
--    sequence_number || '-' || md5(element - 'sequenceNumber')
--    (0045_stats_routine_views.sql), and a past session keeps
--    the number it recorded while the next run of the same
--    routine records the new one. Step 4 renumbered to 3
--    therefore starts a fresh step_key: its runs so far stay
--    under '4-<fingerprint>' and read as a step that stopped,
--    and its trend restarts at the first run after this
--    migration. Unavoidable while uq_routine_steps_sequence
--    demands a gapless 1..n, so the renumber notice below names
--    every routine and every step it moved, with the old and
--    the new sequence number.
-- c. Run-level history IS rewritten for any training that ran
--    this type as a step. v_stats_routine_run_facts reads
--    step_count from the immutable snapshot but counts
--    steps_started, steps_completed and dart_count over live
--    exercise_sessions (0045_stats_routine_views.sql), so a
--    finished four-step run whose step 3 was this type now
--    reports 3 completed against 4 expected — a completed run
--    that reads as unfinished — and its dart count drops by the
--    darts deleted in step 1. A notice counts and names those
--    activities.
-- d. activities and their activity_configurations snapshots
--    survive the session delete. fk_sessions_activity is
--    exercise_sessions -> activities ON DELETE CASCADE, the
--    child direction: deleting sessions never reaches the
--    parent. A routine training whose only sessions were of
--    this type is therefore left with no session at all but
--    keeps its activity_configurations snapshot; both
--    v_training_completions and v_stats_routine_run_facts
--    inner-join that snapshot, so the training still counts in
--    history and streaks and v_stats_routine_run_facts emits a
--    ghost run with the snapshot's step_count and zero started,
--    completed and darts. A standalone run of this type never
--    had an activity_configurations snapshot, so it is left as
--    an empty activities row with no session and no snapshot,
--    appearing in neither view. Those rows are deliberately NOT
--    deleted here; the notice names each one (id, player,
--    status, start, and the routine its snapshot recorded, or
--    'none' for a standalone run) so the production run is
--    auditable.
-- ============================================================

-- migrate:up
DO $$
DECLARE
    v_type_id UUID;
    v_count BIGINT;
    v_named TEXT;
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

    CREATE TEMP TABLE tmp_0048_touched_activities ON COMMIT DROP AS
    SELECT DISTINCT s.activity_id
    FROM exercise_sessions s
    WHERE s.exercise_type_id = v_type_id;

    DELETE FROM exercise_sessions s
    WHERE s.exercise_type_id = v_type_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % exercise sessions (stages, participants, configurations and idempotency rows cascaded)', v_count;

    SELECT count(*),
        string_agg(
            format('%s (player %s, %s, started %s, snapshot routine %s)',
                a.id,
                a.player_id,
                gs.implementation_key,
                a.started_at,
                COALESCE(ac.configuration ->> 'routineName', 'none')
            ),
            '; '
            ORDER BY a.started_at, a.id
        )
    INTO v_count, v_named
    FROM tmp_0048_touched_activities ta
        JOIN activities a ON a.id = ta.activity_id
        JOIN game_statuses gs ON gs.id = a.status_id
        LEFT JOIN activity_configurations ac ON ac.activity_id = a.id
    WHERE NOT EXISTS (
        SELECT 1 FROM exercise_sessions s WHERE s.activity_id = a.id
    );
    RAISE NOTICE '0048: % activity(ies) left with no exercise session by this erasure, kept on purpose (a routine training still counts in v_training_completions and gets a ghost run in v_stats_routine_run_facts; a standalone run of this type has no activity_configurations snapshot and appears in neither view): %', v_count, COALESCE(v_named, 'none');

    SELECT count(*),
        string_agg(a.id::text, '; ' ORDER BY a.started_at, a.id)
    INTO v_count, v_named
    FROM tmp_0048_touched_activities ta
        JOIN activities a ON a.id = ta.activity_id
    WHERE EXISTS (
        SELECT 1 FROM exercise_sessions s WHERE s.activity_id = a.id
    );
    RAISE NOTICE '0048: % surviving activity(ies) now under-report in v_stats_routine_run_facts (snapshot step_count against live steps_started, steps_completed and dart_count): %', v_count, COALESCE(v_named, 'none');

    LOCK TABLE routine_steps IN SHARE ROW EXCLUSIVE MODE;

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

    CREATE TEMP TABLE tmp_0048_emptied_routines ON COMMIT DROP AS
    SELECT rt.id,
        rt.name
    FROM routine_templates rt
    WHERE NOT rt.is_system_template
        AND EXISTS (
            SELECT 1 FROM tmp_0048_erased_steps e
            WHERE e.routine_template_id = rt.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM routine_steps rs
            WHERE rs.routine_template_id = rt.id
        );

    SELECT string_agg(
            format('%s (%s) on weekday %s', r.name, r.id, d.day_of_week),
            '; '
            ORDER BY r.name, d.day_of_week
        )
    INTO v_named
    FROM training_schedule_days d
        JOIN tmp_0048_emptied_routines r ON r.id = d.routine_template_id;

    DELETE FROM training_schedule_days d
    USING tmp_0048_emptied_routines r
    WHERE d.routine_template_id = r.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % training schedule day(s) of emptied player routines: %', v_count, COALESCE(v_named, 'none');

    SELECT string_agg(format('%s (%s)', r.name, r.id), '; ' ORDER BY r.name)
    INTO v_named
    FROM tmp_0048_emptied_routines r;

    DELETE FROM routine_templates rt
    USING tmp_0048_emptied_routines r
    WHERE rt.id = r.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '0048: deleted % player routine(s) left with no step: %', v_count, COALESCE(v_named, 'none');

    CREATE TEMP TABLE tmp_0048_renumbered_steps ON COMMIT DROP AS
    SELECT rs.routine_template_id,
        rt.name AS routine_name,
        et.name AS exercise_name,
        rs.sequence_number AS old_sequence_number,
        gap.rn AS new_sequence_number
    FROM routine_steps rs
        JOIN routine_templates rt ON rt.id = rs.routine_template_id
        JOIN exercise_templates et ON et.id = rs.exercise_template_id
        JOIN (
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
        ) gap ON gap.id = rs.id
    WHERE rs.sequence_number <> gap.rn;

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

    SELECT count(*) INTO v_count FROM tmp_0048_renumbered_steps;

    SELECT string_agg(moved.line, '; ' ORDER BY moved.routine_name, moved.routine_template_id)
    INTO v_named
    FROM (
        SELECT n.routine_template_id,
            n.routine_name,
            format('%s (%s): %s',
                n.routine_name,
                n.routine_template_id,
                string_agg(
                    format('%s moves %s -> %s', n.exercise_name, n.old_sequence_number, n.new_sequence_number),
                    ', '
                    ORDER BY n.old_sequence_number
                )
            ) AS line
        FROM tmp_0048_renumbered_steps n
        GROUP BY n.routine_template_id, n.routine_name
    ) moved;
    RAISE NOTICE '0048: renumbered % surviving routine step(s); each one starts a new step_key in v_stats_routine_step_facts, so its trend restarts on the next run: %', v_count, COALESCE(v_named, 'none');

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
