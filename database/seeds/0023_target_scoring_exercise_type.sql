-- database/seeds/0023_target_scoring_exercise_type.sql
--
-- ============================================================
-- Seed: 0023_target_scoring_exercise_type.sql
--
-- Purpose:
-- Insert the TARGET_SCORING exercise type, its v1 ruleset and
-- one system exercise template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/target-scoring.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- Scoring is locked in the engine, so the default
-- configuration carries the target list alone.
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
		'0199a000-0000-7000-8000-000000000005',
		'TARGET_SCORING',
		'Target Scoring',
		'Builds a chain of hits on one target; a miss resets it and moves on.',
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
		'0199a100-0000-7000-8000-000000000004',
		'0199a000-0000-7000-8000-000000000005',
		'TARGET_SCORING_V1',
		1,
		'Initial target scoring ruleset: single 1, treble 3, double a miss; outer bull 1, bullseye 3.',
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
		'0199b000-0000-7000-8000-000000000007',
		'0199a000-0000-7000-8000-000000000005',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'TARGET_SCORING_V1'
		),
		NULL,
		'Target Scoring',
		'How high a chain can you build on 20, 19, 18 and the bull?',
		'{"targets":[20,19,18,25]}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
