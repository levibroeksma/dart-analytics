-- ============================================================
-- Seed: 0053_shanghai_v3_ruleset.sql
--
-- Purpose:
-- Seed reference data for Shanghai V3: V2's rules plus a selectable
-- round range (rangeStart..rangeEnd within 1-20) and an instant-win
-- switch (Score-only turns the Shanghai win off) — see
-- app/src/modules/game/shanghai.engine.module.ts. No new game_types
-- row: SHANGHAI_V3 is a new ruleset_versions row under the SHANGHAI
-- game type 0008 already seeded.
--
-- No new configuration_templates row: the setup controller reuses
-- 0008's {} preset and always supplies difficulty, range_start,
-- range_end and instant_win through its configOverrides, as V2 does.
--
-- UUID allocation (highest in use 000022):
-- - 0198f100-...-000023 ruleset_versions (SHANGHAI_V3)
--
-- Capability: SHANGHAI_V3 + RECREATIONAL + DETAILED_DARTS and
-- SHANGHAI_V3 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here;
-- verification/0007_capability_seed_checks.sql asserts the rows.
-- ============================================================
BEGIN;
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000023',
        '0198f000-0000-7000-8000-000000000007',
        'SHANGHAI_V3',
        3,
        'Shanghai V3: adds a round range (presets 1-7, 1-10, 1-20, 11-20, 13-20) and a Score-only switch that turns the instant win off, alongside V2''s Target Needed difficulty.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
