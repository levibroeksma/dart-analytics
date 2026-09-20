-- database/seeds/0022_routine_game_templates.sql
-- Two more GAME exercise templates for the routine picker (Phase 2 B).
-- default_configuration is valid under each ruleset; duration_value is a
-- default the step's minutes overwrite at start.
--
-- The 121 lookup below resolves game_types.implementation_key as
-- 'ONE_TWENTY_ONE', not '121': 0009_121_game_engine_reference.sql's
-- game_types row is ('ONE_TWENTY_ONE', '121', ...) — implementation_key,
-- then name. '121' is only the display name; every app-side reference
-- (app/tests/services/session.service.test.ts's gameTypeKey, schema.ts)
-- keys off ONE_TWENTY_ONE. The plan this seed was drafted from names the
-- wrong column here — using its literal '121' would make the subquery
-- resolve to NULL, silently landing a template with no game pinned at all.
BEGIN;

INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, game_ruleset_version_id, name, description, default_configuration, is_system_template, created_at, updated_at)
VALUES
    ('0199b000-0000-7000-8000-000000000005',
     (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
     (SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'),
     (SELECT rv.id FROM ruleset_versions rv JOIN game_types gt ON gt.id = rv.game_type_id WHERE gt.implementation_key = 'SCORE_TRAINING' AND rv.implementation_key = 'SCORE_TRAINING_V1'),
     'Score Training (timed)', 'Score as many points as you can at treble 20 for the step''s minutes.',
     '{"duration_type":"MINUTES","duration_value":10,"max_darts_per_turn":3,"max_visit_score":180}'::jsonb,
     TRUE, now(), now()),
    ('0199b000-0000-7000-8000-000000000006',
     (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
     (SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'),
     (SELECT rv.id FROM ruleset_versions rv JOIN game_types gt ON gt.id = rv.game_type_id WHERE gt.implementation_key = 'ONE_TWENTY_ONE' AND rv.implementation_key = '121_V2'),
     '121 (timed)', 'Climb the 121 ladder for the step''s minutes.',
     '{"duration_type":"MINUTES","duration_value":10}'::jsonb,
     TRUE, now(), now())
ON CONFLICT (id) DO NOTHING;

COMMIT;
