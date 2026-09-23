-- database/seeds/0024_switching_target_scoring_exercise_type.sql
--
-- ============================================================
-- Seed: 0024_switching_target_scoring_exercise_type.sql
--
-- Purpose:
-- Insert the SWITCHING_TARGET_SCORING exercise type, its v1 ruleset and
-- one system exercise template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/switching-target-scoring.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- Scoring is locked in the engine, so the default
-- configuration carries the target sequence alone.
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
		'0199a000-0000-7000-8000-000000000006',
		'SWITCHING_TARGET_SCORING',
		'Switching Target Scoring',
		'Builds a chain across a three-target sequence; a hit switches, a miss restarts.',
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
		'0199a100-0000-7000-8000-000000000005',
		'0199a000-0000-7000-8000-000000000006',
		'SWITCHING_TARGET_SCORING_V1',
		1,
		'Initial switching target scoring ruleset: three targets in order; Target Scoring points.',
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
		'0199b000-0000-7000-8000-000000000008',
		'0199a000-0000-7000-8000-000000000006',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'SWITCHING_TARGET_SCORING_V1'
		),
		NULL,
		'Switching Target Scoring',
		'How high a chain can you build switching 20, 19, 18?',
		'{"targets":[20,19,18]}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
