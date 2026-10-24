-- ============================================================
-- Seed: 0051_tactics_v2_ruleset.sql
--
-- Purpose:
-- Seed reference data for Tactics V2: two-seat play — points on owned
-- numbers, dead numbers and a win by closing out level or ahead — see
-- app/src/modules/game/tactics.engine.module.ts. No new game_types row:
-- TACTICS_V2 is a new ruleset_versions row under the TACTICS game type
-- 0034 already seeded.
--
-- No new configuration_templates row: V2 has no config fields, so the
-- setup controller reuses 0034's preset as its templateRef.
--
-- UUID allocation (highest in use 000020):
-- - 0198f100-...-000021 ruleset_versions (TACTICS_V2)
--
-- Capability: TACTICS_V2 + RECREATIONAL + DETAILED_DARTS and
-- TACTICS_V2 + ANALYTICS + VISUAL_BOARD are declared in
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
        '0198f100-0000-7000-8000-000000000021',
        '0198f000-0000-7000-8000-00000000000b',
        'TACTICS_V2',
        2,
        'Tactics V2: 1v1 — points on owned numbers, dead numbers, and a win by closing out level or ahead; solo plays as V1.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
