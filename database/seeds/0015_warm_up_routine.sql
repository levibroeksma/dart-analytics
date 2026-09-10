-- ============================================================
-- Seed: 0015_warm_up_routine.sql
--
-- Purpose:
-- Insert the one system routine phase 1 ships: a single warm-up
-- exercise of five timed phases (09-training-routines.md 16).
--
-- The routine is a system routine: player_id NULL,
-- is_system_template TRUE (06-Spec/02-Template-Layer.md).
--
-- The five phases live in exercise_templates.default_configuration
-- because they are the exercise type's own defaults; the routine
-- step overrides nothing, so routine_steps.configuration stays
-- NULL. A future routine that wants different phases sets that
-- column instead of creating a second exercise template.
-- ============================================================
BEGIN;

INSERT INTO exercise_templates (
        id,
        exercise_type_id,
        game_type_id,
        name,
        description,
        default_configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0199b000-0000-7000-8000-000000000001',
        '0199a000-0000-7000-8000-000000000002',
        NULL,
        'Warm-Up',
        'Five timed sections to loosen the wrist and arm.',
        '{"phases":[
            {"name":"Upper","targets":[5,20,1],"durationSeconds":60},
            {"name":"Lower","targets":[19,3,17],"durationSeconds":60},
            {"name":"Right","targets":[13,6,10],"durationSeconds":60},
            {"name":"Left","targets":[8,11,14],"durationSeconds":60},
            {"name":"Bull","targets":[25],"durationSeconds":60}
        ]}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO routine_templates (
        id,
        player_id,
        name,
        description,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0199c000-0000-7000-8000-000000000001',
        NULL,
        'Warm-Up',
        'Five-minute warm-up routine.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO routine_steps (
        id,
        routine_template_id,
        exercise_template_id,
        sequence_number,
        duration_type_id,
        duration_value,
        configuration,
        created_at
    )
SELECT '0199d000-0000-7000-8000-000000000001',
    '0199c000-0000-7000-8000-000000000001',
    '0199b000-0000-7000-8000-000000000001',
    1,
    dt.id,
    5,
    NULL,
    now()
FROM duration_types dt
WHERE dt.implementation_key = 'MINUTES' ON CONFLICT (id) DO NOTHING;

COMMIT;
