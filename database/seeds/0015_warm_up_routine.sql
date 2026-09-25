-- ============================================================
-- Seed: 0015_warm_up_routine.sql
--
-- Purpose:
-- Insert the Warm-Up exercise template: five timed phases
-- (09-training-routines.md 16).
--
-- The five phases live in exercise_templates.default_configuration
-- because they are the exercise type's own defaults; a routine
-- step that wants different phases sets routine_steps.configuration
-- instead of creating a second exercise template.
--
-- The standalone "Warm-Up" system routine this file once seeded
-- was removed at the player's request; seed 0031 deletes it from
-- databases that already hold it.
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

COMMIT;
