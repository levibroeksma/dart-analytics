-- ============================================================
-- Verification: 0042_training_completions_view_checks.sql
--
-- Proves against a live database (D193) what migration 0042 only
-- claims: v_training_completions lists a COMPLETED training
-- activity with the routine id/name from its configuration
-- snapshot, and never lists an ABANDONED training, an ACTIVE
-- training, or a standalone game activity (no snapshot).
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0042_training_completions_view_checks.sql
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
VALUES ('0199f200-0000-7000-8000-0000000000f1', 'verify-0042-0199f200-0000-7000-8000-0000000000f1', 'Verify Player 1', now(), now());

INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES
    ('0199f210-0000-7000-8000-000000000001', '0199f200-0000-7000-8000-0000000000f1',
     (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'), now() - interval '1 hour', now(), now()),
    ('0199f210-0000-7000-8000-000000000002', '0199f200-0000-7000-8000-0000000000f1',
     (SELECT id FROM game_statuses WHERE implementation_key = 'ABANDONED'), now() - interval '1 hour', now(), now()),
    ('0199f210-0000-7000-8000-000000000003', '0199f200-0000-7000-8000-0000000000f1',
     (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'), now(), NULL, now()),
    ('0199f210-0000-7000-8000-000000000004', '0199f200-0000-7000-8000-0000000000f1',
     (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'), now() - interval '1 hour', now(), now());

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES
    (gen_random_uuid(), '0199f210-0000-7000-8000-000000000001', '{"routineTemplateId": "0199f220-0000-7000-8000-000000000001", "routineName": "Verify Routine", "steps": []}', now()),
    (gen_random_uuid(), '0199f210-0000-7000-8000-000000000002', '{"routineTemplateId": "0199f220-0000-7000-8000-000000000001", "routineName": "Verify Routine", "steps": []}', now()),
    (gen_random_uuid(), '0199f210-0000-7000-8000-000000000003', '{"routineTemplateId": "0199f220-0000-7000-8000-000000000001", "routineName": "Verify Routine", "steps": []}', now());

INSERT INTO verification_results
SELECT '1', 'completed training listed with snapshot routine',
    CASE WHEN count(*) = 1
          AND bool_and(routine_template_id = '0199f220-0000-7000-8000-000000000001')
          AND bool_and(routine_name = 'Verify Routine')
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s)', count(*))
FROM v_training_completions
WHERE activity_id = '0199f210-0000-7000-8000-000000000001';

INSERT INTO verification_results
SELECT '2', 'abandoned training excluded',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM v_training_completions
WHERE activity_id = '0199f210-0000-7000-8000-000000000002';

INSERT INTO verification_results
SELECT '3', 'active training excluded',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM v_training_completions
WHERE activity_id = '0199f210-0000-7000-8000-000000000003';

INSERT INTO verification_results
SELECT '4', 'game activity without snapshot excluded',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM v_training_completions
WHERE activity_id = '0199f210-0000-7000-8000-000000000004';

SELECT step, check_name, result, detail FROM verification_results ORDER BY step;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
