-- database/seeds/0031_remove_default_routines.sql
--
-- ============================================================
-- Seed: 0031_remove_default_routines.sql
--
-- Purpose:
-- Delete the two system routines the player never asked for:
-- "Standard Practice" (once seeded by 0002) and the standalone
-- "Warm-Up" routine (once seeded by 0015). Both seeds no longer
-- insert them; this file removes them from databases that
-- already hold them. Idempotent: a no-op once they are gone.
--
-- Only the routines go. The Warm-Up exercise template
-- (0199b000-...-000000000001) stays: Balanced Training (0017)
-- uses it as a step and the routine builder lists it.
--
-- training_schedule_days references routine_templates with
-- ON DELETE RESTRICT. A routine a schedule still names is kept
-- and reported with a NOTICE rather than failing the seed run
-- or rewriting the player's schedule.
--
-- Past sessions are unaffected: runtime rows snapshot the
-- routine into activity_configurations and never FK a template.
-- ============================================================
BEGIN;

CREATE TEMP TABLE removed_routine_ids ON COMMIT DROP AS
SELECT rt.id
FROM routine_templates rt
WHERE rt.id IN (
        '0198f400-0000-7000-8000-000000000001',
        '0199c000-0000-7000-8000-000000000001'
    )
    AND rt.is_system_template
    AND NOT EXISTS (
        SELECT 1
        FROM training_schedule_days d
        WHERE d.routine_template_id = rt.id
    );

DO $$
DECLARE
    kept TEXT;
BEGIN
    SELECT string_agg(rt.name, ', ') INTO kept
    FROM routine_templates rt
    WHERE rt.id IN (
            '0198f400-0000-7000-8000-000000000001',
            '0199c000-0000-7000-8000-000000000001'
        )
        AND rt.id NOT IN (SELECT id FROM removed_routine_ids);
    IF kept IS NOT NULL THEN
        RAISE NOTICE 'kept system routine(s) still named by a training schedule: %', kept;
    END IF;
END $$;

DELETE FROM routine_steps
WHERE routine_template_id IN (SELECT id FROM removed_routine_ids);

DELETE FROM routine_templates
WHERE id IN (SELECT id FROM removed_routine_ids);

COMMIT;
