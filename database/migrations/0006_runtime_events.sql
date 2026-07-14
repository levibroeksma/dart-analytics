-- ============================================================
-- Migration: 0006_runtime_events.sql
--
-- Purpose:
-- Store gameplay events.
--
-- These tables form the analytical foundation.
--
-- ============================================================

-- migrate:up
-- ============================================================
-- turns
--
-- Represents one visit to the oche.
--
-- Example:
--
-- Dart 1
-- Dart 2
-- Dart 3
--
-- ============================================================
CREATE TABLE turns (
    id UUID PRIMARY KEY,
    exercise_stage_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    sequence_number INTEGER NOT NULL,
    total_score INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_turn_stage FOREIGN KEY(exercise_stage_id) REFERENCES exercise_stages(id) ON DELETE CASCADE,
    CONSTRAINT fk_turn_participant FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE RESTRICT
);
-- ============================================================
-- darts
--
-- Atomic dart event.
--
-- One row = one thrown dart.
--
-- ============================================================
CREATE TABLE darts (
    id UUID PRIMARY KEY,
    turn_id UUID NOT NULL,
    dart_number SMALLINT NOT NULL,
    intended_target_number SMALLINT,
    intended_zone_id SMALLINT,
    hit_target_number SMALLINT,
    hit_zone_id SMALLINT,
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_darts_turn FOREIGN KEY(turn_id) REFERENCES turns(id) ON DELETE CASCADE,
    CONSTRAINT fk_darts_intended_zone FOREIGN KEY(intended_zone_id) REFERENCES dart_zones(id) ON DELETE RESTRICT,
    CONSTRAINT fk_darts_hit_zone FOREIGN KEY(hit_zone_id) REFERENCES dart_zones(id) ON DELETE RESTRICT,
    CONSTRAINT chk_dart_number CHECK (dart_number > 0),
    CONSTRAINT chk_intended_target CHECK (
        intended_target_number IS NULL
        OR intended_target_number BETWEEN 1 AND 25
    ),
    CONSTRAINT chk_hit_target CHECK (
        hit_target_number IS NULL
        OR hit_target_number BETWEEN 1 AND 25
    )
);

-- migrate:down
DROP TABLE IF EXISTS darts;
DROP TABLE IF EXISTS turns;
