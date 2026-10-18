-- database/seeds/0038_hit_count_exercise_type.sql
--
-- ============================================================
-- Seed: 0038_hit_count_exercise_type.sql
--
-- Purpose:
-- Insert the HIT_COUNT exercise type, its v1 ruleset and the
-- Big Trebles system template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/hit-count.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration is Big Trebles: nine darts each at
-- T20, T19, T18 and T17. Duration is the routine step's.
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
		'0199a000-0000-7000-8000-00000000000c',
		'HIT_COUNT',
		'Hit Count',
		'A set number of darts at each target in a list, counting only the named bed; the list repeats until the time runs out.',
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
		'0199a100-0000-7000-8000-00000000000b',
		'0199a000-0000-7000-8000-00000000000c',
		'HIT_COUNT_V1',
		1,
		'Initial hit count ruleset: fixed darts per target, a multiple of three; one point per hit in the named bed; passes repeat until time.',
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
		'0199b000-0000-7000-8000-000000000012',
		'0199a000-0000-7000-8000-00000000000c',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'HIT_COUNT_V1'
		),
		NULL,
		'Big Trebles',
		'Nine darts each at T20, T19, T18 and T17. Count the trebles.',
		'{"targets":[{"kind":"TREBLE","number":20},{"kind":"TREBLE","number":19},{"kind":"TREBLE","number":18},{"kind":"TREBLE","number":17}],"dartsPerTarget":9}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
