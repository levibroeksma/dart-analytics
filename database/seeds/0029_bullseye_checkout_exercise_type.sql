-- database/seeds/0029_bullseye_checkout_exercise_type.sql
--
-- ============================================================
-- Seed: 0029_bullseye_checkout_exercise_type.sql
--
-- Purpose:
-- Insert the BULLSEYE_CHECKOUT exercise type, its v1 ruleset and
-- one system exercise template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/bullseye-checkout.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration carries the start score, which V1
-- locks to 81.
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
		'0199a000-0000-7000-8000-000000000008',
		'BULLSEYE_CHECKOUT',
		'Bullseye Checkout',
		'Every visit starts at the start score: set up 50 with two darts, finish on the bullseye with the third.',
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
		'0199a100-0000-7000-8000-000000000007',
		'0199a000-0000-7000-8000-000000000008',
		'BULLSEYE_CHECKOUT_V1',
		1,
		'Initial bullseye checkout ruleset: a 31 setup on darts 1-2 and the inner bull on dart 3 checks out 81.',
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
		'0199b000-0000-7000-8000-00000000000e',
		'0199a000-0000-7000-8000-000000000008',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'BULLSEYE_CHECKOUT_V1'
		),
		NULL,
		'Bullseye Checkouts',
		'Check out 81 in three darts, the last on the bullseye. How many before the time runs out?',
		'{"startScore":81}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
