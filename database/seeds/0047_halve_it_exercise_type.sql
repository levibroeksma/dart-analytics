-- database/seeds/0047_halve_it_exercise_type.sql
--
-- ============================================================
-- Seed: 0047_halve_it_exercise_type.sql
--
-- Purpose:
-- Insert the HALVE_IT exercise type, its v1 ruleset and the
-- Halve-It system template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/halve-it.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration is empty: the target list and start
-- total are fixed in V1. Duration is the routine step's.
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
		'0199a000-0000-7000-8000-00000000000f',
		'HALVE_IT',
		'Halve-It',
		'Nine rounds, one visit each: 20, 16, any double, 17, 18, any treble, 19, 20, bull. Darts in the target add their score; a visit that misses it halves your total. The list repeats until the time runs out.',
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
		'0199a100-0000-7000-8000-00000000000f',
		'0199a000-0000-7000-8000-00000000000f',
		'HALVE_IT_V1',
		1,
		'Initial Halve-It ruleset: 20, 16, any double (bullseye included), 17, 18, any treble, 19, 20, bull; board value per hit; a blank visit halves the total, rounding up; passes repeat until time, the total carried.',
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
		'0199b000-0000-7000-8000-000000000016',
		'0199a000-0000-7000-8000-00000000000f',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'HALVE_IT_V1'
		),
		NULL,
		'Halve-It',
		'Hit each round''s target or lose half your total.',
		'{}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
