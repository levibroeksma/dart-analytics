-- database/seeds/0016_switching_double_pattern_exercise_types.sql
--
-- ============================================================
-- Seed: 0016_switching_double_pattern_exercise_types.sql
--
-- Purpose:
-- Insert the SWITCHING and DOUBLE_PATTERN exercise types and
-- their v1 rulesets (09-training-routines.md 3.4, design spec
-- 2026-09-11 5.2/5.3). Catalog rows only — the Balanced Training
-- routine that uses them is seeded separately in
-- 0017_balanced_training_routine.sql, mirroring the 0014/0015
-- split for WARM_UP.
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
		'0199a000-0000-7000-8000-000000000003',
		'SWITCHING',
		'Switching',
		'Cycles a fixed target list dart by dart, scored by zone.',
		TRUE,
		now(),
		now()
	),
	(
		'0199a000-0000-7000-8000-000000000004',
		'DOUBLE_PATTERN',
		'Double Pattern',
		'Cycles a fixed list of double-number patterns; each hit double scores.',
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
		'0199a100-0000-7000-8000-000000000002',
		'0199a000-0000-7000-8000-000000000003',
		'SWITCHING_V1',
		1,
		'Initial switching ruleset: fixed target list, zone scoring.',
		now()
	),
	(
		'0199a100-0000-7000-8000-000000000003',
		'0199a000-0000-7000-8000-000000000004',
		'DOUBLE_PATTERN_V1',
		1,
		'Initial double-pattern ruleset: fixed double patterns, hit scoring.',
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
