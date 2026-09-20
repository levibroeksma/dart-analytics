-- ============================================================
-- Verification: 0041_training_schedule_checks.sql
--
-- Proves against a live database (D193) what migration 0041 only
-- claims: at most one active schedule per player
-- (uq_training_schedules_player_active), day_of_week is bounded to
-- ISO 1-7, a weekday cannot repeat within one schedule, a routine
-- still referenced by a schedule day cannot be deleted (RESTRICT),
-- deleting a schedule cascades its days, deleting a player cascades
-- their schedules, and the two read views' derived columns
-- (day_count, routine_minutes) resolve correctly.
--
-- The fixture routine is built the same way 0038's script builds
-- one: insert the template and its steps, then force the deferred
-- duration-bounds trigger (0038) IMMEDIATE so a broken fixture fails
-- loudly here rather than never firing at all -- this script always
-- ROLLBACKs, so a deferred check left DEFERRED would never run.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0041_training_schedule_checks.sql
--
-- Expected: every result row reads PASS.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES
    ('0199f000-0000-7000-8000-0000000000f1', 'verify-0041-0199f000-0000-7000-8000-0000000000f1', 'Verify Player 1', now(), now()),
    ('0199f000-0000-7000-8000-0000000000f2', 'verify-0041-0199f000-0000-7000-8000-0000000000f2', 'Verify Player 2', now(), now());

-- fixture: one 30-minute user routine owned by player 1
DO $$
BEGIN
    SET CONSTRAINTS trg_routine_steps_duration_bounds, trg_routine_templates_duration_bounds DEFERRED;

    INSERT INTO routine_templates (id, player_id, name, description, is_system_template, created_at, updated_at)
    VALUES ('0199f100-0000-7000-8000-0000000000f1', '0199f000-0000-7000-8000-0000000000f1', 'Verify 30', NULL, FALSE, now(), now());
    INSERT INTO routine_steps (id, routine_template_id, exercise_template_id, sequence_number, duration_type_id, duration_value, configuration, created_at)
    VALUES (gen_random_uuid(), '0199f100-0000-7000-8000-0000000000f1', '0199b000-0000-7000-8000-000000000002', 1,
            (SELECT id FROM duration_types WHERE implementation_key = 'MINUTES'), 30, NULL, now());

    SET CONSTRAINTS trg_routine_steps_duration_bounds, trg_routine_templates_duration_bounds IMMEDIATE;
END $$;

-- fixture: schedule A, active, one day (Wednesday) on the routine above --
-- stays untouched through check 4 and the view checks (7)
INSERT INTO training_schedules (id, player_id, name, is_active, created_at, updated_at)
VALUES ('0199f200-0000-7000-8000-0000000000f1', '0199f000-0000-7000-8000-0000000000f1', 'Schedule A (active)', TRUE, now(), now());

INSERT INTO training_schedule_days (id, training_schedule_id, day_of_week, routine_template_id, created_at)
VALUES ('0199f300-0000-7000-8000-0000000000f1', '0199f200-0000-7000-8000-0000000000f1', 3, '0199f100-0000-7000-8000-0000000000f1', now());

-- 1. a second active schedule for the same player is rejected
DO $$
BEGIN
    BEGIN
        INSERT INTO training_schedules (id, player_id, name, is_active, created_at, updated_at)
        VALUES ('0199f200-0000-7000-8000-0000000000f4', '0199f000-0000-7000-8000-0000000000f1', 'Second active', TRUE, now(), now());
        INSERT INTO verification_results VALUES ('1', 'a second active schedule for the same player is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('1', 'a second active schedule for the same player is rejected', 'PASS', NULL);
    END;
END $$;

-- fixture: schedule B, inactive scratch schedule for the day-level checks (2, 3, 5)
INSERT INTO training_schedules (id, player_id, name, is_active, created_at, updated_at)
VALUES ('0199f200-0000-7000-8000-0000000000f2', '0199f000-0000-7000-8000-0000000000f1', 'Schedule B (scratch)', FALSE, now(), now());

-- 2. day_of_week outside ISO 1-7 is rejected
DO $$
BEGIN
    BEGIN
        INSERT INTO training_schedule_days (id, training_schedule_id, day_of_week, routine_template_id, created_at)
        VALUES ('0199f300-0000-7000-8000-0000000000f2', '0199f200-0000-7000-8000-0000000000f2', 0, '0199f100-0000-7000-8000-0000000000f1', now());
        INSERT INTO verification_results VALUES ('2', 'day_of_week = 0 is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('2', 'day_of_week = 0 is rejected', 'PASS', NULL);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        INSERT INTO training_schedule_days (id, training_schedule_id, day_of_week, routine_template_id, created_at)
        VALUES ('0199f300-0000-7000-8000-0000000000f3', '0199f200-0000-7000-8000-0000000000f2', 8, '0199f100-0000-7000-8000-0000000000f1', now());
        INSERT INTO verification_results VALUES ('2', 'day_of_week = 8 is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('2', 'day_of_week = 8 is rejected', 'PASS', NULL);
    END;
END $$;

-- valid day for schedule B, kept for the duplicate-weekday and cascade checks
INSERT INTO training_schedule_days (id, training_schedule_id, day_of_week, routine_template_id, created_at)
VALUES ('0199f300-0000-7000-8000-0000000000f4', '0199f200-0000-7000-8000-0000000000f2', 1, '0199f100-0000-7000-8000-0000000000f1', now());

-- 3. a duplicate weekday within one schedule is rejected
DO $$
BEGIN
    BEGIN
        INSERT INTO training_schedule_days (id, training_schedule_id, day_of_week, routine_template_id, created_at)
        VALUES ('0199f300-0000-7000-8000-0000000000f5', '0199f200-0000-7000-8000-0000000000f2', 1, '0199f100-0000-7000-8000-0000000000f1', now());
        INSERT INTO verification_results VALUES ('3', 'a duplicate weekday in the same schedule is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('3', 'a duplicate weekday in the same schedule is rejected', 'PASS', NULL);
    END;
END $$;

-- 4. deleting a routine still referenced by a schedule day is blocked (RESTRICT)
--    schedule A's Wednesday still points at it, so this must fail regardless
--    of what happens to schedule B.
DO $$
BEGIN
    BEGIN
        DELETE FROM routine_templates WHERE id = '0199f100-0000-7000-8000-0000000000f1';
        INSERT INTO verification_results VALUES ('4', 'deleting a scheduled routine is blocked (RESTRICT)', 'FAIL', 'delete succeeded');
    EXCEPTION WHEN foreign_key_violation THEN
        INSERT INTO verification_results VALUES ('4', 'deleting a scheduled routine is blocked (RESTRICT)', 'PASS', NULL);
    END;
END $$;

-- 5. deleting a schedule cascades its days
DELETE FROM training_schedules WHERE id = '0199f200-0000-7000-8000-0000000000f2';

INSERT INTO verification_results
SELECT '5', 'deleting a schedule cascades its days',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s day row(s) remain', count(*))
FROM training_schedule_days
WHERE training_schedule_id = '0199f200-0000-7000-8000-0000000000f2';

-- 6. deleting a player cascades their schedules
INSERT INTO training_schedules (id, player_id, name, is_active, created_at, updated_at)
VALUES ('0199f200-0000-7000-8000-0000000000f3', '0199f000-0000-7000-8000-0000000000f2', 'Schedule C', FALSE, now(), now());

DELETE FROM players WHERE id = '0199f000-0000-7000-8000-0000000000f2';

INSERT INTO verification_results
SELECT '6', 'deleting a player cascades their schedules',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s schedule row(s) remain', count(*))
FROM training_schedules
WHERE player_id = '0199f000-0000-7000-8000-0000000000f2';

-- 7. v_training_schedules.day_count matches the inserted days (schedule A: one day)
INSERT INTO verification_results
SELECT '7', 'v_training_schedules.day_count matches the inserted days',
    CASE WHEN day_count = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('day_count = %s', day_count)
FROM v_training_schedules
WHERE schedule_id = '0199f200-0000-7000-8000-0000000000f1';

-- 7. v_training_schedule_days.routine_minutes matches the routine's MINUTES sum
INSERT INTO verification_results
SELECT '7', 'v_training_schedule_days.routine_minutes matches the routine''s MINUTES sum',
    CASE WHEN routine_minutes = 30 THEN 'PASS' ELSE 'FAIL' END,
    format('routine_minutes = %s', routine_minutes)
FROM v_training_schedule_days
WHERE schedule_id = '0199f200-0000-7000-8000-0000000000f1' AND day_of_week = 3;

SELECT step, result, check_name, detail FROM verification_results ORDER BY step::int, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
