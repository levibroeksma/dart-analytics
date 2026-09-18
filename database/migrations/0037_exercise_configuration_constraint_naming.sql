-- ============================================================
-- Migration: 0037_exercise_configuration_constraint_naming.sql
--
-- Purpose:
-- Rename exercise_configurations' two constraints onto the
-- uq_<table>_<column> convention the rest of the chain uses.
--
-- exercise_configurations (0005) named its constraints
-- uq_exercise_configuration_session / fk_exercise_configuration_session:
-- singular table noun, shortened column. Its mirror table one
-- layer up, activity_configurations (0030), uses
-- uq_activity_configurations_activity, as do exercise_types and
-- exercise_ruleset_versions (0027). Two tables that mirror each
-- other column-for-column carried two naming conventions
-- (issue #295).
--
-- RENAME CONSTRAINT is metadata-only: no table rewrite, no row
-- is read or written, and nothing in app/src queries either name
-- (the only reference is drizzle's generated schema.ts, which
-- db:introspect regenerates). Fully reversible.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_configurations
    RENAME CONSTRAINT uq_exercise_configuration_session
    TO uq_exercise_configurations_exercise_session;

ALTER TABLE exercise_configurations
    RENAME CONSTRAINT fk_exercise_configuration_session
    TO fk_exercise_configurations_exercise_session;

-- migrate:down
ALTER TABLE exercise_configurations
    RENAME CONSTRAINT uq_exercise_configurations_exercise_session
    TO uq_exercise_configuration_session;

ALTER TABLE exercise_configurations
    RENAME CONSTRAINT fk_exercise_configurations_exercise_session
    TO fk_exercise_configuration_session;
