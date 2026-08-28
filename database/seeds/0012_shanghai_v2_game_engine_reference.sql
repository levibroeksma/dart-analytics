-- ============================================================
-- Seed: 0012_shanghai_v2_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Shanghai V2: the same round-by-round
-- target mechanics as Shanghai V1 (rounds 1-20, full board,
-- Shanghai instant win), plus one added setting — Target Needed
-- (difficulty: NORMAL default, or HARD, which halves a seat's
-- running total, round-half-up, on any round with zero target
-- hits). No new game_types row: SHANGHAI_V2 is a new
-- ruleset_versions row under the same SHANGHAI game type 0008
-- already seeded. Without this seed there is no ruleset version
-- to start a SHANGHAI_V2 session from — POST /api/sessions has
-- nothing to look up for SHANGHAI_V2.
--
-- No new configuration_templates row: SHANGHAI_V2's setup
-- controller (app/src/lib/game/shanghai-setup.data.ts) reuses
-- 0008's existing "Shanghai — Standard" preset (configuration
-- {}) as its templateRef and always supplies `difficulty` via
-- its own configOverrides — session.service.ts's createSession
-- merges template.configuration with overrides and validates
-- the MERGED result ({"difficulty": "NORMAL"|"HARD"}) against
-- ShanghaiV2Config, so the empty base preset is sufficient. A
-- second preset row would only risk configuration-templates?
-- gameType=SHANGHAI returning two rows with no way for the
-- generic createPresetSetupController's presets[0] pick to
-- prefer the right one (unlike 121_V2, which disambiguates its
-- own several presets by a duration_type field the picker
-- filters on).
--
-- UUID allocation (continues the 0003 range, next after 0011's
-- 121_V2 row):
-- - 0198f100-...-000011 ruleset_versions (SHANGHAI_V2)
--
-- No game_type_features mapping: no opponent toggle to
-- configure, mirroring 0008's SHANGHAI_V1 reasoning. Round
-- range and Shanghai instant-win stay fixed, mirroring V1.
--
-- No exercise_templates row: nothing outside 0008's own
-- configuration_templates preset currently reads
-- exercise_templates at runtime.
--
-- Capability: SHANGHAI_V2 + RECREATIONAL + DETAILED_DARTS and
-- SHANGHAI_V2 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007
-- is the single running ledger every ruleset's capability rows
-- are appended to. verification/0012_shanghai_v2_capability_
-- checks.sql asserts the resulting rows.
-- ============================================================
BEGIN;
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
        '0198f100-0000-7000-8000-000000000011',
        '0198f000-0000-7000-8000-000000000007',
        'SHANGHAI_V2',
        2,
        'Shanghai V2: adds a Target Needed difficulty toggle (NORMAL default, HARD) alongside V1''s unchanged round range, scoring and instant-win rules. HARD halves the running total, round-half-up, on any round with zero target hits.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
