-- database/seeds/0028_around_the_clock_routine_templates.sql
-- Three GAME exercise templates for the routine picker, pinned to
-- AROUND_THE_CLOCK_V2 (seed 0027): outer single only at 1, 2 and 3 darts
-- per visit. default_configuration carries all six AroundTheClockV2Config
-- keys and is valid as seeded; duration_value is a default the step's
-- minutes overwrite at start (ROUTINE_GAME_STEPS, D340). Outer single only
-- is valid here because every routine step records ANALYTICS +
-- VISUAL_BOARD (01-Routines.md §13).
--
-- UUID allocation (continues 0199b000 after 0026's -00a):
-- - 0199b000-...-00b  Around the Clock — 1 dart
-- - 0199b000-...-00c  Around the Clock — 2 darts
-- - 0199b000-...-00d  Around the Clock — 3 darts
BEGIN;

INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, game_ruleset_version_id, name, description, default_configuration, is_system_template, created_at, updated_at)
VALUES
    ('0199b000-0000-7000-8000-00000000000b',
     (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
     (SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'),
     (SELECT rv.id FROM ruleset_versions rv JOIN game_types gt ON gt.id = rv.game_type_id WHERE gt.implementation_key = 'AROUND_THE_CLOCK' AND rv.implementation_key = 'AROUND_THE_CLOCK_V2'),
     'Around the Clock — 1 dart', 'Outer singles 1 to 20, then the bull. At least 1 hit per visit moves you up; fewer steps you back. Laps restart at 1 until time runs out.',
     '{"path_direction":"LOW_TO_HIGH","odds_first":false,"segment_rule":"OUTER_SINGLE","difficulty":"INTERMEDIATE","duration_type":"MINUTES","duration_value":10}'::jsonb,
     TRUE, now(), now()),
    ('0199b000-0000-7000-8000-00000000000c',
     (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
     (SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'),
     (SELECT rv.id FROM ruleset_versions rv JOIN game_types gt ON gt.id = rv.game_type_id WHERE gt.implementation_key = 'AROUND_THE_CLOCK' AND rv.implementation_key = 'AROUND_THE_CLOCK_V2'),
     'Around the Clock — 2 darts', 'Outer singles 1 to 20, then the bull. At least 2 hits per visit move you up; fewer steps you back. Laps restart at 1 until time runs out.',
     '{"path_direction":"LOW_TO_HIGH","odds_first":false,"segment_rule":"OUTER_SINGLE","difficulty":"HARD","duration_type":"MINUTES","duration_value":10}'::jsonb,
     TRUE, now(), now()),
    ('0199b000-0000-7000-8000-00000000000d',
     (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
     (SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'),
     (SELECT rv.id FROM ruleset_versions rv JOIN game_types gt ON gt.id = rv.game_type_id WHERE gt.implementation_key = 'AROUND_THE_CLOCK' AND rv.implementation_key = 'AROUND_THE_CLOCK_V2'),
     'Around the Clock — 3 darts', 'Outer singles 1 to 20, then the bull. All 3 darts must hit to move up; fewer steps you back. Laps restart at 1 until time runs out.',
     '{"path_direction":"LOW_TO_HIGH","odds_first":false,"segment_rule":"OUTER_SINGLE","difficulty":"PRO","duration_type":"MINUTES","duration_value":10}'::jsonb,
     TRUE, now(), now())
ON CONFLICT (id) DO NOTHING;

COMMIT;
