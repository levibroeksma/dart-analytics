-- ============================================================
-- Migration: 0041_training_schedules.sql
--
-- Purpose:
-- Named, swappable weekly schedules: one routine (or rest) per
-- ISO weekday, at most one active schedule per player
-- (spec 2026-09-18-weekly-training-schedules-design.md; D321).
--
-- Template-layer: mutable, owned, never referenced by runtime
-- tables. Rest is the absence of a row, not a NULL routine — one
-- representation. day_of_week is a SMALLINT with a CHECK, a
-- deliberate exception to Pattern 12 (lookup tables): the ISO
-- weekday is a universal constant with nothing to name or grow.
-- The routine FK is RESTRICT so deleting a scheduled routine
-- fails loudly; the service maps it (a silent SET NULL would turn
-- a training day into rest unnoticed). "One active per player" is
-- a partial unique index, no pointer column on players.
-- ============================================================

-- migrate:up
CREATE TABLE training_schedules (
    id          UUID PRIMARY KEY,
    player_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_training_schedules_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT chk_training_schedules_name_not_empty CHECK (length(trim(name)) > 0)
);
COMMENT ON TABLE training_schedules IS 'A player''s named weekly schedule; at most one is active (uq_training_schedules_player_active).';

CREATE UNIQUE INDEX uq_training_schedules_player_active
    ON training_schedules (player_id) WHERE is_active;

CREATE TABLE training_schedule_days (
    id                    UUID PRIMARY KEY,
    training_schedule_id  UUID NOT NULL,
    day_of_week           SMALLINT NOT NULL,
    routine_template_id   UUID NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_training_schedule_days_training_schedule FOREIGN KEY (training_schedule_id) REFERENCES training_schedules(id) ON DELETE CASCADE,
    CONSTRAINT fk_training_schedule_days_routine_template  FOREIGN KEY (routine_template_id)  REFERENCES routine_templates(id)  ON DELETE RESTRICT,
    CONSTRAINT chk_training_schedule_days_day_of_week CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT uq_training_schedule_days_training_schedule_day_of_week UNIQUE (training_schedule_id, day_of_week)
);
COMMENT ON TABLE training_schedule_days IS 'One routine per ISO weekday (1 = Monday … 7 = Sunday) in a schedule; a missing weekday is a rest day.';
COMMENT ON COLUMN training_schedule_days.day_of_week IS 'ISO weekday, 1 = Monday … 7 = Sunday. SMALLINT with CHECK rather than a lookup table (deliberate Pattern 12 exception).';

CREATE INDEX idx_training_schedule_days_routine_template ON training_schedule_days (routine_template_id);

CREATE VIEW v_training_schedules AS
SELECT ts.id AS schedule_id,
    ts.player_id,
    ts.name,
    ts.is_active,
    ts.updated_at,
    (SELECT count(*) FROM training_schedule_days d WHERE d.training_schedule_id = ts.id) AS day_count
FROM training_schedules ts;
COMMENT ON VIEW v_training_schedules IS 'One row per schedule with its day count; filter by player_id.';

CREATE VIEW v_training_schedule_days AS
SELECT ts.id AS schedule_id,
    ts.player_id,
    ts.name AS schedule_name,
    ts.is_active,
    d.day_of_week,
    rt.id   AS routine_template_id,
    rt.name AS routine_name,
    COALESCE((
        SELECT sum(rs.duration_value)
        FROM routine_steps rs JOIN duration_types dt ON dt.id = rs.duration_type_id
        WHERE rs.routine_template_id = rt.id AND dt.implementation_key = 'MINUTES'
    ), 0)::int AS routine_minutes
FROM training_schedule_days d
    JOIN training_schedules ts ON ts.id = d.training_schedule_id
    JOIN routine_templates rt  ON rt.id = d.routine_template_id;
COMMENT ON VIEW v_training_schedule_days IS 'One row per (schedule, weekday) with the routine''s name and MINUTES total; filter by player_id.';

-- migrate:down
DROP VIEW IF EXISTS v_training_schedule_days;
DROP VIEW IF EXISTS v_training_schedules;
DROP TABLE IF EXISTS training_schedule_days;
DROP TABLE IF EXISTS training_schedules;
