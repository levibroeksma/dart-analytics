-- database/seeds/0039_switchblade_exercise_type.sql
--
-- ============================================================
-- Seed: 0039_switchblade_exercise_type.sql
--
-- Purpose:
-- Insert the SWITCHBLADE exercise type, its v1 ruleset and the
-- SwitchBlade system template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/switchblade.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration is empty: the path is fixed in V1.
-- Duration is the routine step's.
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
		'0199a000-0000-7000-8000-00000000000d',
		'SWITCHBLADE',
		'SwitchBlade',
		'Five three-dart rounds on a fixed path — two darts at T20, then a switch — scoring board points on each dart''s own number; the path repeats until the time runs out.',
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
		'0199a100-0000-7000-8000-00000000000c',
		'0199a000-0000-7000-8000-00000000000d',
		'SWITCHBLADE_V1',
		1,
		'Initial SwitchBlade ruleset: fixed path T20 T20 then T20/T19/T18/T17/bull; board score on the slot''s number, either bull on the bull slot; passes repeat until time.',
		now()
	) ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_templates (
		id,
		exercise_type_id,
		exercise_ruleset_version_id,
		game_type_id,
		name,
		description,
		default_configuration,
		is_system_template,
		created_at,
		updated_at
	)
VALUES (
		'0199b000-0000-7000-8000-000000000013',
		'0199a000-0000-7000-8000-00000000000d',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'SWITCHBLADE_V1'
		),
		NULL,
		'SwitchBlade',
		'Two darts at T20, then T20, T19, T18, T17 and the bullseye. Score board points on each dart''s own number.',
		'{}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
