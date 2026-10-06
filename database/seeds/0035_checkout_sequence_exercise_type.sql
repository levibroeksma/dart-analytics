-- database/seeds/0035_checkout_sequence_exercise_type.sql
--
-- ============================================================
-- Seed: 0035_checkout_sequence_exercise_type.sql
--
-- Purpose:
-- Insert the CHECKOUT_SEQUENCE exercise type, its v1 ruleset and
-- one system exercise template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/catch-40.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration is the Catch 40 range (61-100) and
-- six-dart limit; duration is the routine step's.
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
		'0199a000-0000-7000-8000-00000000000a',
		'CHECKOUT_SEQUENCE',
		'Checkout Sequence',
		'Check out a run of outshots in order, each within a dart limit, X01 double-out.',
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
		'0199a100-0000-7000-8000-000000000009',
		'0199a000-0000-7000-8000-00000000000a',
		'CHECKOUT_SEQUENCE_V1',
		1,
		'Initial checkout sequence ruleset: outshots 61-100, six darts each; 3/2/1 points by darts used.',
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
		'0199b000-0000-7000-8000-000000000010',
		'0199a000-0000-7000-8000-00000000000a',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'CHECKOUT_SEQUENCE_V1'
		),
		NULL,
		'Catch 40',
		'Check out 61, then 62, up to 100 - six darts each. Fewer darts, more points.',
		'{"firstOutshot":61,"lastOutshot":100,"dartLimit":6}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
