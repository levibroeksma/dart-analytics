-- database/seeds/0025_score_threshold_exercise_type.sql
--
-- ============================================================
-- Seed: 0025_score_threshold_exercise_type.sql
--
-- Purpose:
-- Insert the SCORE_THRESHOLD exercise type, its v1 ruleset and
-- one system exercise template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/score-threshold.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration carries the threshold, which V1
-- locks to 65; the type is named for the rule, not the number.
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
		'0199a000-0000-7000-8000-000000000007',
		'SCORE_THRESHOLD',
		'Score Threshold',
		'Three darts, free aim: count the visits that reach the threshold before time runs out.',
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
		'0199a100-0000-7000-8000-000000000006',
		'0199a000-0000-7000-8000-000000000007',
		'SCORE_THRESHOLD_V1',
		1,
		'Initial score threshold ruleset: a visit beats at a board total of 65 or more.',
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
		'0199b000-0000-7000-8000-000000000009',
		'0199a000-0000-7000-8000-000000000007',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'SCORE_THRESHOLD_V1'
		),
		NULL,
		'65 or More',
		'Score 65 or more with three darts. How many times before the time runs out?',
		'{"threshold":65}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
