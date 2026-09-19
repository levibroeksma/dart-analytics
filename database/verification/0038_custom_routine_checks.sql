-- ============================================================
-- Verification: 0038_custom_routine_checks.sql
--
-- Proves against a live database (D193) what migration 0038 and
-- seed 0020 only claim: a user routine outside 30-60 MINUTES is
-- refused at commit, a system routine is not, an ownerless user
-- routine is refused, and the catalog view lists exactly the four
-- system templates with defaults after 0020.
--
-- The duration trigger is DEFERRABLE INITIALLY DEFERRED and this
-- script never commits, so each case forces it with
-- SET CONSTRAINTS ... IMMEDIATE inside its own sub-block.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0038_custom_routine_checks.sql
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
VALUES ('01999300-0000-7000-8000-0000000000f1', 'verify-0038', 'Verify 0038', now(), now());

-- 1. ownerless user routine is refused by the CHECK
DO $$
BEGIN
    BEGIN
        INSERT INTO routine_templates (id, player_id, name, description, is_system_template, created_at, updated_at)
        VALUES ('01999400-0000-7000-8000-0000000000f1', NULL, 'Ownerless', NULL, FALSE, now(), now());
        INSERT INTO verification_results VALUES ('1', 'chk_routine_templates_player_ownership rejects a user routine with no owner', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('1', 'chk_routine_templates_player_ownership rejects a user routine with no owner', 'PASS', NULL);
    END;
END $$;

-- helper: a user routine with one Switching step of N minutes
CREATE TEMP FUNCTION IF NOT EXISTS verify_routine(p_id UUID, p_minutes INTEGER) RETURNS void
LANGUAGE plpgsql AS $fn$
BEGIN
    INSERT INTO routine_templates (id, player_id, name, description, is_system_template, created_at, updated_at)
    VALUES (p_id, '01999300-0000-7000-8000-0000000000f1', 'Verify ' || p_minutes, NULL, FALSE, now(), now());
    INSERT INTO routine_steps (id, routine_template_id, exercise_template_id, sequence_number, duration_type_id, duration_value, configuration, created_at)
    VALUES (gen_random_uuid(), p_id, '0199b000-0000-7000-8000-000000000002', 1,
            (SELECT id FROM duration_types WHERE implementation_key = 'MINUTES'), p_minutes, NULL, now());
    SET CONSTRAINTS trg_routine_steps_duration_bounds, trg_routine_templates_duration_bounds IMMEDIATE;
END;
$fn$;

DO $$
BEGIN
    BEGIN
        PERFORM verify_routine('01999400-0000-7000-8000-0000000000f2', 25);
        INSERT INTO verification_results VALUES ('2', 'a 25-minute user routine is refused', 'FAIL', 'commit-time check passed');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('2', 'a 25-minute user routine is refused', 'PASS', NULL);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        PERFORM verify_routine('01999400-0000-7000-8000-0000000000f3', 65);
        INSERT INTO verification_results VALUES ('3', 'a 65-minute user routine is refused', 'FAIL', 'commit-time check passed');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('3', 'a 65-minute user routine is refused', 'PASS', NULL);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        PERFORM verify_routine('01999400-0000-7000-8000-0000000000f4', 30);
        INSERT INTO verification_results VALUES ('4', 'a 30-minute user routine is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('4', 'a 30-minute user routine is accepted', 'FAIL', SQLERRM);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        PERFORM verify_routine('01999400-0000-7000-8000-0000000000f5', 60);
        INSERT INTO verification_results VALUES ('5', 'a 60-minute user routine is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('5', 'a 60-minute user routine is accepted', 'FAIL', SQLERRM);
    END;
END $$;

-- 6. a user routine with no steps is refused by the template trigger
DO $$
BEGIN
    BEGIN
        INSERT INTO routine_templates (id, player_id, name, description, is_system_template, created_at, updated_at)
        VALUES ('01999400-0000-7000-8000-0000000000f6', '01999300-0000-7000-8000-0000000000f1', 'Stepless', NULL, FALSE, now(), now());
        SET CONSTRAINTS trg_routine_templates_duration_bounds IMMEDIATE;
        INSERT INTO verification_results VALUES ('6', 'a stepless user routine is refused', 'FAIL', 'commit-time check passed');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('6', 'a stepless user routine is refused', 'PASS', NULL);
    END;
END $$;

-- 7. the seeded 5-minute system Warm-Up routine is untouched by the bound
INSERT INTO verification_results
SELECT '7', 'system Warm-Up routine (5 min) still exists under the trigger',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM routine_templates WHERE id = '0199c000-0000-7000-8000-000000000001' AND is_system_template;

-- 8. deleting a user routine cascades its steps without tripping the trigger
DO $$
BEGIN
    BEGIN
        DELETE FROM routine_templates WHERE id = '01999400-0000-7000-8000-0000000000f4';
        SET CONSTRAINTS trg_routine_steps_duration_bounds IMMEDIATE;
        INSERT INTO verification_results VALUES ('8', 'deleting a user routine does not trip the bound on its cascaded steps', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('8', 'deleting a user routine does not trip the bound on its cascaded steps', 'FAIL', SQLERRM);
    END;
END $$;

-- 9. view columns
INSERT INTO verification_results
SELECT '9', 'v_routine_execution exposes player_id, routine_description, exercise_description',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END, format('%s of 3 columns', count(*))
FROM information_schema.columns
WHERE table_name = 'v_routine_execution'
    AND column_name IN ('player_id', 'routine_description', 'exercise_description');

-- 10. catalog after seed 0020
INSERT INTO verification_results
SELECT '10', 'v_exercise_template_catalog lists four system templates, all with defaults',
    CASE WHEN count(*) = 4 AND bool_and(has_default_configuration) THEN 'PASS' ELSE 'FAIL' END,
    format('%s rows, all defaults: %s', count(*), bool_and(has_default_configuration))
FROM v_exercise_template_catalog;

SELECT step, result, check_name, detail FROM verification_results ORDER BY step::int, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
