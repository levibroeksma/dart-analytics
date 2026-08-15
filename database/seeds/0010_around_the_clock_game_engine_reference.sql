-- ============================================================
-- Seed: 0010_around_the_clock_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Around the Clock v1: a fixed 21-target
-- path (1..20, then BULL) walked with mid-visit advancement.
-- Without this seed there is no game type, ruleset version, or
-- preset to start a session from — POST /api/sessions has
-- nothing to look up for AROUND_THE_CLOCK_V1.
--
-- UUID allocation (continues the 0003 range, next after 0009's
-- 121 row):
-- - 0198f000-...-000009 game_types              (AROUND_THE_CLOCK)
-- - 0198f100-...-000009 ruleset_versions        (AROUND_THE_CLOCK_V1)
-- - 0198f300-...-000013 configuration_templates (AROUND_THE_CLOCK)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — AroundTheClockConfig is
-- a genuinely empty `.strict()` object: v1 locks every rule
-- (path, any-segment advance, mid-visit advancement, BULL ends
-- the session) with nothing left to configure, so its one
-- preset's configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only, and
-- there is no duration_type/duration_value or opponent toggle to
-- configure, mirroring 0008's Shanghai and 0009's 121 reasoning.
--
-- No exercise_templates row: nothing outside this file's own
-- configuration_templates preset currently reads exercise_
-- templates at runtime.
--
-- Capability: AROUND_THE_CLOCK_V1 + RECREATIONAL + DETAILED_DARTS
-- is declared in seeds/0007_ruleset_version_capabilities.sql, not
-- here — 0007 is the single running ledger every ruleset's
-- capability rows are appended to.
-- verification/0010_around_the_clock_capability_checks.sql
-- asserts the resulting row.
-- ============================================================
BEGIN;
-- ============================================================
-- Game type
-- ============================================================
INSERT INTO game_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0198f000-0000-7000-8000-000000000009',
        'AROUND_THE_CLOCK',
        'Around the Clock',
        'Hit every number 1 through 20 in order, then the bull, to finish. A hit advances the target immediately, mid-visit — a great turn can clear several numbers in three darts.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Ruleset version
-- ============================================================
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000009',
        '0198f000-0000-7000-8000-000000000009',
        'AROUND_THE_CLOCK_V1',
        1,
        'Initial Around the Clock ruleset: path 1-20 then BULL, any segment (single/double/treble) advances immediately, BULL (outer or inner) ends the session.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration preset
-- ============================================================
INSERT INTO configuration_templates (
        id,
        game_type_id,
        player_id,
        name,
        description,
        configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f300-0000-7000-8000-000000000013',
        '0198f000-0000-7000-8000-000000000009',
        NULL,
        'Around the Clock — Standard',
        'Full board, 1 through 20 then BULL, any segment advances.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
