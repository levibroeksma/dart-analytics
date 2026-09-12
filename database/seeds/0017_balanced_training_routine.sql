-- database/seeds/0017_balanced_training_routine.sql
--
-- ============================================================
-- Seed: 0017_balanced_training_routine.sql
--
-- Purpose:
-- Insert the second system routine: Balanced Training, 4 steps,
-- 30 minutes (design spec 2026-09-11 4). Reuses the existing
-- Warm-Up exercise template (0015_warm_up_routine.sql) rather
-- than creating a second one, per design spec 5.1 — its
-- default_configuration is updated in place from fixed
-- durationSeconds-per-phase to proportional weight-per-phase, a
-- change the seed 0015 phase content is compatible with:
-- five equal-weight phases reproduce the original 60s-each split
-- exactly (5 x weight 1 over a 300s step), so the existing
-- 5-minute Warm-Up routine's behaviour is unchanged.
--
-- UPDATE, not a second INSERT with ON CONFLICT DO NOTHING: this
-- is the one legitimate case for mutating already-seeded content
-- (seeds are idempotent INSERTs by id; there is no id to conflict
-- on for changing an existing row's JSONB). Written to be
-- idempotent under re-run: the new phases JSONB always
-- overwrites with the same value, whatever the row currently
-- holds.
-- ============================================================
BEGIN;

UPDATE exercise_templates
SET default_configuration = '{"phases":[
        {"name":"Upper","targets":[5,20,1],"weight":1},
        {"name":"Lower","targets":[19,3,17],"weight":1},
        {"name":"Right","targets":[13,6,10],"weight":1},
        {"name":"Left","targets":[8,11,14],"weight":1},
        {"name":"Bull","targets":[25],"weight":1}
    ]}'::jsonb,
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000001';

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
        '0199b000-0000-7000-8000-000000000002',
        '0199a000-0000-7000-8000-000000000003',
        NULL,
        'Switching',
        'One dart each at a fixed target list, scored by zone.',
        '{"targets":[20,19,18],"scoring":{"single":1,"double":2,"treble":3}}'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0199b000-0000-7000-8000-000000000003',
        '0199a000-0000-7000-8000-000000000004',
        NULL,
        'Double Pattern',
        'Cycles a fixed list of double-number patterns.',
        '{"patterns":[[20,10,5],[16,8,4],[12,6,3]]}'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0199b000-0000-7000-8000-000000000004',
        '0199a000-0000-7000-8000-000000000001',
        '0198f000-0000-7000-8000-000000000002',
        'Finishing',
        'Ten Up One Down, timed.',
        NULL,
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
        '0199c000-0000-7000-8000-000000000002',
        NULL,
        'Balanced Training',
        'Warm-up, two switching drills, and a timed finishing game — 30 minutes.',
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
VALUES (
        '0199d000-0000-7000-8000-000000000002',
        '0199c000-0000-7000-8000-000000000002',
        '0199b000-0000-7000-8000-000000000001',
        1,
        2,
        10,
        NULL,
        now()
    ),
    (
        '0199d000-0000-7000-8000-000000000003',
        '0199c000-0000-7000-8000-000000000002',
        '0199b000-0000-7000-8000-000000000002',
        2,
        2,
        5,
        NULL,
        now()
    ),
    (
        '0199d000-0000-7000-8000-000000000004',
        '0199c000-0000-7000-8000-000000000002',
        '0199b000-0000-7000-8000-000000000003',
        3,
        2,
        5,
        NULL,
        now()
    ),
    (
        '0199d000-0000-7000-8000-000000000005',
        '0199c000-0000-7000-8000-000000000002',
        '0199b000-0000-7000-8000-000000000004',
        4,
        2,
        10,
        '{"rulesetVersionKey":"TUOD_V1","durationType":"MINUTES","durationValue":10}'::jsonb,
        now()
    ) ON CONFLICT (id) DO NOTHING;

COMMIT;
