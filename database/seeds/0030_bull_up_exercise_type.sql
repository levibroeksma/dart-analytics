-- database/seeds/0030_bull_up_exercise_type.sql
--
-- ============================================================
-- Seed: 0030_bull_up_exercise_type.sql
--
-- Purpose:
-- Insert the BULL_UP exercise type, its v1 ruleset and
-- one system exercise template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/bull-up-practice.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration is the empty object: the target is
-- always the bull and duration is the routine step's.
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
		'0199a000-0000-7000-8000-000000000009',
		'BULL_UP',
		'Bull Up',
		'One dart at the bull, retrieve, throw again: the throw that decides who starts a match.',
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
		'0199a100-0000-7000-8000-000000000008',
		'0199a000-0000-7000-8000-000000000009',
		'BULL_UP_V1',
		1,
		'Initial bull up ruleset: one dart per throw at the bull; bullseye, outer bull or miss.',
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
		'0199b000-0000-7000-8000-00000000000f',
		'0199a000-0000-7000-8000-000000000009',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'BULL_UP_V1'
		),
		NULL,
		'Bull Up Practice',
		'One dart at the bull, again and again. How many bullseyes before the time runs out?',
		'{}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
