-- ============================================================
-- Migration: 0020_session_capability_fk.sql
--
-- Purpose:
-- Make an undeclared capture/input mode combination physically
-- unstorable: exercise_sessions gains a composite foreign key
-- to ruleset_version_capabilities.
--
-- PREREQUISITE: database/seeds/0007_ruleset_version_
-- capabilities.sql MUST have been applied first. Seeds run
-- after migrations in the standard flow, so this migration is
-- deliberately separated from 0019 (which creates the table)
-- and the apply order for this change is:
--
--   db:migrate (through 0019) -> db:seed -> db:migrate (0020)
--
-- Applying this against a populated database whose sessions
-- use a combination not present in the capability table will
-- fail on constraint validation.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_sessions
ADD CONSTRAINT fk_sessions_capability FOREIGN KEY (
        ruleset_version_id,
        capture_mode_id,
        input_mode_id
    ) REFERENCES ruleset_version_capabilities (
        ruleset_version_id,
        capture_mode_id,
        input_mode_id
    ) ON DELETE RESTRICT;

-- migrate:down
ALTER TABLE exercise_sessions DROP CONSTRAINT IF EXISTS fk_sessions_capability;
