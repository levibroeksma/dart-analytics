-- ============================================================
-- Seed: 0050_bobs27_v2_ruleset.sql
--
-- Purpose:
-- Seed reference data for Bob's 27 V2: Easy, the same run as
-- Traditional where the score may go negative and no seat is
-- eliminated — see app/src/modules/game/bobs27.engine.module.ts.
-- No new game_types row: BOBS27_V2 is a new ruleset_versions row
-- under the BOBS27 game type 0003 already seeded.
--
-- No new configuration_templates row: the setup controller reuses
-- 0003's V1 preset as its templateRef and supplies mode via
-- configOverrides, as 0027 and 0049 established.
--
-- UUID allocation (highest in use 000019):
-- - 0198f100-...-000020 ruleset_versions (BOBS27_V2)
--
-- Capability: BOBS27_V2 + RECREATIONAL + DETAILED_DARTS and
-- BOBS27_V2 + ANALYTICS + VISUAL_BOARD are declared in
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
        '0198f100-0000-7000-8000-000000000020',
        '0198f000-0000-7000-8000-000000000005',
        'BOBS27_V2',
        2,
        'Bob''s 27 V2: Easy — the Traditional run with no death; the score may go negative and the run ends after the bull visit.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
