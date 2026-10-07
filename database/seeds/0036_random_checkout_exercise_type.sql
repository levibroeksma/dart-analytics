-- database/seeds/0036_random_checkout_exercise_type.sql
--
-- ============================================================
-- Seed: 0036_random_checkout_exercise_type.sql
--
-- Purpose:
-- Insert the RANDOM_CHECKOUT exercise type, its v1 ruleset and
-- one system exercise template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/random-checkout.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration is the 40-170 range; the draw seed is
-- minted per run by the server and never seeded. Duration is the
-- routine step's.
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
		'0199a000-0000-7000-8000-00000000000b',
		'RANDOM_CHECKOUT',
		'Random Checkout',
		'Check out a random score in one visit, over and over until the time runs out, X01 double-out.',
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
		'0199a100-0000-7000-8000-00000000000a',
		'0199a000-0000-7000-8000-00000000000b',
		'RANDOM_CHECKOUT_V1',
		1,
		'Initial random checkout ruleset: one visit per attempt from a seed-drawn score in 40-170; checkout rate.',
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
		'0199b000-0000-7000-8000-000000000011',
		'0199a000-0000-7000-8000-00000000000b',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'RANDOM_CHECKOUT_V1'
		),
		NULL,
		'Random Checkout',
		'A random score from 40 to 170, one visit to check it out. Then the next.',
		'{"minStart":40,"maxStart":170}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
