-- ============================================================
-- Seed: 0055_mickey_mouse_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Mickey Mouse v1: one seat closes twelve
-- categories (20 down to 12, Doubles, Triples, Bull) in as few
-- darts as possible; a double or treble on 12-20 also marks its
-- ring category (the double-dip); no points. Without this seed
-- there is no game type, ruleset version, or preset to start a
-- session from — POST /api/sessions has nothing to look up for
-- MICKEY_MOUSE_V1.
--
-- UUID allocation (continues the 0003 range, next after 0054's
-- Killer rows):
-- - 0198f000-...-00000000000e game_types              (MICKEY_MOUSE)
-- - 0198f100-...-000000000025 ruleset_versions        (MICKEY_MOUSE_V1)
-- - 0198f300-...-00000000001c configuration_templates (Mickey Mouse)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — MickeyMouseConfig is an
-- empty strict object, so the preset carries `{}`.
--
-- No game_type_features mapping: v1 has no duration or opponent
-- toggle, as 0041 Baseball.
--
-- Capability: MICKEY_MOUSE_V1 + RECREATIONAL + DETAILED_DARTS and
-- MICKEY_MOUSE_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, the running ledger.
-- verification/0055_mickey_mouse_capability_checks.sql asserts them.
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
        '0198f000-0000-7000-8000-00000000000e',
        'MICKEY_MOUSE',
        'Mickey Mouse',
        'Close 20 down to 12, Doubles, Triples and the bull in as few darts as possible. A double or treble on 12-20 also marks its ring category; no points.',
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
        '0198f100-0000-7000-8000-000000000025',
        '0198f000-0000-7000-8000-00000000000e',
        'MICKEY_MOUSE_V1',
        1,
        'Initial Mickey Mouse ruleset: one seat, twelve categories, three marks each, double-dip, no points; the run ends when all twelve are closed.',
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
        '0198f300-0000-7000-8000-00000000001c',
        '0198f000-0000-7000-8000-00000000000e',
        NULL,
        'Mickey Mouse',
        'Twelve categories, double-dip, no points, solo.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
