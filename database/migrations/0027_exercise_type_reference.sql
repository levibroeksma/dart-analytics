-- ============================================================
-- Migration: 0027_exercise_type_reference.sql
--
-- Purpose:
-- Introduce the exercise-type catalog and its ruleset versions.
--
-- An exercise type identifies the kind of exercise being run
-- (09-training-routines.md 3.4) and selects the ExerciseEngine
-- and exercise ruleset responsible for it. GAME is one exercise
-- type among many, not a layer above them.
--
-- UUID primary keys, not SMALLINT: this is a growing catalog,
-- structurally identical to game_types. Each new exercise type
-- ships with its own ruleset, engine and configuration schema.
--
-- exercise_ruleset_versions is a separate table rather than a
-- discriminator on ruleset_versions because a game-backed
-- exercise (section 11) holds an exercise ruleset and a game
-- ruleset simultaneously, and one column cannot carry both.
--
-- Seeded by database/seeds/0014_exercise_types.sql.
-- ============================================================

-- migrate:up
CREATE TABLE exercise_types (
    id UUID PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_exercise_types_implementation_key UNIQUE (implementation_key)
);

COMMENT ON TABLE exercise_types IS 'Kinds of exercise an ExerciseEngine can execute.';

CREATE TABLE exercise_ruleset_versions (
    id UUID PRIMARY KEY,
    exercise_type_id UUID NOT NULL,
    implementation_key TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_exercise_ruleset_versions_implementation_key UNIQUE (implementation_key),
    CONSTRAINT fk_exercise_ruleset_versions_type FOREIGN KEY (exercise_type_id) REFERENCES exercise_types(id) ON DELETE RESTRICT
);

COMMENT ON TABLE exercise_ruleset_versions IS 'Versioned behaviour definitions for exercise types.';

-- migrate:down
DROP TABLE IF EXISTS exercise_ruleset_versions;
DROP TABLE IF EXISTS exercise_types;
