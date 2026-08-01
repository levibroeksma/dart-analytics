-- ============================================================
-- Seed: 0004_score_training_minutes_preset.sql
--
-- Purpose:
-- Align the already-seeded Score Training minutes preset to the
-- 5-minute product default.
--
-- 0002 inserts that row with ON CONFLICT (id) DO NOTHING, so any
-- database seeded before this change keeps duration_value 15 and
-- re-running 0002 will not correct it.
--
-- Idempotency deviates from the Seed Checklist's ON CONFLICT DO
-- NOTHING shape: a single-row UPDATE targeted by primary key is
-- idempotent by construction, and there is no row to insert.
-- ============================================================
BEGIN;
UPDATE configuration_templates
SET
    name = 'Score Training — 5 Minutes',
    description = 'Five minutes of scoring practice.',
    configuration = '{
        "duration_type": "MINUTES",
        "duration_value": 5,
        "max_darts_per_turn": 3
    }'::jsonb,
    updated_at = now()
WHERE id = '0198f300-0000-7000-8000-000000000008';
COMMIT;
