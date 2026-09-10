-- ============================================================
-- Migration: 0031_session_exercise_type_not_null.sql
--
-- Purpose:
-- Promote exercise_sessions.exercise_type_id to NOT NULL now
-- that database/seeds/0014_exercise_types.sql has backfilled
-- every existing row to GAME.
--
-- PREREQUISITE: seeds/0014 MUST have been applied first. Seeds
-- run after migrations in the standard flow, which is why this
-- is separated from 0029 — the same three-step shape migrations
-- 0019/0020 use. Applying this against a database with an
-- unbackfilled row will fail on constraint validation.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_sessions ALTER COLUMN exercise_type_id SET NOT NULL;

-- migrate:down
ALTER TABLE exercise_sessions ALTER COLUMN exercise_type_id DROP NOT NULL;
