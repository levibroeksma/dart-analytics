-- ============================================================
-- Migration: 0038_custom_routines.sql
--
-- Purpose:
-- Make player-authored routines representable and bounded
-- (D305, D306, D321; 09-Training/01-Routines.md §7, §20).
--
-- 1. chk_routine_templates_player_ownership: a system routine has
--    no owner and a user routine always has one. Stricter than
--    chk_configuration_templates_system_ownership on purpose — a
--    user routine with no owner is a row nobody can list, edit or
--    delete.
-- 2. The 30–60 minute bound for user routines is a cross-row
--    aggregate, which no CHECK can express, so it is the chain's
--    first constraint trigger: deferred to commit so the builder's
--    update → delete steps → insert steps is checked once. Only
--    MINUTES steps count (ROUNDS have no wall-clock length,
--    matching routine-duration.module.ts). System routines are
--    exempt: the seeded 5-minute Warm-Up stays valid. A second
--    trigger on routine_templates catches a user routine created
--    with no steps at all, which the steps trigger would never see.
--    Raised with ERRCODE check_violation and the trigger's name as
--    CONSTRAINT so the service can map it to VALIDATION_FAILED.
-- 3. v_routine_execution recreated (0036 shape) with player_id,
--    routine_description and exercise_description, so the list and
--    detail reads stay view-backed and owner-aware.
-- 4. v_exercise_template_catalog: what the builder's picker reads.
--
-- Never edits 0004/0011/0036.
-- ============================================================

-- migrate:up
ALTER TABLE routine_templates
    ADD CONSTRAINT chk_routine_templates_player_ownership CHECK (
        (is_system_template AND player_id IS NULL)
        OR (NOT is_system_template AND player_id IS NOT NULL)
    );

CREATE FUNCTION fn_routine_templates_duration_bounds() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_routine_template_ids UUID[];
    v_routine_template_id UUID;
    v_is_system BOOLEAN;
    v_total INTEGER;
BEGIN
    -- NEW is unassigned on DELETE and OLD is unassigned on INSERT: reading the
    -- wrong one raises 42804 before COALESCE could ever pick the other, so the
    -- row to read is chosen by TG_OP, never guessed. A step moved between
    -- routines leaves both parents to re-check.
    IF TG_TABLE_NAME = 'routine_steps' THEN
        IF TG_OP = 'DELETE' THEN
            v_routine_template_ids := ARRAY[OLD.routine_template_id];
        ELSIF TG_OP = 'UPDATE'
            AND NEW.routine_template_id IS DISTINCT FROM OLD.routine_template_id THEN
            v_routine_template_ids := ARRAY[NEW.routine_template_id, OLD.routine_template_id];
        ELSE
            v_routine_template_ids := ARRAY[NEW.routine_template_id];
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_routine_template_ids := ARRAY[OLD.id];
    ELSE
        v_routine_template_ids := ARRAY[NEW.id];
    END IF;

    FOREACH v_routine_template_id IN ARRAY v_routine_template_ids LOOP
        -- No parent row means the routine was deleted in this same transaction
        -- and its steps cascaded: there is nothing left to bound.
        SELECT is_system_template INTO v_is_system
        FROM routine_templates
        WHERE id = v_routine_template_id;
        CONTINUE WHEN NOT FOUND OR v_is_system;

        SELECT COALESCE(SUM(rs.duration_value), 0) INTO v_total
        FROM routine_steps rs
            JOIN duration_types dt ON dt.id = rs.duration_type_id
        WHERE rs.routine_template_id = v_routine_template_id
            AND dt.implementation_key = 'MINUTES';

        IF v_total < 30 OR v_total > 60 THEN
            RAISE EXCEPTION 'user routine % is % minutes; the bound is 30-60', v_routine_template_id, v_total
                USING ERRCODE = 'check_violation',
                      CONSTRAINT = 'trg_routine_templates_duration_bounds',
                      TABLE = 'routine_templates';
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_routine_steps_duration_bounds
    AFTER INSERT OR UPDATE OR DELETE ON routine_steps
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_routine_templates_duration_bounds();

CREATE CONSTRAINT TRIGGER trg_routine_templates_duration_bounds
    AFTER INSERT OR UPDATE OF is_system_template ON routine_templates
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_routine_templates_duration_bounds();

COMMENT ON FUNCTION fn_routine_templates_duration_bounds() IS 'Deferred bound for user routines: the sum of MINUTES steps must be 30-60 (D305). System routines are exempt. Raises check_violation with CONSTRAINT trg_routine_templates_duration_bounds.';

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rt.is_system_template,
    rt.player_id,
    rt.description AS routine_description,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    et.description AS exercise_description,
    ext.implementation_key AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key AS game_type_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    et.default_configuration,
    rs.configuration AS step_configuration
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext    ON ext.id = et.exercise_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = et.exercise_ruleset_version_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition, carrying everything a step resolves from plus the routine''s owner (player_id, NULL for a system routine) and both descriptions (0038). game_type_key and exercise_ruleset_version_key are NULL for a non-game and a game step respectively.';

CREATE VIEW v_exercise_template_catalog AS
SELECT et.id AS exercise_template_id,
    et.name,
    et.description,
    ext.implementation_key AS exercise_type_key,
    gt.implementation_key  AS game_type_key,
    et.default_configuration IS NOT NULL AS has_default_configuration
FROM exercise_templates et
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
    LEFT JOIN game_types gt ON gt.id = et.game_type_id
WHERE et.is_system_template
    AND ext.is_published;
COMMENT ON VIEW v_exercise_template_catalog IS 'System exercise templates a player may compose a routine from. has_default_configuration = FALSE marks a template the service must not offer: its step would resolve to an empty configuration.';

-- migrate:down
DROP VIEW IF EXISTS v_exercise_template_catalog;

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rt.is_system_template,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    ext.implementation_key AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key AS game_type_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    et.default_configuration,
    rs.configuration AS step_configuration
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext    ON ext.id = et.exercise_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = et.exercise_ruleset_version_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition, carrying everything a step resolves from: its exercise type, the exercise ruleset version its template pins (0035), the template default configuration and the step override. game_type_key and exercise_ruleset_version_key are NULL for a non-game and a game step respectively.';

DROP TRIGGER IF EXISTS trg_routine_templates_duration_bounds ON routine_templates;
DROP TRIGGER IF EXISTS trg_routine_steps_duration_bounds ON routine_steps;
DROP FUNCTION IF EXISTS fn_routine_templates_duration_bounds();

ALTER TABLE routine_templates
    DROP CONSTRAINT IF EXISTS chk_routine_templates_player_ownership;
