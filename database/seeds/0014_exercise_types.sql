-- ============================================================
-- Seed: 0014_exercise_types.sql
--
-- Purpose:
-- Insert the exercise-type catalog, the warm-up exercise
-- ruleset, the EXERCISE_SECTION stage type, and backfill
-- exercise_templates.exercise_type_id and
-- exercise_sessions.exercise_type_id for rows that predate the
-- discriminator.
--
-- The backfill is what migrations 0031/0032's NOT NULL depend
-- on, so the apply order is db:migrate -> db:seed -> db:migrate.
-- Every statement is idempotent: seed.ts runs each file twice.
-- ============================================================
BEGIN;

INSERT INTO exercise_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0199a000-0000-7000-8000-000000000001',
        'GAME',
        'Game',
        'Exercise executed by a game engine.',
        TRUE,
        now(),
        now()
    ),
    (
        '0199a000-0000-7000-8000-000000000002',
        'WARM_UP',
        'Warm-Up',
        'Timed non-analytical warm-up; requires no dart input.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_ruleset_versions (
        id,
        exercise_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0199a100-0000-7000-8000-000000000001',
        '0199a000-0000-7000-8000-000000000002',
        'WARM_UP_V1',
        1,
        'Initial warm-up ruleset: ordered timed phases, no dart input.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO stage_types (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        6,
        'EXERCISE_SECTION',
        'Exercise Section',
        'Timed section inside an exercise.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

UPDATE exercise_sessions
SET exercise_type_id = '0199a000-0000-7000-8000-000000000001'
WHERE exercise_type_id IS NULL;

UPDATE exercise_templates
SET exercise_type_id = '0199a000-0000-7000-8000-000000000001'
WHERE exercise_type_id IS NULL;

COMMIT;
